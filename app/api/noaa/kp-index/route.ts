import { NextRequest, NextResponse } from 'next/server';
import { getTimeSeriesCollection } from '@/lib/db';
import { NoaaKpIndex } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  try {
    const { searchParams } = new URL(request.url);
    const fetchMode = searchParams.get('fetch') || 'cached';
    const limit = Math.min(parseInt(searchParams.get('limit') || '60'), 1440);

    // If fetch=latest, get from NOAA and store in DB
    if (fetchMode === 'latest') {
      const noaaUrl = 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json';

      try {
        const response = await fetch(noaaUrl, {
          next: { revalidate: 60 }, // Cache for 1 minute
        });

        if (!response.ok) {
          throw new Error(`NOAA API returned ${response.status}`);
        }

        const rawData = await response.json();

        // Transform NOAA data to our schema
        const collection = await getTimeSeriesCollection<NoaaKpIndex>('timeseries_noaa_kp_index');
        const documents: any[] = [];

        for (const item of rawData) {
          if (!item.time_tag || item.kp_index === null) continue;

          const doc = {
            ts: new Date(item.time_tag),
            kp: parseFloat(item.kp_index) || 0,
            kp_index: parseFloat(item.kp_index) || 0,
            a_running: parseFloat(item.a_running) || 0,
            station_count: parseInt(item.station_count) || 0,
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
          latest: documents[documents.length - 1] || null,
        });
      } catch (fetchError: any) {
        console.error('NOAA fetch error:', fetchError);
        // Fall back to cached data
      }
    }

    // Return cached data from MongoDB
    const collection = await getTimeSeriesCollection<NoaaKpIndex>('timeseries_noaa_kp_index');
    const data = await collection
      .find({})
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      data: data.reverse(), // Return chronological order
      count: data.length,
      source: 'mongodb-cache',
      latest: data[data.length - 1] || null,
    });
  } catch (error: any) {
    console.error('Kp index API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch Kp index data' },
      { status: 500 }
    );
  }
}
