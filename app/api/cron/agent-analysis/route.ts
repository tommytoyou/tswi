import { NextRequest, NextResponse } from 'next/server';
import { analyzeSpaceWeather } from '@/lib/agent';

/**
 * CRON JOB: Agent Analysis
 * Runs every 5 minutes to analyze space weather with AI reasoning
 * Makes autonomous decisions about alert priorities
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Agent] Starting autonomous analysis...');

    const decision = await analyzeSpaceWeather();

    console.log(`[Agent] Decision: ${decision.priority} priority`);
    console.log(`[Agent] Reasoning: ${decision.reasoning}`);
    console.log(`[Agent] Confidence: ${decision.confidence}`);

    return NextResponse.json({
      success: true,
      decision: {
        priority: decision.priority,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
        action: decision.action_taken,
        timestamp: decision.ts,
      },
    });

  } catch (error) {
    console.error('[Agent] Analysis failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Agent analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
