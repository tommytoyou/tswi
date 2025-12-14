import { z } from 'zod';

// ============================================================================
// SPACE-TRACK GP (GENERAL PERTURBATIONS) DATA
// Two-Line Element Sets with orbital parameters
// ============================================================================

export const GPDataSchema = z.object({
  CCSDS_OMM_VERS: z.string().optional(),
  COMMENT: z.string().optional(),
  CREATION_DATE: z.string().optional(),
  ORIGINATOR: z.string().optional(),
  OBJECT_NAME: z.string(),
  OBJECT_ID: z.string(),
  CENTER_NAME: z.string().optional(),
  REF_FRAME: z.string().optional(),
  TIME_SYSTEM: z.string().optional(),
  MEAN_ELEMENT_THEORY: z.string().optional(),
  EPOCH: z.string(),
  MEAN_MOTION: z.number(),
  ECCENTRICITY: z.number(),
  INCLINATION: z.number(),
  RA_OF_ASC_NODE: z.number(),
  ARG_OF_PERICENTER: z.number(),
  MEAN_ANOMALY: z.number(),
  EPHEMERIS_TYPE: z.number().optional(),
  CLASSIFICATION_TYPE: z.string().optional(),
  NORAD_CAT_ID: z.number(),
  ELEMENT_SET_NO: z.number().optional(),
  REV_AT_EPOCH: z.number().optional(),
  BSTAR: z.number(),
  MEAN_MOTION_DOT: z.number().optional(),
  MEAN_MOTION_DDOT: z.number().optional(),
  SEMIMAJOR_AXIS: z.number().optional(),
  PERIOD: z.number().optional(),
  APOAPSIS: z.number().optional(),
  PERIAPSIS: z.number().optional(),
  OBJECT_TYPE: z.string().optional(),
  RCS_SIZE: z.string().optional(),
  COUNTRY_CODE: z.string().optional(),
  LAUNCH_DATE: z.string().optional(),
  SITE: z.string().optional(),
  DECAY_DATE: z.string().nullable().optional(),
  FILE: z.number().optional(),
  GP_ID: z.number().optional(),
  TLE_LINE0: z.string().optional(),
  TLE_LINE1: z.string().optional(),
  TLE_LINE2: z.string().optional(),
});
export type GPData = z.infer<typeof GPDataSchema>;

// ============================================================================
// CONJUNCTION DATA MESSAGE (CDM)
// Close approach information between space objects
// ============================================================================

export const CDMDataSchema = z.object({
  CDM_ID: z.number(),
  CREATED: z.string(),
  EMERGENCY_REPORTABLE: z.string().optional(),
  TCA: z.string(), // Time of Closest Approach
  MIN_RNG: z.number(), // Minimum range in km
  PC: z.number(), // Probability of collision
  SAT_1_ID: z.number(),
  SAT_1_NAME: z.string(),
  SAT1_OBJECT_TYPE: z.string().optional(),
  SAT1_RCS: z.string().optional(),
  SAT_1_EXCL_VOL: z.string().optional(),
  SAT_2_ID: z.number(),
  SAT_2_NAME: z.string(),
  SAT2_OBJECT_TYPE: z.string().optional(),
  SAT2_RCS: z.string().optional(),
  SAT_2_EXCL_VOL: z.string().optional(),
});
export type CDMData = z.infer<typeof CDMDataSchema>;

// ============================================================================
// DECAY/REENTRY DATA
// Predicted reentry information for decaying objects
// ============================================================================

export const DecayDataSchema = z.object({
  NORAD_CAT_ID: z.number(),
  OBJECT_NUMBER: z.number().optional(),
  OBJECT_NAME: z.string(),
  INTLDES: z.string().optional(),
  OBJECT_ID: z.string().optional(),
  RCS: z.number().optional(),
  RCS_SIZE: z.string().optional(),
  COUNTRY: z.string().optional(),
  MSG_EPOCH: z.string(),
  DECAY_EPOCH: z.string(),
  SOURCE: z.string().optional(),
  MSG_TYPE: z.string().optional(),
  PRECEDENCE: z.number().optional(),
});
export type DecayData = z.infer<typeof DecayDataSchema>;

// ============================================================================
// BOXSCORE DATA
// Catalog statistics by country/organization
// ============================================================================

