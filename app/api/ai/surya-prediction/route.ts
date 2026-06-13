import { NextRequest, NextResponse } from 'next/server';
import { getTimeSeriesCollection } from '@/lib/db';
import { requireAIAccess } from '@/lib/auth/api';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// NOAA SWPC endpoints for real solar data
const NOAA_SOLAR_PROBABILITIES_URL = 'https://services.swpc.noaa.gov/json/solar_probabilities.json';
const NOAA_XRAY_FLUX_URL = 'https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json';
const NOAA_ACTIVE_REGIONS_URL = 'https://services.swpc.noaa.gov/json/solar_regions.json';

interface NOAASolarProbability {
  date: string;
  c_class_1_day: number;
  c_class_2_day: number;
  c_class_3_day: number;
  m_class_1_day: number;
  m_class_2_day: number;
  m_class_3_day: number;
  x_class_1_day: number;
  x_class_2_day: number;
  x_class_3_day: number;
  // NOAA keys these as "10mev_protons_*", which are not valid TS identifiers.
  '10mev_protons_1_day': number;
  '10mev_protons_2_day': number;
  '10mev_protons_3_day': number;
  polar_cap_absorption: string;
}

interface XRayFluxData {
  time_tag: string;
  flux: number;
  energy: string;
}

interface ActiveRegion {
  Region: number;
  Latitude: number;
  Longitude: number;
  Area: number;
  Numspots: number;
  Magtype: string;
}

interface PredictionResult {
  time: string;
  flare_probability: number;
  class_probabilities: {
    C: number;
    M: number;
    X: number;
  };
  confidence: number;
}

interface FluxTimelinePoint {
  time: string;
  flux: number;
  flare_probability: number;
  C: number;
  M: number;
  X: number;
}

/**
 * GET /api/ai/surya-prediction
 *
 * Provides solar flare predictions using:
 * 1. Real NOAA SWPC official flare probabilities
 * 2. Current X-ray flux trends from GOES satellite
 * 3. Active region analysis
 *
 * Note: The NASA-IBM Surya-1.0 model is not available via HuggingFace Inference API
 * (it requires 4096x4096 SDO imagery and local GPU inference).
 * This implementation uses NOAA's operational forecasts enhanced with real-time data.
 */
