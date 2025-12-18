import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAdminSession } from '@/lib/auth/admin';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/activity
 *
 * Returns paginated activity logs with optional filtering
 * Query params:
 * - userId: Filter by specific user ID
 * - eventType: Filter by event type
 * - startDate: Filter by start date (ISO string)
 * - endDate: Filter by end date (ISO string)
 * - limit: Number of records per page (default 50, max 200)
 * - page: Page number (default 1)
 *
 * Admin only
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin session
    const adminSession = await getAdminSession();
    if (!adminSession) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const userId = searchParams.get('userId');
    const eventType = searchParams.get('eventType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);

    // Build filter query
    const filter: any = {};

    if (userId) {
      filter.userId = userId;
    }

    if (eventType) {
      filter.eventType = eventType;
    }

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.timestamp.$lte = new Date(endDate);
      }
    }

    // Get database connection
    const db = await getDb();
    const activityCollection = db.collection('user_activity');

    // Get total count for pagination
    const totalCount = await activityCollection.countDocuments(filter);

    // Fetch paginated results
    const activities = await activityCollection
      .find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      success: true,
      data: {
        activities,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      },
    });

  } catch (error: any) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch activity logs' },
      { status: 500 }
    );
  }
}
