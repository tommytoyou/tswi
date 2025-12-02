import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TecGridPoint {
  lat: number;
  lon: number;
  tec: number;
}

interface TecResponse {
  success: boolean;
  data: TecGridPoint[];
  timestamp: string;
  kpIndex: number;
  source: string;
}

// Calculate solar zenith angle factor (0-1, higher on sunlit side)
function getSolarZenithFactor(lat: number, lon: number, date: Date): number {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );

  // Solar declination (approximate)
  const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));

  // Hour angle based on UTC time
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60;
  const solarNoonLon = (12 - hours) * 15; // Longitude where it's solar noon

  // Convert to radians
  const latRad = lat * (Math.PI / 180);
  const decRad = declination * (Math.PI / 180);
  const hourAngle = (lon - solarNoonLon) * (Math.PI / 180);

  // Solar zenith angle calculation
  const cosZenith =
    Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourAngle);

  // Clamp and convert to 0-1 factor (1 = sun overhead, 0 = night)
  return Math.max(0, cosZenith);
}

// Calculate equatorial anomaly factor (higher TEC near ±15° geomagnetic latitude)
function getEquatorialAnomalyFactor(lat: number): number {
  // Approximate geomagnetic latitude (simplified - offset from geographic)
  const geomagLat = lat - 11; // Rough offset for northern hemisphere

  // Equatorial anomaly peaks around ±15° geomagnetic latitude
  const peakLat = 15;
  const anomalyWidth = 10;

  // Double peak around equator
  const northPeak = Math.exp(-Math.pow((geomagLat - peakLat) / anomalyWidth, 2));
  const southPeak = Math.exp(-Math.pow((geomagLat + peakLat) / anomalyWidth, 2));

  return Math.max(northPeak, southPeak);
}

// Generate synthetic TEC value based on physical factors
function calculateTec(lat: number, lon: number, date: Date, kpIndex: number): number {
  // Base TEC varies with solar zenith angle
  const solarFactor = getSolarZenithFactor(lat, lon, date);

  // Equatorial anomaly enhancement
  const anomalyFactor = getEquatorialAnomalyFactor(lat);

  // Base TEC: 5-15 TECU at night, 20-50 TECU during day
  const baseTec = 5 + solarFactor * 35;

  // Equatorial anomaly can add 10-30 TECU during day
  const anomalyTec = solarFactor * anomalyFactor * 25;

  // Geomagnetic storm enhancement (Kp affects TEC variability)
  const stormFactor = 1 + (kpIndex / 9) * 0.5; // Up to 50% increase at Kp=9

  // Add some variability based on longitude (simulates different regions)
  const lonVariability = 1 + 0.1 * Math.sin((lon * 3) * (Math.PI / 180));

  // Random noise (±5 TECU)
  const noise = (Math.random() - 0.5) * 10;

  const tec = (baseTec + anomalyTec) * stormFactor * lonVariability + noise;

  // Clamp to reasonable range (0-100 TECU)
  return Math.max(0, Math.min(100, tec));
}

// Fetch current Kp index
async function fetchKpIndex(): Promise<number> {
  try {
    const response = await fetch('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json', {
      next: { revalidate: 60 },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.length > 0) {
        const latest = data[data.length - 1];
        return parseFloat(latest.kp_index) || 3;
      }
    }
  } catch (err) {
    console.error('Failed to fetch Kp index:', err);
  }
  return 3; // Default to moderate Kp
}

/**
 * GET /api/noaa/tec
 *
 * Returns Total Electron Content (TEC) grid data
 *
 * Query params:
 * - resolution: 'low' | 'medium' | 'high' (default: 'medium')
 *   - low: 20° grid (~162 points)
 *   - medium: 10° grid (~648 points)
 *   - high: 5° grid (~2592 points)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resolution = searchParams.get('resolution') || 'medium';

    // Determine grid spacing based on resolution
    let gridSpacing: number;
    switch (resolution) {
      case 'low':
        gridSpacing = 20;
        break;
      case 'high':
        gridSpacing = 5;
        break;
      case 'medium':
      default:
        gridSpacing = 10;
        break;
    }

    // Fetch current Kp index for storm effects
    const kpIndex = await fetchKpIndex();
    const now = new Date();

    // Generate TEC grid
    const tecData: TecGridPoint[] = [];

    for (let lat = -90; lat <= 90; lat += gridSpacing) {
      for (let lon = -180; lon < 180; lon += gridSpacing) {
        const tec = calculateTec(lat, lon, now, kpIndex);
        tecData.push({
          lat,
          lon,
          tec: Math.round(tec * 10) / 10, // Round to 1 decimal place
        });
      }
    }

    const response: TecResponse = {
      success: true,
      data: tecData,
      timestamp: now.toISOString(),
      kpIndex,
      source: 'synthetic-model',
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('TEC API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate TEC data' },
      { status: 500 }
    );
  }
}
