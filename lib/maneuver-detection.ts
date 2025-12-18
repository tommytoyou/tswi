import {
  GPData,
  TLEHistoryData,
  ManeuverEvent,
  ManeuverType,
  calculateSMA,
  calculatePeriod,
} from './space-track-types';

// ============================================================================
// CONSTANTS
// ============================================================================

// Earth's gravitational parameter (km³/s²)
const MU_EARTH = 398600.4418;

// Earth's radius (km)
const EARTH_RADIUS = 6371;

// Maneuver detection thresholds
const THRESHOLDS = {
  // Semi-major axis change threshold (km)
  SMA_CHANGE_KM: 0.5,

  // Inclination change threshold (degrees)
  INCLINATION_CHANGE_DEG: 0.01,

  // Eccentricity change threshold
  ECCENTRICITY_CHANGE: 0.0001,

  // Period change threshold (minutes)
  PERIOD_CHANGE_MIN: 0.1,

  // Minimum time between TLEs to consider (hours)
  MIN_TLE_GAP_HOURS: 4,

  // Maximum time between TLEs to consider for single maneuver (hours)
  MAX_TLE_GAP_HOURS: 48,
};

// Classification thresholds for maneuver types
const MANEUVER_CLASSIFICATION = {
  // Large SMA change indicates orbit raise/lower
  LARGE_SMA_CHANGE_KM: 5,

  // Small SMA change could be station keeping
  SMALL_SMA_CHANGE_KM: 2,

  // Plane change threshold (degrees)
  PLANE_CHANGE_DEG: 0.05,

  // Period change for phasing maneuver (minutes)
  PHASING_PERIOD_CHANGE_MIN: 0.5,
};

// ============================================================================
// ORBITAL MECHANICS HELPERS
// ============================================================================

/**
 * Calculate orbital velocity at a given altitude (circular orbit approximation)
 * @param altitude km above Earth's surface
 * @returns velocity in km/s
 */
function calculateOrbitalVelocity(altitude: number): number {
  const r = EARTH_RADIUS + altitude;
  return Math.sqrt(MU_EARTH / r);
}

/**
 * Estimate delta-v for a Hohmann transfer between two circular orbits
 * @param sma1 Semi-major axis of initial orbit (km)
 * @param sma2 Semi-major axis of final orbit (km)
 * @returns Delta-v in m/s
 */
function estimateHohmannDeltaV(sma1: number, sma2: number): number {
  // Vis-viva equation for velocities
  const v1 = Math.sqrt(MU_EARTH / sma1);
  const v2 = Math.sqrt(MU_EARTH / sma2);

  // Transfer orbit semi-major axis
  const aTransfer = (sma1 + sma2) / 2;

  // Velocities at periapsis and apoapsis of transfer orbit
  const vTransferPeriapsis = Math.sqrt(MU_EARTH * (2 / sma1 - 1 / aTransfer));
  const vTransferApoapsis = Math.sqrt(MU_EARTH * (2 / sma2 - 1 / aTransfer));

  // Two burns
  const dv1 = Math.abs(vTransferPeriapsis - v1);
  const dv2 = Math.abs(v2 - vTransferApoapsis);

  // Return total delta-v in m/s
  return (dv1 + dv2) * 1000;
}

/**
 * Estimate delta-v for a plane change
 * @param velocity Orbital velocity (km/s)
 * @param inclinationChange Change in inclination (degrees)
 * @returns Delta-v in m/s
 */
function estimatePlaneChangeDeltaV(velocity: number, inclinationChange: number): number {
  const incRad = (inclinationChange * Math.PI) / 180;
  // Simple plane change: dv = 2 * v * sin(theta/2)
  return 2 * velocity * Math.sin(incRad / 2) * 1000;
}

// ============================================================================
// TLE PROCESSING
// ============================================================================

interface ProcessedTLE {
  epoch: Date;
  epochStr: string;
  meanMotion: number;
  eccentricity: number;
  inclination: number;
  raan: number;
  argPerigee: number;
  meanAnomaly: number;
  bstar: number;
  sma: number; // Calculated semi-major axis (km)
  period: number; // Calculated period (minutes)
  apoapsis: number; // km above Earth
  periapsis: number; // km above Earth
}

/**
 * Process raw TLE data into standardized format with calculated values
 */
