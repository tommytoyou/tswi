import { NextRequest, NextResponse } from 'next/server';
import {
  GPData,
  TLEHistoryData,
  ManeuverEvent,
  DEFAULT_WATCH_LIST,
  INSPECTOR_SATELLITES,
  SpaceTrackResponse,
} from '@/lib/space-track-types';
import {
  detectManeuvers,
  filterByConfidence,
  sortManeuversByDate,
} from '@/lib/maneuver-detection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// SPACE-TRACK API HELPERS
// ============================================================================

const SPACE_TRACK_BASE_URL = 'https://www.space-track.org';
const SPACE_TRACK_AUTH_URL = `${SPACE_TRACK_BASE_URL}/ajaxauth/login`;

interface SessionCache {
  cookie: string;
  expiresAt: number;
}

let sessionCache: SessionCache | null = null;
const SESSION_TTL_MS = 90 * 60 * 1000;

async function authenticate(): Promise<string> {
  if (sessionCache && Date.now() < sessionCache.expiresAt) {
    return sessionCache.cookie;
  }

  const username = process.env.SPACE_TRACK_USERNAME;
  const password = process.env.SPACE_TRACK_PASSWORD;

  if (!username || !password) {
    throw new Error('Space-Track credentials not configured');
  }

  const response = await fetch(SPACE_TRACK_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      identity: username,
      password: password,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Space-Track authentication failed: ${response.status}`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('Space-Track authentication failed: No session cookie');
  }

  const cookieMatch = setCookie.match(/chocolatechip=([^;]+)/);
  if (!cookieMatch) {
    throw new Error('Space-Track authentication failed: Invalid cookie format');
  }

  const cookie = `chocolatechip=${cookieMatch[1]}`;
  sessionCache = {
    cookie,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  return cookie;
}

async function fetchTLEHistory(noradId: number, days: number): Promise<TLEHistoryData[]> {
  const cookie = await authenticate();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  const url = `${SPACE_TRACK_BASE_URL}/basicspacedata/query/class/gp_history/NORAD_CAT_ID/${noradId}/EPOCH/%3E${startDateStr}/orderby/EPOCH%20asc/limit/500/format/json`;

  const response = await fetch(url, {
    headers: { Cookie: cookie },
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 401) {
      sessionCache = null;
      throw new Error('Authentication expired');
    }
    throw new Error(`Space-Track API error: ${response.status}`);
  }

  return response.json();
}

async function fetchLatestGP(noradId: number): Promise<GPData | null> {
  const cookie = await authenticate();

  const url = `${SPACE_TRACK_BASE_URL}/basicspacedata/query/class/gp/NORAD_CAT_ID/${noradId}/orderby/EPOCH%20desc/limit/1/format/json`;

  const response = await fetch(url, {
    headers: { Cookie: cookie },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const data: GPData[] = await response.json();
  return data[0] || null;
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

/**
 * GET /api/maneuvers
 *
 * Detect orbital maneuvers for space objects
 *
 * Query params:
 * - norad_id: Single NORAD catalog ID to analyze
 * - watch_list: 'true' to analyze the default watch list (inspector satellites)
 * - days: Number of days of TLE history to analyze (default: 30)
 * - min_confidence: Minimum confidence threshold (0-1, default: 0.5)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const noradIdParam = searchParams.get('norad_id');
    const watchList = searchParams.get('watch_list') === 'true';
    const days = parseInt(searchParams.get('days') || '30');
    const minConfidence = parseFloat(searchParams.get('min_confidence') || '0.5');

    let allManeuvers: ManeuverEvent[] = [];
    const errors: { norad_id: number; error: string }[] = [];

    if (watchList) {
      // Analyze all objects in the watch list
      const satellites = Object.values(INSPECTOR_SATELLITES);

      for (const sat of satellites) {
        try {
          const tleHistory = await fetchTLEHistory(sat.norad_id, days);

          if (tleHistory.length < 2) {
            continue;
          }

          const maneuvers = detectManeuvers(tleHistory, sat.name, sat.norad_id);
          const filtered = filterByConfidence(maneuvers, minConfidence);
          allManeuvers = allManeuvers.concat(filtered);
        } catch (error) {
          errors.push({
            norad_id: sat.norad_id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Sort by date
      allManeuvers = sortManeuversByDate(allManeuvers);

      return NextResponse.json({
        success: true,
        data: allManeuvers,
        count: allManeuvers.length,
        analyzed_objects: satellites.length,
        errors: errors.length > 0 ? errors : undefined,
        source: 'space-track',
        parameters: {
          watch_list: true,
          days,
          min_confidence: minConfidence,
        },
      });
    }

    if (noradIdParam) {
      // Analyze single object
      const noradId = parseInt(noradIdParam);

      if (isNaN(noradId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid norad_id parameter' },
          { status: 400 }
        );
      }

      // Fetch TLE history
      const tleHistory = await fetchTLEHistory(noradId, days);

      if (tleHistory.length < 2) {
        return NextResponse.json({
          success: true,
          data: [],
          count: 0,
          message: 'Insufficient TLE data for maneuver detection',
          tle_count: tleHistory.length,
          source: 'space-track',
        });
      }

      // Get object name from latest GP
      const latestGP = await fetchLatestGP(noradId);
      const objectName = latestGP?.OBJECT_NAME || `NORAD ${noradId}`;

      // Detect maneuvers
      const maneuvers = detectManeuvers(tleHistory, objectName, noradId);
      const filtered = filterByConfidence(maneuvers, minConfidence);
      const sorted = sortManeuversByDate(filtered);

      return NextResponse.json({
        success: true,
        data: sorted,
        count: sorted.length,
        object_name: objectName,
        norad_id: noradId,
        tle_count: tleHistory.length,
        source: 'space-track',
        parameters: {
          days,
          min_confidence: minConfidence,
        },
      });
    }

    // No parameters provided - return usage info
    return NextResponse.json({
      success: false,
      error: 'Missing required parameter: norad_id or watch_list=true',
      usage: {
        single_object: '/api/maneuvers?norad_id=49502&days=30',
        watch_list: '/api/maneuvers?watch_list=true&days=30',
        parameters: {
          norad_id: 'NORAD catalog ID of the object to analyze',
          watch_list: 'Set to "true" to analyze inspector satellite watch list',
          days: 'Number of days of TLE history to analyze (default: 30)',
          min_confidence: 'Minimum confidence threshold 0-1 (default: 0.5)',
        },
        watch_list_objects: Object.entries(INSPECTOR_SATELLITES).map(([key, sat]) => ({
          key,
          norad_id: sat.norad_id,
          name: sat.name,
          country: sat.country,
          description: sat.description,
        })),
      },
    }, { status: 400 });
  } catch (error) {
    console.error('Maneuvers API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('credentials not configured')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Space-Track credentials not configured. Set SPACE_TRACK_USERNAME and SPACE_TRACK_PASSWORD.',
          data: [],
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        data: [],
      },
      { status: 500 }
    );
  }
}
