import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Refreshing stale positions queries Horizons one object at a time
export const maxDuration = 60;

// Spacecraft definitions with NASA JPL Horizons IDs
interface SpacecraftDef {
  id: string;
  name: string;
  horizonsId: string;
  type: 'deep-space' | 'inner-solar' | 'outer-solar' | 'earth-orbit';
  agency: 'NASA' | 'ESA' | 'NASA/ESA' | 'JAXA';
  missionStatus: 'active' | 'extended' | 'nominal';
  description: string;
}

const SPACECRAFT: SpacecraftDef[] = [
  { id: 'voyager1', name: 'Voyager 1', horizonsId: '-31', type: 'deep-space', agency: 'NASA', missionStatus: 'extended', description: 'Farthest human-made object, launched 1977' },
  { id: 'voyager2', name: 'Voyager 2', horizonsId: '-32', type: 'deep-space', agency: 'NASA', missionStatus: 'extended', description: 'Second farthest spacecraft, exploring interstellar space' },
  { id: 'newhorizons', name: 'New Horizons', horizonsId: '-98', type: 'deep-space', agency: 'NASA', missionStatus: 'extended', description: 'Pluto flyby mission, now in Kuiper Belt' },
  { id: 'parkersolar', name: 'Parker Solar Probe', horizonsId: '-96', type: 'inner-solar', agency: 'NASA', missionStatus: 'active', description: 'Closest approach to the Sun ever attempted' },
  { id: 'jwst', name: 'James Webb Space Telescope', horizonsId: '-170', type: 'earth-orbit', agency: 'NASA/ESA', missionStatus: 'active', description: 'Premier infrared space observatory at L2' },
  { id: 'juno', name: 'Juno', horizonsId: '-61', type: 'outer-solar', agency: 'NASA', missionStatus: 'extended', description: 'Jupiter polar orbiter studying gas giant' },
  { id: 'mro', name: 'Mars Reconnaissance Orbiter', horizonsId: '-74', type: 'inner-solar', agency: 'NASA', missionStatus: 'extended', description: 'Mars orbiter with high-resolution imaging' },
  { id: 'lucy', name: 'Lucy', horizonsId: '-49', type: 'outer-solar', agency: 'NASA', missionStatus: 'active', description: 'First mission to Jupiter Trojan asteroids' },
  { id: 'psyche', name: 'Psyche', horizonsId: '-255', type: 'outer-solar', agency: 'NASA', missionStatus: 'active', description: 'Mission to metal-rich asteroid 16 Psyche' },
  { id: 'bepicolombo', name: 'BepiColombo', horizonsId: '-121', type: 'inner-solar', agency: 'ESA', missionStatus: 'active', description: 'ESA/JAXA Mercury orbiter en route' },
  { id: 'solarorbiter', name: 'Solar Orbiter', horizonsId: '-144', type: 'inner-solar', agency: 'ESA', missionStatus: 'active', description: 'ESA mission to study the Sun close-up' },
  { id: 'stereoa', name: 'STEREO-A', horizonsId: '-234', type: 'inner-solar', agency: 'NASA', missionStatus: 'extended', description: 'Solar observatory in heliocentric orbit' },
];

// Planet definitions
interface PlanetDef {
  id: string;
  name: string;
  horizonsId: string;
  color: string;
  size: number; // relative size for visualization
}

const PLANETS: PlanetDef[] = [
  { id: 'mercury', name: 'Mercury', horizonsId: '199', color: '#8C8C8C', size: 0.4 },
  { id: 'venus', name: 'Venus', horizonsId: '299', color: '#E6A64E', size: 0.9 },
  { id: 'earth', name: 'Earth', horizonsId: '399', color: '#3B82F6', size: 1.0 },
  { id: 'mars', name: 'Mars', horizonsId: '499', color: '#EF4444', size: 0.5 },
  { id: 'jupiter', name: 'Jupiter', horizonsId: '599', color: '#D4A574', size: 2.5 },
  { id: 'saturn', name: 'Saturn', horizonsId: '699', color: '#F4D03F', size: 2.2 },
  { id: 'uranus', name: 'Uranus', horizonsId: '799', color: '#06B6D4', size: 1.5 },
  { id: 'neptune', name: 'Neptune', horizonsId: '899', color: '#1E40AF', size: 1.4 },
];

// Heliocentric position
interface HeliocentricPosition {
  x: number; // AU
  y: number; // AU
  z: number; // AU
  distanceFromSun: number; // AU
}

/** ok: current position; ended: Horizons has no ephemeris for now; unavailable: never fetched successfully */
type PositionStatus = 'ok' | 'ended' | 'unavailable';