export const BoxscoreDataSchema = z.object({
  COUNTRY: z.string(),
  SPADOC_CD: z.string().optional(),
  ORBITAL_TBA: z.number().optional(),
  ORBITAL_PAYLOAD_COUNT: z.number(),
  ORBITAL_ROCKET_BODY_COUNT: z.number(),
  ORBITAL_DEBRIS_COUNT: z.number(),
  ORBITAL_TOTAL_COUNT: z.number(),
  DECAYED_PAYLOAD_COUNT: z.number().optional(),
  DECAYED_ROCKET_BODY_COUNT: z.number().optional(),
  DECAYED_DEBRIS_COUNT: z.number().optional(),
  DECAYED_TOTAL_COUNT: z.number().optional(),
  COUNTRY_TOTAL: z.number().optional(),
});
export type BoxscoreData = z.infer<typeof BoxscoreDataSchema>;

// ============================================================================
// LAUNCH DATA
// Recent launch information
// ============================================================================

export const LaunchDataSchema = z.object({
  LAUNCH_ID: z.string(),
  LAUNCH_DATE: z.string(),
  LAUNCH_NUM: z.string().optional(),
  LAUNCH_PIECE: z.string().optional(),
  LAUNCH_SITE: z.string().optional(),
  LAUNCH_YEAR: z.number().optional(),
  OBJECT_NAME: z.string().optional(),
  OBJECT_ID: z.string().optional(),
  OBJECT_NUMBER: z.number().optional(),
});
export type LaunchData = z.infer<typeof LaunchDataSchema>;

// ============================================================================
// TLE HISTORY DATA
// Historical TLE records for tracking orbital changes
// ============================================================================

export const TLEHistoryDataSchema = z.object({
  NORAD_CAT_ID: z.number(),
  OBJECT_NAME: z.string().optional(),
  EPOCH: z.string(),
  MEAN_MOTION: z.number(),
  ECCENTRICITY: z.number(),
  INCLINATION: z.number(),
  RA_OF_ASC_NODE: z.number(),
  ARG_OF_PERICENTER: z.number(),
  MEAN_ANOMALY: z.number(),
  BSTAR: z.number(),
  SEMIMAJOR_AXIS: z.number().optional(),
  PERIOD: z.number().optional(),
  APOAPSIS: z.number().optional(),
  PERIAPSIS: z.number().optional(),
  TLE_LINE1: z.string().optional(),
  TLE_LINE2: z.string().optional(),
});
export type TLEHistoryData = z.infer<typeof TLEHistoryDataSchema>;

// ============================================================================
// MANEUVER EVENT
// Detected orbital maneuver from TLE analysis
// ============================================================================

export const ManeuverTypeSchema = z.enum([
  'STATION_KEEPING',
  'ORBIT_RAISE',
  'ORBIT_LOWER',
  'PLANE_CHANGE',
  'PHASING',
  'RENDEZVOUS',
  'UNKNOWN',
]);
export type ManeuverType = z.infer<typeof ManeuverTypeSchema>;

export const ManeuverEventSchema = z.object({
  norad_id: z.number(),
  object_name: z.string(),
  detected_at: z.string(),
  epoch_before: z.string(),
  epoch_after: z.string(),
  maneuver_type: ManeuverTypeSchema,
  delta_v_estimate_ms: z.number().optional(), // Estimated delta-v in m/s
  // Orbital element changes
  sma_change_km: z.number(), // Semi-major axis change
  inclination_change_deg: z.number(),
  eccentricity_change: z.number(),
  period_change_min: z.number().optional(),
  apoapsis_change_km: z.number().optional(),
  periapsis_change_km: z.number().optional(),
  // Context
  confidence: z.number().min(0).max(1),
  notes: z.string().optional(),
});
export type ManeuverEvent = z.infer<typeof ManeuverEventSchema>;

// ============================================================================
// ORBIT CLASSIFICATION
// ============================================================================

export type OrbitRegime =
  | 'LEO'      // Low Earth Orbit (< 2000 km)
  | 'MEO'      // Medium Earth Orbit (2000-35786 km)
  | 'GEO'      // Geostationary Orbit (~35786 km)
  | 'HEO'      // Highly Elliptical Orbit
  | 'SSO'      // Sun-Synchronous Orbit
  | 'POLAR'    // Polar Orbit (inclination > 80°)
  | 'UNKNOWN';

export type ConjunctionRisk =
  | 'CRITICAL' // PC > 1e-3
  | 'HIGH'     // PC > 1e-4
  | 'MEDIUM'   // PC > 1e-5
  | 'LOW'      // PC > 1e-6
  | 'MINIMAL'; // PC <= 1e-6

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Classify orbit based on orbital parameters
 */
