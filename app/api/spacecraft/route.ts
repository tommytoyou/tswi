import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

interface SpacecraftData extends SpacecraftDef {
  position: HeliocentricPosition | null;
  error?: string;
}

interface PlanetData extends PlanetDef {
  position: HeliocentricPosition | null;
  orbitRadius: number; // Average orbit radius in AU
}

// Fetch position from JPL Horizons API
async function fetchHorizonsPosition(horizonsId: string, name: string): Promise<HeliocentricPosition | null> {
  try {
    // Using JPL Horizons API
    // COMMAND: object ID
    // CENTER: @sun (heliocentric)
    // MAKE_EPHEM: YES
    // TABLE_TYPE: VECTORS
    // OUT_UNITS: AU-D (AU and days)
    const now = new Date();
    const startTime = now.toISOString().split('T')[0];
    const endDate = new Date(now.getTime() + 86400000); // +1 day
    const stopTime = endDate.toISOString().split('T')[0];

    const params = new URLSearchParams({
      format: 'json',
      COMMAND: `'${horizonsId}'`,
      OBJ_DATA: 'NO',
      MAKE_EPHEM: 'YES',
      EPHEM_TYPE: 'VECTORS',
      CENTER: '@sun',
      START_TIME: `'${startTime}'`,
      STOP_TIME: `'${stopTime}'`,
      STEP_SIZE: '1 d',
      VEC_TABLE: '1',
      REF_SYSTEM: 'ICRF',
      REF_PLANE: 'ECLIPTIC',
      VEC_CORR: 'NONE',
      OUT_UNITS: 'AU-D',
      VEC_LABELS: 'YES',
      CSV_FORMAT: 'NO',
    });

    const url = `https://ssd.jpl.nasa.gov/api/horizons.api?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TSWI-SpaceWeather/1.0',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.warn(`Horizons API returned ${response.status} for ${name}`);
      return null;
    }

    const data = await response.json();

    if (!data.result) {
      console.warn(`No result for ${name}:`, data);
      return null;
    }

    // Parse the result string to extract X, Y, Z coordinates
    // The result contains vector data in format like:
    // X = 1.234567890E+00 Y = 2.345678901E+00 Z = 3.456789012E-01
    const result = data.result as string;

    // Find the $$SOE marker (start of ephemeris data)
    const soeIndex = result.indexOf('$$SOE');
    const eoeIndex = result.indexOf('$$EOE');

    if (soeIndex === -1 || eoeIndex === -1) {
      console.warn(`Could not find ephemeris markers for ${name}`);
      return null;
    }

    const ephemerisData = result.substring(soeIndex + 5, eoeIndex).trim();

    // Extract X, Y, Z values using regex
    const xMatch = ephemerisData.match(/X\s*=\s*([-+]?\d+\.?\d*E?[+-]?\d*)/i);
    const yMatch = ephemerisData.match(/Y\s*=\s*([-+]?\d+\.?\d*E?[+-]?\d*)/i);
    const zMatch = ephemerisData.match(/Z\s*=\s*([-+]?\d+\.?\d*E?[+-]?\d*)/i);

    if (!xMatch || !yMatch || !zMatch) {
      console.warn(`Could not parse coordinates for ${name}:`, ephemerisData.substring(0, 200));
      return null;
    }

    const x = parseFloat(xMatch[1]);
    const y = parseFloat(yMatch[1]);
    const z = parseFloat(zMatch[1]);
    const distanceFromSun = Math.sqrt(x * x + y * y + z * z);

    return { x, y, z, distanceFromSun };
  } catch (error) {
    console.error(`Error fetching position for ${name}:`, error);
    return null;
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

/**
 * GET /api/spacecraft
 *
 * Fetches heliocentric positions for spacecraft and planets from NASA JPL Horizons
 *
 * Returns X, Y, Z coordinates in AU (Astronomical Units) centered on the Sun
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

    // Fetch all positions in parallel
    const spacecraftPromises = spacecraftToFetch.map(async (sc): Promise<SpacecraftData> => {
      const position = await fetchHorizonsPosition(sc.horizonsId, sc.name);
      return {
        ...sc,
        position,
        error: position ? undefined : 'Position data unavailable',
      };
    });

    const planetPromises = planetsToFetch.map(async (planet): Promise<PlanetData> => {
      const position = await fetchHorizonsPosition(planet.horizonsId, planet.name);
      return {
        ...planet,
        position,
        orbitRadius: ORBITAL_RADII[planet.id] || 1,
      };
    });

    const [spacecraftResults, planetResults] = await Promise.all([
      Promise.all(spacecraftPromises),
      Promise.all(planetPromises),
    ]);

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
        furthestFromSun: furthestSpacecraft ? {
          name: furthestSpacecraft.name,
          distance: furthestSpacecraft.position?.distanceFromSun,
        } : null,
        closestToSun: closestToSun ? {
          name: closestToSun.name,
          distance: closestToSun.position?.distanceFromSun,
        } : null,
      },
      source: 'NASA JPL Horizons',
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
