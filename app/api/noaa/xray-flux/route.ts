import { NextRequest, NextResponse } from 'next/server';
import { getTimeSeriesCollection } from '@/lib/db';
import { NoaaXrayFlux } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Helper function to fetch and parse NOAA X-ray flux data
 */
async function fetchFromNOAA(limit: number): Promise<{ data: any[]; source: string }> {
  const noaaUrl = 'https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json';
  const response = await fetch(noaaUrl, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`NOAA API returned ${response.status}`);
  }

  const rawData = await response.json();
  const documents: any[] = [];

  for (const item of rawData) {
    if (!item.time_tag || item.flux === null) continue;

    documents.push({
      ts: new Date(item.time_tag),
      satellite: parseInt(item.satellite) || 0,
      flux: parseFloat(item.flux) || 0,
      observed_flux: parseFloat(item.observed_flux) || 0,
      electron_correction: parseFloat(item.electron_correction) || 0,
      electron_contamination: item.electron_contamination || 'false',
      energy: item.energy || '0.05-0.4nm',
    });
  }

  return { data: documents.slice(-limit), source: 'noaa-live' };
}

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
  const { searchParams } = new URL(request.url);
  const fetchMode = searchParams.get('fetch') || 'cached';
  const limit = Math.min(parseInt(searchParams.get('limit') || '360'), 720);

  // If fetch=latest, always fetch from NOAA directly
  if (fetchMode === 'latest') {
    try {
      const result = await fetchFromNOAA(limit);

      // Try to store in MongoDB (non-blocking, ignore errors)
      getTimeSeriesCollection<NoaaXrayFlux>('timeseries_noaa_xray_flux')
        .then(collection => {
          const docsWithMeta = result.data.map(d => ({
            ...d,
            meta: { source: 'NOAA-GOES', fetched_at: new Date() }
          }));
          return collection.insertMany(docsWithMeta, { ordered: false });
        })
        .catch(() => { /* Ignore MongoDB errors */ });

      const latest = result.data[result.data.length - 1] || null;
      const flareClass = latest ? getFlareClass(latest.flux) : null;

      return NextResponse.json({
        success: true,
        data: result.data,
        count: result.data.length,
        source: result.source,
        latest,
        flareClass,
      });
    } catch (error: any) {
      console.error('NOAA X-ray flux fetch error:', error);
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to fetch from NOAA' },
        { status: 500 }
      );
    }
  }

  // For cached mode, try MongoDB first, then fallback to NOAA
  try {
    const collection = await getTimeSeriesCollection<NoaaXrayFlux>('timeseries_noaa_xray_flux');
    const data = await collection
      .find({})
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();

    if (data.length > 0) {
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
    }
  } catch (dbError) {
    console.log('MongoDB unavailable, falling back to NOAA direct fetch');
  }

  // Fallback to NOAA if cache is empty or MongoDB unavailable
  try {
    const result = await fetchFromNOAA(limit);
    const latest = result.data[result.data.length - 1] || null;
    const flareClass = latest ? getFlareClass(latest.flux) : null;

    return NextResponse.json({
      success: true,
      data: result.data,
      count: result.data.length,
      source: 'noaa-live-fallback',
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
