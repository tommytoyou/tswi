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

// Agency colors for spacecraft (muted, professional colors)
const AGENCY_COLORS: Record<string, string> = {
  'NASA': '#4A90D9',
  'ESA': '#B8A038',
  'NASA/ESA': '#7B68A8',
  'JAXA': '#C44E4E',
};

// NASA/Solar System Scope texture URLs for realistic planet rendering
const TEXTURE_BASE = 'https://www.solarsystemscope.com/textures/download';
const PLANET_TEXTURES: Record<string, { texture: string; radius: number; tilt?: number }> = {
  sun: { texture: `${TEXTURE_BASE}/2k_sun.jpg`, radius: 0.05 },
  mercury: { texture: `${TEXTURE_BASE}/2k_mercury.jpg`, radius: 0.003, tilt: 0.03 },
  venus: { texture: `${TEXTURE_BASE}/2k_venus_surface.jpg`, radius: 0.006, tilt: 177.4 },
  earth: { texture: `${TEXTURE_BASE}/2k_earth_daymap.jpg`, radius: 0.0065, tilt: 23.4 },
  mars: { texture: `${TEXTURE_BASE}/2k_mars.jpg`, radius: 0.004, tilt: 25.2 },
  jupiter: { texture: `${TEXTURE_BASE}/2k_jupiter.jpg`, radius: 0.035, tilt: 3.1 },
  saturn: { texture: `${TEXTURE_BASE}/2k_saturn.jpg`, radius: 0.030, tilt: 26.7 },
  uranus: { texture: `${TEXTURE_BASE}/2k_uranus.jpg`, radius: 0.015, tilt: 97.8 },
  neptune: { texture: `${TEXTURE_BASE}/2k_neptune.jpg`, radius: 0.014, tilt: 28.3 },
  pluto: { texture: `${TEXTURE_BASE}/2k_moon.jpg`, radius: 0.002, tilt: 122.5 }, // Using moon texture for Pluto as fallback
};

