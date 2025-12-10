'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { config } from '@/lib/config';
import dynamic from 'next/dynamic';
import {
  Target,
  Maximize2,
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Eye,
  EyeOff,
  Clock,
  Info,
  X,
} from 'lucide-react';
import type { SpacecraftData, PlanetData, ViewMode } from './types';

// Constants for astronomical units to meters conversion
const AU_TO_METERS = 149597870700; // 1 AU in meters
const SCALE_FACTOR = 1e-9; // Scale down for Cesium visualization

// Planet visual sizes in AU - exaggerated for visibility (0.02-0.15 AU visual diameter)
// These are NOT realistic - they're sized for easy clicking and identification
const PLANET_VISUAL_RADII_AU: Record<string, number> = {
  mercury: 0.02,   // Small rocky planet
  venus: 0.03,    // Similar to Earth
  earth: 0.03,    // Our reference
  mars: 0.025,    // Slightly smaller than Earth
  jupiter: 0.08,  // Gas giant - largest
  saturn: 0.07,   // Gas giant with rings
  uranus: 0.05,   // Ice giant
  neptune: 0.05,  // Ice giant
};

// Planet colors for realistic appearance
const PLANET_COLORS: Record<string, string> = {
  mercury: '#8C8C8C',
  venus: '#E6C87A',
  earth: '#3B82F6',
  mars: '#E67E51',
  jupiter: '#D4A574',
  saturn: '#F4D03F',
  uranus: '#06B6D4',
  neptune: '#4169E1',
};

// Static planet data with approximate orbital positions (hardcoded fallback)
// These are approximate positions - actual positions fetched from API will override
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

// Agency colors for spacecraft
const AGENCY_COLORS: Record<string, string> = {
  'NASA': '#3B82F6',
  'ESA': '#F4D03F',
  'NASA/ESA': '#8B5CF6',
  'JAXA': '#EF4444',
};

