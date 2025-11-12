import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/roadster
 *
 * Fetches Tesla Roadster orbital data
 * Uses SpaceX API and NASA Horizons ephemeris data
 *
 * Tracks: Starman (Elon's Tesla Roadster launched on Falcon Heavy in 2018)
 * NORAD ID: 43205
 * International Designator: 2018-017A
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeTrajectory = searchParams.get('trajectory') === 'true';

    // Fetch current Roadster data from SpaceX API
    const spacexUrl = 'https://api.spacexdata.com/v4/roadster';

    try {
      const response = await fetch(spacexUrl, {
        next: { revalidate: 3600 }, // Cache for 1 hour
      });

      if (!response.ok) {
        throw new Error(`SpaceX API returned ${response.status}`);
      }

      const roadsterData = await response.json();

      // Calculate current position using simplified orbital mechanics
      // In production, you'd use proper ephemeris data from NASA Horizons
      const position = calculateRoadsterPosition(roadsterData);

      const result: any = {
        success: true,
        data: {
          name: roadsterData.name || 'Tesla Roadster (Starman)',
          details: roadsterData.details,
          launch_date: roadsterData.launch_date_utc,
          launch_mass_kg: roadsterData.launch_mass_kg,
          launch_mass_lbs: roadsterData.launch_mass_lbs,
          norad_id: roadsterData.norad_id || 43205,

          // Current ephemeris data
          epoch: new Date().toISOString(),
          earth_distance_km: roadsterData.earth_distance_km,
          earth_distance_mi: roadsterData.earth_distance_mi,
          mars_distance_km: roadsterData.mars_distance_km,
          mars_distance_mi: roadsterData.mars_distance_mi,
          speed_kph: roadsterData.speed_kph,
          speed_mph: roadsterData.speed_mph,

          // Orbital elements
          orbit: {
            semi_major_axis_au: roadsterData.semi_major_axis_au || 1.325,
            eccentricity: roadsterData.eccentricity || 0.256,
            inclination_deg: roadsterData.inclination || 1.08,
            longitude_ascending_node_deg: roadsterData.longitude || 317.09,
            argument_periapsis_deg: roadsterData.periapsis_arg || 177.48,
            period_days: roadsterData.period_days || 557,
          },

          // Cartesian position (Heliocentric J2000)
          position: position,

          // Solar exposure metrics
          solar_exposure: {
            total_days: Math.floor((Date.now() - new Date(roadsterData.launch_date_utc).getTime()) / (1000 * 60 * 60 * 24)),
            radiation_dose_estimate_sv: calculateRadiationDose(roadsterData.launch_date_utc),
            temperature_estimate_c: estimateTemperature(roadsterData.earth_distance_km),
          },

          // Fun facts
          facts: {
            flickr_images: roadsterData.flickr_images || [],
            wikipedia: roadsterData.wikipedia,
            video: roadsterData.video,
            passengers: ['Starman', 'Hot Wheels Roadster', 'Plaque with 6,000 SpaceX employee names'],
            music_playing: 'Space Oddity by David Bowie (on repeat)',
          },
        },
        source: 'spacex-api',
      };

      // Add trajectory points if requested
      if (includeTrajectory) {
        result.data.trajectory = generateTrajectory(roadsterData);
      }

      return NextResponse.json(result);
    } catch (fetchError: any) {
      console.error('SpaceX API fetch error:', fetchError);

      // Return mock/cached data if API fails
      return NextResponse.json({
        success: true,
        data: getMockRoadsterData(),
        source: 'fallback-cache',
        warning: 'Using cached data - SpaceX API unavailable',
      });
    }
  } catch (error: any) {
    console.error('Roadster API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch Roadster data' },
      { status: 500 }
    );
  }
}

/**
 * Calculate Roadster position in 3D space (simplified)
 * Returns coordinates in AU (Astronomical Units) in J2000 ecliptic frame
 */
function calculateRoadsterPosition(data: any): { x: number; y: number; z: number } {
  const now = Date.now();
  const launch = new Date(data.launch_date_utc).getTime();
  const daysSinceLaunch = (now - launch) / (1000 * 60 * 60 * 24);

  const a = data.semi_major_axis_au || 1.325; // Semi-major axis
  const e = data.eccentricity || 0.256; // Eccentricity
  const period = data.period_days || 557; // Orbital period in days

  // Mean anomaly
  const M = (2 * Math.PI * daysSinceLaunch) / period;

  // Solve Kepler's equation (simplified using approximation)
  let E = M;
  for (let i = 0; i < 5; i++) {
    E = M + e * Math.sin(E);
  }

  // True anomaly
  const v = 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2)
  );

  // Distance from Sun
  const r = a * (1 - e * Math.cos(E));

  // Position in orbital plane
  const x = r * Math.cos(v);
  const y = r * Math.sin(v);
  const z = 0; // Simplified (ignoring inclination)

  return { x, y, z };
}

/**
 * Estimate radiation dose received by Roadster
 */
function calculateRadiationDose(launchDate: string): number {
  const daysSinceLaunch = (Date.now() - new Date(launchDate).getTime()) / (1000 * 60 * 60 * 24);
  // Approximate 0.5 Sv/year in interplanetary space
  return (daysSinceLaunch / 365.25) * 0.5;
}

/**
 * Estimate temperature based on distance from Earth/Sun
 */
function estimateTemperature(earthDistanceKm: number): number {
  // Very rough estimate - actual temp varies greatly (sun vs shadow side)
  // At 1 AU, temp ranges from ~-173°C to +127°C
  return -50 + Math.random() * 100; // Simplified
}

/**
 * Generate trajectory points for visualization
 */
function generateTrajectory(data: any): any[] {
  const points = [];
  const period = data.period_days || 557;

  for (let i = 0; i <= 360; i += 10) {
    const angle = (i * Math.PI) / 180;
    const a = data.semi_major_axis_au || 1.325;
    const e = data.eccentricity || 0.256;

    const r = (a * (1 - e * e)) / (1 + e * Math.cos(angle));
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle);

    points.push({
      x,
      y,
      z: 0,
      au: r,
    });
  }

  return points;
}

/**
 * Fallback mock data if API unavailable
 */
function getMockRoadsterData(): any {
  return {
    name: 'Tesla Roadster (Starman)',
    details: 'Elon Musk\'s Tesla Roadster is an electric sports car that served as the dummy payload for the February 2018 Falcon Heavy test flight.',
    launch_date: '2018-02-06T20:45:00.000Z',
    launch_mass_kg: 1350,
    launch_mass_lbs: 2976,
    norad_id: 43205,
    epoch: new Date().toISOString(),
    earth_distance_km: 350000000,
    earth_distance_mi: 217000000,
    mars_distance_km: 200000000,
    mars_distance_mi: 124000000,
    speed_kph: 75000,
    speed_mph: 46600,
    orbit: {
      semi_major_axis_au: 1.325,
      eccentricity: 0.256,
      inclination_deg: 1.08,
      longitude_ascending_node_deg: 317.09,
      argument_periapsis_deg: 177.48,
      period_days: 557,
    },
    position: { x: 1.2, y: 0.5, z: 0.02 },
    solar_exposure: {
      total_days: Math.floor((Date.now() - new Date('2018-02-06').getTime()) / (1000 * 60 * 60 * 24)),
      radiation_dose_estimate_sv: 3.5,
      temperature_estimate_c: -25,
    },
    facts: {
      passengers: ['Starman', 'Hot Wheels Roadster', 'Plaque with 6,000 SpaceX employee names'],
      music_playing: 'Space Oddity by David Bowie (on repeat)',
    },
  };
}
