'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { config } from '@/lib/config';
import dynamic from 'next/dynamic';
import * as satellite from 'satellite.js';

// Types
type ViewMode = 'country' | 'sector';
type CountryKey = 'USA' | 'China' | 'Russia' | 'EU' | 'India' | 'Japan' | 'Other';
type SectorKey = 'Commercial' | 'Civil' | 'Government' | 'Military';

interface NationalSatellite {
  noradId: string;
  name: string;
  country: string;
  countryNormalized: CountryKey;
  operator: string;
  users: string;
  sector: SectorKey;
  purpose: string;
  detailedPurpose: string;
  orbitClass: string;
  orbitType: string;
  tle: { line1: string; line2: string } | null;
  hasTLE: boolean;
}

interface SatellitePosition extends NationalSatellite {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  satrec?: satellite.SatRec;
}

interface APIResponse {
  success: boolean;
  satellites: NationalSatellite[];
  totalFiltered: number;
  returned: number;
  stats: {
    totalInDatabase: number;
    countryCounts: Record<string, number>;
    sectorCounts: Record<string, number>;
    filteredCountryCounts: Record<string, number>;
    filteredSectorCounts: Record<string, number>;
  };
}

// Color schemes
const COUNTRY_COLORS: Record<CountryKey, string> = {
  USA: '#3B82F6',      // Blue
  China: '#EF4444',    // Red
  Russia: '#FFFFFF',   // White
  EU: '#EAB308',       // Yellow
  India: '#F97316',    // Orange
  Japan: '#EC4899',    // Pink
  Other: '#6B7280',    // Gray
};

const SECTOR_COLORS: Record<SectorKey, string> = {
  Commercial: '#3B82F6',  // Blue
  Civil: '#22C55E',       // Green
  Government: '#EAB308',  // Yellow
  Military: '#EF4444',    // Red
};

// Shape types for sector (when in Country mode)
const SECTOR_SHAPES: Record<SectorKey, 'circle' | 'triangle' | 'square' | 'diamond'> = {
  Commercial: 'circle',
  Civil: 'triangle',
  Government: 'square',
  Military: 'diamond',
};

