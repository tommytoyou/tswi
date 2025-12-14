import { NextResponse } from 'next/server';
import * as satellite from 'satellite.js';

// NORAD IDs for threat catalog satellites
const THREAT_NORAD_IDS = [
  47852, // COSMOS 2542
  45916, // COSMOS 2543
  49944, // COSMOS 2558
  40258, // Luch (Olymp-K)
  43432, // Luch (Olymp-K2)
  49502, // SJ-21
  52939, // SJ-23
  41838, // SJ-17
  41628, // Aolong-1
];

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

// Parse TLE text into structured data
function parseTLEs(tleText: string): TLEData[] {
  const lines = tleText.trim().split('\n');
  const tles: TLEData[] = [];

  for (let i = 0; i < lines.length; i += 3) {
    if (i + 2 >= lines.length) break;

    const name = lines[i].trim();
    const line1 = lines[i + 1].trim();
    const line2 = lines[i + 2].trim();

    // Extract NORAD ID from line 1 (positions 3-7)
    const noradId = parseInt(line1.substring(2, 7).trim(), 10);

    if (noradId && line1.startsWith('1 ') && line2.startsWith('2 ')) {
      tles.push({ noradId, name, line1, line2 });
    }
  }

  return tles;
}

// Check if satellite is in sunlight using simplified algorithm
function isInSunlight(positionEci: satellite.EciVec3<number>, gmst: number, date: Date): boolean {
  // Get sun position (simplified - using approximate solar position)
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const meanAnomaly = (2 * Math.PI / 365.25) * (dayOfYear - 2);

  // Approximate sun declination
  const obliquity = 23.44 * Math.PI / 180; // Earth's axial tilt
  const sunDeclination = Math.asin(Math.sin(obliquity) * Math.sin(meanAnomaly + Math.PI / 2));

  // Sun distance (1 AU in km)
  const sunDistance = 149597870.7;

  // Approximate sun right ascension (very simplified)
  const sunRA = gmst + Math.PI; // Sun is roughly opposite to midnight

  // Sun position in ECI (simplified)
  const sunX = sunDistance * Math.cos(sunDeclination) * Math.cos(sunRA);
  const sunY = sunDistance * Math.cos(sunDeclination) * Math.sin(sunRA);
  const sunZ = sunDistance * Math.sin(sunDeclination);

  // Earth radius
  const earthRadius = 6371; // km

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
  const satDist = Math.sqrt(positionEci.x * positionEci.x + positionEci.y * positionEci.y + positionEci.z * positionEci.z);
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

  // Simple shadow cylinder check (no penumbra)
  return perpDist > earthRadius;
}

// Propagate satellite position using SGP4
function propagatePosition(tle: TLEData): SatellitePosition | null {
  try {
    const satrec = satellite.twoline2satrec(tle.line1, tle.line2);

    if (!satrec || satrec.error !== 0) {
      console.error(`SGP4 initialization error for ${tle.noradId}:`, satrec?.error);
      return null;
    }

    const now = new Date();
    const positionAndVelocity = satellite.propagate(satrec, now);

    if (!positionAndVelocity || !positionAndVelocity.position || typeof positionAndVelocity.position === 'boolean') {
      console.error(`Propagation failed for ${tle.noradId}`);
      return null;
    }

    const positionEci = positionAndVelocity.position as satellite.EciVec3<number>;
    const velocityEci = positionAndVelocity.velocity as satellite.EciVec3<number>;

    // Calculate GMST for coordinate conversion
    const gmst = satellite.gstime(now);

    // Convert ECI to geodetic coordinates
    const positionGd = satellite.eciToGeodetic(positionEci, gmst);

    // Convert to degrees and km
    const latitude = satellite.degreesLat(positionGd.latitude);
    const longitude = satellite.degreesLong(positionGd.longitude);
    const altitude = positionGd.height; // Already in km

    // Calculate velocity magnitude
    const velocity = Math.sqrt(
      velocityEci.x * velocityEci.x +
      velocityEci.y * velocityEci.y +
      velocityEci.z * velocityEci.z
    );

    // Check sunlight status
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedIds = searchParams.get('ids');

  // Use requested IDs or default to threat catalog
  const noradIds = requestedIds
    ? requestedIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
    : THREAT_NORAD_IDS;

  try {
    // Fetch TLEs from Celestrak for each NORAD ID
    const tlePromises = noradIds.map(async (noradId) => {
      try {
        const response = await fetch(
          `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=TLE`,
          {
            headers: {
              'User-Agent': 'TSWI-SpaceWeather/1.0',
            },
            next: { revalidate: 3600 }, // Cache for 1 hour
          }
        );

        if (!response.ok) {
          console.warn(`Failed to fetch TLE for ${noradId}: ${response.status}`);
          return null;
        }

        const tleText = await response.text();
        return tleText.trim();
      } catch (error) {
        console.error(`Error fetching TLE for ${noradId}:`, error);
        return null;
      }
    });

    const tleTexts = await Promise.all(tlePromises);

    // Combine all TLE texts
    const combinedTLE = tleTexts.filter(t => t).join('\n');

    if (!combinedTLE) {
      return NextResponse.json(
        { error: 'No TLE data available' },
        { status: 503 }
      );
    }

    // Parse TLEs
    const tles = parseTLEs(combinedTLE);

    // Propagate positions for all satellites
    const positions: SatellitePosition[] = [];
    const rawTLEs: TLEData[] = [];

    for (const tle of tles) {
      const position = propagatePosition(tle);
      if (position) {
        positions.push(position);
        rawTLEs.push(tle);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: positions.length,
      positions,
      tles: rawTLEs, // Include raw TLEs for client-side propagation
    });

  } catch (error) {
    console.error('Celestrak API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orbital data' },
      { status: 500 }
    );
  }
}
