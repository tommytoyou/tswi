import { NextRequest, NextResponse } from 'next/server';
import { getTimeSeriesCollection, upsertNoaaDocs } from '@/lib/db';
import { NoaaSolarWindMag } from '@/lib/types';
import { selectRtswByMinute, num, type RtswRecord } from '@/lib/noaa-rtsw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NOAA_MAG_URL = 'https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json';

/**
 * Parse rtsw_mag_1m.json: one record per minute, preferring the active spacecraft.
 * RTSW names the GSM angles phi_gsm (longitude) and theta_gsm (latitude).
 */
function parseMagRecords(rawData: unknown): Array<NoaaSolarWindMag & { source: string }> {
  if (!Array.isArray(rawData)) {
    throw new Error('NOAA mag response is not an array');
  }

  const selected = selectRtswByMinute(rawData as RtswRecord[], ['bt', 'bx_gsm', 'by_gsm', 'bz_gsm']);
  const documents: Array<NoaaSolarWindMag & { source: string }> = [];

  for (const { ts, record } of selected) {
    const bz = num(record.bz_gsm);
    const bt = num(record.bt);
    // Bz and Bt drive every consumer (storm coupling); skip minutes without them
    if (bz === null || bt === null) continue;

    documents.push({
      ts,
      bx_gsm: num(record.bx_gsm) ?? 0,
      by_gsm: num(record.by_gsm) ?? 0,
      bz_gsm: bz,
      lon_gsm: num(record.phi_gsm) ?? 0,
      lat_gsm: num(record.theta_gsm) ?? 0,
      bt,
      source: record.source,
    });
  }

  return documents;
}

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
      try {
        const response = await fetch(NOAA_MAG_URL, { cache: 'no-store' });

        if (!response.ok) {
          throw new Error(`NOAA API returned ${response.status}`);
        }

        const documents = parseMagRecords(await response.json());

        // Upsert on the natural key so re-fetching never duplicates; failures are logged
        try {
          const fetchedAt = new Date();
          await upsertNoaaDocs(
            'timeseries_noaa_solarwind_mag',
            documents.map((d) => ({ ...d, meta: { source: 'NOAA-SWPC-RTSW', fetched_at: fetchedAt } }))
          );
        } catch (dbError) {
          console.error(
            '[NOAA] Write to timeseries_noaa_solarwind_mag failed:',
            dbError instanceof Error ? dbError.message : String(dbError)
          );
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
    const response = await fetch(NOAA_MAG_URL, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`NOAA API returned ${response.status}`);
    }

    const documents = parseMagRecords(await response.json());

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
