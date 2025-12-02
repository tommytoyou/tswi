import { NextRequest, NextResponse } from 'next/server';
import { getTimeSeriesCollection } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// OVATION Aurora data point - our normalized format
interface OvationDataPoint {
  Longitude: number;  // 0-359
  Latitude: number;   // -90 to 90
  Aurora: number;     // Aurora probability 0-100
}

// Raw NOAA response format - coordinates are arrays [lon, lat, aurora]
interface OvationRawResponse {
  "Observation Time": string;
  "Forecast Time": string;
  "Data Format": string;
  coordinates: [number, number, number][]; // [Longitude, Latitude, Aurora]
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

// Helper to fetch and transform NOAA data
async function fetchFromNOAA(
  minProbability: number,
  hemisphere: string
): Promise<{
  observation_time: Date;
  forecast_time: Date;
  coordinates: OvationDataPoint[];
  allCoordinates: OvationDataPoint[];
}> {
  const noaaUrl = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';

  const response = await fetch(noaaUrl, {
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!response.ok) {
    throw new Error(`NOAA API returned ${response.status}`);
  }

  const rawData: OvationRawResponse = await response.json();

  // Transform raw coordinate arrays [lon, lat, aurora] into objects
  const allCoordinates: OvationDataPoint[] = (rawData.coordinates || []).map(
    ([Longitude, Latitude, Aurora]) => ({ Longitude, Latitude, Aurora })
  );

  // Filter coordinates based on params
  let coordinates = allCoordinates;

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

  return {
    observation_time: new Date(rawData["Observation Time"]),
    forecast_time: new Date(rawData["Forecast Time"]),
    coordinates,
    allCoordinates,
  };
}

// Helper to try caching to MongoDB (non-blocking, silent fail)
async function tryCacheToMongo(
  observation_time: Date,
  forecast_time: Date,
  allCoordinates: OvationDataPoint[]
): Promise<void> {
  try {
    if (!process.env.MONGODB_URI) return;

    const doc: CachedAuroraData = {
      ts: new Date(),
      observation_time,
      forecast_time,
      coordinates: allCoordinates,
      meta: {
        source: 'NOAA-SWPC-OVATION',
        fetched_at: new Date(),
        point_count: allCoordinates.length,
      },
    };

    const collection = await getTimeSeriesCollection<CachedAuroraData>('noaa_aurora_ovation');
    await collection.updateOne(
      { 'meta.source': 'NOAA-SWPC-OVATION' },
      { $set: doc },
      { upsert: true }
    );
  } catch (err) {
    // Silent fail - caching is optional
    console.warn('Failed to cache aurora data to MongoDB:', err);
  }
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

    // If fetch=latest, get from NOAA directly
    if (fetchMode === 'latest') {
      try {
        const { observation_time, forecast_time, coordinates, allCoordinates } =
          await fetchFromNOAA(minProbability, hemisphere);

        // Try to cache to MongoDB (non-blocking)
        tryCacheToMongo(observation_time, forecast_time, allCoordinates);

        return NextResponse.json({
          success: true,
          observation_time,
          forecast_time,
          coordinates,
          count: coordinates.length,
          total_points: allCoordinates.length,
          source: 'noaa-live',
        });
      } catch (fetchError: any) {
        console.error('NOAA OVATION fetch error:', fetchError);
        // Fall back to cached data if available
      }
    }

    // Try to return cached data from MongoDB
    if (process.env.MONGODB_URI) {
      try {
        const collection = await getTimeSeriesCollection<CachedAuroraData>('noaa_aurora_ovation');
        const cached = await collection.findOne({ 'meta.source': 'NOAA-SWPC-OVATION' });

        if (cached) {
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
            coordinates,
            count: coordinates.length,
            total_points: cached.coordinates.length,
            source: 'mongodb-cache',
            cached_at: cached.meta.fetched_at,
          });
        }
      } catch (dbError) {
        console.warn('MongoDB cache read failed:', dbError);
      }
    }

    // No cache available or MongoDB not configured - fetch from NOAA
    const { observation_time, forecast_time, coordinates, allCoordinates } =
      await fetchFromNOAA(minProbability, hemisphere);

    // Try to cache for next time
    tryCacheToMongo(observation_time, forecast_time, allCoordinates);

    return NextResponse.json({
      success: true,
      observation_time,
      forecast_time,
      coordinates,
      count: coordinates.length,
      total_points: allCoordinates.length,
      source: 'noaa-live',
    });
  } catch (error: any) {
    console.error('Aurora API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch aurora data' },
      { status: 500 }
    );
  }
}
