'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Target,
  Maximize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  X,
} from 'lucide-react';
import type { SpacecraftData, PlanetData, ViewMode } from './types';

// Agency colors for spacecraft
const AGENCY_COLORS: Record<string, string> = {
  'NASA': '#3B82F6',
  'ESA': '#F4D03F',
  'NASA/ESA': '#8B5CF6',
  'JAXA': '#EF4444',
};

// Deep space probe definitions with orbital elements (approximate current positions)
const DEEP_SPACE_PROBES = [
  {
    id: 'voyager1',
    name: 'Voyager 1',
    horizonsId: '-31',
    agency: 'NASA',
    color: '#3B82F6',
    description: 'Farthest human-made object, launched 1977',
    // Approximate distance ~160 AU from Sun, moving away
    distanceAU: 162,
    eclipticLat: 35, // degrees above ecliptic
    eclipticLon: 260, // degrees
  },
  {
    id: 'voyager2',
    name: 'Voyager 2',
    horizonsId: '-32',
    agency: 'NASA',
    color: '#60A5FA',
    description: 'Exploring interstellar space since 2018',
    distanceAU: 135,
    eclipticLat: -48,
    eclipticLon: 290,
  },
  {
    id: 'newhorizons',
    name: 'New Horizons',
    horizonsId: '-98',
    agency: 'NASA',
    color: '#8B5CF6',
    description: 'Pluto flyby mission, now in Kuiper Belt',
    distanceAU: 58,
    eclipticLat: 2,
    eclipticLon: 290,
  },
  {
    id: 'parkersolar',
    name: 'Parker Solar Probe',
    horizonsId: '-96',
    agency: 'NASA',
    color: '#F97316',
    description: 'Closest approach to the Sun ever',
    distanceAU: 0.1, // varies greatly, closest ~0.04 AU
    eclipticLat: 3,
    eclipticLon: 120,
  },
  {
    id: 'stereoa',
    name: 'STEREO-A',
    horizonsId: '-234',
    agency: 'NASA',
    color: '#22C55E',
    description: 'Solar observatory in heliocentric orbit',
    distanceAU: 0.96,
    eclipticLat: 0,
    eclipticLon: 45, // ahead of Earth
  },
  {
    id: 'jwst',
    name: 'James Webb',
    horizonsId: '-170',
    agency: 'NASA/ESA',
    color: '#EC4899',
    description: 'Infrared space observatory at L2',
    distanceAU: 1.01, // At Earth-Sun L2 point
    eclipticLat: 0,
    eclipticLon: 180, // Behind Earth relative to Sun
  },
];

// Static planet data for display
const STATIC_PLANETS: PlanetData[] = [
  { id: 'mercury', name: 'Mercury', horizonsId: '199', color: '#8C8C8C', size: 0.4, orbitRadius: 0.387, position: { x: 0.35, y: 0.15, z: 0.02, distanceFromSun: 0.387 } },
  { id: 'venus', name: 'Venus', horizonsId: '299', color: '#E6A64E', size: 0.9, orbitRadius: 0.723, position: { x: -0.5, y: 0.52, z: 0.01, distanceFromSun: 0.723 } },
  { id: 'earth', name: 'Earth', horizonsId: '399', color: '#3B82F6', size: 1.0, orbitRadius: 1.0, position: { x: 0.85, y: -0.52, z: 0.0, distanceFromSun: 1.0 } },
  { id: 'mars', name: 'Mars', horizonsId: '499', color: '#EF4444', size: 0.5, orbitRadius: 1.524, position: { x: -1.2, y: -0.9, z: 0.03, distanceFromSun: 1.524 } },
  { id: 'jupiter', name: 'Jupiter', horizonsId: '599', color: '#D4A574', size: 2.5, orbitRadius: 5.203, position: { x: 4.5, y: 2.5, z: -0.1, distanceFromSun: 5.203 } },
  { id: 'saturn', name: 'Saturn', horizonsId: '699', color: '#F4D03F', size: 2.2, orbitRadius: 9.537, position: { x: -8.0, y: 5.0, z: 0.2, distanceFromSun: 9.537 } },
  { id: 'uranus', name: 'Uranus', horizonsId: '799', color: '#06B6D4', size: 1.5, orbitRadius: 19.191, position: { x: 15.0, y: -12.0, z: -0.3, distanceFromSun: 19.191 } },
  { id: 'neptune', name: 'Neptune', horizonsId: '899', color: '#1E40AF', size: 1.4, orbitRadius: 30.069, position: { x: 28.0, y: 10.0, z: -0.5, distanceFromSun: 30.069 } },
];

