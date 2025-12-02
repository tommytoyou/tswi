import { NextRequest, NextResponse } from 'next/server';
import { getTimeSeriesCollection } from '@/lib/db';
import { NoaaXrayFlux } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/noaa/xray-flux
 *
 * Fetches NOAA GOES X-ray flux data from SWPC (6-hour rolling data)
 * Source: https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json
 *
 * Query params:
 * - fetch: 'latest' | 'cached' (default: 'cached')
 * - limit: number (default: 360, max: 720 for full 6 hours)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fetchMode = searchParams.get('fetch') || 'cached';
    const limit = Math.min(parseInt(searchParams.get('limit') || '360'), 720);

    // If fetch=latest, get from NOAA and store in DB
    if (fetchMode === 'latest') {
      const noaaUrl = 'https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json';

      try {
        const response = await fetch(noaaUrl, {
          next: { revalidate: 60 }, // Cache for 1 minute
        });

        if (!response.ok) {
          throw new Error(`NOAA API returned ${response.status}`);
        }

        const rawData = await response.json();

        // Transform NOAA data to our schema
        const collection = await getTimeSeriesCollection<NoaaXrayFlux>('timeseries_noaa_xray_flux');
        const documents: any[] = [];

        for (const item of rawData) {
          if (!item.time_tag || item.flux === null) continue;

          const doc = {
            ts: new Date(item.time_tag),
            satellite: parseInt(item.satellite) || 0,
            flux: parseFloat(item.flux) || 0,
            observed_flux: parseFloat(item.observed_flux) || 0,
            electron_correction: parseFloat(item.electron_correction) || 0,
            electron_contamination: item.electron_contamination || 'false',
            energy: item.energy || '0.05-0.4nm',
            meta: {
              source: 'NOAA-GOES',
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

        // Calculate flare classification from latest flux
        const latest = documents[documents.length - 1];
        const flareClass = latest ? getFlareClass(latest.flux) : null;

        return NextResponse.json({
          success: true,
          data: documents.slice(-limit),
          count: documents.length,
          source: 'noaa-live',
          latest,
          flareClass,
        });
      } catch (fetchError: any) {
        console.error('NOAA fetch error:', fetchError);
        // Fall back to cached data
      }
    }

    // Return cached data from MongoDB
    const collection = await getTimeSeriesCollection<NoaaXrayFlux>('timeseries_noaa_xray_flux');
    const data = await collection
      .find({})
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();

    const latest = data[0] || null;
    const flareClass = latest ? getFlareClass(latest.flux) : null;

    return NextResponse.json({
      success: true,
      data: data.reverse(), // Return chronological order
      count: data.length,
      source: 'mongodb-cache',
      latest,
      flareClass,
    });
  } catch (error: any) {
    console.error('X-ray flux API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch X-ray flux data' },
      { status: 500 }
    );
  }
}

/**
 * Convert X-ray flux to flare classification
 * Based on NOAA Space Weather Scales:
 * - X-class: >= 1e-4 W/m² (R3-R5 radio blackouts)
 * - M-class: >= 1e-5 W/m² (R1-R2 radio blackouts)
 * - C-class: >= 1e-6 W/m² (R0 - minor degradation, no significant blackout)
 * - B-class: >= 1e-7 W/m² (background)
 * - A-class: < 1e-7 W/m² (background)
 */
function getFlareClass(flux: number): string {
  if (flux >= 1e-4) return 'X-class';
  if (flux >= 1e-5) return 'M-class';
  if (flux >= 1e-6) return 'C-class';
  if (flux >= 1e-7) return 'B-class';
  return 'A-class';
}
