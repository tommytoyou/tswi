import { NextRequest, NextResponse } from 'next/server';
import { CmeEvent, ProcessedCme } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Distance from Sun to Earth in km (~1 AU)
const AU_KM = 149597870.7;

/**
 * Categorize CME speed
 * Slow: < 500 km/s
 * Moderate: 500-1000 km/s
 * Fast: 1000-2000 km/s
 * Extreme: > 2000 km/s
 */
function getSpeedCategory(speed: number | undefined): 'slow' | 'moderate' | 'fast' | 'extreme' {
  if (!speed) return 'slow';
  if (speed < 500) return 'slow';
  if (speed < 1000) return 'moderate';
  if (speed < 2000) return 'fast';
  return 'extreme';
}

/**
 * Determine if CME is Earth-directed based on source location
 * Earth-directed CMEs typically originate within ±30 degrees of disk center
 * Also check WSA-Enlil model predictions if available
 */
function isEarthDirected(
  sourceLocation: string | undefined,
  longitude: number | undefined,
  enlilList?: Array<{ isEarthGB?: boolean }> | null
): boolean {
  // Check WSA-Enlil model predictions first
  if (enlilList && enlilList.length > 0) {
    const hasEarthGlancingBlow = enlilList.some(e => e.isEarthGB === true);
    if (hasEarthGlancingBlow) return true;
  }

  // Parse source location (e.g., "N15W30" means 15° North, 30° West)
  if (sourceLocation) {
    const match = sourceLocation.match(/[NS](\d+)[EW](\d+)/i);
    if (match) {
      const lon = parseInt(match[2]);
      // CMEs within ~45° of disk center have a chance of being geoeffective
      return lon <= 45;
    }
  }

  // Check longitude from CME analysis
  if (longitude !== undefined) {
    return Math.abs(longitude) <= 45;
  }

  return false;
}

/**
 * Calculate estimated arrival time based on speed
 * Travel time = distance / speed
 * Note: CME speed typically decelerates or accelerates based on solar wind
 */
function calculateArrivalTime(
  startTime: Date,
  speed: number | undefined,
  enlilEstimate?: string | null
): { arrival: Date | null; hoursUntil: number | null } {
  // Prefer WSA-Enlil model estimate if available
  if (enlilEstimate) {
    const arrivalDate = new Date(enlilEstimate);
    if (!isNaN(arrivalDate.getTime())) {
      const hoursUntil = (arrivalDate.getTime() - Date.now()) / (1000 * 60 * 60);
      return { arrival: arrivalDate, hoursUntil: hoursUntil > 0 ? hoursUntil : null };
    }
  }

  // Fall back to simple calculation
  if (!speed || speed <= 0) return { arrival: null, hoursUntil: null };

  // Travel time in hours: distance (km) / speed (km/s) / 3600
  const travelHours = AU_KM / speed / 3600;
  const arrivalDate = new Date(startTime.getTime() + travelHours * 60 * 60 * 1000);
  const hoursUntil = (arrivalDate.getTime() - Date.now()) / (1000 * 60 * 60);

  return {
    arrival: arrivalDate,
    hoursUntil: hoursUntil > 0 ? hoursUntil : null,
  };
}

/**
 * Process raw CME data into frontend-friendly format
 */
function processCmeEvents(events: CmeEvent[]): ProcessedCme[] {
  return events.map((event) => {
    // Get the most accurate analysis if available
    const analyses = event.cmeAnalyses || [];
    const bestAnalysis = analyses.find(a => a.isMostAccurate) || analyses[0];

    const speed = bestAnalysis?.speed;
    const halfAngle = bestAnalysis?.halfAngle;
    const longitude = bestAnalysis?.longitude;
    const enlilList = bestAnalysis?.enlilList;

    // Get Enlil arrival estimate
    const enlilArrival = enlilList?.[0]?.estimatedShockArrivalTime;
    const enlilLink = enlilList?.[0]?.link;

    const startTime = new Date(event.startTime);
    const earthDirected = isEarthDirected(event.sourceLocation, longitude, enlilList);
    const { arrival, hoursUntil } = calculateArrivalTime(startTime, speed, enlilArrival);

    // Find linked flare
    const linkedFlare = event.linkedEvents?.find(e =>
      e.activityID.includes('FLR')
    )?.activityID;

    return {
      id: event.activityID,
      startTime,
      sourceLocation: event.sourceLocation,
      activeRegion: event.activeRegionNum,
      speed,
      halfAngle,
      isEarthDirected: earthDirected,
      estimatedArrival: arrival,
      arrivalHours: hoursUntil,
      speedCategory: getSpeedCategory(speed),
      linkedFlare,
      note: event.note,
      enlilModelUrl: enlilLink,
    };
  });
}

/**
 * GET /api/nasa/cme
 *
 * Fetches CME data from NASA DONKI API
 *
 * Query params:
 * - days: number of days to look back (default: 7, max: 30)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') || '7'), 30);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    // Get API key (DEMO_KEY works for low traffic)
    const apiKey = process.env.NASA_API_KEY || 'DEMO_KEY';

    // Fetch CME events from NASA DONKI
    const cmeUrl = `https://api.nasa.gov/DONKI/CME?startDate=${formatDate(startDate)}&endDate=${formatDate(endDate)}&api_key=${apiKey}`;

    const response = await fetch(cmeUrl, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`NASA DONKI API returned ${response.status}`);
    }

    const rawData: CmeEvent[] = await response.json();

    // Handle empty response (NASA returns empty array, not null)
    if (!Array.isArray(rawData)) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        earthDirectedCount: 0,
        source: 'nasa-donki',
      });
    }

    // Process CME events
    const processedEvents = processCmeEvents(rawData);

    // Sort by start time (most recent first)
    processedEvents.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    // Count Earth-directed CMEs
    const earthDirectedCount = processedEvents.filter(e => e.isEarthDirected).length;

    // Find any incoming CMEs (arrival time in future)
    const incomingCmes = processedEvents.filter(
      e => e.isEarthDirected && e.arrivalHours && e.arrivalHours > 0
    );

    return NextResponse.json({
      success: true,
      data: processedEvents,
      count: processedEvents.length,
      earthDirectedCount,
      incomingCount: incomingCmes.length,
      nextArrival: incomingCmes[0]?.estimatedArrival || null,
      source: 'nasa-donki',
      dateRange: {
        start: formatDate(startDate),
        end: formatDate(endDate),
      },
    });
  } catch (error: any) {
    console.error('CME API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch CME data' },
      { status: 500 }
    );
  }
}
