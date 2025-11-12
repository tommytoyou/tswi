import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { NoaaSolarEvent } from '@/lib/types';

export const runtime = 'nodejs';

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
        const response = await fetch(noaaUrl, {
          next: { revalidate: 300 }, // Cache for 5 minutes (events don't update as frequently)
        });

        if (!response.ok) {
          throw new Error(`NOAA API returned ${response.status}`);
        }

        const rawData = await response.json();

        // Transform NOAA data to our schema
        const collection = await getCollection<NoaaSolarEvent>('noaa_solar_events');
        const documents: any[] = [];

        for (const item of rawData) {
          if (!item.event_id || !item.begin_time) continue;

          // Parse the peculiar NOAA date format
          const beginTime = parseNoaaDate(item.begin_time);
          if (!beginTime) continue;

          const doc = {
            event_id: item.event_id,
            event_type: item.event_type || 'UNKNOWN',
            begin_time: beginTime,
            max_time: item.max_time ? parseNoaaDate(item.max_time) : undefined,
            end_time: item.end_time ? parseNoaaDate(item.end_time) : undefined,
            source_location: item.source_location || null,
            active_region: item.active_region ? parseInt(item.active_region) : undefined,
            particulars: item.particulars || null,
            class_type: extractFlareClass(item.particulars),
            intensity: extractFlareIntensity(item.particulars),
            created_at: new Date(),
            meta: {
              source: 'NOAA-SWPC',
              fetched_at: new Date(),
            },
          };

          documents.push(doc);
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

        return NextResponse.json({
          success: true,
          data: filteredDocs.slice(-limit),
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
    // Replace space with T if present
    const normalized = dateStr.replace(' ', 'T');
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
function extractFlareClass(particulars: string | null): string | undefined {
  if (!particulars) return undefined;
  const match = particulars.match(/([ABCMX])\d+\.?\d*/);
  return match ? match[1] : undefined;
}

/**
 * Extract flare intensity from particulars string
 * Example: "M5.2" -> 5.2
 */
function extractFlareIntensity(particulars: string | null): number | undefined {
  if (!particulars) return undefined;
  const match = particulars.match(/[ABCMX](\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : undefined;
}