function processTLE(tle: GPData | TLEHistoryData): ProcessedTLE {
  const sma = tle.SEMIMAJOR_AXIS ?? calculateSMA(tle.MEAN_MOTION);
  const period = tle.PERIOD ?? calculatePeriod(tle.MEAN_MOTION);

  // Calculate apoapsis and periapsis
  const apoapsis = tle.APOAPSIS ?? (sma * (1 + tle.ECCENTRICITY) - EARTH_RADIUS);
  const periapsis = tle.PERIAPSIS ?? (sma * (1 - tle.ECCENTRICITY) - EARTH_RADIUS);

  return {
    epoch: new Date(tle.EPOCH),
    epochStr: tle.EPOCH,
    meanMotion: tle.MEAN_MOTION,
    eccentricity: tle.ECCENTRICITY,
    inclination: tle.INCLINATION,
    raan: tle.RA_OF_ASC_NODE,
    argPerigee: tle.ARG_OF_PERICENTER,
    meanAnomaly: tle.MEAN_ANOMALY,
    bstar: tle.BSTAR,
    sma,
    period,
    apoapsis,
    periapsis,
  };
}

// ============================================================================
// MANEUVER DETECTION
// ============================================================================

/**
 * Classify the type of maneuver based on orbital element changes
 */
function classifyManeuverType(
  smaChange: number,
  incChange: number,
  eccChange: number,
  periodChange: number
): ManeuverType {
  const absSmaChange = Math.abs(smaChange);
  const absIncChange = Math.abs(incChange);

  // Check for plane change first (more expensive, likely intentional)
  if (absIncChange > MANEUVER_CLASSIFICATION.PLANE_CHANGE_DEG) {
    return 'PLANE_CHANGE';
  }

  // Check for orbit raise/lower
  if (absSmaChange > MANEUVER_CLASSIFICATION.LARGE_SMA_CHANGE_KM) {
    return smaChange > 0 ? 'ORBIT_RAISE' : 'ORBIT_LOWER';
  }

  // Check for phasing maneuver (period change without large SMA change)
  if (
    Math.abs(periodChange) > MANEUVER_CLASSIFICATION.PHASING_PERIOD_CHANGE_MIN &&
    absSmaChange < MANEUVER_CLASSIFICATION.SMALL_SMA_CHANGE_KM
  ) {
    return 'PHASING';
  }

  // Small adjustments are likely station keeping
  if (absSmaChange < MANEUVER_CLASSIFICATION.SMALL_SMA_CHANGE_KM) {
    return 'STATION_KEEPING';
  }

  // Could be rendezvous if we had additional context
  return 'UNKNOWN';
}

/**
 * Calculate confidence score based on the magnitude of changes and TLE quality
 */
function calculateConfidence(
  smaChange: number,
  incChange: number,
  eccChange: number,
  tleGapHours: number
): number {
  let confidence = 0.5;

  // Higher confidence for larger changes (less likely to be noise)
  if (Math.abs(smaChange) > 2) confidence += 0.15;
  if (Math.abs(smaChange) > 5) confidence += 0.1;
  if (Math.abs(incChange) > 0.02) confidence += 0.15;

  // Lower confidence for very long TLE gaps (more uncertainty)
  if (tleGapHours > 24) confidence -= 0.1;
  if (tleGapHours > 36) confidence -= 0.1;

  // Higher confidence for shorter gaps with clear changes
  if (tleGapHours < 12 && Math.abs(smaChange) > 1) confidence += 0.1;

  return Math.max(0.1, Math.min(0.95, confidence));
}

/**
 * Main maneuver detection function
 * Analyzes TLE history to detect orbital maneuvers
 *
 * @param tleHistory Array of TLE records sorted by epoch (oldest first)
 * @param objectName Name of the object (optional)
 * @param noradId NORAD catalog ID
 * @returns Array of detected maneuver events
 */