// Saturn ring texture
const SATURN_RING_TEXTURE = `${TEXTURE_BASE}/2k_saturn_ring_alpha.png`;

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

        // Create star background (clean, minimal stars)
        viz.createStars();

        // Create lighting from the Sun
        viz.createLight([0, 0, 0], 0xFFFFFF);
        viz.createAmbientLight(0x222222); // Subtle ambient light

        // Add the Sun as a textured sphere (no glow effect)
        const sunConfig = PLANET_TEXTURES.sun;
        viz.createSphere('sun', {
          textureUrl: sunConfig.texture,
          radius: sunConfig.radius,
          position: [0, 0, 0],
          labelText: 'Sun',
          theme: {
            color: 0xFFDD44,
          },
        });

        // Add all planets as textured spheres with proper ephemeris
        const planetNames = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as const;

        planetNames.forEach((planetName) => {
          const upperName = planetName.toUpperCase() as keyof typeof Spacekit.EphemPresets;
          const ephem = Spacekit.EphemPresets[upperName];
          const textureConfig = PLANET_TEXTURES[planetName];

          if (ephem && textureConfig) {
            const sphere = viz.createSphere(planetName, {
              textureUrl: textureConfig.texture,
              radius: textureConfig.radius,
              ephem: ephem,
              labelText: planetName.charAt(0).toUpperCase() + planetName.slice(1),
              axialTilt: textureConfig.tilt,
              theme: {
                color: 0xFFFFFF,
                orbitColor: 0x444455,
              },
            });

            // Add Saturn's rings
            if (planetName === 'saturn' && sphere.addRings) {
              sphere.addRings(
                74500, // Inner radius in km
                140220, // Outer radius in km
                SATURN_RING_TEXTURE,
                64
              );
            }
          }
        });

        // Add Pluto as textured sphere
        const plutoConfig = PLANET_TEXTURES.pluto;
        viz.createSphere('pluto', {
          textureUrl: plutoConfig.texture,
          radius: plutoConfig.radius,
          ephem: Spacekit.EphemPresets.PLUTO,
          labelText: 'Pluto',
          axialTilt: plutoConfig.tilt,
          theme: {
            color: 0xFFFFFF,
            orbitColor: 0x444455,
          },
        });

        // Add deep space probes as small, clean markers (no glow)
        // Using a very small particle size for professional appearance
        DEEP_SPACE_PROBES.forEach((probe) => {
          const [x, y, z] = sphericalToCartesian(probe.distanceAU, probe.eclipticLat, probe.eclipticLon);

          const probeObj = viz.createObject(probe.id, {
            position: [x, y, z],
            labelText: probe.name,
            hideOrbit: true,
            particleSize: 4, // Small, clean dots
            theme: {
              color: 0xCCCCCC, // Neutral gray for professional look
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

    // Update existing spacecraft objects with new positions from API
    // Using small particle size for clean, professional appearance
    spacecraft.forEach((sc) => {
      if (!sc.position) return;

      // Check if we already have this object
      let scObj = spacecraftObjectsRef.current.get(sc.id);

      if (scObj) {
        // Update position if object exists
        scObj.setPosition(sc.position.x, sc.position.y, sc.position.z);
      } else {
        // Create new object as small dot (no glow effect)
        scObj = viz.createObject(sc.id, {
          position: [sc.position.x, sc.position.y, sc.position.z],
          labelText: showLabels ? sc.name : undefined,
          hideOrbit: true,
          particleSize: 4, // Small, clean dots
          theme: {
            color: 0xCCCCCC, // Neutral gray - professional look
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

  // Error display - minimal
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#000008]">
        <div className="max-w-sm p-4 bg-black/50 border border-red-900/50 rounded">
          <h3 className="text-red-400/80 text-sm font-medium mb-1">Error</h3>
          <p className="text-slate-400 text-xs">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-[#000008]">
      {/* Loading overlay - clean, minimal */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#000008]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-600 border-t-slate-300 mx-auto mb-4" />
            <p className="text-slate-300 text-lg font-light">Initializing Solar System</p>
            <p className="text-slate-500 text-xs mt-2">Loading 3D visualization</p>
          </div>
        </div>
      )}

      {/* Spacekit container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Title and status - clean, minimal panel */}
      {spacekitReady && (
        <div className="absolute top-4 left-4 z-20 bg-black/70 backdrop-blur-sm rounded border border-slate-700/50 p-3 max-w-xs">
          <h2 className="text-sm font-medium text-slate-200 mb-2 tracking-wide">SOLAR SYSTEM</h2>

          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Bodies</span>
              <span className="text-slate-300">10</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Spacecraft</span>
              <span className="text-slate-300">
                {dataLoading ? '...' : spacecraft.filter(s => s.position).length + DEEP_SPACE_PROBES.length}
              </span>
            </div>
            {stats?.furthestFromSun && (
              <div className="flex justify-between text-slate-400">
                <span>Furthest</span>
                <span className="text-slate-300 truncate ml-2">
                  {stats.furthestFromSun.distance.toFixed(1)} AU
                </span>
              </div>
            )}
          </div>

          <div className="mt-2 pt-2 border-t border-slate-700/50 text-[10px] text-slate-500">
            NASA JPL Horizons
          </div>
        </div>
      )}

      {/* View mode selector - minimal buttons */}
      {spacekitReady && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-black/70 backdrop-blur-sm rounded border border-slate-700/50 p-1.5">
          <div className="flex gap-1">
            {(['inner', 'outer', 'full'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  viewMode === mode
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {mode === 'inner' ? 'Inner' : mode === 'outer' ? 'Outer' : 'Full'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Display options - compact, minimal */}
      {spacekitReady && (
        <div className="absolute top-4 right-4 z-20 bg-black/70 backdrop-blur-sm rounded border border-slate-700/50 p-2.5 space-y-1.5">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-slate-300">
            <input
              type="checkbox"
              checked={showOrbits}
              onChange={(e) => setShowOrbits(e.target.checked)}
              className="w-3 h-3 rounded-sm border-slate-600 bg-slate-800 accent-slate-500"
            />
            Orbits
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-slate-300">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
              className="w-3 h-3 rounded-sm border-slate-600 bg-slate-800 accent-slate-500"
            />
            Labels
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-slate-300">
            <input
              type="checkbox"
              checked={showTrails}
              onChange={(e) => setShowTrails(e.target.checked)}
              className="w-3 h-3 rounded-sm border-slate-600 bg-slate-800 accent-slate-500"
            />
            Trails
          </label>
        </div>
      )}

      {/* Camera controls - minimal icons */}
      {spacekitReady && (
        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1">
          <button
            onClick={zoomIn}
            className="p-1.5 bg-black/60 rounded border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-black/80 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={zoomOut}
            className="p-1.5 bg-black/60 rounded border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-black/80 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 bg-black/60 rounded border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-black/80 transition-colors"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      )}


      {/* Selected object info - clean panel */}
      {selectedObject && (
        <div className="absolute bottom-16 left-4 z-20 bg-black/80 backdrop-blur-sm rounded border border-slate-700/50 p-3 max-w-xs">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-200">{selectedObject.name}</h3>
            <button
              onClick={() => setSelectedObject(null)}
              className="text-slate-500 hover:text-slate-300 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {'agency' in selectedObject && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-slate-400 font-mono">
                {selectedObject.agency}
              </span>
              <span className={`text-[10px] font-mono ${
                selectedObject.missionStatus === 'active' ? 'text-green-500' : 'text-slate-500'
              }`}>
                {selectedObject.missionStatus}
              </span>
            </div>
          )}

          {'description' in selectedObject && selectedObject.description && (
            <p className="text-slate-400 text-xs mb-2">{selectedObject.description}</p>
          )}

          {selectedObject.position && (
            <div className="text-xs font-mono text-slate-400">
              {selectedObject.position.distanceFromSun.toFixed(3)} AU from Sun
            </div>
          )}

          <button
            onClick={() => flyToObject(selectedObject)}
            className="mt-2 w-full px-2 py-1 bg-slate-700/50 text-slate-300 text-xs rounded hover:bg-slate-600/50 transition-colors flex items-center justify-center gap-1.5"
          >
            <Target className="w-3 h-3" />
            Focus
          </button>
        </div>
      )}

      {/* Instructions - minimal hint */}
      {spacekitReady && !selectedObject && (
        <div className="absolute bottom-4 left-4 z-20 text-[10px] text-slate-600 font-mono">
          Scroll to zoom · Drag to rotate
        </div>
      )}
    </div>
  );
}

// Export with SSR disabled
export default dynamic(() => Promise.resolve(SpacekitHeliocentricComponent), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#000008]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-700 border-t-slate-400 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  ),
});
