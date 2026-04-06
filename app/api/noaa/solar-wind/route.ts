import { NextRequest, NextResponse } from 'next/server';
import { getTimeSeriesCollection } from '@/lib/db';
import { NoaaSolarWindMag } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/noaa/solar-wind
 *
 * Fetches NOAA real-time solar wind magnetic field data from SWPC
 * Source: https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json
 *
 * Query params:
 * - fetch: 'latest' | 'cached' (default: 'cached')
 * - limit: number (default: 60, max: 1440 for 24 hours)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fetchMode = searchParams.get('fetch') || 'cached';
    const limit = Math.min(parseInt(searchParams.get('limit') || '60'), 1440);

    // If fetch=latest, get from NOAA and store in DB
    if (fetchMode === 'latest') {
      const noaaUrl = 'https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json';

      try {
        const response = await fetch(noaaUrl, {
          next: { revalidate: 60 }, // Cache for 1 minute
        });

        if (!response.ok) {
          throw new Error(`NOAA API returned ${response.status}`);
        }

        const rawData = await response.json();

        // Transform NOAA data to our schema
        const collection = await getTimeSeriesCollection<NoaaSolarWindMag>('timeseries_noaa_solarwind_mag');
        const documents: any[] = [];

        for (const item of rawData) {
          if (!item.time_tag || item.bx_gsm === null) continue;

          const doc = {
            ts: new Date(item.time_tag),
            bx_gsm: parseFloat(item.bx_gsm) || 0,
            by_gsm: parseFloat(item.by_gsm) || 0,
            bz_gsm: parseFloat(item.bz_gsm) || 0,
            lon_gsm: parseFloat(item.lon_gsm) || 0,
            lat_gsm: parseFloat(item.lat_gsm) || 0,
            bt: parseFloat(item.bt) || 0,
            meta: {
              source: 'NOAA-SWPC',
              fetched_at: new Date(),
            },
          };

          documents.push(doc);
        }

        // Insert new data (upsert by timestamp)
        if (documents.length > 0) {
          await collection.insertMany(documents, { ordered: false }).catch(() => {
            // Ignore duplicate key errors
          });
        }

        return NextResponse.json({
          success: true,
          data: documents.slice(-limit),
          count: documents.length,
          source: 'noaa-live',
        });
      } catch (fetchError: any) {
        console.error('NOAA fetch error:', fetchError);
        // Fall back to cached data
      }
    }

    // Try cached data from MongoDB first
    try {
      const collection = await getTimeSeriesCollection<NoaaSolarWindMag>('timeseries_noaa_solarwind_mag');
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
    const noaaUrl = 'https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json';
    const response = await fetch(noaaUrl, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`NOAA API returned ${response.status}`);
    }

    const rawData = await response.json();
    const documents: any[] = [];

    for (const item of rawData) {
      if (!item.time_tag || item.bx_gsm === null) continue;

      documents.push({
        ts: new Date(item.time_tag),
        bx_gsm: parseFloat(item.bx_gsm) || 0,
        by_gsm: parseFloat(item.by_gsm) || 0,
        bz_gsm: parseFloat(item.bz_gsm) || 0,
        lon_gsm: parseFloat(item.lon_gsm) || 0,
        lat_gsm: parseFloat(item.lat_gsm) || 0,
        bt: parseFloat(item.bt) || 0,
      });
    }

    return NextResponse.json({
      success: true,
      data: documents.slice(-limit),
      count: documents.length,
      source: 'noaa-live-fallback',
    });
  } catch (error: any) {
    console.error('Solar wind API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch solar wind data' },
      { status: 500 }
    );
  }
}
