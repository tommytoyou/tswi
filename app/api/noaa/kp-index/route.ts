import { NextRequest, NextResponse } from 'next/server';
import { getTimeSeriesCollection, upsertNoaaDocs } from '@/lib/db';
import { parseNoaaTime } from '@/lib/noaa-rtsw';
import { NoaaKpIndex } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NOAA_KP_URL = 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json';
const COLLECTION = 'timeseries_noaa_kp_index';
const MAX_CACHE_AGE_MS = 5 * 60 * 1000;
const MAX_HOURS = 168;

/**
 * Fetch NOAA's 1-minute Kp feed (about the last 6 hours), map it to our schema
 * and upsert it into MongoDB. The upsert is awaited so it completes before the
 * response is sent. Returns the parsed rows in chronological order.
 */
async function refreshFromNOAA(): Promise<{ documents: any[]; fetchedAt: Date; saved: boolean }> {
  const response = await fetch(NOAA_KP_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`NOAA API returned ${response.status}`);
  }

  const rawData = await response.json();
  const fetchedAt = new Date();
  const documents: any[] = [];

  for (const item of rawData) {
    if (!item.time_tag || item.kp_index === null) continue;
    const kp = parseFloat(item.kp_index) || 0;
    documents.push({
      ts: parseNoaaTime(item.time_tag),
      kp,
      kp_index: kp,
      a_running: parseFloat(item.a_running) || 0,
      station_count: parseInt(item.station_count) || 0,
      meta: { source: 'NOAA-SWPC', fetched_at: fetchedAt },
    });
  }
  documents.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  let saved = true;
  try {
    await upsertNoaaDocs(COLLECTION, documents);
  } catch (dbError) {
    saved = false;
    console.error(
      `[NOAA] Write to ${COLLECTION} failed:`,
      dbError instanceof Error ? dbError.message : String(dbError)
    );
  }

  return { documents, fetchedAt, saved };
}

/**
 * GET /api/noaa/kp-index
 *
 * NOAA real-time planetary K-index (1-minute) from SWPC
 * Source: https://services.swpc.noaa.gov/json/planetary_k_index_1m.json
 *
 * Query params:
 * - fetch: 'latest' | 'cached' (default: 'cached'; refreshes from NOAA when the
 *   newest MongoDB copy is older than 5 minutes)
 * - hours: time window ending now (max 168). When set, all readings in the
 *   window are returned and `limit` is ignored.
 * - limit: number of newest readings (default: 60, max: 1440). Used when
 *   `hours` is not set.
 *
 * Data is returned in chronological order, with dataTimestamp (newest reading)
 * and fetchedAt (when that copy was fetched from NOAA).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fetchMode = searchParams.get('fetch') || 'cached';
  const limit = Math.min(parseInt(searchParams.get('limit') || '60') || 60, 1440);
  const hoursParam = parseFloat(searchParams.get('hours') || '');
  const hours = Number.isFinite(hoursParam) && hoursParam > 0 ? Math.min(hoursParam, MAX_HOURS) : null;
  const windowStart = hours !== null ? new Date(Date.now() - hours * 3600 * 1000) : null;

  const selectRows = (rows: any[]) =>
    windowStart
      ? rows.filter((d) => new Date(d.ts).getTime() >= windowStart.getTime())
      : rows.slice(-limit);

  const respond = (data: any[], source: string, fetchedAt: Date | string | null, extra: object = {}) => {
    const latest = data[data.length - 1] || null;
    return NextResponse.json({
      success: true,
      data,
      count: data.length,
      source,
      ...extra,
      latest,
      dataTimestamp: latest?.ts ?? null,
      fetchedAt,
      ...(hours !== null ? { windowHours: hours } : {}),
    });
  };

  const readMongo = async () => {
    const collection = await getTimeSeriesCollection<NoaaKpIndex>(COLLECTION);
    const rows = windowStart
      ? await collection.find({ ts: { $gte: windowStart } } as any).sort({ ts: 1 }).toArray()
      : (await collection.find({}).sort({ ts: -1 }).limit(limit).toArray()).reverse();
    return rows;
  };

  // Decide whether NOAA must be fetched: always for fetch=latest, otherwise
  // only when the newest MongoDB copy is older than 5 minutes (or missing).
  let mustRefresh = fetchMode === 'latest';
  let cachedFetchedAt: Date | null = null;
  let mongoAvailable = true;
  if (!mustRefresh) {
    try {
      const collection = await getTimeSeriesCollection<NoaaKpIndex>(COLLECTION);
      const newest: any = await collection.find({}).sort({ ts: -1 }).limit(1).next();
      cachedFetchedAt = newest?.meta?.fetched_at ?? null;
      mustRefresh = !cachedFetchedAt || Date.now() - new Date(cachedFetchedAt).getTime() > MAX_CACHE_AGE_MS;
    } catch (dbError) {
      console.error('Kp index: MongoDB unavailable, fetching NOAA directly:', dbError);
      mongoAvailable = false;
      mustRefresh = true;
    }
  }

  let refreshFailed = false;
  if (mustRefresh) {
    try {
      const { documents, fetchedAt, saved } = await refreshFromNOAA();

      // With a time window, MongoDB supplies readings older than NOAA's ~6 hour
      // feed, so serve the window from MongoDB once the upsert has completed.
      if (saved && mongoAvailable && windowStart) {
        try {
          return respond(await readMongo(), 'noaa-live+mongodb', fetchedAt);
        } catch (dbError) {
          console.error('Kp index: MongoDB read after refresh failed:', dbError);
        }
      }
      return respond(selectRows(documents), 'noaa-live', fetchedAt);
    } catch (error: any) {
      console.error('NOAA Kp index fetch error:', error);
      if (fetchMode === 'latest' || !mongoAvailable) {
        return NextResponse.json(
          { success: false, error: error.message || 'Failed to fetch Kp index data' },
          { status: 500 }
        );
      }
      refreshFailed = true;
    }
  }

  // Serve the MongoDB copy (fresh enough, or NOAA refresh failed)
  try {
    const data = await readMongo();
    return respond(data, 'mongodb-cache', cachedFetchedAt, refreshFailed ? { fallback: 'mongodb' } : {});
  } catch (error: any) {
    console.error('Kp index API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch Kp index data' },
      { status: 500 }
    );
  }
}
