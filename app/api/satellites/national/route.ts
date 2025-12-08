import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// UCS Satellite data structure
interface UCSSatellite {
  noradId: string;
  name: string;
  country: string;
  countryNormalized: string;
  operator: string;
  users: string;
  sector: string;
  purpose: string;
  detailedPurpose: string;
  orbitClass: string;
  orbitType: string;
  perigee?: number;
  apogee?: number;
  inclination?: number;
  launchDate?: string;
  launchSite?: string;
}

interface UCSData {
  lastUpdated: string;
  source: string;
  totalCount: number;
  countryCounts: Record<string, number>;
  sectorCounts: Record<string, number>;
  satellites: UCSSatellite[];
}

// TLE data for live positions
interface TLEData {
  line1: string;
  line2: string;
}

// Cache for UCS data
let ucsDataCache: UCSData | null = null;

// Load UCS data from JSON file
async function loadUCSData(): Promise<UCSData> {
  if (ucsDataCache) {
    return ucsDataCache;
  }

  const filePath = path.join(process.cwd(), 'public', 'data', 'ucs-satellites.json');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  ucsDataCache = JSON.parse(fileContent) as UCSData;
  return ucsDataCache;
}

// Fetch TLE data for given NORAD IDs from CelesTrak
async function fetchTLEsForSatellites(noradIds: string[]): Promise<Map<string, TLEData>> {
  const tleMap = new Map<string, TLEData>();

  // CelesTrak has a bulk query endpoint, but for large numbers we need to batch
  // For now, fetch from the active satellites catalog
  try {
    const response = await fetch(
      'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle',
      {
        headers: { 'User-Agent': 'TSWI-SpaceWeather/1.0' },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    );

    if (!response.ok) {
      console.warn('Failed to fetch TLEs from CelesTrak:', response.status);
      return tleMap;
    }

    const tleText = await response.text();
    const lines = tleText.trim().split('\n').map(l => l.trim()).filter(l => l);

    // Parse TLE format (3 lines per satellite: name, line1, line2)
    for (let i = 0; i < lines.length - 2; i += 3) {
      const line1 = lines[i + 1];
      const line2 = lines[i + 2];

      if (line1?.startsWith('1 ') && line2?.startsWith('2 ')) {
        // Extract NORAD ID from line 1 (columns 3-7)
        const noradId = line1.substring(2, 7).trim();
        tleMap.set(noradId, { line1, line2 });
      }
    }
  } catch (error) {
    console.error('Error fetching TLEs:', error);
  }

  return tleMap;
}

/**
 * GET /api/satellites/national
 *
 * Fetches UCS satellite data filtered by country and/or sector
 * Optionally matches with CelesTrak TLEs for live positions
 *
 * Query params:
 * - country: Filter by normalized country (USA, China, Russia, EU, India, Japan, Other)
 * - sector: Filter by sector (Commercial, Civil, Government, Military)
 * - includeTLE: 'true' to include TLE data for live positions (slower)
 * - limit: Max number of satellites to return (default: 500)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const countryFilter = searchParams.get('country');
    const sectorFilter = searchParams.get('sector');
    const includeTLE = searchParams.get('includeTLE') === 'true';
    const limit = parseInt(searchParams.get('limit') || '500', 10);

    // Load UCS data
    const ucsData = await loadUCSData();

    // Apply filters
    let filtered = ucsData.satellites;

    if (countryFilter) {
      const countries = countryFilter.split(',').map(c => c.trim());
      filtered = filtered.filter(s => countries.includes(s.countryNormalized));
    }

    if (sectorFilter) {
      const sectors = sectorFilter.split(',').map(s => s.trim());
      filtered = filtered.filter(s => sectors.includes(s.sector));
    }

    // Limit results
    const limitedResults = filtered.slice(0, limit);

    // Optionally fetch TLEs for live positions
    let tleMap: Map<string, TLEData> = new Map();
    if (includeTLE && limitedResults.length > 0) {
      const noradIds = limitedResults.map(s => s.noradId);
      tleMap = await fetchTLEsForSatellites(noradIds);
    }

    // Build response with TLE data if available
    const satellitesWithTLE = limitedResults.map(sat => {
      const tle = tleMap.get(sat.noradId);
      return {
        ...sat,
        tle: tle || null,
        hasTLE: !!tle,
      };
    });

    // Count by country and sector for current filter
    const filteredCountryCounts: Record<string, number> = {};
    const filteredSectorCounts: Record<string, number> = {};

    for (const sat of filtered) {
      filteredCountryCounts[sat.countryNormalized] = (filteredCountryCounts[sat.countryNormalized] || 0) + 1;
      filteredSectorCounts[sat.sector] = (filteredSectorCounts[sat.sector] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      satellites: satellitesWithTLE,
      totalFiltered: filtered.length,
      returned: limitedResults.length,
      limit,
      filters: {
        country: countryFilter,
        sector: sectorFilter,
      },
      stats: {
        totalInDatabase: ucsData.totalCount,
        countryCounts: ucsData.countryCounts,
        sectorCounts: ucsData.sectorCounts,
        filteredCountryCounts,
        filteredSectorCounts,
      },
      tleMatchRate: includeTLE ? (tleMap.size / limitedResults.length * 100).toFixed(1) + '%' : null,
      lastUpdated: ucsData.lastUpdated,
      source: ucsData.source,
    });
  } catch (error: any) {
    console.error('National satellites API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch national satellite data',
        satellites: [],
      },
      { status: 500 }
    );
  }
}
