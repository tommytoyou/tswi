import { NextResponse } from 'next/server';
import { getCollection, getTimeSeriesCollection } from '@/lib/db';
import { AlertRule, AlertOperator, AlertMetric, TriggeredAlert } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CurrentMetrics {
  kp_index: number | null;
  bz_value: number | null;
  solar_wind_speed: number | null;
  xray_flux: number | null;
  proton_flux: number | null;
  fetched_at: Date;
}

/**
 * Fetch current space weather metrics from various sources
 */
async function getCurrentMetrics(): Promise<CurrentMetrics> {
  const metrics: CurrentMetrics = {
    kp_index: null,
    bz_value: null,
    solar_wind_speed: null,
    xray_flux: null,
    proton_flux: null,
    fetched_at: new Date(),
  };

  try {
    // Get Kp index
    const kpCollection = await getTimeSeriesCollection('timeseries_noaa_kp_index');
    const kpData = await kpCollection.findOne({}, { sort: { ts: -1 } });
    if (kpData && 'kp_index' in kpData) {
      metrics.kp_index = kpData.kp_index as number;
    }
  } catch (e) {
    console.error('Error fetching Kp index:', e);
  }

  try {
    // Get Bz value from solar wind magnetic field
    const magCollection = await getTimeSeriesCollection('timeseries_noaa_solarwind_mag');
    const magData = await magCollection.findOne({}, { sort: { ts: -1 } });
    if (magData && 'bz_gsm' in magData) {
      metrics.bz_value = magData.bz_gsm as number;
    }
  } catch (e) {
    console.error('Error fetching Bz value:', e);
  }

  try {
    // Get solar wind speed from plasma data
    const plasmaCollection = await getTimeSeriesCollection('timeseries_solarwind_plasma');
    const plasmaData = await plasmaCollection.findOne({}, { sort: { ts: -1 } });
    if (plasmaData && 'speed_kms' in plasmaData) {
      metrics.solar_wind_speed = plasmaData.speed_kms as number;
    }
  } catch (e) {
    console.error('Error fetching solar wind speed:', e);
  }

  try {
    // Get X-ray flux
    const xrayCollection = await getTimeSeriesCollection('timeseries_noaa_xray_flux');
    const xrayData = await xrayCollection.findOne({}, { sort: { ts: -1 } });
    if (xrayData && 'flux' in xrayData) {
      metrics.xray_flux = xrayData.flux as number;
    }
  } catch (e) {
    console.error('Error fetching X-ray flux:', e);
  }

  try {
    // Get proton flux
    const protonCollection = await getTimeSeriesCollection('timeseries_goes_protons');
    const protonData = await protonCollection.findOne({}, { sort: { ts: -1 } });
    if (protonData && 'p10_pfu' in protonData) {
      metrics.proton_flux = protonData.p10_pfu as number;
    }
  } catch (e) {
    console.error('Error fetching proton flux:', e);
  }

  return metrics;
}

/**
 * Evaluate a single condition against current metrics
 */
function evaluateCondition(
  metric: AlertMetric,
  operator: AlertOperator,
  threshold: number,
  metrics: CurrentMetrics
): { met: boolean; actual_value: number | null } {
  const value = metrics[metric];

  if (value === null) {
    return { met: false, actual_value: null };
  }

  let met = false;
  switch (operator) {
    case 'gt':
      met = value > threshold;
      break;
    case 'gte':
      met = value >= threshold;
      break;
    case 'lt':
      met = value < threshold;
      break;
    case 'lte':
      met = value <= threshold;
      break;
    case 'eq':
      met = value === threshold;
      break;
  }

  return { met, actual_value: value };
}

/**
 * Check if a rule was recently triggered (within cooldown period)
 */
async function wasRecentlyTriggered(ruleId: string, cooldownMinutes: number = 60): Promise<boolean> {
  const collection = await getCollection('alert_history');
  const cutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000);

  const recentAlert = await collection.findOne({
    rule_id: ruleId,
    triggered_at: { $gte: cutoff },
  });

  return !!recentAlert;
}

