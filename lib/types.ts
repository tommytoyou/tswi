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
// NOAA REAL-TIME DATA TYPES
// ============================================================================

// NOAA Solar Wind Magnetic Field (RTSW MAG 1-minute)
export const NoaaSolarWindMagSchema = z.object({
  ts: z.date(),
  bx_gsm: z.number(),  // X component in GSM coordinates (nT)
  by_gsm: z.number(),  // Y component in GSM coordinates (nT)
  bz_gsm: z.number(),  // Z component in GSM coordinates (nT)
  lon_gsm: z.number(), // Longitude in GSM (degrees)
  lat_gsm: z.number(), // Latitude in GSM (degrees)
  bt: z.number(),      // Total magnetic field (nT)
  meta: z.object({}).optional(),
});
export type NoaaSolarWindMag = z.infer<typeof NoaaSolarWindMagSchema>;

// NOAA Planetary K-Index (1-minute)
export const NoaaKpIndexSchema = z.object({
  ts: z.date(),
  kp: z.number(),           // Planetary K-index (0-9)
  kp_index: z.number(),     // Current Kp value
  a_running: z.number(),    // Running A-index
  station_count: z.number(), // Number of stations reporting
  meta: z.object({}).optional(),
});
export type NoaaKpIndex = z.infer<typeof NoaaKpIndexSchema>;

// NOAA GOES X-Ray Flux (6-hour data)
export const NoaaXrayFluxSchema = z.object({
  ts: z.date(),
  satellite: z.number(),         // GOES satellite number
  flux: z.number(),              // X-ray flux (W/m²)
  observed_flux: z.number(),     // Observed flux value
  electron_correction: z.number(),// Electron correction
  electron_contamination: z.string().optional(), // Contamination flag
  energy: z.string(),            // Energy band (0.05-0.4nm or 0.1-0.8nm)
  meta: z.object({}).optional(),
});
export type NoaaXrayFlux = z.infer<typeof NoaaXrayFluxSchema>;

// NOAA Solar Events (edited events)
export const NoaaSolarEventSchema = z.object({
  event_id: z.string(),
  event_type: z.string(),        // FLA (flare), CME, SEP, etc.
  begin_time: z.date(),
  max_time: z.date().optional(),
  end_time: z.date().optional(),
  source_location: z.string().optional(),
  active_region: z.number().optional(),
  particulars: z.string().optional(),
  class_type: z.string().optional(), // For flares: C, M, X
  intensity: z.number().optional(),   // Flare intensity
  created_at: z.date(),
  meta: z.object({}).optional(),
});
export type NoaaSolarEvent = z.infer<typeof NoaaSolarEventSchema>;

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

// ============================================================================
// AGENTIC AI MONITORING TYPES
// ============================================================================

// Agent Decision Priority Levels
export const AgentPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type AgentPriority = z.infer<typeof AgentPrioritySchema>;

// Agent Decision Record
export const AgentDecisionSchema = z.object({
  _id: z.string().optional(),
  ts: z.date(),
  decision_type: z.enum(['alert_evaluation', 'threshold_adjustment', 'event_classification', 'recommendation']),
  priority: AgentPrioritySchema,
  reasoning: z.string(), // AI-generated reasoning
  confidence: z.number().min(0).max(1), // 0-1 confidence score
  data_snapshot: z.record(z.any()), // Data at decision time
  action_taken: z.string(),
  outcome: z.enum(['pending', 'success', 'false_positive', 'missed_event']).optional(),
  user_feedback: z.string().optional(),
  created_at: z.date(),
});
export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

// Prediction Accuracy Tracking
export const PredictionAccuracySchema = z.object({
  _id: z.string().optional(),
  prediction_ts: z.date(),
  predicted_event: z.string(), // What was predicted
  predicted_value: z.number(),
  predicted_time: z.date(), // When it was predicted to occur
  actual_event: z.string().optional(), // What actually happened
  actual_value: z.number().optional(),
  actual_time: z.date().optional(), // When it actually occurred
  error_magnitude: z.number().optional(), // Absolute error
  error_timing_min: z.number().optional(), // Timing error in minutes
  accuracy_score: z.number().min(0).max(1).optional(), // 0-1 score
  prediction_source: z.string(), // 'surya', 'statistical', 'ensemble'
  created_at: z.date(),
});
export type PredictionAccuracy = z.infer<typeof PredictionAccuracySchema>;

// Alert History with AI Reasoning
export const AlertHistorySchema = z.object({
  _id: z.string().optional(),
  alert_id: z.string(),
  user_id: z.string(),
  triggered_at: z.date(),
  priority: AgentPrioritySchema,
  conditions_met: z.record(z.any()),
  ai_reasoning: z.string(), // Why the agent decided to alert
  ai_confidence: z.number().min(0).max(1),
  data_snapshot: z.record(z.any()),
  notification_sent: z.boolean(),
  notification_channel: z.enum(['email', 'webhook', 'sms', 'websocket']),
  user_acknowledged: z.boolean().default(false),
  acknowledged_at: z.date().optional(),
  false_positive: z.boolean().default(false),
  user_feedback: z.string().optional(),
  created_at: z.date(),
});
export type AlertHistory = z.infer<typeof AlertHistorySchema>;

// Self-Tuning Threshold Configuration
export const AdaptiveThresholdSchema = z.object({
  _id: z.string().optional(),
  parameter: z.string(), // 'kp', 'bz', 'speed', etc.
  current_threshold: z.number(),
  initial_threshold: z.number(),
  adjustment_history: z.array(z.object({
    ts: z.date(),
    old_value: z.number(),
    new_value: z.number(),
    reason: z.string(),
    false_positive_rate: z.number(),
  })),
  false_positive_rate: z.number(), // Current FP rate
  target_false_positive_rate: z.number().default(0.05), // 5% target
  last_adjusted_at: z.date(),
  created_at: z.date(),
});
export type AdaptiveThreshold = z.infer<typeof AdaptiveThresholdSchema>;