export function classifyOrbit(gp: GPData): OrbitRegime {
  const sma = gp.SEMIMAJOR_AXIS;
  const inc = gp.INCLINATION;
  const ecc = gp.ECCENTRICITY;
  const period = gp.PERIOD;

  // Calculate altitude if we have semi-major axis
  const earthRadius = 6371; // km
  const altitude = sma ? sma - earthRadius : undefined;

  // Check for highly elliptical orbit first
  if (ecc > 0.25) {
    return 'HEO';
  }

  // Check for polar orbit
  if (inc > 80 && inc < 100) {
    // Check if it's sun-synchronous (typically 96-99° at LEO altitudes)
    if (inc >= 96 && inc <= 99 && altitude && altitude < 2000) {
      return 'SSO';
    }
    return 'POLAR';
  }

  // Classify by altitude
  if (altitude !== undefined) {
    if (altitude < 2000) {
      return 'LEO';
    } else if (altitude >= 35000 && altitude <= 36500) {
      // Check for near-circular orbit at GEO altitude
      if (ecc < 0.1 && inc < 15) {
        return 'GEO';
      }
    } else if (altitude < 35786) {
      return 'MEO';
    }
  }

  // Use period as fallback (GEO period is ~1436 minutes)
  if (period !== undefined) {
    if (period > 1420 && period < 1450 && ecc < 0.1 && inc < 15) {
      return 'GEO';
    } else if (period < 128) {
      return 'LEO';
    } else if (period < 720) {
      return 'MEO';
    }
  }

  return 'UNKNOWN';
}

/**
 * Classify conjunction risk based on probability of collision
 */
export function classifyConjunctionRisk(pc: number): ConjunctionRisk {
  if (pc > 1e-3) return 'CRITICAL';
  if (pc > 1e-4) return 'HIGH';
  if (pc > 1e-5) return 'MEDIUM';
  if (pc > 1e-6) return 'LOW';
  return 'MINIMAL';
}

/**
 * Calculate semi-major axis from mean motion
 * @param meanMotion revolutions per day
 * @returns semi-major axis in km
 */
export function calculateSMA(meanMotion: number): number {
  const mu = 398600.4418; // Earth's gravitational parameter (km³/s²)
  const n = meanMotion * 2 * Math.PI / 86400; // Convert to rad/s
  return Math.pow(mu / (n * n), 1/3);
}

/**
 * Calculate orbital period from mean motion
 * @param meanMotion revolutions per day
 * @returns period in minutes
 */
export function calculatePeriod(meanMotion: number): number {
  return 1440 / meanMotion; // 1440 minutes per day
}

/**
 * Format NORAD ID with leading zeros
 */
export function formatNoradId(id: number): string {
  return id.toString().padStart(5, '0');
}

// ============================================================================
// WATCH LIST - Objects of interest for maneuver monitoring
// ============================================================================

export const INSPECTOR_SATELLITES = {
  // Chinese inspector satellites
  SJ_21: { norad_id: 49502, name: 'SJ-21', country: 'PRC', description: 'Shijian-21 GEO debris cleanup/RPO demo' },
  SJ_23: { norad_id: 52939, name: 'SJ-23', country: 'PRC', description: 'Shijian-23 follow-on, suspected RPO' },
  SJ_17: { norad_id: 41838, name: 'SJ-17', country: 'PRC', description: 'Shijian-17 GEO inspector with robotic arm' },
  AOLONG_1: { norad_id: 41628, name: 'Aolong-1', country: 'PRC', description: 'Roaming Dragon debris capture demo' },

  // Russian inspector satellites
  COSMOS_2542: { norad_id: 47852, name: 'COSMOS 2542', country: 'RUS', description: 'Nivelir inspector, RPO vs USA 245' },
  COSMOS_2543: { norad_id: 45916, name: 'COSMOS 2543', country: 'RUS', description: 'Sub-satellite of COSMOS 2542' },
  COSMOS_2558: { norad_id: 49944, name: 'COSMOS 2558', country: 'RUS', description: 'Inspector tracking USA 326' },

  // Russian GEO SIGINT/Inspector
  LUCH_OLYMP_1: { norad_id: 40258, name: 'Luch (Olymp-K)', country: 'RUS', description: 'GEO SIGINT/inspector' },
  LUCH_OLYMP_2: { norad_id: 43432, name: 'Luch (Olymp-K2)', country: 'RUS', description: 'GEO SIGINT/inspector' },
} as const;

export const DEFAULT_WATCH_LIST = [
  // Chinese
  49502,  // SJ-21
  52939,  // SJ-23
  41838,  // SJ-17
  41628,  // Aolong-1
  // Russian
  47852,  // COSMOS 2542
  45916,  // COSMOS 2543
  49944,  // COSMOS 2558
  40258,  // Luch/Olymp-1
  43432,  // Luch/Olymp-2
];

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface SpaceTrackResponse<T> {
  success: boolean;
  data: T[];
  count: number;
  source: 'space-track' | 'cache';
  cached_at?: string;
  error?: string;
}