/**
 * GET /api/alerts/check
 *
 * Evaluates all enabled alert rules against current space weather data
 * and logs any triggered alerts to the alert_history collection.
 *
 * Query params:
 * - dry_run: 'true' to check without saving to history
 * - cooldown: minutes to wait before re-triggering same rule (default: 60)
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dryRun = url.searchParams.get('dry_run') === 'true';
    const cooldownMinutes = parseInt(url.searchParams.get('cooldown') || '60');

    // Fetch current metrics
    const metrics = await getCurrentMetrics();

    // Get all enabled rules
    const rulesCollection = await getCollection('alert_rules');
    const rules = await rulesCollection.find({ enabled: true }).toArray() as unknown as AlertRule[];

    const results: {
      rule_id: string;
      rule_name: string;
      triggered: boolean;
      conditions_met: Array<{
        metric: AlertMetric;
        operator: AlertOperator;
        threshold: number;
        actual_value: number | null;
        met: boolean;
      }>;
      saved: boolean;
      skipped_cooldown: boolean;
    }[] = [];

    const historyCollection = await getCollection('alert_history');

    for (const rule of rules) {
      const ruleId = rule._id?.toString() || '';
      const conditionsResults = rule.conditions.map((condition) => {
        const result = evaluateCondition(
          condition.metric,
          condition.operator,
          condition.value,
          metrics
        );
        return {
          metric: condition.metric,
          operator: condition.operator,
          threshold: condition.value,
          actual_value: result.actual_value,
          met: result.met,
        };
      });

      // All conditions must be met (AND logic)
      const allConditionsMet = conditionsResults.every((c) => c.met);

      let saved = false;
      let skippedCooldown = false;

      if (allConditionsMet && !dryRun) {
        // Check cooldown
        const recentlyTriggered = await wasRecentlyTriggered(ruleId, cooldownMinutes);

        if (!recentlyTriggered) {
          // Log to alert history
          const triggeredAlert: Omit<TriggeredAlert, '_id'> = {
            rule_id: ruleId,
            rule_name: rule.name,
            severity: rule.severity,
            conditions_met: conditionsResults.filter((c) => c.met).map((c) => ({
              metric: c.metric,
              operator: c.operator,
              threshold: c.threshold,
              actual_value: c.actual_value!,
            })),
            data_snapshot: metrics,
            triggered_at: new Date(),
            acknowledged: false,
          };

          await historyCollection.insertOne(triggeredAlert as any);
          saved = true;
        } else {
          skippedCooldown = true;
        }
      }

      results.push({
        rule_id: ruleId,
        rule_name: rule.name,
        triggered: allConditionsMet,
        conditions_met: conditionsResults,
        saved,
        skipped_cooldown: skippedCooldown,
      });
    }

    const triggeredRules = results.filter((r) => r.triggered);
    const savedAlerts = results.filter((r) => r.saved);

    return NextResponse.json({
      success: true,
      current_metrics: metrics,
      rules_checked: rules.length,
      triggered_count: triggeredRules.length,
      saved_count: savedAlerts.length,
      dry_run: dryRun,
      results,
    });
  } catch (error: any) {
    console.error('Error checking alerts:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check alerts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alerts/check
 *
 * Force check with custom metric values (useful for testing rules)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { metrics: customMetrics, rule_ids } = body;

    // Use custom metrics or fetch current
    const metrics: CurrentMetrics = customMetrics || await getCurrentMetrics();
    metrics.fetched_at = new Date();

    // Get rules to check
    const rulesCollection = await getCollection('alert_rules');
    const filter: any = { enabled: true };
    if (rule_ids && rule_ids.length > 0) {
      const { ObjectId } = await import('mongodb');
      filter._id = { $in: rule_ids.map((id: string) => new ObjectId(id)) };
    }

    const rules = await rulesCollection.find(filter).toArray() as unknown as AlertRule[];

    const results = rules.map((rule) => {
      const conditionsResults = rule.conditions.map((condition) => {
        const result = evaluateCondition(
          condition.metric,
          condition.operator,
          condition.value,
          metrics
        );
        return {
          metric: condition.metric,
          operator: condition.operator,
          threshold: condition.value,
          actual_value: result.actual_value,
          met: result.met,
        };
      });

      return {
        rule_id: rule._id?.toString(),
        rule_name: rule.name,
        severity: rule.severity,
        triggered: conditionsResults.every((c) => c.met),
        conditions_met: conditionsResults,
      };
    });

    return NextResponse.json({
      success: true,
      test_mode: true,
      metrics_used: metrics,
      rules_checked: rules.length,
      results,
    });
  } catch (error: any) {
    console.error('Error testing alerts:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to test alerts' },
      { status: 500 }
    );
  }
}