export function detectManeuvers(
  tleHistory: (GPData | TLEHistoryData)[],
  objectName?: string,
  noradId?: number
): ManeuverEvent[] {
  if (tleHistory.length < 2) {
    return [];
  }

  // Process TLEs
  const processedTLEs = tleHistory
    .map(processTLE)
    .sort((a, b) => a.epoch.getTime() - b.epoch.getTime());

  const maneuvers: ManeuverEvent[] = [];

  // Compare consecutive TLEs
  for (let i = 1; i < processedTLEs.length; i++) {
    const before = processedTLEs[i - 1];
    const after = processedTLEs[i];

    // Calculate time gap
    const gapMs = after.epoch.getTime() - before.epoch.getTime();
    const gapHours = gapMs / (1000 * 60 * 60);

    // Skip if TLEs are too close together or too far apart
    if (gapHours < THRESHOLDS.MIN_TLE_GAP_HOURS || gapHours > THRESHOLDS.MAX_TLE_GAP_HOURS) {
      continue;
    }

    // Calculate changes
    const smaChange = after.sma - before.sma;
    const incChange = after.inclination - before.inclination;
    const eccChange = after.eccentricity - before.eccentricity;
    const periodChange = after.period - before.period;
    const apoapsisChange = after.apoapsis - before.apoapsis;
    const periapsisChange = after.periapsis - before.periapsis;

    // Check if changes exceed thresholds
    const hasSmaChange = Math.abs(smaChange) > THRESHOLDS.SMA_CHANGE_KM;
    const hasIncChange = Math.abs(incChange) > THRESHOLDS.INCLINATION_CHANGE_DEG;
    const hasEccChange = Math.abs(eccChange) > THRESHOLDS.ECCENTRICITY_CHANGE;

    if (!hasSmaChange && !hasIncChange && !hasEccChange) {
      continue;
    }

    // Classify maneuver type
    const maneuverType = classifyManeuverType(smaChange, incChange, eccChange, periodChange);

    // Estimate delta-v
    let deltaV: number | undefined;
    const avgAltitude = (before.apoapsis + before.periapsis + after.apoapsis + after.periapsis) / 4;
    const avgVelocity = calculateOrbitalVelocity(avgAltitude);

    if (hasSmaChange && !hasIncChange) {
      deltaV = estimateHohmannDeltaV(before.sma, after.sma);
    } else if (hasIncChange) {
      deltaV = estimatePlaneChangeDeltaV(avgVelocity, Math.abs(incChange));
    }

    // Calculate confidence
    const confidence = calculateConfidence(smaChange, incChange, eccChange, gapHours);

    // Get NORAD ID from the TLE data
    const detectedNoradId = noradId ||
      ('NORAD_CAT_ID' in tleHistory[0] ? (tleHistory[0] as GPData).NORAD_CAT_ID : 0);

    // Get object name
    const detectedName = objectName ||
      ('OBJECT_NAME' in tleHistory[0] ? (tleHistory[0] as GPData).OBJECT_NAME : 'Unknown');

    // Create maneuver event
    const maneuver: ManeuverEvent = {
      norad_id: detectedNoradId,
      object_name: detectedName,
      detected_at: new Date().toISOString(),
      epoch_before: before.epochStr,
      epoch_after: after.epochStr,
      maneuver_type: maneuverType,
      delta_v_estimate_ms: deltaV ? Math.round(deltaV * 100) / 100 : undefined,
      sma_change_km: Math.round(smaChange * 1000) / 1000,
      inclination_change_deg: Math.round(incChange * 10000) / 10000,
      eccentricity_change: Math.round(eccChange * 1000000) / 1000000,
      period_change_min: Math.round(periodChange * 1000) / 1000,
      apoapsis_change_km: Math.round(apoapsisChange * 1000) / 1000,
      periapsis_change_km: Math.round(periapsisChange * 1000) / 1000,
      confidence,
      notes: generateManeuverNotes(maneuverType, smaChange, incChange, deltaV),
    };

    maneuvers.push(maneuver);
  }

  return maneuvers;
}

/**
 * Generate human-readable notes for a maneuver
 */
function generateManeuverNotes(
  type: ManeuverType,
  smaChange: number,
  incChange: number,
  deltaV?: number
): string {
  const parts: string[] = [];

  switch (type) {
    case 'ORBIT_RAISE':
      parts.push(`Orbit raised by ${Math.abs(smaChange).toFixed(2)} km`);
      break;
    case 'ORBIT_LOWER':
      parts.push(`Orbit lowered by ${Math.abs(smaChange).toFixed(2)} km`);
      break;
    case 'PLANE_CHANGE':
      parts.push(`Plane change of ${Math.abs(incChange).toFixed(4)}°`);
      break;
    case 'STATION_KEEPING':
      parts.push('Station keeping maneuver detected');
      break;
    case 'PHASING':
      parts.push('Phasing maneuver detected');
      break;
    case 'RENDEZVOUS':
      parts.push('Possible rendezvous maneuver');
      break;
    default:
      parts.push('Orbital change detected');
  }

  if (deltaV !== undefined) {
    parts.push(`Estimated Δv: ${deltaV.toFixed(1)} m/s`);
  }

  return parts.join('. ');
}

/**
 * Filter maneuvers by minimum confidence
 */
export function filterByConfidence(maneuvers: ManeuverEvent[], minConfidence: number = 0.5): ManeuverEvent[] {
  return maneuvers.filter(m => m.confidence >= minConfidence);
}

/**
 * Get recent maneuvers from the last N days
 */
export function getRecentManeuvers(maneuvers: ManeuverEvent[], days: number = 7): ManeuverEvent[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return maneuvers.filter(m => new Date(m.epoch_after) >= cutoff);
}

/**
 * Sort maneuvers by date (most recent first)
 */
export function sortManeuversByDate(maneuvers: ManeuverEvent[]): ManeuverEvent[] {
  return [...maneuvers].sort(
    (a, b) => new Date(b.epoch_after).getTime() - new Date(a.epoch_after).getTime()
  );
}
