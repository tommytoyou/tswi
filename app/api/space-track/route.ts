import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/auth/api';
import {
  GPData,
  CDMData,
  DecayData,
  BoxscoreData,
  LaunchData,
  TLEHistoryData,
  SpaceTrackResponse,
} from '@/lib/space-track-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// SESSION CACHE
// Space-Track requires authentication; cache session cookie for 90 minutes
// ============================================================================

interface SessionCache {
  cookie: string;
  expiresAt: number;
}

let sessionCache: SessionCache | null = null;
const SESSION_TTL_MS = 90 * 60 * 1000; // 90 minutes

const SPACE_TRACK_BASE_URL = 'https://www.space-track.org';
const SPACE_TRACK_AUTH_URL = `${SPACE_TRACK_BASE_URL}/ajaxauth/login`;

// ============================================================================
// AUTHENTICATION
// ============================================================================

async function authenticate(): Promise<string> {
  // Check if we have a valid cached session
  if (sessionCache && Date.now() < sessionCache.expiresAt) {
    return sessionCache.cookie;
  }

  const username = process.env.SPACE_TRACK_USERNAME;
  const password = process.env.SPACE_TRACK_PASSWORD;

  if (!username || !password) {
    throw new Error('Space-Track credentials not configured. Set SPACE_TRACK_USERNAME and SPACE_TRACK_PASSWORD.');
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

  // Extract session cookie
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('Space-Track authentication failed: No session cookie received');
  }

  // Parse the cookie value
  const cookieMatch = setCookie.match(/chocolatechip=([^;]+)/);
  if (!cookieMatch) {
    throw new Error('Space-Track authentication failed: Invalid cookie format');
  }

  const cookie = `chocolatechip=${cookieMatch[1]}`;

  // Cache the session
  sessionCache = {
    cookie,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  return cookie;
}

// ============================================================================
// QUERY BUILDERS
// ============================================================================

const QUERY_TYPES = ['debris', 'catalog', 'cdm', 'decay', 'launch', 'gp', 'tle-history', 'boxscore'] as const;
type QueryType = (typeof QUERY_TYPES)[number];

const OBJECT_TYPES = ['PAYLOAD', 'ROCKET BODY', 'DEBRIS', 'UNKNOWN'] as const;

interface QueryConfig {
  endpoint: string;
  defaultParams: Record<string, string>;
}

const QUERY_CONFIGS: Record<QueryType, QueryConfig> = {
  debris: {
    endpoint: '/basicspacedata/query/class/gp',
    defaultParams: {
      OBJECT_TYPE: 'DEBRIS',
      orderby: 'EPOCH desc',
      limit: '100',
      format: 'json',
    },
  },
  catalog: {
    endpoint: '/basicspacedata/query/class/gp_history',
    defaultParams: {
      orderby: 'EPOCH desc',
      limit: '100',
      format: 'json',
    },
  },
  cdm: {
    endpoint: '/basicspacedata/query/class/cdm_public',
    defaultParams: {
      orderby: 'TCA desc',
      limit: '100',
      format: 'json',
    },
  },
  decay: {
    endpoint: '/basicspacedata/query/class/decay',
    defaultParams: {
      orderby: 'DECAY_EPOCH desc',
      limit: '50',
      format: 'json',
    },
  },
  launch: {
    endpoint: '/basicspacedata/query/class/launch_site',
    defaultParams: {
      orderby: 'LAUNCH_DATE desc',
      limit: '50',
      format: 'json',
    },
  },
  gp: {
    endpoint: '/basicspacedata/query/class/gp',
    defaultParams: {
      orderby: 'EPOCH desc',
      limit: '100',
      format: 'json',
    },
  },
  'tle-history': {
    endpoint: '/basicspacedata/query/class/gp_history',
    defaultParams: {
      orderby: 'EPOCH asc',
      limit: '500',
      format: 'json',
    },
  },
  boxscore: {
    endpoint: '/basicspacedata/query/class/boxscore',
    defaultParams: {
      format: 'json',
    },
  },
};

function buildQueryUrl(queryType: QueryType, params: Record<string, string>): string {
  const config = QUERY_CONFIGS[queryType];
  if (!config) {
    throw new Error(`Unknown query type: ${queryType}`);
  }

  // Merge default params with provided params
  const mergedParams = { ...config.defaultParams, ...params };

  // Build the URL path
  let url = SPACE_TRACK_BASE_URL + config.endpoint;

  // Add parameters to the URL path (Space-Track uses path-based params)
  for (const [key, value] of Object.entries(mergedParams)) {
    if (value && key !== 'format') {
      url += `/${encodeURIComponent(key)}/${encodeURIComponent(value)}`;
    }
  }

  // Format is always at the end
  url += `/format/${encodeURIComponent(mergedParams.format || 'json')}`;

  return url;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchSpaceTrackData<T>(queryType: QueryType, params: Record<string, string>): Promise<T[]> {
  const cookie = await authenticate();
  const url = buildQueryUrl(queryType, params);

  const response = await fetch(url, {
    headers: {
      Cookie: cookie,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    // If unauthorized, clear session cache and retry once
    if (response.status === 401) {
      sessionCache = null;
      const newCookie = await authenticate();
      const retryResponse = await fetch(url, {
        headers: {
          Cookie: newCookie,
        },
        cache: 'no-store',
      });

      if (!retryResponse.ok) {
        throw new Error(`Space-Track API error: ${retryResponse.status}`);
      }

      return retryResponse.json();
    }

    throw new Error(`Space-Track API error: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

/**
 * GET /api/space-track
 *
 * Query Space-Track.org for space domain awareness data
 *
 * Query params:
 * - query: 'debris' | 'catalog' | 'cdm' | 'decay' | 'launch' | 'gp' | 'tle-history' | 'boxscore'
 * - norad_id: NORAD catalog ID (for specific object queries)
 * - days: Number of days of data (default: 30)
 * - limit: Max results (default: 100)
 * - country: Filter by country code (e.g., 'PRC', 'RUS', 'US')
 * - object_type: Filter by object type ('PAYLOAD', 'ROCKET BODY', 'DEBRIS')
 */
function badRequest(error: string) {
  return NextResponse.json({ success: false, error }, { status: 400 });
}

/** Parse an optional integer param within [min, max]; null means invalid. */
function parseBoundedInt(raw: string | null, min: number, max: number, fallback: number): number | null {
  if (raw === null || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const n = parseInt(raw, 10);
  return n >= min && n <= max ? n : null;
}

export async function GET(request: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    const rawQuery = searchParams.get('query') || 'gp';
    if (!(QUERY_TYPES as readonly string[]).includes(rawQuery)) {
      return badRequest('Invalid query');
    }
    const queryType = rawQuery as QueryType;

    const noradId = searchParams.get('norad_id');
    if (noradId !== null && !/^\d{1,9}$/.test(noradId)) {
      return badRequest('Invalid norad_id');
    }

    const daysNum = parseBoundedInt(searchParams.get('days'), 1, 90, 30);
    if (daysNum === null) {
      return badRequest('days must be an integer from 1 to 90');
    }

    const limitNum = parseBoundedInt(searchParams.get('limit'), 1, 500, 100);
    if (limitNum === null) {
      return badRequest('limit must be an integer from 1 to 500');
    }

    const country = searchParams.get('country');
    if (country !== null && !/^[A-Z]{2,6}$/.test(country)) {
      return badRequest('Invalid country');
    }

    const objectType = searchParams.get('object_type');
    if (objectType !== null && !(OBJECT_TYPES as readonly string[]).includes(objectType)) {
      return badRequest('Invalid object_type');
    }

    const days = String(daysNum);
    const limit = String(limitNum);

    // Build query parameters
    const params: Record<string, string> = {
      limit,
    };

    // Add date range filter
    if (days && queryType !== 'boxscore') {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
      const startDateStr = startDate.toISOString().split('T')[0];

      if (queryType === 'cdm') {
        params['TCA'] = `>${startDateStr}`;
      } else if (queryType === 'decay') {
        params['MSG_EPOCH'] = `>${startDateStr}`;
      } else if (queryType === 'launch') {
        params['LAUNCH_DATE'] = `>${startDateStr}`;
      } else {
        params['EPOCH'] = `>${startDateStr}`;
      }
    }

    // Add NORAD ID filter
    if (noradId) {
      if (queryType === 'cdm') {
        // CDM uses SAT_1_ID or SAT_2_ID
        params['SAT_1_ID'] = noradId;
      } else {
        params['NORAD_CAT_ID'] = noradId;
      }
    }

    // Add country filter
    if (country) {
      params['COUNTRY_CODE'] = country;
    }

    // Add object type filter
    if (objectType) {
      params['OBJECT_TYPE'] = objectType;
    }

    // Fetch data based on query type
    let data: unknown[];

    switch (queryType) {
      case 'debris':
        params['OBJECT_TYPE'] = 'DEBRIS';
        data = await fetchSpaceTrackData<GPData>('debris', params);
        break;

      case 'catalog':
      case 'gp':
        data = await fetchSpaceTrackData<GPData>('gp', params);
        break;

      case 'cdm':
        data = await fetchSpaceTrackData<CDMData>('cdm', params);
        break;

      case 'decay':
        data = await fetchSpaceTrackData<DecayData>('decay', params);
        break;

      case 'launch':
        data = await fetchSpaceTrackData<LaunchData>('launch', params);
        break;

      case 'tle-history':
        if (!noradId) {
          return NextResponse.json(
            { success: false, error: 'norad_id is required for tle-history query' },
            { status: 400 }
          );
        }
        data = await fetchSpaceTrackData<TLEHistoryData>('tle-history', params);
        break;

      case 'boxscore':
        data = await fetchSpaceTrackData<BoxscoreData>('boxscore', params);
        break;

      default:
        return badRequest('Invalid query');
    }

    const response: SpaceTrackResponse<unknown> = {
      success: true,
      data,
      count: data.length,
      source: 'space-track',
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    // Log detail server-side only; never return internal messages to the client
    console.error('Space-Track API error:', error);

    const errorMessage = error instanceof Error ? error.message : '';
    const notConfigured = errorMessage.includes('credentials not configured');

    return NextResponse.json(
      {
        success: false,
        error: notConfigured ? 'Service unavailable' : 'Failed to fetch Space-Track data',
        data: [],
        count: 0,
      },
      { status: notConfigured ? 503 : 500 }
    );
  }
}
