import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { loadTleCatalog } from '@/lib/tle-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A due TLE catalog refresh (CelesTrak download + MongoDB upsert) can take a while
export const maxDuration = 60;

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

/**
 * GET /api/satellites/national
 *
 * Fetches UCS satellite data filtered by country and/or sector
 * Optionally matches TLEs from the shared MongoDB catalog (tle_catalog, refreshed
 * from CelesTrak at most every 2 hours) for live positions
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

    // Optionally attach TLEs from the shared catalog for live positions
    let tleFetchedAt: Date | null = null;
    let tleStatus: string | null = null;
    let catalogById: Map<string, { line1: string; line2: string; epoch: Date | null }> | null = null;
    if (includeTLE && limitedResults.length > 0) {
      try {
        const catalog = await loadTleCatalog();
        catalogById = catalog.byId;
        tleFetchedAt = catalog.fetchedAt;
        tleStatus = catalog.lastStatus;
      } catch (error) {
        console.error('National satellites: TLE catalog unavailable:', error);
        tleStatus = 'TLE catalog unavailable';
      }
    }

    let matched = 0;
    const satellitesWithTLE = limitedResults.map(sat => {
      const rec = catalogById?.get(String(parseInt(String(sat.noradId), 10)));
      if (rec) matched++;
      return {
        ...sat,
        tle: rec ? { line1: rec.line1, line2: rec.line2 } : null,
        tleEpoch: rec?.epoch ?? null,
        hasTLE: !!rec,
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
      // Percent of returned satellites that have a TLE (number, 0-100)
      tleMatchRate: includeTLE
        ? limitedResults.length > 0 ? Math.round((matched / limitedResults.length) * 1000) / 10 : 0
        : null,
      tleMatched: includeTLE ? matched : null,
      tleFetchedAt,
      tleStatus,
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