interface SpacecraftData extends SpacecraftDef {
  position: HeliocentricPosition | null;
  /** Epoch of the position (UTC, start of the hour it was computed for) */
  positionEpoch: string | null;
  /** When this position was fetched from Horizons */
  fetchedAt: string | null;
  status: PositionStatus;
  /** Last date Horizons has an ephemeris for, when status is 'ended' (YYYY-MM-DD) */
  ephemerisEnd?: string;
  error?: string;
}

interface PlanetData extends PlanetDef {
  position: HeliocentricPosition | null;
  positionEpoch: string | null;
  fetchedAt: string | null;
  orbitRadius: number; // Average orbit radius in AU
}

/** One document per Horizons object in MongoDB (horizons_positions). */
interface CachedPosition {
  horizonsId: string;
  name: string;
  position: HeliocentricPosition | null;
  positionEpoch: Date | null;
  fetchedAt: Date | null;
  status: PositionStatus;
  ephemerisEnd?: string | null;
  lastError?: string | null;
  /** Earliest time another Horizons request may be made for this object */
  nextAttemptAt: Date;
}

const HORIZONS_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const USER_AGENT = 'TSWI-SpaceWeather/1.0 (+https://www.tswi.us; hourly heliocentric positions)';
const CACHE_COLLECTION = 'horizons_positions';
const REFRESH_MS = 60 * 60 * 1000; // positions refreshed at most hourly
const RETRY_AFTER_ERROR_MS = 5 * 60 * 1000; // transient Horizons errors retried after 5 min
const LOCK_MS = 2 * 60 * 1000; // claim held while one instance queries Horizons

const MONTHS: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

/** "2019-JAN-01" / "2019-Jan-01" -> "2019-01-01" */
function horizonsDate(d: string): string | null {
  const m = d.match(/(\d{4})-([A-Za-z]{3})-(\d{2})/);
  if (!m) return null;
  const mm = MONTHS[m[2].toUpperCase()];
  return mm ? `${m[1]}-${mm}-${m[3]}` : null;
}

type HorizonsResult =
  | { kind: 'ok'; position: HeliocentricPosition; epoch: Date }
  | { kind: 'ended'; ephemerisEnd: string; message: string }
  | { kind: 'error'; message: string };

const NUM = String.raw`([-+]?\d+(?:\.\d*)?(?:E[-+]?\d+)?)`;
const X_RE = new RegExp(String.raw`X\s*=\s*` + NUM, 'i');
const Y_RE = new RegExp(String.raw`Y\s*=\s*` + NUM, 'i');
const Z_RE = new RegExp(String.raw`Z\s*=\s*` + NUM, 'i');

/**
 * One Horizons VECTORS request for the start of the current UTC hour.
 * Horizons answers concurrent requests from one client with HTTP 503
 * ("Unexpected Server Error" HTML), so callers run these one at a time.
 */
async function queryHorizons(horizonsId: string): Promise<HorizonsResult> {
  const start = new Date(Math.floor(Date.now() / REFRESH_MS) * REFRESH_MS);
  const stop = new Date(start.getTime() + REFRESH_MS);
  const fmt = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ');

  const params = new URLSearchParams({
    format: 'json',
    COMMAND: `'${horizonsId}'`,
    OBJ_DATA: 'NO',
    MAKE_EPHEM: 'YES',
    EPHEM_TYPE: 'VECTORS',
    CENTER: '@sun',
    START_TIME: `'${fmt(start)}'`,
    STOP_TIME: `'${fmt(stop)}'`,
    STEP_SIZE: '1 h',
    TIME_TYPE: 'UT',
    VEC_TABLE: '1',
    REF_SYSTEM: 'ICRF',
    REF_PLANE: 'ECLIPTIC',
    VEC_CORR: 'NONE',
    OUT_UNITS: 'AU-D',
    VEC_LABELS: 'YES',
    CSV_FORMAT: 'NO',
  });

  let response: Response;
  try {
    response = await fetch(`${HORIZONS_URL}?${params}`, {
      cache: 'no-store',
      headers: { 'User-Agent': USER_AGENT },
    });
  } catch (error: any) {
    return { kind: 'error', message: `request failed: ${error?.message || error}` };
  }

  const body = await response.text();
  if (!response.ok) {
    return { kind: 'error', message: `HTTP ${response.status}, ${body.length} bytes` };
  }

  let result = '';
  try {
    const json = JSON.parse(body);
    result = typeof json.result === 'string' ? json.result : '';
    if (!result && json.error) return { kind: 'error', message: String(json.error).slice(0, 200) };
  } catch {
    return { kind: 'error', message: `non-JSON response: ${body.slice(0, 120)}` };
  }

  const soe = result.indexOf('$$SOE');
  const eoe = result.indexOf('$$EOE');
  if (soe === -1 || eoe === -1) {
    // e.g. 'No ephemeris for target "X" after A.D. 2019-JAN-01 00:00:00.0000 TDB'
    const line = result.match(/No ephemeris for target[^\n]*/)?.[0];
    const after = line?.match(/after A\.D\.\s*(\d{4}-[A-Za-z]{3}-\d{2})/);
    if (line && after) {
      return { kind: 'ended', ephemerisEnd: horizonsDate(after[1]) ?? after[1], message: line.trim() };
    }
    return { kind: 'error', message: `no ephemeris block: ${result.replace(/\s+/g, ' ').slice(0, 200)}` };
  }

  const block = result.substring(soe + 5, eoe);
  const x = block.match(X_RE);
  const y = block.match(Y_RE);
  const z = block.match(Z_RE);
  if (!x || !y || !z) {
    return { kind: 'error', message: `could not parse vectors: ${block.trim().slice(0, 120)}` };
  }

  const px = parseFloat(x[1]);
  const py = parseFloat(y[1]);
  const pz = parseFloat(z[1]);
  return {
    kind: 'ok',
    position: { x: px, y: py, z: pz, distanceFromSun: Math.sqrt(px * px + py * py + pz * pz) },
    epoch: start,
  };
}

