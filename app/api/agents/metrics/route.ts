import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * AGENT METRICS API
 * Fetch agent performance metrics over time
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily';
    const limit = parseInt(searchParams.get('limit') || '30');

    const db = await getDb();

    // Fetch metrics
    const metrics = await db.collection('agent_metrics')
      .find({ period })
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();

    // Calculate trends
    const trends = calculateTrends(metrics);

    return NextResponse.json({
      success: true,
      data: {
        metrics: metrics.reverse(), // Chronological order for charts
        trends,
        period,
      },
    });

  } catch (error) {
    console.error('Agent metrics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate trends from metrics
 */
function calculateTrends(metrics: any[]): any {
  if (metrics.length < 2) {
    return {
      precision: 'stable',
      recall: 'stable',
      f1_score: 'stable',
      false_positive_rate: 'stable',
    };
  }

  const recent = metrics[0];
  const previous = metrics[1];

  const getTrend = (current: number, prev: number) => {
    const change = current - prev;
    if (Math.abs(change) < 0.05) return 'stable';
    return change > 0 ? 'improving' : 'declining';
  };

  const fpRateCurrent = recent.total_alerts > 0
    ? recent.false_positives / recent.total_alerts
    : 0;
  const fpRatePrev = previous.total_alerts > 0
    ? previous.false_positives / previous.total_alerts
    : 0;

  return {
    precision: getTrend(recent.precision, previous.precision),
    recall: getTrend(recent.recall, previous.recall),
    f1_score: getTrend(recent.f1_score, previous.f1_score),
    false_positive_rate: getTrend(fpRatePrev, fpRateCurrent), // Lower is better
  };
}