interface ApiResponse {
  success: boolean;
  spacecraft: SpacecraftData[];
  planets: PlanetData[];
  viewMode: string;
  stats: {
    totalSpacecraft: number;
    successfulFetches: number;
    furthestFromSun: { name: string; distance: number } | null;
    closestToSun: { name: string; distance: number } | null;
  };
}

// Helper to convert spherical coordinates to Cartesian (AU)
function sphericalToCartesian(distanceAU: number, latDeg: number, lonDeg: number): [number, number, number] {
  const latRad = (latDeg * Math.PI) / 180;
  const lonRad = (lonDeg * Math.PI) / 180;
  const x = distanceAU * Math.cos(latRad) * Math.cos(lonRad);
  const y = distanceAU * Math.cos(latRad) * Math.sin(lonRad);
  const z = distanceAU * Math.sin(latRad);
  return [x, y, z];
}

function SpacekitHeliocentricComponent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<any>(null);
  const spacekitRef = useRef<any>(null);
  const spacecraftObjectsRef = useRef<Map<string, any>>(new Map());

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [spacekitReady, setSpacekitReady] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Data state
  const [spacecraft, setSpacecraft] = useState<SpacecraftData[]>([]);
  const [stats, setStats] = useState<ApiResponse['stats'] | null>(null);

  // View controls
  const [viewMode, setViewMode] = useState<ViewMode>('full');
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [selectedObject, setSelectedObject] = useState<PlanetData | SpacecraftData | null>(null);

  // Initialize Spacekit
  useEffect(() => {
    if (!containerRef.current || simulationRef.current) return;

    let mounted = true;

    const initSpacekit = async () => {
      try {
        // Dynamic import of spacekit.js
        const Spacekit = await import('spacekit.js');

        if (!mounted || !containerRef.current) return;

        spacekitRef.current = Spacekit;

        // Create simulation
        // Note: Spacekit accepts an HTMLElement container despite its type definition saying HTMLCanvasElement
        const viz = new Spacekit.Simulation(containerRef.current as unknown as HTMLCanvasElement, {
          basePath: 'https://typpo.github.io/spacekit/src',
          startDate: new Date(),
          jdPerSecond: 0.1, // Slow time progression
          unitsPerAu: 100.0, // Scale factor
          startPaused: false,
          camera: {
            initialPosition: [0, -150, 80], // View from above and behind
            enableDrift: false,
          },
          debug: {
            showAxes: false,
            showGrid: false,
            showStats: false,
          },
        });

        simulationRef.current = viz;

        // Create star background
        viz.createStars();

        // Create lighting
        viz.createAmbientLight(0x333333);
        viz.createLight([0, 0, 0], 0xFFFFFF); // Light from the Sun

        // Add the Sun
        viz.createObject('sun', {
          ...Spacekit.SpaceObjectPresets.SUN,
          labelText: 'Sun',
        });

        // Add all planets with their built-in ephemeris
        const planetNames = ['MERCURY', 'VENUS', 'EARTH', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE'] as const;

        planetNames.forEach((planetName) => {
          const preset = Spacekit.SpaceObjectPresets[planetName];
          if (preset) {
            viz.createObject(planetName.toLowerCase(), {
              ...preset,
              labelText: planetName.charAt(0) + planetName.slice(1).toLowerCase(),
            });
          }
        });

        // Add Pluto
        viz.createObject('pluto', {
          ...Spacekit.SpaceObjectPresets.PLUTO,
          labelText: 'Pluto',
        });

        // Add deep space probes as static objects at their approximate positions
        // Use smallparticle.png texture for point representation
        const spacecraftTextureUrl = 'https://typpo.github.io/spacekit/src/assets/sprites/smallparticle.png';

        DEEP_SPACE_PROBES.forEach((probe) => {
          const [x, y, z] = sphericalToCartesian(probe.distanceAU, probe.eclipticLat, probe.eclipticLon);

          const probeObj = viz.createObject(probe.id, {
            position: [x, y, z],
            textureUrl: spacecraftTextureUrl,
            labelText: probe.name,
            hideOrbit: true,
            theme: {
              color: parseInt(probe.color.replace('#', ''), 16),
            },
          });

          spacecraftObjectsRef.current.set(probe.id, probeObj);
        });

        setIsLoading(false);
        setSpacekitReady(true);

        console.log('Spacekit heliocentric viewer initialized');
      } catch (err: any) {
        console.error('Spacekit initialization error:', err);
        setError(err.message || 'Failed to initialize Spacekit');
        setIsLoading(false);
      }
    };

    initSpacekit();

    return () => {
      mounted = false;
      if (simulationRef.current) {
        try {
          simulationRef.current.stop();
        } catch (err) {
          console.error('Error stopping Spacekit simulation:', err);
        }
      }
    };
  }, []);

  // Fetch data from API
  const fetchData = useCallback(async () => {
    setDataLoading(true);
    console.log(`Fetching spacecraft data for view mode: ${viewMode}`);
    try {
      const response = await fetch(`/api/spacecraft?view=${viewMode}`);
      console.log(`API response status: ${response.status}`);

      if (!response.ok) {
        console.error(`API returned error status: ${response.status}`);
        return;
      }

      const data: ApiResponse = await response.json();
      console.log('API response:', {
        success: data.success,
        spacecraftCount: data.spacecraft?.length,
        planetsCount: data.planets?.length,
        stats: data.stats
      });

      if (data.success) {
        const validSpacecraft = data.spacecraft.filter(s => s.position !== null);
        console.log(`Valid spacecraft with positions: ${validSpacecraft.length}/${data.spacecraft.length}`);
        setSpacecraft(validSpacecraft);
        setStats(data.stats);
      } else {
        console.error('API returned success: false');
      }
    } catch (err) {
      console.error('Error fetching spacecraft data:', err);
    } finally {
      setDataLoading(false);
    }
  }, [viewMode]);

  // Fetch data on mount and when view mode changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update spacecraft positions from API data
  useEffect(() => {
    const viz = simulationRef.current;
    const Spacekit = spacekitRef.current;
    if (!viz || !Spacekit || !spacekitReady) return;

    // Use smallparticle.png texture for point representation
    const spacecraftTextureUrl = 'https://typpo.github.io/spacekit/src/assets/sprites/smallparticle.png';

    // Update existing spacecraft objects with new positions from API
    spacecraft.forEach((sc) => {
      if (!sc.position) return;

      // Check if we already have this object
      let scObj = spacecraftObjectsRef.current.get(sc.id);

      if (scObj) {
        // Update position if object exists
        scObj.setPosition(sc.position.x, sc.position.y, sc.position.z);
      } else {
        // Create new object with texture for point representation
        const agencyColor = AGENCY_COLORS[sc.agency] || '#ffffff';
        scObj = viz.createObject(sc.id, {
          position: [sc.position.x, sc.position.y, sc.position.z],
          textureUrl: spacecraftTextureUrl,
          labelText: showLabels ? sc.name : undefined,
          hideOrbit: true,
          theme: {
            color: parseInt(agencyColor.replace('#', ''), 16),
          },
        });
        spacecraftObjectsRef.current.set(sc.id, scObj);
      }
    });

    console.log(`Updated ${spacecraft.length} spacecraft from API`);
  }, [spacekitReady, spacecraft, showLabels]);

  // Handle view mode changes - adjust camera position
  useEffect(() => {
    const viz = simulationRef.current;
    if (!viz || !spacekitReady) return;

    const viewer = viz.getViewer();
    if (!viewer) return;

    let cameraPosition: [number, number, number];

    switch (viewMode) {
      case 'inner':
        // View inner solar system (Mercury to Mars)
        cameraPosition = [0, -30, 15];
        break;
      case 'outer':
        // View outer solar system (Jupiter to Neptune)
        cameraPosition = [0, -400, 200];
        break;
      case 'full':
      default:
        // View entire solar system
        cameraPosition = [0, -150, 80];
        break;
    }

    // TODO: Implement camera animation to new position
    // viewer.camera.position.set(...cameraPosition);
  }, [viewMode, spacekitReady]);

  // Camera controls
  const resetView = useCallback(() => {
    const viz = simulationRef.current;
    if (!viz) return;

    const viewer = viz.getViewer();
    if (viewer) {
      // Reset to default view
      // viewer.camera.position.set(0, -150, 80);
    }
  }, []);

  const zoomIn = useCallback(() => {
    const viz = simulationRef.current;
    if (!viz) return;

    const viewer = viz.getViewer();
    if (viewer) {
      // Zoom in by moving camera closer
      // const pos = viewer.camera.position;
      // viewer.camera.position.set(pos.x * 0.8, pos.y * 0.8, pos.z * 0.8);
    }
  }, []);

  const zoomOut = useCallback(() => {
    const viz = simulationRef.current;
    if (!viz) return;

    const viewer = viz.getViewer();
    if (viewer) {
      // Zoom out by moving camera away
      // const pos = viewer.camera.position;
      // viewer.camera.position.set(pos.x * 1.2, pos.y * 1.2, pos.z * 1.2);
    }
  }, []);

  const flyToObject = useCallback((obj: PlanetData | SpacecraftData) => {
    const viz = simulationRef.current;
    if (!viz || !obj.position) return;

    // Focus on the selected object
    const offset = obj.position.distanceFromSun * 0.5 + 5;
    // viewer.camera.position.set(obj.position.x + offset, obj.position.y - offset, obj.position.z + offset);
  }, []);

  // Error display
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#050520]">
        <div className="max-w-md p-6 bg-red-900/20 border border-red-500 rounded-lg">
          <h3 className="text-red-400 font-bold mb-2">Heliocentric Viewer Error</h3>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-[#050520]">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#050520]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500 mx-auto mb-4" />
            <p className="text-white text-xl">Initializing Heliocentric View...</p>
            <p className="text-slate-400 text-sm mt-2">Loading Spacekit 3D engine</p>
          </div>
        </div>
      )}

      {/* Spacekit container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Title and status */}
      {spacekitReady && (
        <div className="absolute top-4 left-4 z-20 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-4 max-w-xs">
          <h2 className="text-lg font-bold text-white mb-1">Heliocentric View</h2>
          <p className="text-xs text-slate-400 mb-3">
            {dataLoading ? 'Fetching real-time positions...' : 'Real-time spacecraft positions'}
          </p>

          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Planets:</span>
              <span className="text-white">{STATIC_PLANETS.length + 1} (Sun + 8 planets + Pluto)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Spacecraft:</span>
              <span className="text-white">
                {dataLoading ? (
                  <span className="text-yellow-400 animate-pulse">Loading...</span>
                ) : (
                  `${spacecraft.filter(s => s.position).length + DEEP_SPACE_PROBES.length} tracked`
                )}
              </span>
            </div>
            {stats?.furthestFromSun && (
              <div className="flex justify-between">
                <span className="text-slate-400">Furthest:</span>
                <span className="text-white truncate ml-2">
                  {stats.furthestFromSun.name} ({stats.furthestFromSun.distance.toFixed(1)} AU)
                </span>
              </div>
            )}
            {stats?.closestToSun && (
              <div className="flex justify-between">
                <span className="text-slate-400">Closest:</span>
                <span className="text-white truncate ml-2">
                  {stats.closestToSun.name} ({stats.closestToSun.distance.toFixed(3)} AU)
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-700">
            <div className="text-xs text-slate-500">Powered by Spacekit.js</div>
            <div className="text-xs text-slate-500">Data: NASA JPL Horizons</div>
          </div>
        </div>
      )}

      {/* View mode selector */}
      {spacekitReady && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-2">
          <div className="flex gap-1">
            {(['inner', 'outer', 'full'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 text-sm rounded transition-colors ${
                  viewMode === mode
                    ? 'bg-yellow-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {mode === 'inner' ? 'Inner System' : mode === 'outer' ? 'Outer System' : 'Full System'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Display options */}
      {spacekitReady && (
        <div className="absolute top-4 right-4 z-20 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-3 space-y-2">
          <div className="text-xs text-slate-400 mb-2">Display Options</div>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showOrbits}
              onChange={(e) => setShowOrbits(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800"
            />
            Orbit Lines
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800"
            />
            Labels
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showTrails}
              onChange={(e) => setShowTrails(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800"
            />
            Trajectory Lines
          </label>
        </div>
      )}

      {/* Camera controls */}
      {spacekitReady && (
        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
          <button
            onClick={zoomIn}
            className="p-2 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 text-white hover:bg-slate-800 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={zoomOut}
            className="p-2 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 text-white hover:bg-slate-800 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={resetView}
            className="p-2 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 text-white hover:bg-slate-800 transition-colors"
            title="Reset View"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Legend */}
      {spacekitReady && (
        <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-3">
          <div className="text-xs text-slate-400 mb-2">Spacecraft Agencies</div>
          <div className="space-y-1">
            {Object.entries(AGENCY_COLORS).map(([agency, color]) => (
              <div key={agency} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full border-2"
                  style={{ borderColor: color, backgroundColor: 'white' }}
                />
                <span className="text-xs text-slate-300">{agency}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected object info */}
      {selectedObject && (
        <div className="absolute bottom-20 left-4 z-20 bg-slate-900/95 backdrop-blur-sm rounded-lg border border-slate-700 p-4 max-w-sm">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-bold text-white">{selectedObject.name}</h3>
            <button
              onClick={() => setSelectedObject(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {'agency' in selectedObject && (
            <div className="flex items-center gap-2 mb-2">
              <span
                className="px-2 py-0.5 rounded text-xs font-medium text-white"
                style={{ backgroundColor: AGENCY_COLORS[selectedObject.agency] }}
              >
                {selectedObject.agency}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                selectedObject.missionStatus === 'active'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {selectedObject.missionStatus}
              </span>
            </div>
          )}

          {'description' in selectedObject && selectedObject.description && (
            <p className="text-slate-300 text-sm mb-3">{selectedObject.description}</p>
          )}

          {selectedObject.position && (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Distance from Sun:</span>
                <span className="text-white font-mono">
                  {selectedObject.position.distanceFromSun.toFixed(3)} AU
                </span>
              </div>
            </div>
          )}

          <button
            onClick={() => flyToObject(selectedObject)}
            className="mt-3 w-full px-3 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors flex items-center justify-center gap-2"
          >
            <Target className="w-4 h-4" />
            Fly to {selectedObject.name}
          </button>
        </div>
      )}

      {/* Instructions */}
      {spacekitReady && !selectedObject && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Target className="w-3 h-3" />
              <span>Click objects for details</span>
            </div>
            <div className="flex items-center gap-2">
              <Maximize2 className="w-3 h-3" />
              <span>Scroll to zoom, drag to rotate</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export with SSR disabled
export default dynamic(() => Promise.resolve(SpacekitHeliocentricComponent), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#050520]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500 mx-auto mb-4" />
        <p className="text-white text-xl">Loading Heliocentric View...</p>
      </div>
    </div>
  ),
});