let indexEnsured = false;
async function positionsCollection() {
  const collection = await getCollection<CachedPosition>(CACHE_COLLECTION);
  if (!indexEnsured) {
    await collection.createIndex({ horizonsId: 1 }, { unique: true });
    indexEnsured = true;
  }
  return collection;
}

/**
 * Refresh due positions from Horizons, one request at a time. Each object is
 * claimed atomically (nextAttemptAt) so concurrent instances never query the
 * same object twice; on failure the last good position is kept.
 */
async function refreshPositions(objects: { horizonsId: string; name: string }[]) {
  const collection = await positionsCollection();

  for (const obj of objects) {
    const now = new Date();
    try {
      // Matches when due; inserts on first use; collides on the unique index
      // (E11000) when the object is fresh or being refreshed elsewhere.
      await collection.updateOne(
        { horizonsId: obj.horizonsId, nextAttemptAt: { $lte: now } },
        {
          $set: { nextAttemptAt: new Date(now.getTime() + LOCK_MS), name: obj.name },
          $setOnInsert: { position: null, positionEpoch: null, fetchedAt: null, status: 'unavailable' as PositionStatus },
        },
        { upsert: true }
      );
    } catch (error: any) {
      if (error?.code === 11000) continue;
      throw error;
    }

    let result = await queryHorizons(obj.horizonsId);
    if (result.kind === 'error' && result.message.startsWith('HTTP 503')) {
      await new Promise((r) => setTimeout(r, 1500));
      result = await queryHorizons(obj.horizonsId);
    }

    const done = new Date();
    if (result.kind === 'ok') {
      await collection.updateOne({ horizonsId: obj.horizonsId }, {
        $set: {
          position: result.position,
          positionEpoch: result.epoch,
          fetchedAt: done,
          status: 'ok',
          ephemerisEnd: null,
          lastError: null,
          nextAttemptAt: new Date(result.epoch.getTime() + REFRESH_MS),
        },
      });
    } else if (result.kind === 'ended') {
      console.warn(`[Horizons] ${obj.name} (${obj.horizonsId}): ${result.message}`);
      await collection.updateOne({ horizonsId: obj.horizonsId }, {
        $set: {
          position: null,
          positionEpoch: null,
          fetchedAt: done,
          status: 'ended',
          ephemerisEnd: result.ephemerisEnd,
          lastError: result.message,
          nextAttemptAt: new Date(done.getTime() + 24 * REFRESH_MS),
        },
      });
    } else {
      console.warn(`[Horizons] ${obj.name} (${obj.horizonsId}) failed: ${result.message}; keeping last good position`);
      await collection.updateOne({ horizonsId: obj.horizonsId }, {
        $set: { lastError: result.message, nextAttemptAt: new Date(done.getTime() + RETRY_AFTER_ERROR_MS) },
      });
    }
  }
}

// Average orbital radii in AU for planets
const ORBITAL_RADII: Record<string, number> = {
  mercury: 0.387,
  venus: 0.723,
  earth: 1.0,
  mars: 1.524,
  jupiter: 5.203,
  saturn: 9.537,
  uranus: 19.191,
  neptune: 30.069,
};

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

