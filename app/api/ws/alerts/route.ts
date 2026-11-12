import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api';
import { checkCronAuth } from '@/lib/cron-auth';

/**
 * WEBSOCKET ALERTS API
 * Real-time alert streaming via Server-Sent Events (SSE)
 *
 * Note: Using SSE for real-time communication
 * For true WebSocket support, consider using Pusher, Ably, or Socket.io
 */

// Node runtime: the session and cron-secret checks need Node APIs
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE endpoint for real-time alerts
 */
export async function GET(request: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  // Create a TransformStream for SSE
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Send initial connection message
  const sendEvent = async (event: string, data: any) => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    await writer.write(encoder.encode(message));
  };

  // Start heartbeat
  const heartbeat = setInterval(async () => {
    try {
      await sendEvent('heartbeat', { timestamp: new Date().toISOString() });
    } catch (error) {
      clearInterval(heartbeat);
    }
  }, 30000); // Every 30 seconds

  // Send welcome message
  await sendEvent('connected', {
    message: 'Connected to TSWI alert stream',
    timestamp: new Date().toISOString(),
  });

  // Clean up on close
  request.signal.addEventListener('abort', () => {
    clearInterval(heartbeat);
    writer.close();
  });

  // Return SSE response
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * POST endpoint to broadcast alert
 * Called by the alert evaluation cron job (Bearer CRON_SECRET) or a logged-in user
 */
export async function POST(request: NextRequest) {
  // The alert-evaluation cron calls this with the cron Bearer token; users need a session
  const authError = request.headers.has('authorization')
    ? checkCronAuth(request, 'ws-alerts')
    : await requireAuth();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { alert, priority, reasoning } = body;

    // In a production system, you would:
    // 1. Store alert in a message queue (Redis, RabbitMQ)
    // 2. Broadcast to all connected SSE clients
    // 3. Use a WebSocket service like Pusher or Ably

    // For now, just acknowledge receipt
    console.log(`[WebSocket] Alert broadcast requested: ${alert.name} (${priority})`);

    return NextResponse.json({
      success: true,
      message: 'Alert queued for broadcast',
    });

  } catch (error) {
    console.error('[WebSocket] Broadcast error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to broadcast alert',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Example of how to use with a proper WebSocket service:
 *
 * // Using Pusher
 * import Pusher from 'pusher';
 *
 * const pusher = new Pusher({
 *   appId: process.env.PUSHER_APP_ID,
 *   key: process.env.PUSHER_KEY,
 *   secret: process.env.PUSHER_SECRET,
 *   cluster: process.env.PUSHER_CLUSTER,
 * });
 *
 * await pusher.trigger('alerts', 'new-alert', {
 *   alert,
 *   priority,
 *   reasoning,
 *   timestamp: new Date().toISOString(),
 * });
 */
