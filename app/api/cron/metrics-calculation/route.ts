import { NextRequest, NextResponse } from 'next/server';
import { calculateAgentMetrics } from '@/lib/agent';

/**
 * CRON JOB: Metrics Calculation
 * Runs hourly to calculate agent performance metrics
 * Tracks precision, recall, prediction accuracy, etc.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Metrics] Calculating agent performance metrics...');

    // Calculate metrics for different periods
    const [hourly, daily] = await Promise.all([
      calculateAgentMetrics('hourly'),
      calculateAgentMetrics('daily'),
    ]);

    console.log(`[Metrics] Hourly - Alerts: ${hourly.total_alerts}, Precision: ${(hourly.precision * 100).toFixed(1)}%, F1: ${(hourly.f1_score * 100).toFixed(1)}%`);
    console.log(`[Metrics] Daily - Alerts: ${daily.total_alerts}, Precision: ${(daily.precision * 100).toFixed(1)}%, F1: ${(daily.f1_score * 100).toFixed(1)}%`);

    return NextResponse.json({
      success: true,
      metrics: {
        hourly,
        daily,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Metrics] Calculation failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Metrics calculation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