/**
 * GET /api/spacecraft
 *
 * Heliocentric positions for spacecraft and planets from NASA JPL Horizons,
 * cached in MongoDB (horizons_positions) and refreshed at most hourly per
 * object. Horizons is queried one object at a time: it answers concurrent
 * requests with HTTP 503.
 *
 * Returns X, Y, Z coordinates in AU (Astronomical Units) centered on the Sun.
 * Spacecraft whose Horizons ephemeris has ended get status 'ended' and
 * error "No current ephemeris (mission ended <date>)".
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const viewMode = searchParams.get('view') || 'inner'; // inner, outer, full

    // Determine which spacecraft to fetch based on view mode
    let spacecraftToFetch = SPACECRAFT;
    let planetsToFetch = PLANETS;

    if (viewMode === 'inner') {
      spacecraftToFetch = SPACECRAFT.filter(s =>
        s.type === 'inner-solar' || s.type === 'earth-orbit'
      );
      planetsToFetch = PLANETS.filter(p =>
        ['mercury', 'venus', 'earth', 'mars'].includes(p.id)
      );
    } else if (viewMode === 'outer') {
      spacecraftToFetch = SPACECRAFT.filter(s =>
        s.type === 'outer-solar' || s.type === 'deep-space'
      );
      // Include Mars through Neptune for outer view
      planetsToFetch = PLANETS.filter(p =>
        ['mars', 'jupiter', 'saturn', 'uranus', 'neptune'].includes(p.id)
      );
    }
    // 'full' mode includes all

    const objects = [...spacecraftToFetch, ...planetsToFetch].map(o => ({ horizonsId: o.horizonsId, name: o.name }));
    await refreshPositions(objects);

    const collection = await positionsCollection();
    const cached = await collection
      .find({ horizonsId: { $in: objects.map(o => o.horizonsId) } }, { projection: { _id: 0 } })
      .toArray();
    const byId = new Map(cached.map(c => [c.horizonsId, c]));

    const spacecraftResults: SpacecraftData[] = spacecraftToFetch.map(sc => {
      const c = byId.get(sc.horizonsId);
      const status: PositionStatus = c?.status ?? 'unavailable';
      const base = {
        ...sc,
        position: c?.position ?? null,
        positionEpoch: iso(c?.positionEpoch),
        fetchedAt: iso(c?.fetchedAt),
        status,
      };
      if (status === 'ended') {
        return {
          ...base,
          ephemerisEnd: c?.ephemerisEnd ?? undefined,
          error: `No current ephemeris (mission ended ${c?.ephemerisEnd ?? 'date unknown'})`,
        };
      }
      return base.position ? base : { ...base, error: `Position data unavailable${c?.lastError ? ` (${c.lastError})` : ''}` };
    });

    const planetResults: PlanetData[] = planetsToFetch.map(planet => {
      const c = byId.get(planet.horizonsId);
      return {
        ...planet,
        position: c?.position ?? null,
        positionEpoch: iso(c?.positionEpoch),
        fetchedAt: iso(c?.fetchedAt),
        orbitRadius: ORBITAL_RADII[planet.id] || 1,
      };
    });

    // Calculate statistics
    const successfulSpacecraft = spacecraftResults.filter(s => s.position !== null);
    const furthestSpacecraft = successfulSpacecraft.reduce((max, s) => {
      if (!s.position) return max;
      if (!max || !max.position) return s;
      return s.position.distanceFromSun > max.position.distanceFromSun ? s : max;
    }, null as SpacecraftData | null);

    const closestToSun = successfulSpacecraft.reduce((min, s) => {
      if (!s.position) return min;
      if (!min || !min.position) return s;
      return s.position.distanceFromSun < min.position.distanceFromSun ? s : min;
    }, null as SpacecraftData | null);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      viewMode,
      spacecraft: spacecraftResults,
      planets: planetResults,
      stats: {
        totalSpacecraft: spacecraftResults.length,
        successfulFetches: successfulSpacecraft.length,
        endedMissions: spacecraftResults.filter(s => s.status === 'ended').length,
        furthestFromSun: furthestSpacecraft ? {
          name: furthestSpacecraft.name,
          distance: furthestSpacecraft.position?.distanceFromSun,
        } : null,
        closestToSun: closestToSun ? {
          name: closestToSun.name,
          distance: closestToSun.position?.distanceFromSun,
        } : null,
      },
      source: 'NASA JPL Horizons (cached hourly)',
    });
  } catch (error: any) {
    console.error('Spacecraft API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch spacecraft data',
        spacecraft: [],
        planets: [],
      },
      { status: 500 }
    );
  }
}
