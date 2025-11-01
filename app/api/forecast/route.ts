import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const collection = await getCollection('forecasts');

    // Get latest Kp forecast
    const latestKp = await collection
      .find({ kind: 'kp' })
      .sort({ ts: -1 })
      .limit(1)
      .toArray();

    return NextResponse.json({
      success: true,
      data: {
        kp: latestKp[0] || null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// TODO: Implement forecast generation job (runs every 30 min)
// TODO: Add DST and TEC forecast endpoints