// Agent Performance Metrics
export const AgentMetricsSchema = z.object({
  _id: z.string().optional(),
  ts: z.date(),
  period: z.enum(['hourly', 'daily', 'weekly']),
  total_alerts: z.number(),
  critical_alerts: z.number(),
  false_positives: z.number(),
  missed_events: z.number(),
  true_positives: z.number(),
  precision: z.number(), // TP / (TP + FP)
  recall: z.number(), // TP / (TP + FN)
  f1_score: z.number(),
  avg_confidence: z.number(),
  avg_prediction_accuracy: z.number(),
  threshold_adjustments: z.number(),
  created_at: z.date(),
});
export type AgentMetrics = z.infer<typeof AgentMetricsSchema>;

// WebSocket Message Types
export const WebSocketMessageSchema = z.object({
  type: z.enum(['alert', 'agent_decision', 'data_update', 'system_status']),
  priority: AgentPrioritySchema.optional(),
  data: z.record(z.any()),
  timestamp: z.date(),
});
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// ============================================================================
// ALERT RULES ENGINE TYPES
// ============================================================================

// Available metrics for alert rules
export const AlertMetricSchema = z.enum([
  'kp_index',
  'bz_value',
  'solar_wind_speed',
  'xray_flux',
  'proton_flux',
]);
export type AlertMetric = z.infer<typeof AlertMetricSchema>;

// Comparison operators
export const AlertOperatorSchema = z.enum(['gt', 'gte', 'lt', 'lte', 'eq']);
export type AlertOperator = z.infer<typeof AlertOperatorSchema>;

// Severity levels
export const AlertSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

// Single condition in a rule
export const AlertRuleConditionSchema = z.object({
  metric: AlertMetricSchema,
  operator: AlertOperatorSchema,
  value: z.number(),
});
export type AlertRuleCondition = z.infer<typeof AlertRuleConditionSchema>;

// Alert Rule (stored in alert_rules collection)
export const AlertRuleSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  conditions: z.array(AlertRuleConditionSchema).min(1),
  severity: AlertSeveritySchema,
  enabled: z.boolean().default(true),
  created_at: z.date(),
  updated_at: z.date(),
});
export type AlertRule = z.infer<typeof AlertRuleSchema>;

// Triggered Alert (stored in alert_history collection)
export const TriggeredAlertSchema = z.object({
  _id: z.string().optional(),
  rule_id: z.string(),
  rule_name: z.string(),
  severity: AlertSeveritySchema,
  conditions_met: z.array(z.object({
    metric: AlertMetricSchema,
    operator: AlertOperatorSchema,
    threshold: z.number(),
    actual_value: z.number(),
  })),
  data_snapshot: z.record(z.any()),
  triggered_at: z.date(),
  acknowledged: z.boolean().default(false),
  acknowledged_at: z.date().optional(),
});
export type TriggeredAlert = z.infer<typeof TriggeredAlertSchema>;

// ============================================================================
// NASA DONKI CME TYPES
// ============================================================================

// CME Analysis from NASA DONKI
export const CmeAnalysisSchema = z.object({
  time21_5: z.string().optional(), // Time when CME reaches 21.5 solar radii
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  halfAngle: z.number().optional(), // Half-width of the CME in degrees
  speed: z.number().optional(), // Speed in km/s
  type: z.string().optional(), // S (slow), C (common), O (operator)
  isMostAccurate: z.boolean().optional(),
  note: z.string().optional(),
  levelOfData: z.number().optional(),
  enlilList: z.array(z.object({
    modelCompletionTime: z.string().optional(),
    au: z.number().optional(),
    estimatedShockArrivalTime: z.string().optional(),
    estimatedDuration: z.number().optional(),
    rmin_re: z.number().optional(),
    kp_18: z.number().optional(),
    kp_90: z.number().optional(),
    kp_135: z.number().optional(),
    kp_180: z.number().optional(),
    isEarthGB: z.boolean().optional(),
    link: z.string().optional(),
  })).optional(),
});
export type CmeAnalysis = z.infer<typeof CmeAnalysisSchema>;

// CME Event from NASA DONKI
export const CmeEventSchema = z.object({
  activityID: z.string(),
  catalog: z.string(),
  startTime: z.string(),
  sourceLocation: z.string().optional(),
  activeRegionNum: z.number().nullable().optional(),
  link: z.string().optional(),
  note: z.string().optional(),
  instruments: z.array(z.object({
    displayName: z.string(),
  })).optional(),
  cmeAnalyses: z.array(CmeAnalysisSchema).nullable().optional(),
  linkedEvents: z.array(z.object({
    activityID: z.string(),
  })).nullable().optional(),
});
export type CmeEvent = z.infer<typeof CmeEventSchema>;

// Processed CME for frontend display
export const ProcessedCmeSchema = z.object({
  id: z.string(),
  startTime: z.date(),
  sourceLocation: z.string().optional(),
  activeRegion: z.number().nullable().optional(),
  speed: z.number().optional(), // km/s
  halfAngle: z.number().optional(), // degrees
  isEarthDirected: z.boolean(),
  estimatedArrival: z.date().nullable().optional(),
  arrivalHours: z.number().nullable().optional(), // hours until arrival
  speedCategory: z.enum(['slow', 'moderate', 'fast', 'extreme']),
  linkedFlare: z.string().nullable().optional(),
  note: z.string().optional(),
  enlilModelUrl: z.string().optional(),
});
export type ProcessedCme = z.infer<typeof ProcessedCmeSchema>;