export async function GET(request: NextRequest) {
  // Check if user has AI access
  const authError = await requireAIAccess();
  if (authError) return authError;

  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const useMock = searchParams.get('mock') === 'true';

    if (useMock) {
      return NextResponse.json({
        success: true,
        data: getMockPrediction(),
        warning: 'Using mock predictions (requested via query param)',
      });
    }

    // Fetch real NOAA data in parallel
    const [solarProbabilities, xrayHistory, activeRegions, dbXray] = await Promise.allSettled([
      fetchNOAASolarProbabilities(),
      fetchXRayFluxHistory(),
      fetchActiveRegions(),
      fetchDBXrayData(),
    ]);

    const noaaProbs = solarProbabilities.status === 'fulfilled' ? solarProbabilities.value : null;
    const xrayFluxHistory = xrayHistory.status === 'fulfilled' ? xrayHistory.value : [];
    // The most recent measurement is the last element (feed is chronological).
    const currentXray = xrayFluxHistory.length > 0 ? xrayFluxHistory[xrayFluxHistory.length - 1] : null;
    const regions = activeRegions.status === 'fulfilled' ? activeRegions.value : null;
    const dbXrayData = dbXray.status === 'fulfilled' ? dbXray.value : null;

    // Build a real, time-resolved class-probability timeline from observed X-ray flux.
    const fluxTimeline = buildFluxTimeline(xrayFluxHistory);

    // If we have NOAA probabilities, use them as the primary source
    if (noaaProbs && noaaProbs.length > 0) {
      // NOAA's solar_probabilities.json is sorted newest-first (descending date).
      // Sort defensively and take the most recent forecast row.
      const latestProbs = [...noaaProbs].sort((a, b) => b.date.localeCompare(a.date))[0];

      // Enhance NOAA predictions with real-time X-ray flux analysis
      const xrayModifier = calculateXRayModifier(currentXray);
      const regionRisk = calculateRegionRisk(regions);

      const predictions = generateEnhancedPredictions(latestProbs, xrayModifier, regionRisk);

      return NextResponse.json({
        success: true,
        data: {
          model: 'NOAA SWPC Enhanced',
          model_type: 'statistical',
          prediction_time: new Date().toISOString(),
          forecast_horizon_hours: 2,
          predictions,
          flux_timeline: fluxTimeline,
          source: 'noaa-swpc-enhanced',
          metadata: {
            noaa_forecast_date: latestProbs.date,
            current_xray_flux: currentXray?.flux ?? null,
            active_regions_count: regions?.length ?? 0,
            complex_regions: regions?.filter(r => r.Magtype?.includes('beta-gamma') || r.Magtype?.includes('delta')).length ?? 0,
            data_sources: [
              'NOAA SWPC Solar Probabilities',
              'GOES X-ray Flux',
              'Solar Active Regions',
            ],
            processing_time_ms: Date.now() - startTime,
          },
        },
      });
    }

    // Fallback to statistical model using database data if NOAA API fails
    if (dbXrayData && dbXrayData.length >= 10) {
      const predictions = generateStatisticalPrediction(dbXrayData, currentXray);

      return NextResponse.json({
        success: true,
        data: {
          model: 'Statistical Fallback',
          model_type: 'statistical',
          prediction_time: new Date().toISOString(),
          forecast_horizon_hours: 2,
          predictions,
          flux_timeline: fluxTimeline,
          source: 'statistical-fallback',
          metadata: {
            data_points_used: dbXrayData.length,
            processing_time_ms: Date.now() - startTime,
          },
        },
        warning: 'NOAA SWPC data unavailable, using statistical fallback',
      });
    }

    // Last resort: return mock data with warning
    return NextResponse.json({
      success: true,
      data: getMockPrediction(),
      warning: 'All data sources unavailable, using mock predictions',
    });

  } catch (error: any) {
    console.error('Surya prediction API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate predictions' },
      { status: 500 }
    );
  }
}

/**
 * Fetch official NOAA SWPC solar flare probabilities
 */
