import { NextRequest, NextResponse } from 'next/server';
import { getTimeSeriesCollection } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SolarWindPlasmaDoc {
  ts: Date;
  speed_kms: number;
  density_cm3: number;
  temp_k: number;
  meta?: {
    source: string;
    fetched_at: Date;
  };
}

/**
 * Helper function to fetch and parse NOAA solar wind plasma data
 */
async function fetchFromNOAA(limit: number): Promise<{ data: SolarWindPlasmaDoc[]; source: string }> {
  const noaaUrl = 'https://services.swpc.noaa.gov/products/solar-wind/plasma-5-minute.json';
  const response = await fetch(noaaUrl, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`NOAA API returned ${response.status}`);
  }

  const rawData = await response.json();
  // Data format: [["time_tag","density","speed","temperature"], ["2025-12-03 01:58:00.000","10.81","401.6","39242"], ...]

  const documents: SolarWindPlasmaDoc[] = [];
  for (let i = 1; i < rawData.length; i++) {
    const item = rawData[i];
    if (!item[0] || item[1] === null || item[2] === null) continue;

    documents.push({
      ts: new Date(item[0]),
      density_cm3: parseFloat(item[1]) || 0,
      speed_kms: parseFloat(item[2]) || 0,
      temp_k: parseFloat(item[3]) || 0,
    });
  }

  return { data: documents.slice(-limit), source: 'noaa-live' };
}

/**
 * GET /api/noaa/solar-wind-plasma
 *
 * Fetches NOAA real-time solar wind plasma data from SWPC
 * Source: https://services.swpc.noaa.gov/products/solar-wind/plasma-5-minute.json
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
      getTimeSeriesCollection<SolarWindPlasmaDoc>('timeseries_noaa_solarwind_plasma')
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
      });
    } catch (error: any) {
      console.error('NOAA plasma fetch error:', error);
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to fetch from NOAA' },
        { status: 500 }
      );
    }
  }

  // For cached mode, try MongoDB first, then fallback to NOAA
  try {
    const collection = await getTimeSeriesCollection<SolarWindPlasmaDoc>('timeseries_noaa_solarwind_plasma');
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
    console.error('Solar wind plasma API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch solar wind plasma data' },
      { status: 500 }
    );
  }
}
