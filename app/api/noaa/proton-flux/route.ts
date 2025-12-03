import { NextRequest, NextResponse } from 'next/server';
import { getTimeSeriesCollection } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProtonFluxDoc {
  ts: Date;
  p10_pfu: number;  // >=10 MeV protons (pfu)
  p50_pfu: number;  // >=50 MeV protons (pfu)
  p100_pfu: number; // >=100 MeV protons (pfu)
  s_scale: number;  // S1-S5 radiation storm scale (0 = no storm)
  meta?: {
    source: string;
    fetched_at: Date;
  };
}

/**
 * Calculate S-scale radiation storm level based on >10 MeV proton flux
 * S1: 10 pfu
 * S2: 100 pfu
 * S3: 1000 pfu
 * S4: 10000 pfu
 * S5: 100000 pfu
 */
function calculateSScale(p10: number): number {
  if (p10 >= 100000) return 5;
  if (p10 >= 10000) return 4;
  if (p10 >= 1000) return 3;
  if (p10 >= 100) return 2;
  if (p10 >= 10) return 1;
  return 0;
}

/**
 * GET /api/noaa/proton-flux
 *
 * Fetches NOAA GOES integral proton flux data
 * Source: https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json
 *
 * Query params:
 * - fetch: 'latest' | 'cached' (default: 'cached')
 * - limit: number (default: 288, max: 1440 for 5 days at 5-min intervals)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fetchMode = searchParams.get('fetch') || 'cached';
    const limit = Math.min(parseInt(searchParams.get('limit') || '288'), 1440);

    // If fetch=latest, get from NOAA and store in DB
    if (fetchMode === 'latest') {
      const noaaUrl = 'https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json';

      try {
        const response = await fetch(noaaUrl, {
          next: { revalidate: 300 }, // Cache for 5 minutes
        });

        if (!response.ok) {
          throw new Error(`NOAA API returned ${response.status}`);
        }

        const rawData = await response.json();

        // Transform NOAA data to our schema
        // Data format: {"time_tag":"2025-12-02T02:05:00Z","satellite":18,"flux":1.809,"energy":">=10 MeV"}
        const collection = await getTimeSeriesCollection<ProtonFluxDoc>('timeseries_noaa_proton_flux');

        // Group data by timestamp to combine different energy levels
        const timestampMap = new Map<string, { p10: number; p50: number; p100: number }>();

        for (const item of rawData) {
          if (!item.time_tag || item.flux === null) continue;

          const ts = item.time_tag;
          if (!timestampMap.has(ts)) {
            timestampMap.set(ts, { p10: 0, p50: 0, p100: 0 });
          }

          const entry = timestampMap.get(ts)!;
          const energy = item.energy;

          // Map energy levels
          if (energy === '>=10 MeV') {
            entry.p10 = parseFloat(item.flux) || 0;
          } else if (energy === '>=50 MeV') {
            entry.p50 = parseFloat(item.flux) || 0;
          } else if (energy === '>=100 MeV') {
            entry.p100 = parseFloat(item.flux) || 0;
          }
        }

        // Convert to documents
        const documents: ProtonFluxDoc[] = [];
        for (const [ts, values] of timestampMap) {
          documents.push({
            ts: new Date(ts),
            p10_pfu: values.p10,
            p50_pfu: values.p50,
            p100_pfu: values.p100,
            s_scale: calculateSScale(values.p10),
            meta: {
              source: 'NOAA-SWPC-GOES',
              fetched_at: new Date(),
            },
          });
        }

        // Sort by timestamp
        documents.sort((a, b) => a.ts.getTime() - b.ts.getTime());

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
        console.error('NOAA proton flux fetch error:', fetchError);
        // Fall back to cached data
      }
    }

    // Return cached data from MongoDB
    const collection = await getTimeSeriesCollection<ProtonFluxDoc>('timeseries_noaa_proton_flux');
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
    console.error('Proton flux API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch proton flux data' },
      { status: 500 }
    );
  }
}