// Deep space probe definitions
const DEEP_SPACE_PROBES = [
  { id: 'voyager1', name: 'Voyager 1', horizonsId: '-31', agency: 'NASA', color: '#3B82F6', description: 'Farthest human-made object, launched 1977' },
  { id: 'voyager2', name: 'Voyager 2', horizonsId: '-32', agency: 'NASA', color: '#60A5FA', description: 'Exploring interstellar space since 2018' },
  { id: 'newhorizons', name: 'New Horizons', horizonsId: '-98', agency: 'NASA', color: '#8B5CF6', description: 'Pluto flyby mission, now in Kuiper Belt' },
  { id: 'parkersolar', name: 'Parker Solar Probe', horizonsId: '-96', agency: 'NASA', color: '#F97316', description: 'Closest approach to the Sun ever' },
  { id: 'stereoa', name: 'STEREO-A', horizonsId: '-234', agency: 'NASA', color: '#22C55E', description: 'Solar observatory in heliocentric orbit' },
  { id: 'jwst', name: 'James Webb', horizonsId: '-170', agency: 'NASA/ESA', color: '#EC4899', description: 'Infrared space observatory at L2' },
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

// Helper function to convert AU position to Cesium Cartesian3
function auToCartesian3(Cesium: any, x: number, y: number, z: number) {
  const scaledX = x * AU_TO_METERS * SCALE_FACTOR;
  const scaledY = y * AU_TO_METERS * SCALE_FACTOR;
  const scaledZ = z * AU_TO_METERS * SCALE_FACTOR;
  return new Cesium.Cartesian3(scaledX, scaledZ, -scaledY); // Swap Y and Z for top-down view
}

// Sun visual radius in AU (exaggerated for visibility - actual sun is ~0.00465 AU radius)
const SUN_VISUAL_RADIUS_AU = 0.08;

// Add static Sun and planets immediately on Cesium init (no API dependency)
function addStaticSolarSystem(viewer: any, Cesium: any) {
  console.log('Adding static solar system entities...');

  // Convert AU to scaled meters
  const sunRadiusScaled = SUN_VISUAL_RADIUS_AU * AU_TO_METERS * SCALE_FACTOR;

  viewer.entities.add({
    id: 'sun-static',
    name: 'Sun',
    position: Cesium.Cartesian3.ZERO,
    ellipsoid: {
      radii: new Cesium.Cartesian3(sunRadiusScaled, sunRadiusScaled, sunRadiusScaled),
      material: new Cesium.ColorMaterialProperty(
        Cesium.Color.fromCssColorString('#FFD700')
      ),
    },
    label: {
      text: 'Sun',
      font: 'bold 16px sans-serif',
      fillColor: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -40),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  // Add sun glow/corona
  const glowRadiusScaled = sunRadiusScaled * 1.4;
  viewer.entities.add({
    id: 'sun-glow-static',
    name: 'Sun Corona',
    position: Cesium.Cartesian3.ZERO,
    ellipsoid: {
      radii: new Cesium.Cartesian3(glowRadiusScaled, glowRadiusScaled, glowRadiusScaled),
      material: new Cesium.ColorMaterialProperty(
        Cesium.Color.fromCssColorString('#FFA500').withAlpha(0.3)
      ),
    },
  });

  // Add all 8 planets with their static positions
  STATIC_PLANETS.forEach((planet) => {
    if (!planet.position) return;

    const position = auToCartesian3(Cesium, planet.position.x, planet.position.y, planet.position.z);
    // Get planet radius in AU, convert to scaled meters
    const planetRadiusAU = PLANET_VISUAL_RADII_AU[planet.id] || 0.03;
    const visualSizeScaled = planetRadiusAU * AU_TO_METERS * SCALE_FACTOR;
    const color = PLANET_COLORS[planet.id] || planet.color;

    // Add orbit line
    const orbitRadiusMeters = planet.orbitRadius * AU_TO_METERS * SCALE_FACTOR;
    const orbitPositions: any[] = [];
    const segments = 360;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const ox = Math.cos(angle) * orbitRadiusMeters;
      const oz = Math.sin(angle) * orbitRadiusMeters;
      orbitPositions.push(new Cesium.Cartesian3(ox, 0, oz));
    }

    viewer.entities.add({
      id: `orbit-static-${planet.id}`,
      name: `${planet.name} Orbit`,
      polyline: {
        positions: orbitPositions,
        width: 1.5,
        material: new Cesium.ColorMaterialProperty(
          Cesium.Color.fromCssColorString(color).withAlpha(0.5)
        ),
      },
    });

    // Add planet sphere
    viewer.entities.add({
      id: `planet-static-${planet.id}`,
      name: planet.name,
      position: position,
      ellipsoid: {
        radii: new Cesium.Cartesian3(visualSizeScaled, visualSizeScaled, visualSizeScaled),
        material: new Cesium.ColorMaterialProperty(
          Cesium.Color.fromCssColorString(color)
        ),
      },
      label: {
        text: planet.name,
        font: 'bold 14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -35),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });

    // Add Saturn's rings
    if (planet.id === 'saturn') {
      const innerRingRadius = visualSizeScaled * 1.3;
      const outerRingRadius = visualSizeScaled * 2.2;

      viewer.entities.add({
        id: 'saturn-rings-static',
        name: 'Saturn Rings',
        position: position,
        ellipse: {
          semiMajorAxis: outerRingRadius,
          semiMinorAxis: outerRingRadius,
          material: new Cesium.ColorMaterialProperty(
            Cesium.Color.fromCssColorString('#E8D5A3').withAlpha(0.6)
          ),
          height: 0,
          rotation: Cesium.Math.toRadians(27),
        },
      });
    }
  });

  console.log(`Added Sun and ${STATIC_PLANETS.length} planets as static entities`);
}

function CesiumHeliocentricComponent() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const cesiumViewerRef = useRef<any>(null);
  const cesiumModuleRef = useRef<any>(null);
  const entitiesRef = useRef<Map<string, any>>(new Map());
  const trailEntitiesRef = useRef<any[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cesiumReady, setCesiumReady] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Data state
  const [spacecraft, setSpacecraft] = useState<SpacecraftData[]>([]);
  const [planets, setPlanets] = useState<PlanetData[]>([]);
  const [stats, setStats] = useState<ApiResponse['stats'] | null>(null);

  // View controls
  const [viewMode, setViewMode] = useState<ViewMode>('full');
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [selectedObject, setSelectedObject] = useState<PlanetData | SpacecraftData | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [timeMultiplier, setTimeMultiplier] = useState(1);

  // Initialize Cesium
  useEffect(() => {
    if (!viewerRef.current || cesiumViewerRef.current) return;

    if (!config.cesium.ionToken) {
      setError('Cesium Ion token not configured');
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const initCesium = async () => {
      try {
        const Cesium = await import('cesium');

        if (!mounted) return;

        Cesium.Ion.defaultAccessToken = config.cesium.ionToken;

        // Create viewer with space-like settings
        const viewer = new Cesium.Viewer(viewerRef.current!, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          vrButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          skyAtmosphere: false,
        });

        // Remove default imagery layers for space view
        viewer.imageryLayers.removeAll();

        // Hide the globe entirely for heliocentric view
        viewer.scene.globe.show = false;
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#050520');

        // Enable depth testing against translucent objects
        viewer.scene.globe.depthTestAgainstTerrain = false;

        // Configure for deep space viewing
        viewer.scene.screenSpaceCameraController.minimumZoomDistance = 1e7;
        viewer.scene.screenSpaceCameraController.maximumZoomDistance = 1e14;

        // Set initial camera to view inner solar system from above
        // Camera at ~3 AU height shows Mercury through Mars clearly
        const innerSystemViewHeight = 3 * AU_TO_METERS * SCALE_FACTOR;
        viewer.camera.setView({
          destination: new Cesium.Cartesian3(0, innerSystemViewHeight, 0),
          orientation: {
            heading: 0,
            pitch: -Cesium.Math.PI_OVER_TWO,
            roll: 0,
          },
        });

        // Configure clock
        viewer.clock.currentTime = Cesium.JulianDate.now();
        viewer.clock.shouldAnimate = false;
        viewer.clock.multiplier = 1;

        cesiumViewerRef.current = viewer;
        cesiumModuleRef.current = Cesium;

        // Immediately add Sun and planets using static data
        addStaticSolarSystem(viewer, Cesium);

        setIsLoading(false);
        setCesiumReady(true);

        console.log('Cesium heliocentric viewer initialized with static solar system');
      } catch (err: any) {
        console.error('Cesium initialization error:', err);
        setError(err.message || 'Failed to initialize Cesium');
        setIsLoading(false);
      }
    };

    initCesium();

    return () => {
      mounted = false;
      if (cesiumViewerRef.current && !cesiumViewerRef.current.isDestroyed()) {
        try {
          cesiumViewerRef.current.destroy();
        } catch (err) {
          console.error('Error destroying Cesium viewer:', err);
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
        // Filter to only spacecraft with valid positions
        const validSpacecraft = data.spacecraft.filter(s => s.position !== null);
        console.log(`Valid spacecraft with positions: ${validSpacecraft.length}/${data.spacecraft.length}`);

        setSpacecraft(validSpacecraft);
        setPlanets(data.planets);
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

  // Convert AU position to Cesium Cartesian3
  const auToCartesian = useCallback((x: number, y: number, z: number) => {
    const Cesium = cesiumModuleRef.current;
    if (!Cesium) return null;

    // Convert AU to meters then scale
    const scaledX = x * AU_TO_METERS * SCALE_FACTOR;
    const scaledY = y * AU_TO_METERS * SCALE_FACTOR;
    const scaledZ = z * AU_TO_METERS * SCALE_FACTOR;

    return new Cesium.Cartesian3(scaledX, scaledZ, -scaledY); // Swap Y and Z for top-down view
  }, []);

  // Create spacecraft entity with trail - no dependencies on showLabels/showTrails to avoid re-renders
  const createSpacecraft = useCallback((sc: SpacecraftData, labelsVisible: boolean, trailsVisible: boolean) => {
    const viewer = cesiumViewerRef.current;
    const Cesium = cesiumModuleRef.current;
    if (!viewer || !Cesium || !sc.position) return;

    const position = auToCartesian(sc.position.x, sc.position.y, sc.position.z);
    if (!position) return;

    const agencyColor = AGENCY_COLORS[sc.agency] || '#ffffff';

    // Create spacecraft point
    const scEntity = viewer.entities.add({
      id: sc.id,
      name: sc.name,
      position: position,
      point: {
        pixelSize: 10,
        color: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.fromCssColorString(agencyColor),
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: labelsVisible ? {
        text: sc.name,
        font: '11px sans-serif',
        fillColor: Cesium.Color.fromCssColorString(agencyColor),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -15),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      } : undefined,
      description: `
        <div style="padding: 10px;">
          <h3>${sc.name}</h3>
          <p><strong>Agency:</strong> ${sc.agency}</p>
          <p><strong>Status:</strong> ${sc.missionStatus}</p>
          <p><strong>Type:</strong> ${sc.type}</p>
          <p>${sc.description}</p>
          <hr/>
          <p>Distance from Sun: ${sc.position.distanceFromSun.toFixed(3)} AU</p>
        </div>
      `,
    });

    entitiesRef.current.set(sc.id, scEntity);

    // Create trail from Sun to spacecraft if trails enabled
    if (trailsVisible) {
      const trailEntity = viewer.entities.add({
        id: `trail-${sc.id}`,
        name: `${sc.name} Trail`,
        polyline: {
          positions: [Cesium.Cartesian3.ZERO, position],
          width: 1,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.2,
            color: Cesium.Color.fromCssColorString(agencyColor).withAlpha(0.5),
          }),
        },
      });
      trailEntitiesRef.current.push(trailEntity);
    }
  }, [auToCartesian]);

  // Track last render state to avoid unnecessary re-renders
  const lastRenderKeyRef = useRef<string>('');

  // Render spacecraft entities (planets and Sun are rendered statically on init)
  useEffect(() => {
    const viewer = cesiumViewerRef.current;
    const Cesium = cesiumModuleRef.current;
    if (!viewer || !Cesium || !cesiumReady) return;

    // Create a key representing current render state to avoid unnecessary re-renders
    const renderKey = `${spacecraft.map(s => s.id).sort().join(',')}-${showLabels}-${showTrails}`;
    if (renderKey === lastRenderKeyRef.current) {
      return; // No changes, skip re-render
    }
    lastRenderKeyRef.current = renderKey;

    // Only clear dynamically-added spacecraft entities and trails (not static planets/sun)
    entitiesRef.current.forEach((entity) => {
      try {
        viewer.entities.remove(entity);
      } catch (e) {}
    });
    entitiesRef.current.clear();

    trailEntitiesRef.current.forEach((entity) => {
      try {
        viewer.entities.remove(entity);
      } catch (e) {}
    });
    trailEntitiesRef.current = [];

    // Add spacecraft from API data - pass current showLabels/showTrails values
    spacecraft.forEach(sc => createSpacecraft(sc, showLabels, showTrails));

    console.log(`Rendered ${spacecraft.length} spacecraft from API`);

  }, [cesiumReady, spacecraft, createSpacecraft, showLabels, showTrails]);

  // Handle entity click
  useEffect(() => {
    const viewer = cesiumViewerRef.current;
    const Cesium = cesiumModuleRef.current;
    if (!viewer || !Cesium || !cesiumReady) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement: any) => {
      const pickedObject = viewer.scene.pick(movement.position);
      if (Cesium.defined(pickedObject) && pickedObject.id) {
        const entityId = pickedObject.id.id || pickedObject.id;

        // Check for static planet entities (format: planet-static-{id})
        const staticPlanetMatch = entityId.match?.(/^planet-static-(.+)$/);
        if (staticPlanetMatch) {
          const planetId = staticPlanetMatch[1];
          const staticPlanet = STATIC_PLANETS.find(p => p.id === planetId);
          if (staticPlanet) {
            setSelectedObject(staticPlanet);
            return;
          }
        }

        // Find in API-fetched planets or spacecraft
        const planet = planets.find(p => p.id === entityId);
        const sc = spacecraft.find(s => s.id === entityId);

        if (planet) {
          setSelectedObject(planet);
        } else if (sc) {
          setSelectedObject(sc);
        }
      } else {
        setSelectedObject(null);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
    };
  }, [cesiumReady, planets, spacecraft]);

  // Camera controls
  const flyToObject = useCallback((obj: PlanetData | SpacecraftData) => {
    const viewer = cesiumViewerRef.current;
    const Cesium = cesiumModuleRef.current;
    if (!viewer || !Cesium || !obj.position) return;

    const position = auToCartesian(obj.position.x, obj.position.y, obj.position.z);
    if (!position) return;

    const distance = obj.position.distanceFromSun * AU_TO_METERS * SCALE_FACTOR * 0.5;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.add(
        position,
        new Cesium.Cartesian3(0, distance, distance),
        new Cesium.Cartesian3()
      ),
      orientation: {
        heading: 0,
        pitch: -Cesium.Math.PI_OVER_FOUR,
        roll: 0,
      },
      duration: 2,
    });
  }, [auToCartesian]);

  const resetView = useCallback(() => {
    const viewer = cesiumViewerRef.current;
    const Cesium = cesiumModuleRef.current;
    if (!viewer || !Cesium) return;

    // Reset to inner solar system view (~3 AU height)
    const innerSystemViewHeight = 3 * AU_TO_METERS * SCALE_FACTOR;
    viewer.camera.flyTo({
      destination: new Cesium.Cartesian3(0, innerSystemViewHeight, 0),
      orientation: {
        heading: 0,
        pitch: -Cesium.Math.PI_OVER_TWO,
        roll: 0,
      },
      duration: 2,
    });
  }, []);

  const zoomIn = useCallback(() => {
    const viewer = cesiumViewerRef.current;
    if (!viewer) return;
    viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.3);
  }, []);

  const zoomOut = useCallback(() => {
    const viewer = cesiumViewerRef.current;
    if (!viewer) return;
    viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.3);
  }, []);

  // Toggle animation
  const toggleAnimation = useCallback(() => {
    const viewer = cesiumViewerRef.current;
    if (!viewer) return;

    viewer.clock.shouldAnimate = !isAnimating;
    setIsAnimating(!isAnimating);
  }, [isAnimating]);

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
      {/* Loading overlay - only show during initial Cesium load, not API load */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#050520]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500 mx-auto mb-4" />
            <p className="text-white text-xl">Initializing Heliocentric View...</p>
            <p className="text-slate-400 text-sm mt-2">Loading Cesium 3D engine</p>
          </div>
        </div>
      )}

      {/* Cesium container */}
      <div ref={viewerRef} className="w-full h-full" />

      {/* Title and status */}
      {cesiumReady && (
        <div className="absolute top-4 left-4 z-20 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-4 max-w-xs">
          <h2 className="text-lg font-bold text-white mb-1">Heliocentric View</h2>
          <p className="text-xs text-slate-400 mb-3">
            {dataLoading ? 'Fetching real-time positions...' : 'Real-time spacecraft positions'}
          </p>

          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Planets:</span>
              <span className="text-white">{STATIC_PLANETS.length} (Sun + 8 planets)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Spacecraft:</span>
              <span className="text-white">
                {dataLoading ? (
                  <span className="text-yellow-400 animate-pulse">Loading...</span>
                ) : (
                  `${spacecraft.filter(s => s.position).length} tracked`
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
            <div className="text-xs text-slate-500">Data: NASA JPL Horizons</div>
          </div>
        </div>
      )}

      {/* View mode selector */}
      {cesiumReady && (
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
      {cesiumReady && (
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
      {cesiumReady && (
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
      {cesiumReady && (
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
      {cesiumReady && !selectedObject && (
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
export default dynamic(() => Promise.resolve(CesiumHeliocentricComponent), {
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
