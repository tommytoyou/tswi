import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// TLE data structure
interface TLEData {
  name: string;
  line1: string;
  line2: string;
  noradId: string;
  type: ConstellationType;
  inclination?: number;
  raan?: number;
  orbitalPlane?: string;
}

// Constellation types
type ConstellationType = 'station' | 'starlink' | 'iridium' | 'noaa' | 'goes' | 'gps' | 'science' | 'military';

// CelesTrak category endpoints
const CELESTRAK_CATEGORIES: { group: string; type: ConstellationType; limit?: number }[] = [
  { group: 'stations', type: 'station' },
  { group: 'starlink', type: 'starlink', limit: 5000 }, // Fetch all for orbital plane grouping
  { group: 'iridium-NEXT', type: 'iridium' },
  { group: 'noaa', type: 'noaa' },
  { group: 'goes', type: 'goes' },
  { group: 'gps-ops', type: 'gps' },
  { group: 'science', type: 'science' },
  { group: 'military', type: 'military' },
];

// Orbital plane grouping data
interface OrbitalPlane {
  id: string;
  inclination: number;
  raan: number;
  satellites: TLEData[];
  representative: TLEData;
}

// Parse TLE text into structured data with orbital elements
function parseTLE(tleText: string, defaultType: ConstellationType): TLEData[] {
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

    // Extract orbital elements from line 2
    // Inclination: columns 9-16
    // RAAN: columns 18-25
    const inclination = parseFloat(line2.substring(8, 16).trim());
    const raan = parseFloat(line2.substring(17, 25).trim());

    satellites.push({
      name: name.trim(),
      line1,
      line2,
      noradId,
      type: defaultType,
      inclination,
      raan,
    });
  }

  return satellites;
}

// Group satellites by orbital plane
function groupByOrbitalPlane(satellites: TLEData[], incResolution: number = 1, raanResolution: number = 10): OrbitalPlane[] {
  const planeMap = new Map<string, TLEData[]>();

  for (const sat of satellites) {
    if (sat.inclination === undefined || sat.raan === undefined) continue;

    // Round inclination and RAAN to create orbital plane groups
    const incGroup = Math.round(sat.inclination / incResolution) * incResolution;
    const raanGroup = Math.round(sat.raan / raanResolution) * raanResolution;
    const planeId = `${incGroup.toFixed(0)}_${raanGroup.toFixed(0)}`;

    sat.orbitalPlane = planeId;

    if (!planeMap.has(planeId)) {
      planeMap.set(planeId, []);
    }
    planeMap.get(planeId)!.push(sat);
  }

  // Convert to OrbitalPlane array
  const planes: OrbitalPlane[] = [];
  for (const [id, sats] of planeMap) {
    if (sats.length === 0) continue;

    // Sort by NORAD ID and pick the first as representative (often the most recently launched)
    sats.sort((a, b) => parseInt(b.noradId) - parseInt(a.noradId));
    const representative = sats[0];

    planes.push({
      id,
      inclination: representative.inclination!,
      raan: representative.raan!,
      satellites: sats,
      representative,
    });
  }

  return planes;
}

// Fetch TLE data from a single CelesTrak category
async function fetchCategoryTLE(group: string, type: ConstellationType): Promise<TLEData[]> {
  const tleUrl = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`;

  try {
    const response = await fetch(tleUrl, {
      headers: {
        'User-Agent': 'TSWI-SpaceWeather/1.0',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.warn(`CelesTrak ${group} returned ${response.status}`);
      return [];
    }

    const tleText = await response.text();
    return parseTLE(tleText, type);
  } catch (error) {
    console.warn(`Failed to fetch ${group}:`, error);
    return [];
  }
}

// Fetch all satellite data from multiple CelesTrak categories
async function fetchAllSatellites(): Promise<{
  satellites: TLEData[];
  starlinkPlanes: OrbitalPlane[];
  iridiumPlanes: OrbitalPlane[];
}> {
  // Fetch all categories in parallel
  const fetchPromises = CELESTRAK_CATEGORIES.map(cat =>
    fetchCategoryTLE(cat.group, cat.type)
  );

  const results = await Promise.all(fetchPromises);

  // Separate Starlink and Iridium for orbital plane grouping
  let starlinkSats: TLEData[] = [];
  let iridiumSats: TLEData[] = [];
  const otherSats: TLEData[] = [];

  results.forEach((sats, index) => {
    const category = CELESTRAK_CATEGORIES[index];
    if (category.type === 'starlink') {
      starlinkSats = sats;
    } else if (category.type === 'iridium') {
      iridiumSats = sats;
    } else {
      otherSats.push(...sats);
    }
  });

  // Group Starlink by orbital planes
  const starlinkPlanes = groupByOrbitalPlane(starlinkSats, 1, 15);

  // Group Iridium by orbital planes (they have fewer planes)
  const iridiumPlanes = groupByOrbitalPlane(iridiumSats, 1, 30);

  // For individual satellites response, include representatives from planes
  const satellites: TLEData[] = [
    ...otherSats,
    ...starlinkPlanes.map(p => ({
      ...p.representative,
      orbitalPlane: p.id,
    })),
    ...iridiumPlanes.map(p => ({
      ...p.representative,
      orbitalPlane: p.id,
    })),
  ];

  return {
    satellites,
    starlinkPlanes,
    iridiumPlanes,
  };
}

/**
 * GET /api/satellites
 *
 * Fetches TLE data for multiple satellite constellations from CelesTrak
 *
 * Query params:
 * - type: 'all' | constellation type (default: 'all')
 * - includeOrbitalPlanes: 'true' to include orbital plane data for Starlink/Iridium
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type') || 'all';
    const includeOrbitalPlanes = searchParams.get('includeOrbitalPlanes') === 'true';

    const { satellites, starlinkPlanes, iridiumPlanes } = await fetchAllSatellites();

    // Filter by type if specified
    let filtered = satellites;
    if (typeFilter !== 'all') {
      filtered = satellites.filter(s => s.type === typeFilter);
    }

    // Count satellites by type
    const countByType: Record<string, number> = {};
    for (const sat of satellites) {
      countByType[sat.type] = (countByType[sat.type] || 0) + 1;
    }

    // Prepare response
    const response: any = {
      success: true,
      satellites: filtered,
      count: filtered.length,
      countByType,
      timestamp: new Date().toISOString(),
      source: 'celestrak',
    };

    // Include orbital plane data if requested
    if (includeOrbitalPlanes) {
      response.orbitalPlanes = {
        starlink: starlinkPlanes.map(p => ({
          id: p.id,
          inclination: p.inclination,
          raan: p.raan,
          satelliteCount: p.satellites.length,
          representative: {
            name: p.representative.name,
            noradId: p.representative.noradId,
            line1: p.representative.line1,
            line2: p.representative.line2,
          },
        })),
        iridium: iridiumPlanes.map(p => ({
          id: p.id,
          inclination: p.inclination,
          raan: p.raan,
          satelliteCount: p.satellites.length,
          representative: {
            name: p.representative.name,
            noradId: p.representative.noradId,
            line1: p.representative.line1,
            line2: p.representative.line2,
          },
        })),
      };
      response.starlinkPlaneCount = starlinkPlanes.length;
      response.iridiumPlaneCount = iridiumPlanes.length;
      response.totalStarlinkSatellites = starlinkPlanes.reduce((acc, p) => acc + p.satellites.length, 0);
      response.totalIridiumSatellites = iridiumPlanes.reduce((acc, p) => acc + p.satellites.length, 0);
    }

    return NextResponse.json(response);
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
