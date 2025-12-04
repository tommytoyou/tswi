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
  // Use 1-day endpoint for more data (5-minute endpoint only has ~3 entries)
  const noaaUrl = 'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json';

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

  console.log('[NOAA Plasma] Raw data rows:', rawData.length);
  if (rawData.length > 1) {
    console.log('[NOAA Plasma] Header:', JSON.stringify(rawData[0]));
    console.log('[NOAA Plasma] First data row:', JSON.stringify(rawData[1]));
  }

  // Data format: [["time_tag","density","speed","temperature"], ["2025-12-03 01:58:00.000","10.81","401.6","39242"], ...]
  const documents: SolarWindPlasmaDoc[] = [];
  let skippedCount = 0;

  for (let i = 1; i < rawData.length; i++) {
    const item = rawData[i];

    // Check for null or empty values - NOAA sometimes returns null for missing data
    if (!item || !item[0] || item[1] === null || item[1] === '' || item[2] === null || item[2] === '') {
      skippedCount++;
      continue;
    }

    const density = parseFloat(item[1]);
    const speed = parseFloat(item[2]);
    const temp = parseFloat(item[3]);

    // Skip if parsing failed (NaN values)
    if (isNaN(density) || isNaN(speed)) {
      skippedCount++;
      continue;
    }

    documents.push({
      ts: new Date(item[0]),
      density_cm3: density,
      speed_kms: speed,
      temp_k: isNaN(temp) ? 0 : temp,
    });
  }

  console.log('[NOAA Plasma] Parsed documents:', documents.length, '| Skipped:', skippedCount);

  if (documents.length === 0 && rawData.length > 1) {
    console.error('[NOAA Plasma] All rows skipped! Sample row:', JSON.stringify(rawData[1]));
  }

  return { data: documents.slice(-limit), source: 'noaa-live' };
}

/**
 * GET /api/noaa/solar-wind-plasma
 *
 * Fetches NOAA real-time solar wind plasma data from SWPC
 * Source: https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json
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
