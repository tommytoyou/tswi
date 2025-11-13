import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { analyzeSpaceWeather } from '@/lib/agent';

/**
 * MONITORING AGENT API
 * Main endpoint for the autonomous monitoring agent
 *
 * GET /api/agents/monitoring-agent
 * - Returns current agent status and recent decisions
 * - Query params:
 *   - analyze=true: Triggers immediate analysis
 *   - limit=N: Number of recent decisions to return
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shouldAnalyze = searchParams.get('analyze') === 'true';
    const limit = parseInt(searchParams.get('limit') || '10');

    const db = await getDb();

    // Trigger immediate analysis if requested
    let currentDecision = null;
    if (shouldAnalyze) {
      currentDecision = await analyzeSpaceWeather();
    }

    // Fetch recent decisions
    const recentDecisions = await db.collection('agent_decisions')
      .find()
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();

    // Get agent metrics
    const latestMetrics = await db.collection('agent_metrics')
      .find()
      .sort({ ts: -1 })
      .limit(1)
      .toArray();

    // Get active thresholds
    const thresholds = await db.collection('adaptive_thresholds')
      .find()
      .toArray();

    // Get recent alert history
    const recentAlerts = await db.collection('alert_history')
      .find()
      .sort({ triggered_at: -1 })
      .limit(10)
      .toArray();

    return NextResponse.json({
      success: true,
      data: {
        status: 'operational',
        current_decision: currentDecision,
        recent_decisions: recentDecisions,
        metrics: latestMetrics[0] || null,
        adaptive_thresholds: thresholds,
        recent_alerts: recentAlerts,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Monitoring agent error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch agent data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/monitoring-agent
 * - Update agent configuration
 * - Provide feedback on decisions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, decision_id, feedback } = body;

    const db = await getDb();

    if (action === 'feedback' && decision_id && feedback) {
      // User feedback on a decision
      const result = await db.collection('agent_decisions').updateOne(
        { _id: decision_id },
        {
          $set: {
            user_feedback: feedback.comment,
            outcome: feedback.outcome, // 'success', 'false_positive', 'missed_event'
          }
        }
      );

      // If marking as false positive, update alert history too
      if (feedback.outcome === 'false_positive' && feedback.alert_id) {
        await db.collection('alert_history').updateOne(
          { _id: feedback.alert_id },
          {
            $set: {
              false_positive: true,
              user_feedback: feedback.comment,
            }
          }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Feedback recorded',
        modified: result.modifiedCount,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Monitoring agent POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
