import { NextRequest, NextResponse } from 'next/server';
import { getTimeSeriesCollection } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  collection: z.enum([
    'timeseries_kp',
    'timeseries_dst',
    'timeseries_solarwind_plasma',
    'timeseries_solarwind_mag',
    'timeseries_goes_protons',
    'timeseries_tec_regional',
  ]),
  start: z.string().datetime(),
  end: z.string().datetime(),
  limit: z.coerce.number().min(1).max(10000).optional().default(1000),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = querySchema.parse({
      collection: searchParams.get('collection'),
      start: searchParams.get('start'),
      end: searchParams.get('end'),
      limit: searchParams.get('limit'),
    });

    const collection = await getTimeSeriesCollection(params.collection);
    
    const results = await collection
      .find({
        ts: {
          $gte: new Date(params.start),
          $lte: new Date(params.end),
        },
      })
      .sort({ ts: -1 })
      .limit(params.limit)
      .toArray();

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    console.error('Timeseries API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 400 }
    );
  }
}

// TODO: POST endpoint for data ingestion (with auth)
