import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getApiSession } from '@/lib/auth/api';
import { UserActivitySchema, type UserActivity } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/activity/track
 *
 * Tracks user activity events from the frontend
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  console.log('[Activity Track] Received request');
  try {
    // Verify user session
    const session = await getApiSession();
    console.log('[Activity Track] Session:', session ? `User: ${session.user?.email}` : 'No session');
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('[Activity Track] Body:', JSON.stringify(body));

    // Validate required fields
    if (!body.eventType || !body.sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: eventType, sessionId' },
        { status: 400 }
      );
    }

    // Anonymize IP address (remove last octet)
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
    const anonymizedIp = ip.split('.').slice(0, 3).join('.') + '.0';

    // Get user agent
    const userAgent = request.headers.get('user-agent') || '';

    // Construct activity record
    const activityRecord: Omit<UserActivity, '_id'> = {
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      eventType: body.eventType,
      eventData: body.eventData || {},
      sessionId: body.sessionId,
      timestamp: new Date(),
      userAgent,
      ip: anonymizedIp,
    };

    // Validate with schema
    const validatedActivity = UserActivitySchema.omit({ _id: true }).parse(activityRecord);

    // Store in database
    const db = await getDb();
    const activityCollection = db.collection('user_activity');

    await activityCollection.insertOne(validatedActivity);

    return NextResponse.json({
      success: true,
      message: 'Activity tracked successfully',
    });

  } catch (error: any) {
    console.error('Error tracking activity:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to track activity' },
      { status: 500 }
    );
  }
}