// Generate SVG data URI for different shapes with specified color
function createShapeSvg(shape: 'circle' | 'triangle' | 'square' | 'diamond', colorHex: string): string {
  const size = 24;
  const strokeWidth = 2;
  let svgContent: string;

  switch (shape) {
    case 'circle':
      svgContent = `<circle cx="${size/2}" cy="${size/2}" r="${size/2 - strokeWidth}" fill="${colorHex}" stroke="white" stroke-width="${strokeWidth}"/>`;
      break;
    case 'triangle': {
      // Equilateral triangle pointing up
      const triPadding = strokeWidth;
      const triTop = triPadding;
      const triBottom = size - triPadding;
      const triLeft = triPadding;
      const triRight = size - triPadding;
      svgContent = `<polygon points="${size/2},${triTop} ${triRight},${triBottom} ${triLeft},${triBottom}" fill="${colorHex}" stroke="white" stroke-width="${strokeWidth}"/>`;
      break;
    }
    case 'square': {
      const sqPadding = strokeWidth + 1;
      svgContent = `<rect x="${sqPadding}" y="${sqPadding}" width="${size - sqPadding*2}" height="${size - sqPadding*2}" fill="${colorHex}" stroke="white" stroke-width="${strokeWidth}"/>`;
      break;
    }
    case 'diamond': {
      // Diamond (rotated square)
      const dPadding = strokeWidth;
      const dCenter = size / 2;
      svgContent = `<polygon points="${dCenter},${dPadding} ${size - dPadding},${dCenter} ${dCenter},${size - dPadding} ${dPadding},${dCenter}" fill="${colorHex}" stroke="white" stroke-width="${strokeWidth}"/>`;
      break;
    }
    default:
      svgContent = `<circle cx="${size/2}" cy="${size/2}" r="${size/2 - strokeWidth}" fill="${colorHex}" stroke="white" stroke-width="${strokeWidth}"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${svgContent}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Cache for shape SVGs to avoid recreating them
const shapeSvgCache = new Map<string, string>();

function getShapeSvg(shape: 'circle' | 'triangle' | 'square' | 'diamond', colorHex: string): string {
  const key = `${shape}-${colorHex}`;
  if (!shapeSvgCache.has(key)) {
    shapeSvgCache.set(key, createShapeSvg(shape, colorHex));
  }
  return shapeSvgCache.get(key)!;
}

// Convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 128, g: 128, b: 128 };
}

// Calculate satellite position from TLE
function calculatePosition(
  satrec: satellite.SatRec,
  date: Date
): { latitude: number; longitude: number; altitude: number; velocity: number } | null {
  try {
    const positionAndVelocity = satellite.propagate(satrec, date);

    if (
      !positionAndVelocity ||
      !positionAndVelocity.position ||
      typeof positionAndVelocity.position === 'boolean'
    ) {
      return null;
    }

    if (!positionAndVelocity.velocity || typeof positionAndVelocity.velocity === 'boolean') {
      return null;
    }

    const positionEci = positionAndVelocity.position as satellite.EciVec3<number>;
    const velocityEci = positionAndVelocity.velocity as satellite.EciVec3<number>;

    const gmst = satellite.gstime(date);
    const positionGd = satellite.eciToGeodetic(positionEci, gmst);

    const longitude = satellite.degreesLong(positionGd.longitude);
    const latitude = satellite.degreesLat(positionGd.latitude);
    const altitude = positionGd.height;

    const velocity = Math.sqrt(velocityEci.x ** 2 + velocityEci.y ** 2 + velocityEci.z ** 2);

    return { latitude, longitude, altitude, velocity };
  } catch {
    return null;
  }
}

// Generate orbital track positions for one complete orbit
function generateOrbitalTrack(
  satrec: satellite.SatRec,
  startDate: Date,
  numPoints: number = 120
): { longitude: number; latitude: number; altitude: number }[] {
  const positions: { longitude: number; latitude: number; altitude: number }[] = [];

  // Calculate orbital period from mean motion (revolutions per day)
  const meanMotion = satrec.no; // radians per minute
  const orbitalPeriodMinutes = (2 * Math.PI) / meanMotion;

  // Generate positions for one complete orbit
  for (let i = 0; i <= numPoints; i++) {
    const timeOffset = (i / numPoints) * orbitalPeriodMinutes;
    const date = new Date(startDate.getTime() + timeOffset * 60 * 1000);

    try {
      const positionAndVelocity = satellite.propagate(satrec, date);

      if (
        !positionAndVelocity ||
        !positionAndVelocity.position ||
        typeof positionAndVelocity.position === 'boolean'
      ) {
        continue;
      }

      const positionEci = positionAndVelocity.position as satellite.EciVec3<number>;
      const gmst = satellite.gstime(date);
      const positionGd = satellite.eciToGeodetic(positionEci, gmst);

      positions.push({
        longitude: satellite.degreesLong(positionGd.longitude),
        latitude: satellite.degreesLat(positionGd.latitude),
        altitude: positionGd.height,
      });
    } catch {
      // Skip invalid positions
    }
  }

  return positions;
}

function NationalAssetsGlobeComponent() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const cesiumViewerRef = useRef<any>(null);
  const cesiumModuleRef = useRef<any>(null);
  const entitiesRef = useRef<any[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cesiumReady, setCesiumReady] = useState(false);

  // View mode and filters
  const [viewMode, setViewMode] = useState<ViewMode>('country');
  const [selectedCountries, setSelectedCountries] = useState<Set<CountryKey>>(new Set(['USA']));
  const [selectedSectors, setSelectedSectors] = useState<Set<SectorKey>>(
    new Set(['Commercial', 'Civil', 'Government', 'Military'])
  );

  // Data
  const [satellites, setSatellites] = useState<SatellitePosition[]>([]);
  const [stats, setStats] = useState<APIResponse['stats'] | null>(null);
  const [selectedSatellite, setSelectedSatellite] = useState<SatellitePosition | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  // Orbital tracks
  const [showOrbitalTracks, setShowOrbitalTracks] = useState(false);
  const orbitalTracksRef = useRef<any[]>([]);

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

        const viewer = new Cesium.Viewer(viewerRef.current!, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          vrButton: false,
          geocoder: false,
          homeButton: true,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: true,
        });

        viewer.clock.currentTime = Cesium.JulianDate.now();
        viewer.clock.shouldAnimate = true;
        viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
        viewer.clock.multiplier = 1;

        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.showGroundAtmosphere = true;
        if (viewer.scene.skyAtmosphere) {
          viewer.scene.skyAtmosphere.show = true;
        }

        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(-98.5, 39.8, 20000000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0.0,
          },
        });

        cesiumViewerRef.current = viewer;
        cesiumModuleRef.current = Cesium;
        setIsLoading(false);
        setError(null);
        setCesiumReady(true);
      } catch (err: any) {
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
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  // Fetch satellite data
  const fetchSatellites = useCallback(async () => {
    setDataLoading(true);

    try {
      const countryParam =
        selectedCountries.size > 0 ? Array.from(selectedCountries).join(',') : '';
      const sectorParam = selectedSectors.size > 0 ? Array.from(selectedSectors).join(',') : '';

      const params = new URLSearchParams();
      if (countryParam) params.set('country', countryParam);
      if (sectorParam) params.set('sector', sectorParam);
      params.set('includeTLE', 'true');
      params.set('limit', '500');

      const response = await fetch(`/api/satellites/national?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch satellite data');
      }

      const data: APIResponse = await response.json();

      if (!data.success) {
        throw new Error('Invalid satellite data');
      }

      setStats(data.stats);

      // Process satellites with TLE data
      const now = new Date();
      const positions: SatellitePosition[] = [];

      for (const sat of data.satellites) {
        if (!sat.tle) continue;

        try {
          const satrec = satellite.twoline2satrec(sat.tle.line1, sat.tle.line2);
          const pos = calculatePosition(satrec, now);

          if (pos) {
            positions.push({
              ...sat,
              countryNormalized: sat.countryNormalized as CountryKey,
              sector: sat.sector as SectorKey,
              latitude: pos.latitude,
              longitude: pos.longitude,
              altitude: pos.altitude,
              velocity: pos.velocity,
              satrec,
            });
          }
        } catch {
          // Skip satellites with invalid TLE
        }
      }

      setSatellites(positions);
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setDataLoading(false);
    }
  }, [selectedCountries, selectedSectors]);

  // Fetch data when filters change
  useEffect(() => {
    if (cesiumReady) {
      fetchSatellites();
    }
  }, [cesiumReady, fetchSatellites]);

  // Render satellites on globe
  useEffect(() => {
    const viewer = cesiumViewerRef.current;
    const Cesium = cesiumModuleRef.current;

    if (!viewer || !Cesium || !cesiumReady) return;

    // Clear existing entities
    entitiesRef.current.forEach((entity) => {
      try {
        viewer.entities.remove(entity);
      } catch {
        // Ignore cleanup errors
      }
    });
    entitiesRef.current = [];

    // Add satellite entities
    satellites.forEach((sat) => {
      const colorHex = viewMode === 'country' ? COUNTRY_COLORS[sat.countryNormalized] : SECTOR_COLORS[sat.sector];
      const rgb = hexToRgb(colorHex);
      const cesiumColor = new Cesium.Color(rgb.r / 255, rgb.g / 255, rgb.b / 255, 1.0);

      // In country mode, use billboards with different shapes based on sector
      // In sector mode, use simple points (circles) colored by sector
      const useShapes = viewMode === 'country';
      const shape = SECTOR_SHAPES[sat.sector];

      const entityConfig: any = {
        name: sat.name,
        position: Cesium.Cartesian3.fromDegrees(sat.longitude, sat.latitude, sat.altitude * 1000),
        label: {
          text: sat.name,
          font: '11px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          scaleByDistance: new Cesium.NearFarScalar(1e6, 1.0, 1e8, 0.3),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2e7),
        },
        properties: {
          noradId: sat.noradId,
          country: sat.countryNormalized,
          sector: sat.sector,
        },
      };

      if (useShapes) {
        // Use billboard with SVG shape for country mode
        const svgDataUri = getShapeSvg(shape, colorHex);
        entityConfig.billboard = {
          image: svgDataUri,
          width: 16,
          height: 16,
          scaleByDistance: new Cesium.NearFarScalar(1e6, 1.5, 1e8, 0.5),
        };
      } else {
        // Use simple point for sector mode
        entityConfig.point = {
          pixelSize: 8,
          color: cesiumColor,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          scaleByDistance: new Cesium.NearFarScalar(1e6, 1.5, 1e8, 0.5),
        };
      }

      const entity = viewer.entities.add(entityConfig);
      entitiesRef.current.push(entity);
    });

    // Set up click handler
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: any) => {
      const pickedObject = viewer.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && pickedObject.id?.properties) {
        const props = pickedObject.id.properties;
        const noradId = props.noradId?.getValue();
        const sat = satellites.find((s) => s.noradId === noradId);
        if (sat) {
          setSelectedSatellite(sat);
        }
      } else {
        setSelectedSatellite(null);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
      entitiesRef.current.forEach((entity) => {
        try {
          viewer.entities.remove(entity);
        } catch {
          // Ignore cleanup errors
        }
      });
      entitiesRef.current = [];
    };
  }, [cesiumReady, satellites, viewMode]);

  // Render orbital tracks when enabled
  useEffect(() => {
    const viewer = cesiumViewerRef.current;
    const Cesium = cesiumModuleRef.current;

    if (!viewer || !Cesium || !cesiumReady) return;

    // Clear existing orbital track entities
    orbitalTracksRef.current.forEach((entity) => {
      try {
        viewer.entities.remove(entity);
      } catch {
        // Ignore cleanup errors
      }
    });
    orbitalTracksRef.current = [];

    // Only render if showOrbitalTracks is enabled
    if (!showOrbitalTracks) return;

    const now = new Date();

    // Generate and draw orbital tracks for each satellite
    satellites.forEach((sat) => {
      if (!sat.satrec) return;

      const trackPositions = generateOrbitalTrack(sat.satrec, now, 120);

      if (trackPositions.length < 2) return;

      // Get color based on view mode
      const colorHex = viewMode === 'country' ? COUNTRY_COLORS[sat.countryNormalized] : SECTOR_COLORS[sat.sector];
      const rgb = hexToRgb(colorHex);

      // Create Cartesian3 positions array for the polyline
      const cartesianPositions: any[] = [];
      for (const pos of trackPositions) {
        cartesianPositions.push(
          Cesium.Cartesian3.fromDegrees(pos.longitude, pos.latitude, pos.altitude * 1000)
        );
      }

      // Add polyline entity with semi-transparent dashed line
      const trackEntity = viewer.entities.add({
        polyline: {
          positions: cartesianPositions,
          width: 1.5,
          material: new Cesium.PolylineDashMaterialProperty({
            color: new Cesium.Color(rgb.r / 255, rgb.g / 255, rgb.b / 255, 0.4),
            dashLength: 16,
          }),
          clampToGround: false,
        },
      });

      orbitalTracksRef.current.push(trackEntity);
    });

    return () => {
      orbitalTracksRef.current.forEach((entity) => {
        try {
          viewer.entities.remove(entity);
        } catch {
          // Ignore cleanup errors
        }
      });
      orbitalTracksRef.current = [];
    };
  }, [cesiumReady, satellites, viewMode, showOrbitalTracks]);

  // Toggle country selection
  const toggleCountry = (country: CountryKey) => {
    setSelectedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(country)) {
        next.delete(country);
      } else {
        next.add(country);
      }
      return next;
    });
  };

  // Toggle sector selection
  const toggleSector = (sector: SectorKey) => {
    setSelectedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(sector)) {
        next.delete(sector);
      } else {
        next.add(sector);
      }
      return next;
    });
  };

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="max-w-md p-6 bg-red-900/20 border border-red-500 rounded-lg">
          <h3 className="text-red-400 font-bold mb-2">Globe Error</h3>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const countries: CountryKey[] = ['USA', 'China', 'Russia', 'EU', 'India', 'Japan', 'Other'];
  const sectors: SectorKey[] = ['Commercial', 'Civil', 'Government', 'Military'];

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4" />
            <p className="text-white text-xl">Loading National Assets Globe...</p>
          </div>
        </div>
      )}
      <div ref={viewerRef} className="w-full h-full" />

      {/* Legend - Top Right */}
      {cesiumReady && (
        <div className="absolute top-4 right-4 z-20 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-3 min-w-[200px]">
          <div className="text-sm font-semibold text-white mb-2">
            {viewMode === 'country' ? 'By Country' : 'By Sector'}
          </div>
          <div className="space-y-1">
            {viewMode === 'country'
              ? countries.map((c) => (
                  <div key={c} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COUNTRY_COLORS[c] }}
                    />
                    <span className="text-slate-300">{c}</span>
                    {stats && (
                      <span className="text-slate-500 ml-auto">
                        {stats.countryCounts[c] || 0}
                      </span>
                    )}
                  </div>
                ))
              : sectors.map((s) => (
                  <div key={s} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: SECTOR_COLORS[s] }}
                    />
                    <span className="text-slate-300">{s}</span>
                    {stats && (
                      <span className="text-slate-500 ml-auto">
                        {stats.sectorCounts[s] || 0}
                      </span>
                    )}
                  </div>
                ))}
          </div>
          {viewMode === 'country' && (
            <div className="mt-3 pt-2 border-t border-slate-700">
              <div className="text-xs text-slate-400 mb-2">Shape by Sector</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <circle cx="6" cy="6" r="5" fill="#6B7280" stroke="white" strokeWidth="1"/>
                  </svg>
                  <span>Commercial</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <polygon points="6,1 11,11 1,11" fill="#6B7280" stroke="white" strokeWidth="1"/>
                  </svg>
                  <span>Civil</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <rect x="1" y="1" width="10" height="10" fill="#6B7280" stroke="white" strokeWidth="1"/>
                  </svg>
                  <span>Government</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <polygon points="6,1 11,6 6,11 1,6" fill="#6B7280" stroke="white" strokeWidth="1"/>
                  </svg>
                  <span>Military</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter Panel - Bottom Left */}
      {cesiumReady && (
        <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-3 min-w-[220px]">
          {/* View Mode Toggle */}
          <div className="mb-3">
            <div className="text-xs text-slate-400 mb-2">View Mode</div>
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('country')}
                className={`flex-1 px-3 py-1.5 text-xs rounded ${
                  viewMode === 'country'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Country
              </button>
              <button
                onClick={() => setViewMode('sector')}
                className={`flex-1 px-3 py-1.5 text-xs rounded ${
                  viewMode === 'sector'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Sector
              </button>
            </div>
          </div>

          {/* Country Filters */}
          <div className="mb-3">
            <div className="text-xs text-slate-400 mb-2">Countries</div>
            <div className="space-y-1">
              {countries.map((c) => (
                <label key={c} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCountries.has(c)}
                    onChange={() => toggleCountry(c)}
                    className="w-3 h-3 rounded border-slate-600 bg-slate-800"
                  />
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COUNTRY_COLORS[c] }}
                  />
                  <span className="text-xs text-slate-300">{c}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sector Filters */}
          <div>
            <div className="text-xs text-slate-400 mb-2">Sectors</div>
            <div className="space-y-1">
              {sectors.map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSectors.has(s)}
                    onChange={() => toggleSector(s)}
                    className="w-3 h-3 rounded border-slate-600 bg-slate-800"
                  />
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: SECTOR_COLORS[s] }}
                  />
                  <span className="text-xs text-slate-300">{s}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Orbital Tracks Toggle */}
          <div className="mt-3 pt-3 border-t border-slate-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOrbitalTracks}
                onChange={() => setShowOrbitalTracks(!showOrbitalTracks)}
                className="w-3 h-3 rounded border-slate-600 bg-slate-800"
              />
              <span className="text-xs text-slate-300">Show Orbital Tracks</span>
            </label>
          </div>

          {dataLoading && (
            <div className="mt-2 pt-2 border-t border-slate-700">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-500" />
                Loading satellites...
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Panel - Bottom Right */}
      {cesiumReady && (
        <div className="absolute bottom-4 right-4 z-20 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-3 min-w-[260px]">
          <div className="text-sm font-semibold text-white mb-2">Statistics</div>

          {/* Satellite counts */}
          <div className="text-xs text-slate-400 mb-2">
            Showing {satellites.length} of {stats?.totalInDatabase || 0} satellites
          </div>

          {/* Country breakdown */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mb-3">
            {countries.map((c) => {
              const count = stats?.filteredCountryCounts[c] || 0;
              if (count === 0) return null;
              return (
                <span key={c} className="text-slate-300">
                  <span style={{ color: COUNTRY_COLORS[c] }}>{c}</span>: {count}
                </span>
              );
            })}
          </div>

          {/* Selected Satellite Details */}
          {selectedSatellite && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="text-sm font-semibold text-white">{selectedSatellite.name}</h4>
                  <p className="text-xs text-slate-400">NORAD {selectedSatellite.noradId}</p>
                </div>
                <button
                  onClick={() => setSelectedSatellite(null)}
                  className="text-slate-400 hover:text-white"
                >
                  x
                </button>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Country</span>
                  <span
                    className="font-medium"
                    style={{ color: COUNTRY_COLORS[selectedSatellite.countryNormalized] }}
                  >
                    {selectedSatellite.country}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Operator</span>
                  <span className="text-slate-200 text-right max-w-[150px] truncate">
                    {selectedSatellite.operator || 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Sector</span>
                  <span
                    className="font-medium"
                    style={{ color: SECTOR_COLORS[selectedSatellite.sector] }}
                  >
                    {selectedSatellite.sector}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Purpose</span>
                  <span className="text-slate-200 text-right max-w-[150px] truncate">
                    {selectedSatellite.purpose || 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Altitude</span>
                  <span className="text-slate-200 font-mono">
                    {selectedSatellite.altitude.toFixed(0)} km
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Orbit</span>
                  <span className="text-slate-200">{selectedSatellite.orbitClass}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Export with SSR disabled
export default dynamic(() => Promise.resolve(NationalAssetsGlobeComponent), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4" />
        <p className="text-white text-xl">Loading National Assets Globe...</p>
      </div>
    </div>
  ),
});
