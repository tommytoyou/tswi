#!/bin/bash

# This script generates all remaining TSWI project files

echo "Generating TSWI project files..."

# Create lib/types.ts (large file - creating via heredoc)
cat > lib/types.ts << 'EOF'
import { z } from 'zod';

// ============================================================================
// TIME SERIES DATA TYPES
// ============================================================================

export const KpDataSchema = z.object({
  ts: z.date(),
  kp: z.number().min(0).max(9),
  meta: z.object({}).optional(),
});
export type KpData = z.infer<typeof KpDataSchema>;

export const DstDataSchema = z.object({
  ts: z.date(),
  dst: z.number(),
  meta: z.object({}).optional(),
});
export type DstData = z.infer<typeof DstDataSchema>;

export const SolarWindPlasmaSchema = z.object({
  ts: z.date(),
  speed_kms: z.number(),
  density_cm3: z.number(),
  temp_k: z.number(),
  meta: z.object({}).optional(),
});
export type SolarWindPlasma = z.infer<typeof SolarWindPlasmaSchema>;

export const SolarWindMagSchema = z.object({
  ts: z.date(),
  bz_nt: z.number(),
  by_nt: z.number(),
  bx_nt: z.number(),
  bt_nt: z.number(),
  meta: z.object({}).optional(),
});
export type SolarWindMag = z.infer<typeof SolarWindMagSchema>;

export const GoesProtonsSchema = z.object({
  ts: z.date(),
  p10_pfu: z.number(),
  p50_pfu: z.number(),
  p100_pfu: z.number(),
  meta: z.object({}).optional(),
});
export type GoesProtons = z.infer<typeof GoesProtonsSchema>;

export const TecRegionalSchema = z.object({
  ts: z.date(),
  region_id: z.enum(['NA-mid', 'EU-high', 'polar-north', 'polar-south']),
  tec_mean: z.number(),
  tec_grad: z.number(),
  meta: z.object({}).optional(),
});
export type TecRegional = z.infer<typeof TecRegionalSchema>;

// ============================================================================
// FORECAST TYPES
// ============================================================================

export const ForecastSchema = z.object({
  ts: z.date(),
  kind: z.enum(['kp', 'dst', 'tec']),
  horizon_min: z.number(),
  value: z.number(),
  p10: z.number(),
  p90: z.number(),
  summary: z.string(),
  evidence: z.array(z.string()),
});
export type Forecast = z.infer<typeof ForecastSchema>;

// ============================================================================
// EVENT TYPES
// ============================================================================

export const EventKindSchema = z.enum([
  'flare_event',
  'cme_watch',
  'sep_event',
  'geomag_storm_watch',
  'tec_spike',
  'solarwind_flag_bz_south',
  'alert_fired',
]);
export type EventKind = z.infer<typeof EventKindSchema>;

export const EventSeveritySchema = z.enum(['low', 'moderate', 'high', 'severe']);
export type EventSeverity = z.infer<typeof EventSeveritySchema>;

export const EventObservedSchema = z.object({
  ts: z.date(),
  kind: EventKindSchema,
  severity: EventSeveritySchema,
  source: z.string(),
  payload: z.record(z.any()),
  evidence_uris: z.array(z.string()),
});
export type EventObserved = z.infer<typeof EventObservedSchema>;

// ============================================================================
// ALERT RULE TYPES
// ============================================================================

export const AlertConditionSchema = z.object({
  bz_lt: z.number().optional(),
  speed_gt: z.number().optional(),
  kp_ge: z.number().optional(),
  dst_le: z.number().optional(),
  proton_gt: z.number().optional(),
  flare_class_ge: z.enum(['C', 'M', 'X']).optional(),
  tec_gradient_gt: z.number().optional(),
  window_min: z.number().optional(),
  region: z.string().optional(),
});
export type AlertCondition = z.infer<typeof AlertConditionSchema>;

export const AlertSchema = z.object({
  _id: z.string().optional(),
  user_id: z.string(),
  name: z.string(),
  conditions: AlertConditionSchema,
  channel: z.enum(['email', 'webhook', 'sms']),
  target: z.string(),
  status: z.enum(['active', 'paused', 'disabled']),
  last_triggered_at: z.date().optional(),
  created_at: z.date(),
  updated_at: z.date(),
});
export type Alert = z.infer<typeof AlertSchema>;

// ============================================================================
// SATELLITE TYPES
// ============================================================================

export const SatelliteSchema = z.object({
  name: z.string(),
  norad_id: z.number(),
  tle_line1: z.string(),
  tle_line2: z.string(),
  color: z.string().optional(),
  enabled: z.boolean().default(true),
});
export type Satellite = z.infer<typeof SatelliteSchema>;

// ============================================================================
// GROUND STATION TYPES
// ============================================================================

export const GroundStationSchema = z.object({
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  network: z.string(),
  enabled: z.boolean().default(true),
});
export type GroundStation = z.infer<typeof GroundStationSchema>;

// ============================================================================
// USER TYPES (Mock Auth)
// ============================================================================

export const UserSchema = z.object({
  _id: z.string(),
  email: z.string().email(),
  name: z.string(),
  plan: z.enum(['free', 'pro', 'enterprise']),
  apiKey: z.string(),
  created_at: z.date(),
});
export type User = z.infer<typeof UserSchema>;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};
EOF

echo "Created lib/types.ts"

