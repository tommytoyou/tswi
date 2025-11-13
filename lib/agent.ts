/**
 * AGENTIC AI MONITORING SYSTEM
 * Core autonomous agent for space weather monitoring
 * Uses LLM for intelligent decision-making and reasoning
 */

import { ObjectId } from 'mongodb';
import { getDb } from './db';
import type {
  AgentDecision,
  AgentPriority,
  AlertCondition,
  PredictionAccuracy,
} from './types';

// ============================================================================
// LLM INTEGRATION (Anthropic Claude)
// ============================================================================

interface LLMRequest {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

interface LLMResponse {
  reasoning: string;
  priority: AgentPriority;
  confidence: number;
  action: string;
  shouldAlert: boolean;
}

/**
 * Call Claude API for AI reasoning
 */
async function callLLM(request: LLMRequest): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Fallback to rule-based logic if no API key
    return fallbackReasoning(request.messages[0].content);
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: request.max_tokens || 1024,
        temperature: request.temperature || 0.7,
        system: request.system,
        messages: request.messages,
      }),
    });

    if (!response.ok) {
      console.error('LLM API error:', response.status);
      return fallbackReasoning(request.messages[0].content);
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Parse structured response
    return parseAIResponse(content);

  } catch (error) {
    console.error('LLM call failed:', error);
    return fallbackReasoning(request.messages[0].content);
  }
}

/**
 * Parse AI response into structured format
 */
function parseAIResponse(content: string): LLMResponse {
  try {
    // Try to parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        reasoning: parsed.reasoning || content,
        priority: parsed.priority || 'medium',
        confidence: parsed.confidence || 0.7,
        action: parsed.action || 'monitor',
        shouldAlert: parsed.shouldAlert || false,
      };
    }

    // Fallback to text parsing
    const priorityMatch = content.match(/priority:\s*(critical|high|medium|low)/i);
    const confidenceMatch = content.match(/confidence:\s*([\d.]+)/i);
    const actionMatch = content.match(/action:\s*([^\n]+)/i);
    const alertMatch = content.match(/alert:\s*(true|false|yes|no)/i);

    return {
      reasoning: content,
      priority: (priorityMatch?.[1].toLowerCase() as AgentPriority) || 'medium',
      confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.7,
      action: actionMatch?.[1] || 'continue monitoring',
      shouldAlert: alertMatch ? ['true', 'yes'].includes(alertMatch[1].toLowerCase()) : false,
    };
  } catch (error) {
    return {
      reasoning: content,
      priority: 'medium',
      confidence: 0.5,
      action: 'continue monitoring',
      shouldAlert: false,
    };
  }
}

/**
 * Fallback rule-based reasoning when LLM unavailable
 */
function fallbackReasoning(dataContext: string): LLMResponse {
  // Extract key metrics from context
  const bzMatch = dataContext.match(/Bz:\s*(-?[\d.]+)/i);
  const kpMatch = dataContext.match(/Kp:\s*([\d.]+)/i);
  const flareMatch = dataContext.match(/flare:\s*([A-Z]\d+\.?\d*)/i);

  const bz = bzMatch ? parseFloat(bzMatch[1]) : 0;
  const kp = kpMatch ? parseFloat(kpMatch[1]) : 0;
  const flareClass = flareMatch?.[1] || '';

  let priority: AgentPriority = 'low';
  let shouldAlert = false;
  let reasoning = 'Nominal space weather conditions. ';

  // Rule-based priority assessment
  if (bz < -10 || kp >= 7 || flareClass.startsWith('X')) {
    priority = 'critical';
    shouldAlert = true;
    reasoning = 'CRITICAL: ';
    if (bz < -10) reasoning += `Strong southward Bz (${bz.toFixed(1)} nT). `;
    if (kp >= 7) reasoning += `Severe geomagnetic storm (Kp=${kp}). `;
    if (flareClass.startsWith('X')) reasoning += `X-class solar flare detected. `;
    reasoning += 'High risk of satellite and communication disruptions.';
  } else if (bz < -5 || kp >= 5 || flareClass.startsWith('M')) {
    priority = 'high';
    shouldAlert = true;
    reasoning = 'HIGH: ';
    if (bz < -5) reasoning += `Moderate southward Bz (${bz.toFixed(1)} nT). `;
    if (kp >= 5) reasoning += `Moderate geomagnetic activity (Kp=${kp}). `;
    if (flareClass.startsWith('M')) reasoning += `M-class flare detected. `;
    reasoning += 'Possible impacts to HF communications and navigation.';
  } else if (bz < -3 || kp >= 4) {
    priority = 'medium';
    reasoning = 'MEDIUM: ';
    if (bz < -3) reasoning += `Minor southward Bz (${bz.toFixed(1)} nT). `;
    if (kp >= 4) reasoning += `Unsettled geomagnetic conditions (Kp=${kp}). `;
    reasoning += 'Monitor for increasing activity.';
  }

  return {
    reasoning,
    priority,
    confidence: 0.75,
    action: shouldAlert ? 'send alert' : 'continue monitoring',
    shouldAlert,
  };
}

