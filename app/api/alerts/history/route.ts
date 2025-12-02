import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getCollection } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/alerts/history
 * Fetch triggered alert history
 *
 * Query params:
 * - limit: number (default: 50, max: 500)
 * - severity: 'low' | 'medium' | 'high' | 'critical' (optional filter)
 * - acknowledged: 'true' | 'false' (optional filter)
 * - since: ISO date string (optional, only alerts after this time)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
    const severity = searchParams.get('severity');
    const acknowledged = searchParams.get('acknowledged');
    const since = searchParams.get('since');

    const collection = await getCollection('alert_history');

    // Build query filter
    const filter: Record<string, any> = {};

    if (severity) {
      filter.severity = severity;
    }

    if (acknowledged !== null) {
      filter.acknowledged = acknowledged === 'true';
    }

    if (since) {
      filter.triggered_at = { $gte: new Date(since) };
    }

    const history = await collection
      .find(filter)
      .sort({ triggered_at: -1 })
      .limit(limit)
      .toArray();

    // Get summary stats
    const stats = await collection.aggregate([
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 },
          last_triggered: { $max: '$triggered_at' },
        },
      },
    ]).toArray();

    const unacknowledgedCount = await collection.countDocuments({ acknowledged: false });

    return NextResponse.json({
      success: true,
      data: history,
      count: history.length,
      stats: {
        by_severity: stats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
        unacknowledged: unacknowledgedCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching alert history:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch alert history' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/alerts/history
 * Acknowledge an alert (mark as reviewed)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { _id, acknowledged } = body;

    if (!_id) {
      return NextResponse.json(
        { success: false, error: 'Alert ID is required' },
        { status: 400 }
      );
    }

    const collection = await getCollection('alert_history');
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(_id) },
      {
        $set: {
          acknowledged: acknowledged ?? true,
          acknowledged_at: acknowledged !== false ? new Date() : null,
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error acknowledging alert:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to acknowledge alert' },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/alerts/history
 * Clear alert history (with optional filters)
 *
 * Query params:
 * - before: ISO date string (delete alerts before this date)
 * - acknowledged_only: 'true' (only delete acknowledged alerts)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const before = searchParams.get('before');
    const acknowledgedOnly = searchParams.get('acknowledged_only') === 'true';

    const collection = await getCollection('alert_history');

    const filter: Record<string, any> = {};

    if (before) {
      filter.triggered_at = { $lt: new Date(before) };
    }

    if (acknowledgedOnly) {
      filter.acknowledged = true;
    }

    // Safety check - require at least one filter
    if (Object.keys(filter).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Must specify at least one filter (before or acknowledged_only)' },
        { status: 400 }
      );
    }

    const result = await collection.deleteMany(filter);

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.deletedCount} alerts`,
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    console.error('Error clearing alert history:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to clear alert history' },
      { status: 400 }
    );
  }
}
