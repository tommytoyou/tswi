import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * CRON JOB: Threshold Adjustment
 * Runs every 6 hours to adjust alert thresholds based on false positive rates
 * Self-tuning system to minimize false positives
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getDb();
    const now = new Date();
    const lookback = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days

    console.log('[Threshold Adjuster] Starting self-tuning analysis...');

    // Get alert history for the past week
    const alertHistory = await db.collection('alert_history')
      .find({ triggered_at: { $gte: lookback } })
      .toArray();

    // Group by parameter type
    const parameterGroups: Record<string, any[]> = {
      bz: [],
      kp: [],
      flare: [],
    };

    for (const alert of alertHistory) {
      if (alert.conditions_met?.bz_lt) {
        parameterGroups.bz.push(alert);
      }
      if (alert.conditions_met?.kp_ge) {
        parameterGroups.kp.push(alert);
      }
      if (alert.conditions_met?.flare_class_ge) {
        parameterGroups.flare.push(alert);
      }
    }

    const adjustments = [];

    // Analyze each parameter
    for (const [param, alerts] of Object.entries(parameterGroups)) {
      if (alerts.length === 0) continue;

      const totalAlerts = alerts.length;
      const falsePositives = alerts.filter((a: any) => a.false_positive === true).length;
      const falsePositiveRate = totalAlerts > 0 ? falsePositives / totalAlerts : 0;

      console.log(`[Threshold Adjuster] ${param}: ${totalAlerts} alerts, ${falsePositives} false positives (${(falsePositiveRate * 100).toFixed(1)}%)`);

      // Target false positive rate: 5%
      const targetRate = 0.05;

      // Get current threshold
      const currentThreshold = await db.collection('adaptive_thresholds')
        .findOne({ parameter: param });

      let newThreshold = null;
      let adjustment = 0;

      if (param === 'bz') {
        const currentValue = currentThreshold?.current_threshold || -5;

        if (falsePositiveRate > targetRate + 0.05) {
          // Too many false positives - make threshold more strict (more negative)
          adjustment = -1;
          newThreshold = currentValue - 1;
        } else if (falsePositiveRate < targetRate - 0.02 && currentValue < -3) {
          // Too few alerts - make threshold less strict (less negative)
          adjustment = 1;
          newThreshold = currentValue + 1;
        }
      } else if (param === 'kp') {
        const currentValue = currentThreshold?.current_threshold || 5;

        if (falsePositiveRate > targetRate + 0.05 && currentValue < 9) {
          // Too many false positives - increase threshold
          adjustment = 0.5;
          newThreshold = Math.min(9, currentValue + 0.5);
        } else if (falsePositiveRate < targetRate - 0.02 && currentValue > 3) {
          // Too few alerts - decrease threshold
          adjustment = -0.5;
          newThreshold = Math.max(3, currentValue - 0.5);
        }
      }

      // Apply adjustment if needed
      if (newThreshold !== null && adjustment !== 0) {
        console.log(`[Threshold Adjuster] Adjusting ${param}: ${currentThreshold?.current_threshold} → ${newThreshold}`);

        const adjustmentRecord = {
          ts: now,
          old_value: currentThreshold?.current_threshold || 0,
          new_value: newThreshold,
          reason: `False positive rate: ${(falsePositiveRate * 100).toFixed(1)}% (target: ${(targetRate * 100).toFixed(0)}%)`,
          false_positive_rate: falsePositiveRate,
        };

        if (currentThreshold) {
          // Update existing threshold
          await db.collection('adaptive_thresholds').updateOne(
            { parameter: param },
            {
              $set: {
                current_threshold: newThreshold,
                false_positive_rate: falsePositiveRate,
                last_adjusted_at: now,
              },
              $push: {
                adjustment_history: {
                  $each: [adjustmentRecord],
                  $slice: -20, // Keep last 20 adjustments
                }
              } as any
            }
          );
        } else {
          // Create new threshold record
          await db.collection('adaptive_thresholds').insertOne({
            parameter: param,
            current_threshold: newThreshold,
            initial_threshold: (currentThreshold as any)?.current_threshold || 0,
            adjustment_history: [adjustmentRecord],
            false_positive_rate: falsePositiveRate,
            target_false_positive_rate: targetRate,
            last_adjusted_at: now,
            created_at: now,
          });
        }

        adjustments.push({
          parameter: param,
          old_value: adjustmentRecord.old_value,
          new_value: newThreshold,
          reason: adjustmentRecord.reason,
        });
      }
    }

    console.log(`[Threshold Adjuster] Made ${adjustments.length} threshold adjustments`);

    return NextResponse.json({
      success: true,
      adjustments_made: adjustments.length,
      adjustments,
      timestamp: now.toISOString(),
    });

  } catch (error) {
    console.error('[Threshold Adjuster] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Threshold adjustment failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