// ============================================================================
// AGENT CORE FUNCTIONS
// ============================================================================

/**
 * Analyze current space weather conditions with AI reasoning
 */
export async function analyzeSpaceWeather(): Promise<AgentDecision> {
  const db = await getDb();
  const now = new Date();
  const lookback = new Date(now.getTime() - 15 * 60 * 1000); // 15 min lookback

  // Fetch recent data
  const [solarWind, kpData, xrayFlux, events, predictions] = await Promise.all([
    db.collection('timeseries_noaa_solarwind_mag')
      .find({ ts: { $gte: lookback } })
      .sort({ ts: -1 })
      .limit(10)
      .toArray(),
    db.collection('timeseries_noaa_kp_index')
      .find({ ts: { $gte: lookback } })
      .sort({ ts: -1 })
      .limit(10)
      .toArray(),
    db.collection('timeseries_noaa_xray_flux')
      .find({ ts: { $gte: lookback } })
      .sort({ ts: -1 })
      .limit(10)
      .toArray(),
    db.collection('noaa_solar_events')
      .find({ begin_time: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } })
      .sort({ begin_time: -1 })
      .toArray(),
    db.collection('forecasts')
      .find({ ts: { $gte: lookback } })
      .sort({ ts: -1 })
      .toArray(),
  ]);

  // Build context for LLM
  const latestSolarWind = solarWind[0];
  const latestKp = kpData[0];
  const latestXray = xrayFlux[0];
  const recentFlares = events.filter((e: any) => e.event_type === 'FLA');

  const dataSnapshot = {
    solar_wind: {
      bz_gsm: latestSolarWind?.bz_gsm,
      bt: latestSolarWind?.bt,
      timestamp: latestSolarWind?.ts,
    },
    kp_index: {
      value: latestKp?.kp,
      timestamp: latestKp?.ts,
    },
    xray_flux: {
      flux: latestXray?.flux,
      timestamp: latestXray?.ts,
    },
    recent_events: recentFlares.slice(0, 3).map((e: any) => ({
      type: e.event_type,
      class: e.class_type,
      time: e.begin_time,
    })),
    predictions: predictions.slice(0, 2).map((p: any) => ({
      kind: p.kind,
      value: p.value,
      horizon_min: p.horizon_min,
    })),
  };

  const contextPrompt = `
Current Space Weather Data (Last 15 minutes):

Solar Wind Magnetic Field:
- Bz (GSM): ${latestSolarWind?.bz_gsm?.toFixed(2) || 'N/A'} nT (southward is negative, critical if < -10 nT)
- Bt (Total): ${latestSolarWind?.bt?.toFixed(2) || 'N/A'} nT
- Timestamp: ${latestSolarWind?.ts || 'N/A'}

Geomagnetic Activity:
- Kp Index: ${latestKp?.kp?.toFixed(1) || 'N/A'} (0-9 scale, storm if >= 5)
- Timestamp: ${latestKp?.ts || 'N/A'}

Solar X-ray Flux:
- Current Flux: ${latestXray?.flux ? latestXray.flux.toExponential(2) : 'N/A'} W/m²
- Timestamp: ${latestXray?.ts || 'N/A'}

Recent Solar Events (24h):
${recentFlares.length > 0 ? recentFlares.slice(0, 3).map((e: any) =>
  `- ${e.class_type || 'Unknown'} flare at ${e.begin_time}`
).join('\n') : '- No significant flares'}

AI Predictions:
${predictions.length > 0 ? predictions.slice(0, 2).map((p: any) =>
  `- ${p.kind}: ${p.value} (${p.horizon_min} min ahead)`
).join('\n') : '- No recent predictions'}

Analyze this data and provide:
1. Current risk level (critical/high/medium/low)
2. Reasoning for your assessment
3. Recommended action
4. Whether to send alerts to users
5. Confidence in your assessment (0-1)

Respond in JSON format:
{
  "priority": "critical|high|medium|low",
  "reasoning": "detailed explanation",
  "action": "recommended action",
  "shouldAlert": true/false,
  "confidence": 0.0-1.0
}`;

  const systemPrompt = `You are an expert space weather analyst AI agent. Your role is to:
1. Analyze real-time solar wind, geomagnetic, and solar activity data
2. Assess risk levels for satellite operations, communications, and navigation
3. Provide clear reasoning for your decisions
4. Determine when to alert users about dangerous conditions
5. Be conservative with critical alerts to minimize false positives

Key thresholds:
- Bz < -10 nT: High risk of geomagnetic storms
- Kp >= 7: Severe geomagnetic storm
- Kp >= 5: Moderate storm
- X-class flares: Potential for radio blackouts
- M-class flares: Minor to moderate impacts`;

  // Get AI reasoning
  const aiResponse = await callLLM({
    system: systemPrompt,
    messages: [{ role: 'user', content: contextPrompt }],
    temperature: 0.7,
    max_tokens: 1024,
  });

  // Create agent decision record
  const decision: AgentDecision = {
    ts: now,
    decision_type: 'alert_evaluation',
    priority: aiResponse.priority,
    reasoning: aiResponse.reasoning,
    confidence: aiResponse.confidence,
    data_snapshot: dataSnapshot,
    action_taken: aiResponse.action,
    outcome: 'pending',
    created_at: now,
  };

  // Store decision in database
  await db.collection('agent_decisions').insertOne(decision as any);

  return decision;
}

