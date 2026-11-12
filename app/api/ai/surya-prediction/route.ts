import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/auth/api';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// NOAA SWPC endpoints. Fetched with no-store: the Data Cache served a 78-min-old
// X-ray copy on the first request after idle (stale-while-revalidate).
const NOAA_SOLAR_PROBABILITIES_URL = 'https://services.swpc.noaa.gov/json/solar_probabilities.json';
const NOAA_XRAY_FLUX_URL = 'https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json';
const NOAA_ACTIVE_REGIONS_URL = 'https://services.swpc.noaa.gov/json/solar_regions.json';

interface NOAASolarProbability {
  date: string;
  c_class_1_day: number;
  c_class_2_day?: number;
  c_class_3_day?: number;
  m_class_1_day: number;
  m_class_2_day?: number;
  m_class_3_day?: number;
  x_class_1_day: number;
  x_class_2_day?: number;
  x_class_3_day?: number;
}

interface XRayFluxData {
  time_tag: string;
  flux: number;
  energy: string;
}

interface ActiveRegion {
  Region: number;
  observed_date?: string;
}

/** One NOAA forecast period, values exactly as published (percent / 100). */
interface ForecastPeriod {
  horizon: '24h' | '48h' | '72h';
  C: number;
  M: number;
  X: number;
  issued: string;
  source: 'NOAA SWPC';
}

/** Observed GOES X-ray flux sample with its flare class (e.g. "C2.3"). */
interface FluxPoint {
  time: string;
  flux: number;
  class: string;
}

/**
 * GET /api/ai/surya-prediction
 *
 * Solar flare forecast exactly as published by NOAA SWPC (solar_probabilities.json),
 * plus the observed GOES X-ray flux for the past 24h. No modifiers or derived
 * probabilities: if NOAA's forecast is unavailable, `forecast` is null.
 */
