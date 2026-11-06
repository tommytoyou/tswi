import { NextRequest, NextResponse } from 'next/server';
import { getTimeSeriesCollection, upsertNoaaDocs } from '@/lib/db';
import { selectRtswByMinute, num, type RtswRecord } from '@/lib/noaa-rtsw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SolarWindPlasmaDoc {
  ts: Date;
  speed_kms: number;
  density_cm3: number;
  temp_k: number;
  source?: string; // RTSW spacecraft (SOLAR1, ACE, IMAP)
  meta?: {
    source: string;
    fetched_at: Date;
  };
}

/**
 * Helper function to fetch and parse NOAA solar wind plasma data
 */
async function fetchFromNOAA(limit: number): Promise<{ data: SolarWindPlasmaDoc[]; source: string }> {
  // RTSW 1-minute feed (replaced products/solar-wind/plasma-1-day.json, NOAA SCN 26-21)
  const noaaUrl = 'https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json';

  console.log('[NOAA Plasma] Fetching from:', noaaUrl);

  const response = await fetch(noaaUrl, {
    cache: 'no-store',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'TSWI-SpaceWeather/1.0'
    }
  });

  console.log('[NOAA Plasma] Response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Could not read response body');
    console.error('[NOAA Plasma] Error response body:', errorText.substring(0, 500));
    throw new Error(`NOAA API returned ${response.status}: ${response.statusText}`);
  }

  const responseText = await response.text();
  console.log('[NOAA Plasma] Response length:', responseText.length, 'bytes');
  console.log('[NOAA Plasma] Response preview:', responseText.substring(0, 300));

  let rawData;
  try {
    rawData = JSON.parse(responseText);
  } catch (parseError: any) {
    console.error('[NOAA Plasma] JSON parse error:', parseError.message);
    console.error('[NOAA Plasma] Raw response (first 500 chars):', responseText.substring(0, 500));
    throw new Error(`Failed to parse NOAA response: ${parseError.message}`);
  }

  if (!Array.isArray(rawData)) {
    console.error('[NOAA Plasma] Unexpected response type:', typeof rawData);
    throw new Error('NOAA response is not an array');
  }

  // Records: { time_tag, active, source, proton_density, proton_speed, proton_temperature, ... }
  // One record per spacecraft per minute; keep the active one (see selectRtswByMinute).
  const selected = selectRtswByMinute(rawData as RtswRecord[], [
    'proton_density',
    'proton_speed',
    'proton_temperature',
  ]);

  const documents: SolarWindPlasmaDoc[] = [];
  let skippedCount = 0;

  for (const { ts, record } of selected) {
    const density = num(record.proton_density);
    const speed = num(record.proton_speed);
    const temp = num(record.proton_temperature);

    // Density and speed are required for every consumer of this series
    if (density === null || speed === null) {
      skippedCount++;
      continue;
    }

    // Map renamed RTSW fields to the existing stored names so consumers keep working
    documents.push({
      ts,
      density_cm3: density,
      speed_kms: speed,
      temp_k: temp ?? 0,
      source: record.source,
    });
  }

  if (documents.length === 0 && rawData.length > 0) {
    console.error('[NOAA Plasma] All rows skipped! Sample row:', JSON.stringify(rawData[0]));
  }

  return { data: documents.slice(-limit), source: 'noaa-live' };
}

/**
 * GET /api/noaa/solar-wind-plasma
 *
 * Fetches NOAA real-time solar wind plasma data from SWPC
 * Source: https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json
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

      // Store in MongoDB. Upsert on the natural key so re-fetching the same
      // NOAA window never duplicates readings. Failures are logged, not hidden.
      try {
        const fetchedAt = new Date();
        await upsertNoaaDocs(
          'timeseries_noaa_solarwind_plasma',
          result.data.map(d => ({ ...d, meta: { source: 'NOAA-SWPC', fetched_at: fetchedAt } }))
        );
      } catch (dbError) {
        console.error(
          '[NOAA] Write to timeseries_noaa_solarwind_plasma failed:',
          dbError instanceof Error ? dbError.message : String(dbError)
        );
      }

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
