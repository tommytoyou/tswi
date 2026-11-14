import { NextRequest, NextResponse } from 'next/server';
import { loadTleCatalog, TleCatalog } from '@/lib/tle-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A due TLE catalog refresh (CelesTrak download + MongoDB upsert) can take a while
export const maxDuration = 60;

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

// Space station NORAD IDs - only permanent stations, not visiting spacecraft
const SPACE_STATION_IDS = new Set([
  '25544', // ISS (ZARYA)
  '48274', // Tiangong / CSS (TIANHE)
]);

// Read one CelesTrak group's TLEs from the shared catalog (tle_catalog)
function categoryTLEs(catalog: TleCatalog, group: string, type: ConstellationType): TLEData[] {
  const text: string[] = [];
  for (const rec of catalog.byId.values()) {
    if (rec.groups?.includes(group)) text.push(rec.name, rec.line1, rec.line2);
  }
  let satellites = parseTLE(text.join('\n'), type);

  // Filter space stations to only include ISS and Tiangong
  if (group === 'stations') {
    satellites = satellites.filter(sat => SPACE_STATION_IDS.has(sat.noradId));
  }
  return satellites;
}

// Fetch all satellite data from multiple CelesTrak categories
async function fetchAllSatellites(catalog: TleCatalog): Promise<{
  satellites: TLEData[];
  starlinkPlanes: OrbitalPlane[];
  iridiumPlanes: OrbitalPlane[];
}> {
  const results = CELESTRAK_CATEGORIES.map(cat => categoryTLEs(catalog, cat.group, cat.type));

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
 * TLE data for multiple satellite constellations, read from the shared
 * MongoDB catalog (tle_catalog, refreshed from CelesTrak at most every 2 hours)
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

    const catalog = await loadTleCatalog();
    const { satellites, starlinkPlanes, iridiumPlanes } = await fetchAllSatellites(catalog);

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
      source: 'celestrak (tle_catalog)',
      tleFetchedAt: catalog.fetchedAt,
      tleStatus: catalog.lastStatus,
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
