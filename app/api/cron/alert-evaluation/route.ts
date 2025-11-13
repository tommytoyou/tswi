import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/db';
import { evaluateAlertConditions } from '@/lib/agent';
import type { Alert } from '@/lib/types';

/**
 * CRON JOB: Alert Evaluation
 * Runs every 1 minute to check all active alerts
 * Triggers notifications when conditions are met
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getDb();
    const now = new Date();

    // Fetch all active alerts
    const alerts = await db.collection('alerts')
      .find({ status: 'active' })
      .toArray() as unknown as Alert[];

    console.log(`[Alert Evaluator] Checking ${alerts.length} active alerts...`);

    // Get current data for evaluation
    const [latestSolarWind, latestKp, recentEvents] = await Promise.all([
      db.collection('timeseries_noaa_solarwind_mag')
        .find()
        .sort({ ts: -1 })
        .limit(1)
        .toArray(),
      db.collection('timeseries_noaa_kp_index')
        .find()
        .sort({ ts: -1 })
        .limit(1)
        .toArray(),
      db.collection('noaa_solar_events')
        .find({ begin_time: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } })
        .sort({ begin_time: -1 })
        .limit(10)
        .toArray(),
    ]);

    const currentData = {
      solar_wind: latestSolarWind[0],
      kp_index: { value: latestKp[0]?.kp, timestamp: latestKp[0]?.ts },
      recent_events: recentEvents.map((e: any) => ({
        type: e.event_type,
        class: e.class_type,
        time: e.begin_time,
      })),
    };

    let triggeredCount = 0;
    const results = [];

    // Evaluate each alert
    for (const alert of alerts) {
      try {
        // Check cooldown period (don't re-trigger within 30 minutes)
        if (alert.last_triggered_at) {
          const cooldownMs = 30 * 60 * 1000;
          if (now.getTime() - alert.last_triggered_at.getTime() < cooldownMs) {
            continue;
          }
        }

        // Evaluate conditions
        const evaluation = await evaluateAlertConditions(alert.conditions, currentData);

        if (evaluation.met) {
          console.log(`[Alert Evaluator] Alert triggered: ${alert.name}`);

          // Determine priority based on conditions
          let priority: 'critical' | 'high' | 'medium' | 'low' = 'medium';

          if (evaluation.details.bz_lt?.actual < -10 ||
              evaluation.details.kp_ge?.actual >= 7 ||
              evaluation.details.flare_class_ge?.actual === 'X') {
            priority = 'critical';
          } else if (evaluation.details.bz_lt?.actual < -5 ||
                     evaluation.details.kp_ge?.actual >= 5 ||
                     evaluation.details.flare_class_ge?.actual === 'M') {
            priority = 'high';
          }

          // Generate AI reasoning
          const reasoning = generateAlertReasoning(alert, evaluation, currentData);

          // Store in alert history
          const historyEntry = {
            alert_id: alert._id?.toString() || '',
            user_id: alert.user_id,
            triggered_at: now,
            priority,
            conditions_met: evaluation.details,
            ai_reasoning: reasoning,
            ai_confidence: 0.85,
            data_snapshot: currentData,
            notification_sent: false,
            notification_channel: alert.channel,
            user_acknowledged: false,
            false_positive: false,
            created_at: now,
          };

          await db.collection('alert_history').insertOne(historyEntry);

          // Send notification (implement later)
          await sendNotification(alert, historyEntry);

          // Update alert's last_triggered_at
          await db.collection('alerts').updateOne(
            { _id: new ObjectId(alert._id) },
            {
              $set: {
                last_triggered_at: now,
                updated_at: now,
              }
            }
          );

          triggeredCount++;
          results.push({
            alert_id: alert._id,
            alert_name: alert.name,
            priority,
            reasoning,
          });
        }
      } catch (error) {
        console.error(`[Alert Evaluator] Error evaluating alert ${alert._id}:`, error);
      }
    }

    console.log(`[Alert Evaluator] Triggered ${triggeredCount} alerts`);

    return NextResponse.json({
      success: true,
      alerts_checked: alerts.length,
      alerts_triggered: triggeredCount,
      results,
      timestamp: now.toISOString(),
    });

  } catch (error) {
    console.error('[Alert Evaluator] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Alert evaluation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Generate AI reasoning for why an alert was triggered
 */
function generateAlertReasoning(
  alert: Alert,
  evaluation: any,
  currentData: any
): string {
  let reasoning = `Alert "${alert.name}" triggered. `;

  const conditions = [];

  if (evaluation.details.bz_lt?.met) {
    const bz = evaluation.details.bz_lt.actual;
    conditions.push(`Bz = ${bz?.toFixed(1)} nT (threshold: ${evaluation.details.bz_lt.threshold} nT)`);
    if (bz < -10) {
      reasoning += 'CRITICAL: Strong southward magnetic field. High risk of geomagnetic storms. ';
    } else if (bz < -5) {
      reasoning += 'Moderate southward magnetic field. Elevated storm risk. ';
    }
  }

  if (evaluation.details.kp_ge?.met) {
    const kp = evaluation.details.kp_ge.actual;
    conditions.push(`Kp = ${kp} (threshold: ${evaluation.details.kp_ge.threshold})`);
    if (kp >= 7) {
      reasoning += 'Severe geomagnetic storm in progress. Expect widespread impacts to satellites, communications, and power grids. ';
    } else if (kp >= 5) {
      reasoning += 'Moderate geomagnetic storm. Possible impacts to HF communications and navigation systems. ';
    }
  }

  if (evaluation.details.flare_class_ge?.met) {
    const flareClass = evaluation.details.flare_class_ge.actual;
    conditions.push(`Solar flare: ${flareClass}-class`);
    if (flareClass.startsWith('X')) {
      reasoning += 'X-class solar flare detected. Expect radio blackouts and solar radiation storms. ';
    } else if (flareClass.startsWith('M')) {
      reasoning += 'M-class solar flare detected. Minor radio blackouts possible. ';
    }
  }

  reasoning += `Conditions met: ${conditions.join(', ')}. `;
  reasoning += 'Recommend monitoring for further developments.';

  return reasoning;
}

/**
 * Send notification via configured channel
 */
async function sendNotification(alert: Alert, historyEntry: any): Promise<void> {
  try {
    const { sendAlertNotification } = await import('@/lib/notifications');

    // Send notification
    const success = await sendAlertNotification(alert, historyEntry);

    // Update history entry
    const db = await getDb();
    await db.collection('alert_history').updateOne(
      { _id: historyEntry._id },
      { $set: { notification_sent: success } }
    );

    if (success) {
      console.log(`[Notification] Sent ${alert.channel} to ${alert.target}`);
    } else {
      console.warn(`[Notification] Failed to send ${alert.channel}`);
    }

    // Broadcast via WebSocket/SSE
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ws/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert,
          priority: historyEntry.priority,
          reasoning: historyEntry.ai_reasoning,
        }),
      });
    } catch (wsError) {
      console.error('[WebSocket] Broadcast failed:', wsError);
    }

  } catch (error) {
    console.error('[Notification] Failed to send:', error);
  }
}
