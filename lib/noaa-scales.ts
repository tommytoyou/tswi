/**
 * NOAA Space Weather Scale calculations (R/S/G)
 * Shared between the RSG Scales card and the Threat Posture strip.
 */

// Calculate R-Scale from X-ray flux (W/m²)
export function calculateRScale(flux: number): number {
  if (flux >= 2e-3) return 5;  // X20+
  if (flux >= 1e-3) return 4;  // X10-X19
  if (flux >= 1e-4) return 3;  // X1-X9
  if (flux >= 5e-5) return 2;  // M5-M9
  if (flux >= 1e-5) return 1;  // M1-M4
  return 0;                     // Below M-class
}

// Calculate S-Scale from >10 MeV proton flux (pfu)
export function calculateSScale(pfu: number): number {
  if (pfu >= 100000) return 5;
  if (pfu >= 10000) return 4;
  if (pfu >= 1000) return 3;
  if (pfu >= 100) return 2;
  if (pfu >= 10) return 1;
  return 0;
}

// Calculate G-Scale from Kp index
export function calculateGScale(kp: number): number {
  if (kp >= 9) return 5;
  if (kp >= 8) return 4;
  if (kp >= 7) return 3;
  if (kp >= 6) return 2;
  if (kp >= 5) return 1;
  return 0;
}

// Map a 0-5 scale level to a 4-tier threat band, matching getScaleColor's
// thresholds: 0 → NOMINAL, 1-2 → ELEVATED, 3 → HIGH, 4-5 → SEVERE.
export function scaleLevelToTier(level: number): 0 | 1 | 2 | 3 {
  if (level === 0) return 0;
  if (level === 1 || level === 2) return 1;
  if (level === 3) return 2;
  return 3;
}
