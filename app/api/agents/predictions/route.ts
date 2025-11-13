import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * PREDICTION ACCURACY API
 * Compare Surya predictions vs actual events
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const source = searchParams.get('source'); // 'surya', 'statistical', etc.

    const db = await getDb();

    // Build query
    const query: any = {};
    if (source) {
      query.prediction_source = source;
    }

    // Fetch prediction accuracy records
    const accuracyRecords = await db.collection('prediction_accuracy')
      .find(query)
      .sort({ prediction_ts: -1 })
      .limit(limit)
      .toArray();

    // Calculate overall statistics
    const stats = {
      total_predictions: accuracyRecords.length,
      avg_accuracy_score: accuracyRecords.reduce((sum: number, r: any) =>
        sum + (r.accuracy_score || 0), 0) / (accuracyRecords.length || 1),
      avg_error_magnitude: accuracyRecords.reduce((sum: number, r: any) =>
        sum + (r.error_magnitude || 0), 0) / (accuracyRecords.length || 1),
      avg_timing_error_min: accuracyRecords.reduce((sum: number, r: any) =>
        sum + (r.error_timing_min || 0), 0) / (accuracyRecords.length || 1),
      by_source: {} as Record<string, any>,
    };

    // Group by source
    const sources = [...new Set(accuracyRecords.map((r: any) => r.prediction_source))];
    for (const src of sources) {
      const sourceRecords = accuracyRecords.filter((r: any) => r.prediction_source === src);
      stats.by_source[src] = {
        count: sourceRecords.length,
        avg_accuracy: sourceRecords.reduce((sum: number, r: any) =>
          sum + (r.accuracy_score || 0), 0) / sourceRecords.length,
      };
    }

    // Fetch recent forecasts for comparison
    const recentForecasts = await db.collection('forecasts')
      .find()
      .sort({ ts: -1 })
      .limit(10)
      .toArray();

    return NextResponse.json({
      success: true,
      data: {
        accuracy_records: accuracyRecords.reverse(), // Chronological
        stats,
        recent_forecasts: recentForecasts,
      },
    });

  } catch (error) {
    console.error('Prediction accuracy error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch prediction data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
