import * as satellite from 'satellite.js';

export interface TLEData {
  noradId: number;
  name: string;
  line1: string;
  line2: string;
}

export interface SatellitePosition {
  noradId: number;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number; // km
  velocity: number; // km/s
  inSunlight: boolean;
  timestamp: string;
}

// Cache for satellite records to avoid re-parsing TLEs
const satrecCache = new Map<number, satellite.SatRec>();

// Parse TLE and get satrec (with caching)
function getSatrec(tle: TLEData): satellite.SatRec | null {
  const cached = satrecCache.get(tle.noradId);
  if (cached) return cached;

  try {
    const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
    if (satrec && satrec.error === 0) {
      satrecCache.set(tle.noradId, satrec);
      return satrec;
    }
  } catch (error) {
    console.error(`Error parsing TLE for ${tle.noradId}:`, error);
  }
  return null;
}

// Clear the cache (call when new TLEs are fetched)
export function clearSatrecCache(): void {
  satrecCache.clear();
}

// Check if satellite is in sunlight using simplified algorithm
function isInSunlight(positionEci: satellite.EciVec3<number>, gmst: number, date: Date): boolean {
  // Get day of year for sun position calculation
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const meanAnomaly = (2 * Math.PI / 365.25) * (dayOfYear - 2);

  // Approximate sun declination
  const obliquity = 23.44 * Math.PI / 180;
  const sunDeclination = Math.asin(Math.sin(obliquity) * Math.sin(meanAnomaly + Math.PI / 2));

  // Sun distance (1 AU in km)
  const sunDistance = 149597870.7;

  // Approximate sun right ascension
  const sunRA = gmst + Math.PI;

  // Sun position in ECI (simplified)
  const sunX = sunDistance * Math.cos(sunDeclination) * Math.cos(sunRA);
  const sunY = sunDistance * Math.cos(sunDeclination) * Math.sin(sunRA);
  const sunZ = sunDistance * Math.sin(sunDeclination);

  // Earth radius
  const earthRadius = 6371;

  // Vector from satellite to sun
  const satToSunX = sunX - positionEci.x;
  const satToSunY = sunY - positionEci.y;
  const satToSunZ = sunZ - positionEci.z;

  // Distance from satellite to sun
  const satToSunDist = Math.sqrt(satToSunX * satToSunX + satToSunY * satToSunY + satToSunZ * satToSunZ);

  // Normalize direction to sun
  const dirX = satToSunX / satToSunDist;
  const dirY = satToSunY / satToSunDist;
  const dirZ = satToSunZ / satToSunDist;

  // Project satellite position onto sun direction
  const projection = -(positionEci.x * dirX + positionEci.y * dirY + positionEci.z * dirZ);

  // If projection is negative, satellite is on the sun side of Earth
  if (projection < 0) {
    return true;
  }

  // Check if satellite is in Earth's shadow cylinder
  const perpX = positionEci.x + projection * dirX;
  const perpY = positionEci.y + projection * dirY;
  const perpZ = positionEci.z + projection * dirZ;
  const perpDist = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);

  return perpDist > earthRadius;
}

// Propagate satellite position at current time
export function propagatePosition(tle: TLEData, date?: Date): SatellitePosition | null {
  const satrec = getSatrec(tle);
  if (!satrec) return null;

  const now = date || new Date();

  try {
    const positionAndVelocity = satellite.propagate(satrec, now);

    if (!positionAndVelocity || !positionAndVelocity.position || typeof positionAndVelocity.position === 'boolean') {
      return null;
    }

    const positionEci = positionAndVelocity.position as satellite.EciVec3<number>;
    const velocityEci = positionAndVelocity.velocity as satellite.EciVec3<number>;

    const gmst = satellite.gstime(now);
    const positionGd = satellite.eciToGeodetic(positionEci, gmst);

    const latitude = satellite.degreesLat(positionGd.latitude);
    const longitude = satellite.degreesLong(positionGd.longitude);
    const altitude = positionGd.height;

    const velocity = Math.sqrt(
      velocityEci.x * velocityEci.x +
      velocityEci.y * velocityEci.y +
      velocityEci.z * velocityEci.z
    );

    const inSunlight = isInSunlight(positionEci, gmst, now);

    return {
      noradId: tle.noradId,
      name: tle.name,
      latitude,
      longitude,
      altitude,
      velocity,
      inSunlight,
      timestamp: now.toISOString(),
    };
  } catch (error) {
    console.error(`Error propagating ${tle.noradId}:`, error);
    return null;
  }
}

// Propagate multiple satellites
export function propagateAllPositions(tles: TLEData[], date?: Date): Map<number, SatellitePosition> {
  const positions = new Map<number, SatellitePosition>();

  for (const tle of tles) {
    const position = propagatePosition(tle, date);
    if (position) {
      positions.set(tle.noradId, position);
    }
  }

  return positions;
}

// Format latitude/longitude for display
export function formatCoordinate(value: number, isLatitude: boolean): string {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const min = ((abs - deg) * 60).toFixed(2);
  const dir = isLatitude
    ? (value >= 0 ? 'N' : 'S')
    : (value >= 0 ? 'E' : 'W');
  return `${deg}°${min}'${dir}`;
}

// Format altitude for display
export function formatAltitude(km: number): string {
  if (km >= 35000) {
    return `${(km / 1000).toFixed(0)}K km`; // GEO-style formatting
  }
  return `${km.toFixed(0)} km`;
}

// Get orbit type from altitude
export function getOrbitTypeFromAltitude(altitudeKm: number): 'LEO' | 'MEO' | 'GEO' | 'HEO' {
  if (altitudeKm < 2000) return 'LEO';
  if (altitudeKm >= 35000 && altitudeKm <= 36000) return 'GEO';
  if (altitudeKm > 36000) return 'HEO';
  return 'MEO';
}