async function fetchNOAASolarProbabilities(): Promise<NOAASolarProbability[] | null> {
  try {
    const response = await fetch(NOAA_SOLAR_PROBABILITIES_URL, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

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

/**
 * Fetch the full GOES X-ray flux history for the past day (1-minute cadence).
 * Returns the 0.1-0.8nm (short wavelength) channel in chronological order.
 */
async function fetchXRayFluxHistory(): Promise<XRayFluxData[]> {
  try {
    const response = await fetch(NOAA_XRAY_FLUX_URL, {
      next: { revalidate: 60 }, // Cache for 1 minute
    });

    if (!response.ok) {
      console.error('NOAA X-ray flux fetch failed:', response.status);
      return [];
    }

    const data = await response.json();
    // Keep only the 1-8A (short wavelength) channel used for flare classification.
    return data.filter((d: any) => d.energy === '0.1-0.8nm');
  } catch (error) {
    console.error('Error fetching X-ray flux:', error);
    return [];
  }
}

/**
 * Fetch active solar regions
 */
async function fetchActiveRegions(): Promise<ActiveRegion[] | null> {
  try {
    const response = await fetch(NOAA_ACTIVE_REGIONS_URL, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching active regions:', error);
    return null;
  }
}

/**
 * Fetch X-ray data from our database
 */
async function fetchDBXrayData(): Promise<any[] | null> {
  try {
    const collection = await getTimeSeriesCollection('timeseries_noaa_xray_flux');
    return await collection
      .find({})
      .sort({ ts: -1 })
      .limit(60)
      .toArray();
  } catch (error) {
    console.error('Error fetching DB X-ray data:', error);
    return null;
  }
}

/**
 * Calculate X-ray flux modifier based on current conditions
 * Returns a multiplier for probability adjustment
 */
function calculateXRayModifier(xrayData: XRayFluxData | null): number {
  if (!xrayData || !xrayData.flux) return 1.0;

  const flux = xrayData.flux;

  // X-ray flux classification thresholds
  // B-class: < 1e-6, C-class: 1e-6 to 1e-5, M-class: 1e-5 to 1e-4, X-class: > 1e-4
  if (flux >= 1e-4) return 1.5;      // X-class activity - significantly elevated
  if (flux >= 1e-5) return 1.3;      // M-class activity - elevated
  if (flux >= 1e-6) return 1.1;      // C-class activity - slightly elevated
  return 0.9;                         // Background levels - slightly reduced
}

/**
 * Calculate risk factor from active regions
 */
function calculateRegionRisk(regions: ActiveRegion[] | null): number {
  if (!regions || regions.length === 0) return 1.0;

  let riskScore = 1.0;

  for (const region of regions) {
    // Complex magnetic configurations are more flare-prone
    if (region.Magtype?.includes('delta')) {
      riskScore += 0.2;
    } else if (region.Magtype?.includes('beta-gamma')) {
      riskScore += 0.1;
    }

    // Large sunspot areas indicate more energy
    if (region.Area > 500) {
      riskScore += 0.1;
    }
  }

  return Math.min(riskScore, 2.0); // Cap at 2x
}

/**
 * Map an observed GOES X-ray flux level to per-class "at or above" probabilities.
 *
 * Flare class is defined by short-wavelength flux magnitude:
 *   B < 1e-6, C 1e-6..1e-5, M 1e-5..1e-4, X >= 1e-4 (W/m²).
 * We use a logistic curve centred just below each class threshold so that, as the
 * real flux rises, each class probability climbs smoothly toward 1. Because the
 * input is the live flux history, the resulting series genuinely varies over time.
 */
function fluxToClassProbabilities(flux: number): { C: number; M: number; X: number } {
  const logF = Math.log10(Math.max(flux, 1e-9));
  const logistic = (center: number) => 1 / (1 + Math.exp(-(logF - center) * 3));
  return {
    C: logistic(-6.3),
    M: logistic(-5.3),
    X: logistic(-4.3),
  };
}

/**
 * Build a real, time-resolved timeline from the observed X-ray flux history.
 * The raw feed is ~1 reading/minute over 24h; we bucket it down to `targetPoints`
 * and keep the PEAK flux per bucket (flares are short spikes that averaging hides).
 */
function buildFluxTimeline(history: XRayFluxData[], targetPoints = 48): FluxTimelinePoint[] {
  if (!history || history.length === 0) return [];

  const bucketSize = Math.max(1, Math.ceil(history.length / targetPoints));
  const timeline: FluxTimelinePoint[] = [];

  for (let i = 0; i < history.length; i += bucketSize) {
    const bucket = history.slice(i, i + bucketSize);
    // Peak flux drives flare classification, so summarise each bucket by its max.
    const peak = bucket.reduce((max, d) => (d.flux > max.flux ? d : max), bucket[0]);
    const probs = fluxToClassProbabilities(peak.flux);

    // P(any flare) = 1 - P(no flare of any class).
    const flareProbability = 1 - (1 - probs.C) * (1 - probs.M) * (1 - probs.X);

    timeline.push({
      time: peak.time_tag,
      flux: peak.flux,
      flare_probability: flareProbability,
      C: probs.C,
      M: probs.M,
      X: probs.X,
    });
  }

  return timeline;
}

/**
 * Generate enhanced predictions using NOAA data
 */
function generateEnhancedPredictions(
  noaaProbs: NOAASolarProbability,
  xrayModifier: number,
  regionRisk: number
): PredictionResult[] {
  const predictions: PredictionResult[] = [];
  const now = Date.now();

  // Convert daily probabilities to hourly estimates with modifiers
  // NOAA provides daily probabilities (0-100), we interpolate for 2-hour forecast
  const cProb = (noaaProbs.c_class_1_day / 100) * xrayModifier * regionRisk;
  const mProb = (noaaProbs.m_class_1_day / 100) * xrayModifier * regionRisk;
  const xProb = (noaaProbs.x_class_1_day / 100) * xrayModifier * regionRisk;

  // Generate 4 predictions at 30-minute intervals
  for (let i = 0; i < 4; i++) {
    const timeOffset = (i + 1) * 30 * 60 * 1000;

    // Slight variation for each time slot (solar activity can evolve)
    const variation = 1 + (Math.sin(i * 0.5) * 0.1);

    const cClassProb = Math.min(0.99, Math.max(0, cProb * variation));
    const mClassProb = Math.min(0.99, Math.max(0, mProb * variation));
    const xClassProb = Math.min(0.99, Math.max(0, xProb * variation));

    // Total flare probability (at least one flare of any class)
    // P(any) = 1 - P(none) = 1 - (1-Pc)(1-Pm)(1-Px)
    const totalProb = 1 - ((1 - cClassProb) * (1 - mClassProb) * (1 - xClassProb));

    predictions.push({
      time: new Date(now + timeOffset).toISOString(),
      flare_probability: Math.min(0.99, Math.max(0.01, totalProb)),
      class_probabilities: {
        C: cClassProb,
        M: mClassProb,
        X: xClassProb,
      },
      // Confidence based on data quality
      confidence: 0.75 + (xrayModifier > 1 ? 0.1 : 0) - (i * 0.03),
    });
  }

  return predictions;
}

/**
 * Generate statistical predictions based on X-ray flux trends
 */
function generateStatisticalPrediction(
  xrayData: any[],
  currentXray: XRayFluxData | null
): PredictionResult[] {
  const predictions: PredictionResult[] = [];
  const now = Date.now();

  // Calculate baseline from recent data
  const recentFlux = xrayData.slice(0, 10);
  const avgFlux = recentFlux.reduce((sum, d) => sum + (d.flux || 0), 0) / recentFlux.length;
  const fluxTrend = recentFlux[0]?.flux - recentFlux[9]?.flux;

  // Determine base probability from flux level
  let baseProbability = 0.05; // Minimum baseline
  if (avgFlux >= 1e-4) baseProbability = 0.5;
  else if (avgFlux >= 1e-5) baseProbability = 0.25;
  else if (avgFlux >= 1e-6) baseProbability = 0.1;

  // Adjust for trend
  const trendFactor = fluxTrend > 0 ? 1.2 : 0.9;

  for (let i = 0; i < 4; i++) {
    const timeOffset = (i + 1) * 30 * 60 * 1000;
    const prob = Math.min(0.8, baseProbability * trendFactor * (1 - i * 0.05));

    predictions.push({
      time: new Date(now + timeOffset).toISOString(),
      flare_probability: Math.max(0.01, prob),
      class_probabilities: {
        C: prob * 0.6,
        M: prob * 0.3,
        X: prob * 0.1,
      },
      confidence: 0.55 - (i * 0.03), // Lower confidence for statistical model
    });
  }

  return predictions;
}

/**
 * Mock prediction data for testing
 */
function getMockPrediction() {
  const now = Date.now();
  return {
    model: 'Mock Model',
    model_type: 'mock',
    prediction_time: new Date().toISOString(),
    forecast_horizon_hours: 2,
    predictions: [
      {
        time: new Date(now + 30 * 60 * 1000).toISOString(),
        flare_probability: 0.12,
        class_probabilities: { C: 0.08, M: 0.03, X: 0.01 },
        confidence: 0.85,
      },
      {
        time: new Date(now + 60 * 60 * 1000).toISOString(),
        flare_probability: 0.18,
        class_probabilities: { C: 0.11, M: 0.05, X: 0.02 },
        confidence: 0.82,
      },
      {
        time: new Date(now + 90 * 60 * 1000).toISOString(),
        flare_probability: 0.22,
        class_probabilities: { C: 0.14, M: 0.06, X: 0.02 },
        confidence: 0.78,
      },
      {
        time: new Date(now + 120 * 60 * 1000).toISOString(),
        flare_probability: 0.15,
        class_probabilities: { C: 0.10, M: 0.04, X: 0.01 },
        confidence: 0.75,
      },
    ],
    source: 'mock-prediction',
    metadata: {
      data_sources: ['Mock data'],
      processing_time_ms: 0,
    },
  };
}
