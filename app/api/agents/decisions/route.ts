import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAIAccess } from '@/lib/auth/api';

/**
 * AGENT DECISIONS API
 * Fetch and analyze agent decision history
 */
export async function GET(request: NextRequest) {
  // Check if user has AI access
  const authError = await requireAIAccess();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const priority = searchParams.get('priority');
    const decisionType = searchParams.get('type');
    const since = searchParams.get('since');

    const db = await getDb();

    // Build query
    const query: any = {};

    if (priority) {
      query.priority = priority;
    }

    if (decisionType) {
      query.decision_type = decisionType;
    }

    if (since) {
      query.ts = { $gte: new Date(since) };
    }

    // Fetch decisions
    const decisions = await db.collection('agent_decisions')
      .find(query)
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();

    // Calculate statistics
    const stats = {
      total: decisions.length,
      by_priority: {
        critical: decisions.filter((d: any) => d.priority === 'critical').length,
        high: decisions.filter((d: any) => d.priority === 'high').length,
        medium: decisions.filter((d: any) => d.priority === 'medium').length,
        low: decisions.filter((d: any) => d.priority === 'low').length,
      },
      by_outcome: {
        pending: decisions.filter((d: any) => d.outcome === 'pending').length,
        success: decisions.filter((d: any) => d.outcome === 'success').length,
        false_positive: decisions.filter((d: any) => d.outcome === 'false_positive').length,
        missed_event: decisions.filter((d: any) => d.outcome === 'missed_event').length,
      },
      avg_confidence: decisions.reduce((sum: number, d: any) =>
        sum + (d.confidence || 0), 0) / (decisions.length || 1),
    };

    return NextResponse.json({
      success: true,
      data: {
        decisions,
        stats,
        query,
      },
    });

  } catch (error) {
    console.error('Agent decisions error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch decisions',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
