import { NextResponse } from 'next/server';
import { getCollection, getTimeSeriesCollection } from '@/lib/db';
import { AlertRule, AlertOperator, AlertMetric, TriggeredAlert } from '@/lib/types';
import { sendAlertRuleNotifications } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vercel Cron configuration - runs every 5 minutes
// Add to vercel.json: { "crons": [{ "path": "/api/cron/check-alerts", "schedule": "*/5 * * * *" }] }

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
    const kpCollection = await getTimeSeriesCollection('timeseries_noaa_kp_index');
    const kpData = await kpCollection.findOne({}, { sort: { ts: -1 } });
    if (kpData && 'kp_index' in kpData) {
      metrics.kp_index = kpData.kp_index as number;
    }
  } catch (e) {
    console.error('[Cron] Error fetching Kp index:', e);
  }

  try {
    const magCollection = await getTimeSeriesCollection('timeseries_noaa_solarwind_mag');
    const magData = await magCollection.findOne({}, { sort: { ts: -1 } });
    if (magData && 'bz_gsm' in magData) {
      metrics.bz_value = magData.bz_gsm as number;
    }
  } catch (e) {
    console.error('[Cron] Error fetching Bz value:', e);
  }

  try {
    const plasmaCollection = await getTimeSeriesCollection('timeseries_solarwind_plasma');
    const plasmaData = await plasmaCollection.findOne({}, { sort: { ts: -1 } });
    if (plasmaData && 'speed_kms' in plasmaData) {
      metrics.solar_wind_speed = plasmaData.speed_kms as number;
    }
  } catch (e) {
    console.error('[Cron] Error fetching solar wind speed:', e);
  }

  try {
    const xrayCollection = await getTimeSeriesCollection('timeseries_noaa_xray_flux');
    const xrayData = await xrayCollection.findOne({}, { sort: { ts: -1 } });
    if (xrayData && 'flux' in xrayData) {
      metrics.xray_flux = xrayData.flux as number;
    }
  } catch (e) {
    console.error('[Cron] Error fetching X-ray flux:', e);
  }

  try {
    const protonCollection = await getTimeSeriesCollection('timeseries_goes_protons');
    const protonData = await protonCollection.findOne({}, { sort: { ts: -1 } });
    if (protonData && 'p10_pfu' in protonData) {
      metrics.proton_flux = protonData.p10_pfu as number;
    }
  } catch (e) {
    console.error('[Cron] Error fetching proton flux:', e);
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
 * GET /api/cron/check-alerts
 *
 * Cron endpoint to check all enabled alert rules.
 * Can be called by Vercel Cron, external cron services, or manually.
 *
 * Query params:
 * - cooldown: minutes to wait before re-triggering same rule (default: 60)
 * - secret: optional secret for authentication (CRON_SECRET env var)
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // Optional authentication via secret
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && secret !== cronSecret) {
      // Check for Vercel cron header as alternative
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const cooldownMinutes = parseInt(url.searchParams.get('cooldown') || '60');

    // Fetch current metrics
    const metrics = await getCurrentMetrics();
    console.log('[Cron] Current metrics:', metrics);

    // Get all enabled rules
    const rulesCollection = await getCollection('alert_rules');
    const rules = await rulesCollection.find({ enabled: true }).toArray() as unknown as AlertRule[];

    console.log(`[Cron] Checking ${rules.length} enabled rules`);

    const historyCollection = await getCollection('alert_history');

    let triggeredCount = 0;
    let savedCount = 0;
    let notificationsSentCount = 0;
    const errors: string[] = [];

    for (const rule of rules) {
      const ruleId = rule._id?.toString() || '';

      // Evaluate all conditions
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

      if (allConditionsMet) {
        triggeredCount++;

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
          savedCount++;

          console.log(`[Cron] Alert triggered: ${rule.name} (${rule.severity})`);

          // Send notifications if configured
          const channels = rule.notification_channels || [];
          if (channels.length > 0) {
            try {
              const notificationResult = await sendAlertRuleNotifications(
                rule,
                triggeredAlert,
                metrics as unknown as Record<string, number | null>
              );

              if (notificationResult.channels_succeeded.length > 0) {
                notificationsSentCount++;
                console.log(`[Cron] Notifications sent for "${rule.name}":`, notificationResult.channels_succeeded);
              }

              if (Object.keys(notificationResult.errors).length > 0) {
                errors.push(`${rule.name}: ${JSON.stringify(notificationResult.errors)}`);
              }
            } catch (notifyError: any) {
              errors.push(`${rule.name}: ${notifyError.message}`);
              console.error(`[Cron] Notification error for "${rule.name}":`, notifyError);
            }
          }
        } else {
          console.log(`[Cron] Alert "${rule.name}" skipped (cooldown)`);
        }
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'Alert check completed',
      stats: {
        rules_checked: rules.length,
        triggered_count: triggeredCount,
        saved_count: savedCount,
        notifications_sent: notificationsSentCount,
        cooldown_minutes: cooldownMinutes,
        duration_ms: duration,
      },
      current_metrics: metrics,
      errors: errors.length > 0 ? errors : undefined,
      checked_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Cron] Error checking alerts:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to check alerts',
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/check-alerts
 *
 * Alternative POST endpoint for services that prefer POST for webhooks
 */
export async function POST(request: Request) {
  return GET(request);
}