/**
 * Evaluate alert conditions against current data
 */
export async function evaluateAlertConditions(
  conditions: AlertCondition,
  currentData: any
): Promise<{ met: boolean; details: Record<string, any> }> {
  const details: Record<string, any> = {};
  let allConditionsMet = true;

  // Check Bz threshold
  if (conditions.bz_lt !== undefined) {
    const met = currentData.solar_wind?.bz_gsm < conditions.bz_lt;
    details.bz_lt = {
      threshold: conditions.bz_lt,
      actual: currentData.solar_wind?.bz_gsm,
      met,
    };
    if (!met) allConditionsMet = false;
  }

  // Check Kp threshold
  if (conditions.kp_ge !== undefined) {
    const met = currentData.kp_index?.value >= conditions.kp_ge;
    details.kp_ge = {
      threshold: conditions.kp_ge,
      actual: currentData.kp_index?.value,
      met,
    };
    if (!met) allConditionsMet = false;
  }

  // Check flare class
  if (conditions.flare_class_ge !== undefined) {
    const flareClasses = ['A', 'B', 'C', 'M', 'X'];
    const thresholdIdx = flareClasses.indexOf(conditions.flare_class_ge);
    const actualClass = currentData.recent_events?.[0]?.class?.[0];
    const actualIdx = actualClass ? flareClasses.indexOf(actualClass) : -1;
    const met = actualIdx >= thresholdIdx && actualIdx !== -1;
    details.flare_class_ge = {
      threshold: conditions.flare_class_ge,
      actual: actualClass || 'None',
      met,
    };
    if (!met) allConditionsMet = false;
  }

  return { met: allConditionsMet, details };
}

/**
 * Compare predictions vs actual events for accuracy tracking
 */
