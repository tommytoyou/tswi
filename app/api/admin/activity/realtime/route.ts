import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getAdminSession } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/admin/activity/realtime
 *
 * Server-Sent Events (SSE) endpoint for real-time activity feed
 * Streams new activity events as they are added to the database
 *
 * Admin only
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin session
    const adminSession = await getAdminSession();
    if (!adminSession) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create a ReadableStream for SSE
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let changeStream: any = null;

        try {
          // Get database connection
          const db = await getDb();
          const activityCollection = db.collection('user_activity');

          // Send initial connection message
          const initialMessage = `data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`;
          controller.enqueue(encoder.encode(initialMessage));

          // Setup change stream to watch for new inserts
          changeStream = activityCollection.watch([
            {
              $match: {
                operationType: 'insert'
              }
            }
          ], {
            fullDocument: 'updateLookup'
          });

          // Send heartbeat every 30 seconds to keep connection alive
          const heartbeatInterval = setInterval(() => {
            try {
              const heartbeat = `: heartbeat\n\n`;
              controller.enqueue(encoder.encode(heartbeat));
            } catch (error) {
              clearInterval(heartbeatInterval);
            }
          }, 30000);

          // Listen for changes
          for await (const change of changeStream) {
            if (change.operationType === 'insert' && change.fullDocument) {
              const activity = change.fullDocument;

              // Format event data for SSE
              const eventData = {
                type: 'activity',
                data: {
                  _id: activity._id?.toString(),
                  userId: activity.userId,
                  userEmail: activity.userEmail,
                  userName: activity.userName,
                  eventType: activity.eventType,
                  eventData: activity.eventData,
                  sessionId: activity.sessionId,
                  timestamp: activity.timestamp,
                }
              };

              const message = `data: ${JSON.stringify(eventData)}\n\n`;
              controller.enqueue(encoder.encode(message));
            }
          }

          clearInterval(heartbeatInterval);
        } catch (error: any) {
          console.error('Error in realtime activity stream:', error);

          // Send error event
          const errorMessage = `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
        } finally {
          // Close change stream
          if (changeStream) {
            await changeStream.close();
          }
          controller.close();
        }
      },

      cancel() {
        // Clean up when client closes connection
        console.log('Client closed realtime activity stream');
      }
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable buffering in nginx
      },
    });

  } catch (error: any) {
    console.error('Error setting up realtime activity stream:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Failed to setup realtime stream' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
