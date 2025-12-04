import { NextRequest, NextResponse } from 'next/server';
import { getTimeSeriesCollection } from '@/lib/db';
import { NoaaKpIndex } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Helper function to fetch and parse NOAA Kp index data
 */
async function fetchFromNOAA(limit: number): Promise<{ data: any[]; source: string }> {
  const noaaUrl = 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json';
  const response = await fetch(noaaUrl, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`NOAA API returned ${response.status}`);
  }

  const rawData = await response.json();
  const documents: any[] = [];

  for (const item of rawData) {
    if (!item.time_tag || item.kp_index === null) continue;

    documents.push({
      ts: new Date(item.time_tag),
      kp: parseFloat(item.kp_index) || 0,
      kp_index: parseFloat(item.kp_index) || 0,
      a_running: parseFloat(item.a_running) || 0,
      station_count: parseInt(item.station_count) || 0,
    });
  }

  return { data: documents.slice(-limit), source: 'noaa-live' };
}

/**
 * GET /api/noaa/kp-index
 *
 * Fetches NOAA real-time planetary K-index data from SWPC
 * Source: https://services.swpc.noaa.gov/json/planetary_k_index_1m.json
 *
 * Query params:
 * - fetch: 'latest' | 'cached' (default: 'cached')
 * - limit: number (default: 60, max: 1440 for 24 hours)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fetchMode = searchParams.get('fetch') || 'cached';
  const limit = Math.min(parseInt(searchParams.get('limit') || '60'), 1440);

  // If fetch=latest, always fetch from NOAA directly
  if (fetchMode === 'latest') {
    try {
      const result = await fetchFromNOAA(limit);

      // Try to store in MongoDB (non-blocking, ignore errors)
      getTimeSeriesCollection<NoaaKpIndex>('timeseries_noaa_kp_index')
        .then(collection => {
          const docsWithMeta = result.data.map(d => ({
            ...d,
            meta: { source: 'NOAA-SWPC', fetched_at: new Date() }
          }));
          return collection.insertMany(docsWithMeta, { ordered: false });
        })
        .catch(() => { /* Ignore MongoDB errors */ });

      return NextResponse.json({
        success: true,
        data: result.data,
        count: result.data.length,
        source: result.source,
        latest: result.data[result.data.length - 1] || null,
      });
    } catch (error: any) {
      console.error('NOAA Kp index fetch error:', error);
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to fetch from NOAA' },
        { status: 500 }
      );
    }
  }

  // For cached mode, try MongoDB first, then fallback to NOAA
  try {
    const collection = await getTimeSeriesCollection<NoaaKpIndex>('timeseries_noaa_kp_index');
    const data = await collection
      .find({})
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();

    if (data.length > 0) {
      return NextResponse.json({
        success: true,
        data: data.reverse(), // Return chronological order
        count: data.length,
        source: 'mongodb-cache',
        latest: data[data.length - 1] || null,
      });
    }
  } catch (dbError) {
    console.log('MongoDB unavailable, falling back to NOAA direct fetch');
  }

  // Fallback to NOAA if cache is empty or MongoDB unavailable
  try {
    const result = await fetchFromNOAA(limit);
    return NextResponse.json({
      success: true,
      data: result.data,
      count: result.data.length,
      source: 'noaa-live-fallback',
      latest: result.data[result.data.length - 1] || null,
    });
  } catch (error: any) {
    console.error('Kp index API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch Kp index data' },
      { status: 500 }
    );
  }
}