export async function trackPredictionAccuracy(
  predictionId: string,
  actualData: any
): Promise<PredictionAccuracy | null> {
  const db = await getDb();

  // Fetch the prediction
  const prediction = await db.collection('forecasts').findOne({ _id: new ObjectId(predictionId) });
  if (!prediction) return null;

  // Calculate error based on prediction type
  let errorMagnitude = 0;
  let accuracyScore = 0;

  if (prediction.kind === 'kp' && actualData.kp_index?.value !== undefined) {
    errorMagnitude = Math.abs(prediction.value - actualData.kp_index.value);
    // Score: 1.0 if error < 1, linear decay to 0 at error = 5
    accuracyScore = Math.max(0, 1 - errorMagnitude / 5);
  }

  const accuracy: PredictionAccuracy = {
    prediction_ts: prediction.ts,
    predicted_event: prediction.kind,
    predicted_value: prediction.value,
    predicted_time: new Date(prediction.ts.getTime() + prediction.horizon_min * 60 * 1000),
    actual_value: actualData.kp_index?.value,
    actual_time: actualData.kp_index?.timestamp,
    error_magnitude: errorMagnitude,
    accuracy_score: accuracyScore,
    prediction_source: prediction.source || 'unknown',
    created_at: new Date(),
  };

  // Store accuracy record
  await db.collection('prediction_accuracy').insertOne(accuracy as any);

  return accuracy;
}

/**
 * Calculate agent performance metrics
 */
export async function calculateAgentMetrics(period: 'hourly' | 'daily' | 'weekly'): Promise<any> {
  const db = await getDb();
  const now = new Date();

  let lookbackMs = 60 * 60 * 1000; // 1 hour
  if (period === 'daily') lookbackMs = 24 * 60 * 60 * 1000;
  if (period === 'weekly') lookbackMs = 7 * 24 * 60 * 60 * 1000;

  const since = new Date(now.getTime() - lookbackMs);

  // Fetch alert history
  const alerts = await db.collection('alert_history')
    .find({ triggered_at: { $gte: since } })
    .toArray();

  const totalAlerts = alerts.length;
  const criticalAlerts = alerts.filter((a: any) => a.priority === 'critical').length;
  const falsePositives = alerts.filter((a: any) => a.false_positive === true).length;
  const truePositives = totalAlerts - falsePositives;

  // Fetch prediction accuracy
  const accuracyRecords = await db.collection('prediction_accuracy')
    .find({ created_at: { $gte: since } })
    .toArray();

  const avgAccuracy = accuracyRecords.length > 0
    ? accuracyRecords.reduce((sum: number, r: any) => sum + (r.accuracy_score || 0), 0) / accuracyRecords.length
    : 0;

  // Calculate precision and recall (assuming we have missed events tracked)
  const missedEvents = 0; // TODO: Track this
  const precision = totalAlerts > 0 ? truePositives / totalAlerts : 0;
  const recall = (truePositives + missedEvents) > 0 ? truePositives / (truePositives + missedEvents) : 0;
  const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

  // Average confidence from decisions
  const decisions = await db.collection('agent_decisions')
    .find({ ts: { $gte: since } })
    .toArray();

  const avgConfidence = decisions.length > 0
    ? decisions.reduce((sum: number, d: any) => sum + (d.confidence || 0), 0) / decisions.length
    : 0;

  // Threshold adjustments
  const thresholdAdjustments = await db.collection('adaptive_thresholds')
    .countDocuments({ last_adjusted_at: { $gte: since } });

  const metrics = {
    ts: now,
    period,
    total_alerts: totalAlerts,
    critical_alerts: criticalAlerts,
    false_positives: falsePositives,
    missed_events: missedEvents,
    true_positives: truePositives,
    precision,
    recall,
    f1_score: f1Score,
    avg_confidence: avgConfidence,
    avg_prediction_accuracy: avgAccuracy,
    threshold_adjustments: thresholdAdjustments,
    created_at: now,
  };

  // Store metrics
  await db.collection('agent_metrics').insertOne(metrics);

  return metrics;
}
