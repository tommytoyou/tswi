import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { NoaaSolarEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Raw record from https://services.swpc.noaa.gov/json/edited_events.json */
interface NoaaEditedEvent {
  begin_datetime: string;
  max_datetime: string | null;
  end_datetime: string | null;
  observatory: string | null;
  type: string;
  location: string | null;
  frequency: string | null;
  particulars1: string | null;
  particulars2: string | null;
  region: number | null;
}

/**
 * NOAA records have no id. begin + type + location alone collides (several
 * observatories report the same event), so observatory and frequency are added.
 */
function buildEventId(e: NoaaEditedEvent): string {
  return [e.begin_datetime, e.type, e.location || '-', e.observatory || '-', e.frequency || '-'].join('|');
}

/**
 * GET /api/noaa/solar-events
 *
 * Fetches NOAA edited solar events from SWPC
 * Source: https://services.swpc.noaa.gov/json/edited_events.json
 *
 * Includes: Solar flares, CMEs, SEP events, geomagnetic storms, radio bursts
 *
 * Query params:
 * - fetch: 'latest' | 'cached' (default: 'cached')
 * - limit: number (default: 50, max: 500)
 * - type: 'FLA' | 'CME' | 'SEP' | 'all' (default: 'all')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fetchMode = searchParams.get('fetch') || 'cached';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
    const eventType = searchParams.get('type') || 'all';

    // If fetch=latest, get from NOAA and store in DB
    if (fetchMode === 'latest') {
      const noaaUrl = 'https://services.swpc.noaa.gov/json/edited_events.json';

      try {
        const response = await fetch(noaaUrl, { cache: 'no-store' });

        if (!response.ok) {
          throw new Error(`NOAA API returned ${response.status}`);
        }

        const rawData: NoaaEditedEvent[] = await response.json();
        const collection = await getCollection<NoaaSolarEvent>('noaa_solar_events');
        const fetchedAt = new Date();
        const documents: any[] = [];

        for (const item of rawData) {
          if (!item.begin_datetime || !item.type) continue;
          const beginTime = parseNoaaDate(item.begin_datetime);
          if (!beginTime) continue;

          const particulars = [item.particulars1, item.particulars2]
            .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
            .join(' ') || null;

          documents.push({
            event_id: buildEventId(item),
            event_type: item.type,
            begin_time: beginTime,
            max_time: item.max_datetime ? parseNoaaDate(item.max_datetime) ?? undefined : undefined,
            end_time: item.end_datetime ? parseNoaaDate(item.end_datetime) ?? undefined : undefined,
            source_location: item.location || null,
            active_region: typeof item.region === 'number' ? item.region : undefined,
            observatory: item.observatory || null,
            frequency: item.frequency || null,
            particulars,
            // X-ray flare class is in particulars1 for XRA events (e.g. "C1.0").
            // FLA events carry an optical class there ("SF"), which is not an X-ray class.
            class_type: item.type === 'XRA' ? extractFlareClass(item.particulars1) : undefined,
            intensity: item.type === 'XRA' ? extractFlareIntensity(item.particulars1) : undefined,
            created_at: fetchedAt,
            meta: {
              source: 'NOAA-SWPC',
              fetched_at: fetchedAt,
            },
          });
        }

        // Upsert events by event_id
        if (documents.length > 0) {
          const bulkOps = documents.map((doc) => ({
            updateOne: {
              filter: { event_id: doc.event_id },
              update: { $set: doc },
              upsert: true,
            },
          }));

          await collection.bulkWrite(bulkOps);
        }

        // Filter by event type if specified
        let filteredDocs = documents;
        if (eventType !== 'all') {
          filteredDocs = documents.filter((d) => d.event_type === eventType);
        }

        // Newest first, to match the cached path
        filteredDocs = [...filteredDocs].sort((a, b) => b.begin_time.getTime() - a.begin_time.getTime());

        return NextResponse.json({
          success: true,
          data: filteredDocs.slice(0, limit),
          count: filteredDocs.length,
          source: 'noaa-live',
        });
      } catch (fetchError: any) {
        console.error('NOAA events fetch error:', fetchError);
        // Fall back to cached data
      }
    }

    // Return cached data from MongoDB
    const collection = await getCollection<NoaaSolarEvent>('noaa_solar_events');
    const query = eventType !== 'all' ? { event_type: eventType } : {};

    const data = await collection
      .find(query)
      .sort({ begin_time: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
      source: 'mongodb-cache',
    });
  } catch (error: any) {
    console.error('Solar events API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch solar events data' },
      { status: 500 }
    );
  }
}

/**
 * Parse NOAA's weird date format: "2025-01-01T12:30:00"
 * Sometimes they use space instead of T, sometimes missing seconds
 */
function parseNoaaDate(dateStr: string): Date | null {
  try {
    // NOAA times are UTC but carry no zone suffix; add one so they are not read as local time
    let normalized = dateStr.trim().replace(' ', 'T');
    if (!/[zZ]|[+-]\d\d:?\d\d$/.test(normalized)) normalized += 'Z';
    const date = new Date(normalized);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Extract flare class from particulars string
 * Example: "M5.2" -> "M"
 */
function extractFlareClass(particulars: string | null | undefined): string | undefined {
  if (!particulars) return undefined;
  const match = particulars.match(/^([ABCMX])\d+\.?\d*/);
  return match ? match[1] : undefined;
}

/**
 * Extract flare intensity from particulars string
 * Example: "M5.2" -> 5.2
 */
function extractFlareIntensity(particulars: string | null | undefined): number | undefined {
  if (!particulars) return undefined;
  const match = particulars.match(/^[ABCMX](\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : undefined;
}
