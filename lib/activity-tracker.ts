import { getDb } from '@/lib/db';
import { getApiSession } from '@/lib/auth/api';
import type { UserActivity, ActivityEventData } from '@/lib/types';

/**
 * Track AI query activity from API routes
 * This is a server-side helper for tracking AI usage
 */
export async function trackAIQuery(params: {
  query: string;
  tokensUsed?: number;
  model?: string;
  responseTime?: number;
  sessionId?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    // Get current user session
    const session = await getApiSession();
    if (!session) {
      // If no session, skip tracking (don't throw error)
      return;
    }

    // Get sessionId from params or generate a default one
    const sessionId = params.sessionId || 'server-side-session';

    // Construct activity record
    const activityRecord: Omit<UserActivity, '_id'> = {
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      eventType: 'ai_query',
      eventData: {
        aiQuery: params.query.substring(0, 100), // Truncate to 100 chars
        aiTokensUsed: params.tokensUsed,
        aiModel: params.model,
        aiResponseTime: params.responseTime,
        metadata: params.metadata,
      },
      sessionId,
      timestamp: new Date(),
      userAgent: 'API Route',
      ip: undefined, // Not available server-side
    };

    // Store in database
    const db = await getDb();
    const activityCollection = db.collection('user_activity');
    await activityCollection.insertOne(activityRecord);

  } catch (error) {
    // Silently fail - don't disrupt the main API operation
    console.error('Failed to track AI query:', error);
  }
}

/**
 * Track general activity from API routes
 */
export async function trackActivity(params: {
  eventType: 'page_view' | 'tab_switch' | 'login' | 'logout' | 'ai_query' | 'feature_interaction';
  eventData?: ActivityEventData;
  sessionId?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
}): Promise<void> {
  try {
    // If user info not provided, get from session
    let userId = params.userId;
    let userEmail = params.userEmail;
    let userName = params.userName;

    if (!userId || !userEmail || !userName) {
      const session = await getApiSession();
      if (!session) return;

      userId = session.user.id;
      userEmail = session.user.email;
      userName = session.user.name;
    }

    const sessionId = params.sessionId || 'server-side-session';

    const activityRecord: Omit<UserActivity, '_id'> = {
      userId,
      userEmail,
      userName,
      eventType: params.eventType,
      eventData: params.eventData || {},
      sessionId,
      timestamp: new Date(),
      userAgent: 'API Route',
      ip: undefined,
    };

    const db = await getDb();
    const activityCollection = db.collection('user_activity');
    await activityCollection.insertOne(activityRecord);

  } catch (error) {
    console.error('Failed to track activity:', error);
  }
}
