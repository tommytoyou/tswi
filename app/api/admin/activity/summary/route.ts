import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAdminSession } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

interface UserSummaryAggregation {
  userId: string;
  userEmail: string;
  userName: string;
  totalSessions: number;
  totalPageViews: number;
  aiQueriesCount: number;
  totalAiTokens: number;
  lastActive: Date;
  tabViews: string[];
}

interface UserSummaryWithTabs extends Omit<UserSummaryAggregation, 'tabViews'> {
  mostViewedTabs: { tab: string; count: number }[];
  tabViews: undefined;
}

/**
 * GET /api/admin/activity/summary
 *
 * Returns aggregated activity statistics per user
 * Query params:
 * - startDate: Filter by start date (ISO string)
 * - endDate: Filter by end date (ISO string)
 *
 * Returns:
 * - Per-user stats: sessions, page views, AI queries, tokens used, last active
 * - Most viewed tabs per user
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build match stage for aggregation
    const matchStage: any = {};

    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) {
        matchStage.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        matchStage.timestamp.$lte = new Date(endDate);
      }
    }

    // Get database connection
    const db = await getDb();
    const activityCollection = db.collection('user_activity');

    // Aggregation pipeline for user summaries
    const userSummaries = await activityCollection.aggregate([
      // Match by date range
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),

      // Group by user
      {
        $group: {
          _id: '$userId',
          userEmail: { $first: '$userEmail' },
          userName: { $first: '$userName' },
          totalSessions: { $addToSet: '$sessionId' },
          totalPageViews: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'page_view'] }, 1, 0]
            }
          },
          aiQueriesCount: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'ai_query'] }, 1, 0]
            }
          },
          totalAiTokens: {
            $sum: {
              $ifNull: ['$eventData.aiTokensUsed', 0]
            }
          },
          lastActive: { $max: '$timestamp' },
          tabViews: {
            $push: {
              $cond: [
                { $ne: ['$eventData.tab', null] },
                '$eventData.tab',
                '$$REMOVE'
              ]
            }
          },
          events: { $push: '$$ROOT' }
        }
      },

      // Add computed fields
      {
        $addFields: {
          userId: '$_id',
          totalSessions: { $size: '$totalSessions' },
        }
      },

      // Sort by last active (most recent first)
      {
        $sort: { lastActive: -1 }
      },

      // Project final shape
      {
        $project: {
          _id: 0,
          userId: 1,
          userEmail: 1,
          userName: 1,
          totalSessions: 1,
          totalPageViews: 1,
          aiQueriesCount: 1,
          totalAiTokens: 1,
          lastActive: 1,
          tabViews: 1,
        }
      }
    ]).toArray() as UserSummaryAggregation[];

    // Calculate most viewed tabs for each user
    const summariesWithTabs: UserSummaryWithTabs[] = userSummaries.map(summary => {
      // Count tab occurrences
      const tabCounts: Record<string, number> = {};
      (summary.tabViews || []).forEach((tab: string) => {
        if (tab) {
          tabCounts[tab] = (tabCounts[tab] || 0) + 1;
        }
      });

      // Convert to array and sort
      const mostViewedTabs = Object.entries(tabCounts)
        .map(([tab, count]) => ({ tab, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5 tabs

      return {
        ...summary,
        mostViewedTabs,
        tabViews: undefined, // Remove the raw array
      };
    });

    // Calculate overall stats
    const overallStats = {
      totalUsers: summariesWithTabs.length,
      totalSessions: summariesWithTabs.reduce((sum, s) => sum + s.totalSessions, 0),
      totalPageViews: summariesWithTabs.reduce((sum, s) => sum + s.totalPageViews, 0),
      totalAiQueries: summariesWithTabs.reduce((sum, s) => sum + s.aiQueriesCount, 0),
      totalAiTokens: summariesWithTabs.reduce((sum, s) => sum + s.totalAiTokens, 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        userSummaries: summariesWithTabs,
        overallStats,
        timeRange: {
          start: startDate ? new Date(startDate) : null,
          end: endDate ? new Date(endDate) : null,
        },
      },
    });

  } catch (error: any) {
    console.error('Error generating activity summary:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate activity summary' },
      { status: 500 }
    );
  }
}