export async function GET(_request: NextRequest) {
  // Any logged-in user: this serves NOAA data, not an AI model
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const [probsResult, xrayResult, regionsResult] = await Promise.allSettled([
      fetchNOAASolarProbabilities(),
      fetchXRayFluxHistory(),
      fetchActiveRegions(),
    ]);

    const noaaProbs = probsResult.status === 'fulfilled' ? probsResult.value : null;
    const xrayHistory = xrayResult.status === 'fulfilled' ? xrayResult.value : [];
    const regions = regionsResult.status === 'fulfilled' ? regionsResult.value : null;

    const forecast = noaaProbs && noaaProbs.length > 0 ? toForecast(noaaProbs) : null;
    const latestXray = xrayHistory.length > 0 ? xrayHistory[xrayHistory.length - 1] : null;

    if (!forecast && !latestXray) {
      console.error('[Flare] NOAA forecast and X-ray flux both unavailable');
      return NextResponse.json(
        { success: false, error: 'Flare data unavailable' },
        { status: 503 }
      );
    }

    if (!forecast) {
      console.warn('[Flare] NOAA solar_probabilities.json unavailable; returning no forecast');
    }

    return NextResponse.json({
      success: true,
      data: {
        forecast,
        ...(forecast ? {} : { reason: 'NOAA SWPC flare forecast unavailable' }),
        xray_flux: {
          current: latestXray ? toFluxPoint(latestXray) : null,
          timeline: buildFluxTimeline(xrayHistory),
          source: 'NOAA SWPC GOES primary, 0.1-0.8 nm',
        },
        active_regions_count: regions ? regions.length : null,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Flare forecast API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load flare data' },
      { status: 500 }
    );
  }
}

/**
 * NOAA's newest row, values as published (percent → fraction). The 2- and 3-day
 * periods are included only when NOAA provides them.
 */
function toForecast(rows: NOAASolarProbability[]): ForecastPeriod[] | null {
  const latest = [...rows].sort((a, b) => b.date.localeCompare(a.date))[0];
  const periods: Array<{ horizon: ForecastPeriod['horizon']; day: 1 | 2 | 3 }> = [
    { horizon: '24h', day: 1 },
    { horizon: '48h', day: 2 },
    { horizon: '72h', day: 3 },
  ];

  const out: ForecastPeriod[] = [];
  for (const { horizon, day } of periods) {
    const row = latest as unknown as Record<string, unknown>;
    const c = row[`c_class_${day}_day`];
    const m = row[`m_class_${day}_day`];
    const x = row[`x_class_${day}_day`];
    if (typeof c !== 'number' || typeof m !== 'number' || typeof x !== 'number') continue;
    out.push({ horizon, C: c / 100, M: m / 100, X: x / 100, issued: latest.date, source: 'NOAA SWPC' });
  }
  return out.length > 0 ? out : null;
}

async function fetchNOAASolarProbabilities(): Promise<NOAASolarProbability[] | null> {
  try {
    const response = await fetch(NOAA_SOLAR_PROBABILITIES_URL, { cache: 'no-store' });
    if (!response.ok) {
      console.error('NOAA solar probabilities fetch failed:', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching NOAA solar probabilities:', error);
    return null;
  }
}

/** GOES X-ray flux for the past day, 0.1-0.8 nm channel, chronological. */
async function fetchXRayFluxHistory(): Promise<XRayFluxData[]> {
  try {
    const response = await fetch(NOAA_XRAY_FLUX_URL, { cache: 'no-store' });
    if (!response.ok) {
      console.error('NOAA X-ray flux fetch failed:', response.status);
      return [];
    }
    const data = await response.json();
    return data.filter((d: any) => d.energy === '0.1-0.8nm' && typeof d.flux === 'number' && d.flux > 0);
  } catch (error) {
    console.error('Error fetching X-ray flux:', error);
    return [];
  }
}

async function fetchActiveRegions(): Promise<ActiveRegion[] | null> {
  try {
    const response = await fetch(NOAA_ACTIVE_REGIONS_URL, { cache: 'no-store' });
    if (!response.ok) return null;
    const rows: ActiveRegion[] = await response.json();
    // The feed holds several days of reports; count regions on the newest observed date only
    const newest = rows.reduce((max, r) => (r.observed_date && r.observed_date > max ? r.observed_date : max), '');
    return newest ? rows.filter((r) => r.observed_date === newest) : rows;
  } catch (error) {
    console.error('Error fetching active regions:', error);
    return null;
  }
}

/**
 * GOES flare class from 0.1-0.8 nm flux (W/m²):
 * A < 1e-7 <= B < 1e-6 <= C < 1e-5 <= M < 1e-4 <= X.
 */
function fluxClass(flux: number): string {
  const scales: Array<[string, number]> = [['X', 1e-4], ['M', 1e-5], ['C', 1e-6], ['B', 1e-7]];
  for (const [letter, base] of scales) {
    if (flux >= base) return `${letter}${(flux / base).toFixed(1)}`;
  }
  return `A${(flux / 1e-8).toFixed(1)}`;
}

function toFluxPoint(d: XRayFluxData): FluxPoint {
  return { time: d.time_tag, flux: d.flux, class: fluxClass(d.flux) };
}

/**
 * Observed flux, bucketed to ~targetPoints. Each bucket keeps its PEAK sample
 * (flares are short spikes that averaging would hide).
 */
function buildFluxTimeline(history: XRayFluxData[], targetPoints = 96): FluxPoint[] {
  if (history.length === 0) return [];
  const bucketSize = Math.max(1, Math.ceil(history.length / targetPoints));
  const timeline: FluxPoint[] = [];
  for (let i = 0; i < history.length; i += bucketSize) {
    const bucket = history.slice(i, i + bucketSize);
    const peak = bucket.reduce((max, d) => (d.flux > max.flux ? d : max), bucket[0]);
    timeline.push(toFluxPoint(peak));
  }
  return timeline;
}
