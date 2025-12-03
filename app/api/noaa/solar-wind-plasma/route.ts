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
  try {
    const { searchParams } = new URL(request.url);
    const fetchMode = searchParams.get('fetch') || 'cached';
    const limit = Math.min(parseInt(searchParams.get('limit') || '60'), 1440);

    // If fetch=latest, get from NOAA and store in DB
    if (fetchMode === 'latest') {
      const noaaUrl = 'https://services.swpc.noaa.gov/products/solar-wind/plasma-5-minute.json';

      try {
        const response = await fetch(noaaUrl, {
          next: { revalidate: 60 }, // Cache for 1 minute
        });

        if (!response.ok) {
          throw new Error(`NOAA API returned ${response.status}`);
        }

        const rawData = await response.json();

        // Transform NOAA data to our schema
        // Data format: [["time_tag","density","speed","temperature"], ["2025-12-03 01:58:00.000","10.81","401.6","39242"], ...]
        const collection = await getTimeSeriesCollection<SolarWindPlasmaDoc>('timeseries_noaa_solarwind_plasma');
        const documents: SolarWindPlasmaDoc[] = [];

        // Skip header row
        for (let i = 1; i < rawData.length; i++) {
          const item = rawData[i];
          if (!item[0] || item[1] === null || item[2] === null) continue;

          const doc: SolarWindPlasmaDoc = {
            ts: new Date(item[0]),
            density_cm3: parseFloat(item[1]) || 0,
            speed_kms: parseFloat(item[2]) || 0,
            temp_k: parseFloat(item[3]) || 0,
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
        console.error('NOAA plasma fetch error:', fetchError);
        // Fall back to cached data
      }
    }

    // Return cached data from MongoDB
    const collection = await getTimeSeriesCollection<SolarWindPlasmaDoc>('timeseries_noaa_solarwind_plasma');
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
    });
  } catch (error: any) {
    console.error('Solar wind plasma API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch solar wind plasma data' },
      { status: 500 }
    );
  }
}
