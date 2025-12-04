import { NextRequest, NextResponse } from 'next/server';
import { getTimeSeriesCollection } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DstDoc {
  ts: Date;
  dst_nt: number;  // Dst index in nT
  storm_level: string; // quiet, minor, moderate, intense, super-storm
  meta?: {
    source: string;
    fetched_at: Date;
  };
}

/**
 * Calculate storm level based on Dst index
 * Quiet: Dst > -20 nT
 * Minor storm: -20 to -50 nT
 * Moderate: -50 to -100 nT
 * Intense: -100 to -200 nT
 * Super-storm: < -200 nT
 */
function getStormLevel(dst: number): string {
  if (dst > -20) return 'quiet';
  if (dst > -50) return 'minor';
  if (dst > -100) return 'moderate';
  if (dst > -200) return 'intense';
  return 'super-storm';
}

/**
 * Helper function to fetch and parse NOAA DST data
 */
async function fetchFromNOAA(limit: number): Promise<{ data: DstDoc[]; source: string }> {
  const noaaUrl = 'https://services.swpc.noaa.gov/products/kyoto-dst.json';
  const response = await fetch(noaaUrl, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`NOAA API returned ${response.status}`);
  }

  const rawData = await response.json();
  // Data format: [["time_tag","dst"], ["2025-11-26 03:00:00","-22"], ...]

  const documents: DstDoc[] = [];
  // Skip header row
  for (let i = 1; i < rawData.length; i++) {
    const item = rawData[i];
    if (!item[0] || item[1] === null) continue;

    const dst = parseInt(item[1]) || 0;
    documents.push({
      ts: new Date(item[0]),
      dst_nt: dst,
      storm_level: getStormLevel(dst),
    });
  }

  return { data: documents.slice(-limit), source: 'noaa-live' };
}

/**
 * GET /api/noaa/dst
 *
 * Fetches NOAA Kyoto Dst index data
 * Source: https://services.swpc.noaa.gov/products/kyoto-dst.json
 *
 * Query params:
 * - fetch: 'latest' | 'cached' (default: 'cached')
 * - limit: number (default: 168, max: 720 for 30 days hourly)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fetchMode = searchParams.get('fetch') || 'cached';
  const limit = Math.min(parseInt(searchParams.get('limit') || '168'), 720);

  // If fetch=latest, always fetch from NOAA directly
  if (fetchMode === 'latest') {
    try {
      const result = await fetchFromNOAA(limit);

      // Try to store in MongoDB (non-blocking, ignore errors)
      getTimeSeriesCollection<DstDoc>('timeseries_noaa_dst')
        .then(collection => {
          const docsWithMeta = result.data.map(d => ({
            ...d,
            meta: { source: 'NOAA-SWPC-Kyoto', fetched_at: new Date() }
          }));
          return collection.insertMany(docsWithMeta, { ordered: false });
        })
        .catch(() => { /* Ignore MongoDB errors */ });

      return NextResponse.json({
        success: true,
        data: result.data,
        count: result.data.length,
        source: result.source,
      });
    } catch (error: any) {
      console.error('NOAA DST fetch error:', error);
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to fetch from NOAA' },
        { status: 500 }
      );
    }
  }

  // For cached mode, try MongoDB first, then fallback to NOAA
  try {
    const collection = await getTimeSeriesCollection<DstDoc>('timeseries_noaa_dst');
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
    });
  } catch (error: any) {
    console.error('DST API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch DST data' },
      { status: 500 }
    );
  }
}
