import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TecGridPoint {
  lat: number;
  lon: number;
  tec: number;
  anomaly?: number;
  hmF2?: number;
  quality_flag?: number;
}

interface GloTecFile {
  url: string;
  time_tag: string;
}

interface GeoJsonFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  properties: {
    tec: number;
    anomaly?: number;
    hmF2?: number;
    NmF2?: number;
    quality_flag?: number;
  };
}

interface GloTecGeoJson {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

interface TecResponse {
  success: boolean;
  data: TecGridPoint[];
  timestamp: string;
  source: string;
  featureCount?: number;
}

const GLOTEC_LIST_URL = 'https://services.swpc.noaa.gov/products/glotec/geojson_2d_urt.json';
const GLOTEC_BASE_URL = 'https://services.swpc.noaa.gov';

// Cache for GloTEC data (5 minute cache)
let cachedData: { data: TecGridPoint[]; timestamp: string; fetchedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch the list of available GloTEC files and return the latest one
 */
async function getLatestGloTecFile(): Promise<GloTecFile | null> {
  try {
    const response = await fetch(GLOTEC_LIST_URL, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      console.error('Failed to fetch GloTEC file list:', response.status);
      return null;
    }

    const files: GloTecFile[] = await response.json();
    if (files.length === 0) {
      return null;
    }

    // Return the last (most recent) file
    return files[files.length - 1];
  } catch (error) {
    console.error('Error fetching GloTEC file list:', error);
    return null;
  }
}

/**
 * Fetch and parse GloTEC GeoJSON data
 */
async function fetchGloTecData(fileUrl: string): Promise<TecGridPoint[]> {
  const fullUrl = `${GLOTEC_BASE_URL}${fileUrl}`;

  const response = await fetch(fullUrl, {
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GloTEC data: ${response.status}`);
  }

  const geoJson: GloTecGeoJson = await response.json();

  // Parse GeoJSON features into TEC grid points
  const tecData: TecGridPoint[] = [];

  for (const feature of geoJson.features) {
    if (feature.geometry.type !== 'Point') continue;

    const [lon, lat] = feature.geometry.coordinates;
    const props = feature.properties;

    // Only include valid data points
    if (props.quality_flag !== undefined && props.quality_flag !== 0) continue;

    tecData.push({
      lat: Math.round(lat * 100) / 100,
      lon: Math.round(lon * 100) / 100,
      tec: Math.round(props.tec * 10) / 10,
      anomaly: props.anomaly !== undefined ? Math.round(props.anomaly * 10) / 10 : undefined,
      hmF2: props.hmF2 !== undefined ? Math.round(props.hmF2) : undefined,
      quality_flag: props.quality_flag,
    });
  }

  return tecData;
}

/**
 * Downsample data based on resolution parameter
 */
function downsampleData(data: TecGridPoint[], resolution: string): TecGridPoint[] {
  if (resolution === 'high') return data;

  // Create a grid-based downsampling
  const gridSpacing = resolution === 'low' ? 10 : 5; // low: 10°, medium: 5°
  const gridMap = new Map<string, TecGridPoint>();

  for (const point of data) {
    // Round to grid
    const gridLat = Math.round(point.lat / gridSpacing) * gridSpacing;
    const gridLon = Math.round(point.lon / gridSpacing) * gridSpacing;
    const key = `${gridLat},${gridLon}`;

    // Keep the first point for each grid cell (or could average)
    if (!gridMap.has(key)) {
      gridMap.set(key, {
        ...point,
        lat: gridLat,
        lon: gridLon,
      });
    }
  }

  return Array.from(gridMap.values());
}

/**
 * Store data in MongoDB for historical tracking
 */
async function cacheToMongoDB(data: TecGridPoint[], timestamp: string): Promise<void> {
  try {
    const collection = await getCollection('glotec_cache');

    // Store as a single document with all grid points
    await collection.updateOne(
      { type: 'current' },
      {
        $set: {
          type: 'current',
          timestamp: new Date(timestamp),
          data: data,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error caching GloTEC data to MongoDB:', error);
  }
}

/**
 * Get cached data from MongoDB
 */
async function getFromMongoCache(): Promise<{ data: TecGridPoint[]; timestamp: string } | null> {
  try {
    const collection = await getCollection('glotec_cache');
    const cached = await collection.findOne({ type: 'current' });

    if (cached && cached.data && cached.timestamp) {
      return {
        data: cached.data as TecGridPoint[],
        timestamp: cached.timestamp.toISOString(),
      };
    }
  } catch (error) {
    console.error('Error reading GloTEC cache from MongoDB:', error);
  }
  return null;
}

/**
 * GET /api/noaa/tec
 *
 * Returns real Total Electron Content (TEC) data from NOAA GloTEC
 *
 * Query params:
 * - resolution: 'low' | 'medium' | 'high' (default: 'medium')
 *   - low: ~10° grid
 *   - medium: ~5° grid
 *   - high: full resolution
 * - refresh: 'true' to force refresh from NOAA
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resolution = searchParams.get('resolution') || 'medium';
    const forceRefresh = searchParams.get('refresh') === 'true';

    const now = Date.now();

    // Check memory cache first
    if (!forceRefresh && cachedData && (now - cachedData.fetchedAt) < CACHE_TTL) {
      const downsampled = downsampleData(cachedData.data, resolution);
      return NextResponse.json({
        success: true,
        data: downsampled,
        timestamp: cachedData.timestamp,
        source: 'noaa-glotec',
        featureCount: downsampled.length,
        cached: true,
      } as TecResponse);
    }

    // Try to fetch fresh data from NOAA
    const latestFile = await getLatestGloTecFile();

    if (latestFile) {
      try {
        const tecData = await fetchGloTecData(latestFile.url);

        // Update memory cache
        cachedData = {
          data: tecData,
          timestamp: latestFile.time_tag,
          fetchedAt: now,
        };

        // Cache to MongoDB asynchronously
        cacheToMongoDB(tecData, latestFile.time_tag).catch(console.error);

        const downsampled = downsampleData(tecData, resolution);

        return NextResponse.json({
          success: true,
          data: downsampled,
          timestamp: latestFile.time_tag,
          source: 'noaa-glotec',
          featureCount: downsampled.length,
        } as TecResponse);
      } catch (fetchError) {
        console.error('Error fetching GloTEC GeoJSON:', fetchError);
        // Fall through to MongoDB cache
      }
    }

    // Fall back to MongoDB cache
    const mongoCache = await getFromMongoCache();
    if (mongoCache) {
      // Update memory cache from MongoDB
      cachedData = {
        data: mongoCache.data,
        timestamp: mongoCache.timestamp,
        fetchedAt: now,
      };

      const downsampled = downsampleData(mongoCache.data, resolution);

      return NextResponse.json({
        success: true,
        data: downsampled,
        timestamp: mongoCache.timestamp,
        source: 'noaa-glotec',
        featureCount: downsampled.length,
        cached: true,
        fallback: 'mongodb',
      } as TecResponse);
    }

    // No data available
    return NextResponse.json(
      {
        success: false,
        error: 'No GloTEC data available',
        data: [],
        timestamp: new Date().toISOString(),
        source: 'none',
      },
      { status: 503 }
    );
  } catch (error: any) {
    console.error('TEC API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch TEC data' },
      { status: 500 }
    );
  }
}
