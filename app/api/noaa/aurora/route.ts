import { NextRequest, NextResponse } from 'next/server';
import { getTimeSeriesCollection } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// OVATION Aurora data point from NOAA
interface OvationDataPoint {
  Longitude: number;  // 0-359
  Latitude: number;   // -90 to 90
  Aurora: number;     // Aurora probability 0-100
}

interface OvationResponse {
  Observation_Time: string;
  Forecast_Time: string;
  Data_Format: string;
  coordinates: OvationDataPoint[];
}

// Cached aurora data structure
interface CachedAuroraData {
  ts: Date;
  observation_time: Date;
  forecast_time: Date;
  coordinates: OvationDataPoint[];
  meta: {
    source: string;
    fetched_at: Date;
    point_count: number;
  };
}

/**
 * GET /api/noaa/aurora
 *
 * Fetches NOAA OVATION Aurora Forecast data
 * Source: https://services.swpc.noaa.gov/json/ovation_aurora_latest.json
 *
 * Query params:
 * - fetch: 'latest' | 'cached' (default: 'cached')
 * - minProbability: number (default: 0) - filter points below this probability
 * - hemisphere: 'north' | 'south' | 'both' (default: 'both')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fetchMode = searchParams.get('fetch') || 'cached';
    const minProbability = parseInt(searchParams.get('minProbability') || '0');
    const hemisphere = searchParams.get('hemisphere') || 'both';

    // If fetch=latest, get from NOAA and store in DB
    if (fetchMode === 'latest') {
      const noaaUrl = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';

      try {
        const response = await fetch(noaaUrl, {
          next: { revalidate: 300 }, // Cache for 5 minutes
        });

        if (!response.ok) {
          throw new Error(`NOAA API returned ${response.status}`);
        }

        const rawData: OvationResponse = await response.json();

        // Filter and process coordinates
        let coordinates = rawData.coordinates || [];

        // Filter by hemisphere if specified
        if (hemisphere === 'north') {
          coordinates = coordinates.filter(p => p.Latitude >= 0);
        } else if (hemisphere === 'south') {
          coordinates = coordinates.filter(p => p.Latitude < 0);
        }

        // Filter by minimum probability
        if (minProbability > 0) {
          coordinates = coordinates.filter(p => p.Aurora >= minProbability);
        }

        const doc: CachedAuroraData = {
          ts: new Date(),
          observation_time: new Date(rawData.Observation_Time),
          forecast_time: new Date(rawData.Forecast_Time),
          coordinates: rawData.coordinates, // Store full data
          meta: {
            source: 'NOAA-SWPC-OVATION',
            fetched_at: new Date(),
            point_count: rawData.coordinates.length,
          },
        };

        // Store in MongoDB (replace old data - we only need latest)
        const collection = await getTimeSeriesCollection<CachedAuroraData>('noaa_aurora_ovation');

        // Use upsert to keep only the latest data
        await collection.updateOne(
          { 'meta.source': 'NOAA-SWPC-OVATION' },
          { $set: doc },
          { upsert: true }
        );

        return NextResponse.json({
          success: true,
          observation_time: doc.observation_time,
          forecast_time: doc.forecast_time,
          coordinates: coordinates,
          count: coordinates.length,
          total_points: rawData.coordinates.length,
          source: 'noaa-live',
        });
      } catch (fetchError: any) {
        console.error('NOAA OVATION fetch error:', fetchError);
        // Fall back to cached data
      }
    }

    // Return cached data from MongoDB
    const collection = await getTimeSeriesCollection<CachedAuroraData>('noaa_aurora_ovation');
    const cached = await collection.findOne({ 'meta.source': 'NOAA-SWPC-OVATION' });

    if (!cached) {
      // No cached data, try to fetch fresh
      return NextResponse.redirect(new URL('/api/noaa/aurora?fetch=latest', request.url));
    }

    // Filter cached data
    let coordinates = cached.coordinates || [];

    if (hemisphere === 'north') {
      coordinates = coordinates.filter(p => p.Latitude >= 0);
    } else if (hemisphere === 'south') {
      coordinates = coordinates.filter(p => p.Latitude < 0);
    }

    if (minProbability > 0) {
      coordinates = coordinates.filter(p => p.Aurora >= minProbability);
    }

    return NextResponse.json({
      success: true,
      observation_time: cached.observation_time,
      forecast_time: cached.forecast_time,
      coordinates: coordinates,
      count: coordinates.length,
      total_points: cached.coordinates.length,
      source: 'mongodb-cache',
      cached_at: cached.meta.fetched_at,
    });
  } catch (error: any) {
    console.error('Aurora API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch aurora data' },
      { status: 500 }
    );
  }
}
