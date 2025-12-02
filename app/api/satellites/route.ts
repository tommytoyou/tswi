import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// TLE data structure
interface TLEData {
  name: string;
  line1: string;
  line2: string;
  noradId: string;
  type: 'station' | 'weather' | 'comms' | 'starlink';
}

// Key satellites to track
const KEY_SATELLITES: { name: string; noradId: string; type: TLEData['type'] }[] = [
  { name: 'ISS (ZARYA)', noradId: '25544', type: 'station' },
  { name: 'NOAA 20', noradId: '43013', type: 'weather' },
  { name: 'GOES 18', noradId: '51850', type: 'weather' },
  { name: 'NOAA 19', noradId: '33591', type: 'weather' },
  { name: 'GOES 16', noradId: '41866', type: 'weather' },
  { name: 'STARLINK-1007', noradId: '44713', type: 'starlink' },
  { name: 'STARLINK-1008', noradId: '44714', type: 'starlink' },
  { name: 'STARLINK-1009', noradId: '44715', type: 'starlink' },
  { name: 'IRIDIUM 180', noradId: '56730', type: 'comms' },
  { name: 'GLOBALSTAR M087', noradId: '40269', type: 'comms' },
];

// Parse TLE text into structured data
function parseTLE(tleText: string, satelliteInfo: Map<string, { type: TLEData['type'] }>): TLEData[] {
  const lines = tleText.trim().split('\n').map(l => l.trim()).filter(l => l);
  const satellites: TLEData[] = [];

  for (let i = 0; i < lines.length; i += 3) {
    if (i + 2 >= lines.length) break;

    const name = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];

    // Validate TLE format
    if (!line1.startsWith('1 ') || !line2.startsWith('2 ')) {
      continue;
    }

    // Extract NORAD ID from line 1 (columns 3-7)
    const noradId = line1.substring(2, 7).trim();

    // Get satellite type from our key satellites list
    const info = satelliteInfo.get(noradId);
    const type = info?.type || 'comms';

    satellites.push({
      name: name.trim(),
      line1,
      line2,
      noradId,
      type,
    });
  }

  return satellites;
}

// Fetch TLE data from CelesTrak
async function fetchTLEFromCelesTrak(): Promise<TLEData[]> {
  // Build a map of our key satellites for type lookup
  const satelliteInfo = new Map(
    KEY_SATELLITES.map(s => [s.noradId, { type: s.type }])
  );

  // Fetch active satellites (includes ISS, weather, etc.)
  const tleUrl = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle';

  const response = await fetch(tleUrl, {
    headers: {
      'User-Agent': 'TSWI-SpaceWeather/1.0',
    },
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!response.ok) {
    throw new Error(`CelesTrak returned ${response.status}`);
  }

  const tleText = await response.text();
  const allSatellites = parseTLE(tleText, satelliteInfo);

  // Filter to only our key satellites
  const keyNoradIds = new Set(KEY_SATELLITES.map(s => s.noradId));
  let filtered = allSatellites.filter(s => keyNoradIds.has(s.noradId));

  // If we didn't find some satellites, try individual fetches
  if (filtered.length < KEY_SATELLITES.length) {
    const foundIds = new Set(filtered.map(s => s.noradId));
    const missing = KEY_SATELLITES.filter(s => !foundIds.has(s.noradId));

    for (const sat of missing) {
      try {
        const singleUrl = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${sat.noradId}&FORMAT=tle`;
        const singleResponse = await fetch(singleUrl, {
          headers: { 'User-Agent': 'TSWI-SpaceWeather/1.0' },
        });

        if (singleResponse.ok) {
          const singleTle = await singleResponse.text();
          const parsed = parseTLE(singleTle, satelliteInfo);
          if (parsed.length > 0) {
            // Override with known type
            parsed[0].type = sat.type;
            filtered.push(parsed[0]);
          }
        }
      } catch {
        console.warn(`Failed to fetch TLE for ${sat.name}`);
      }
    }
  }

  // Update types from our key satellites list
  return filtered.map(s => {
    const keySat = KEY_SATELLITES.find(ks => ks.noradId === s.noradId);
    return {
      ...s,
      type: keySat?.type || s.type,
    };
  });
}

/**
 * GET /api/satellites
 *
 * Fetches TLE data for key satellites from CelesTrak
 *
 * Query params:
 * - type: 'all' | 'station' | 'weather' | 'comms' | 'starlink' (default: 'all')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type') || 'all';

    const satellites = await fetchTLEFromCelesTrak();

    // Filter by type if specified
    let filtered = satellites;
    if (typeFilter !== 'all') {
      filtered = satellites.filter(s => s.type === typeFilter);
    }

    return NextResponse.json({
      success: true,
      satellites: filtered,
      count: filtered.length,
      timestamp: new Date().toISOString(),
      source: 'celestrak',
    });
  } catch (error: any) {
    console.error('Satellites API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch satellite data',
        satellites: [],
      },
      { status: 500 }
    );
  }
}
