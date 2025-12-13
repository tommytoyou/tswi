'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { config } from '@/lib/config';
import dynamic from 'next/dynamic';

interface AuroraDataPoint {
  Longitude: number;
  Latitude: number;
  Aurora: number;
}

interface AuroraData {
  observation_time: string;
  forecast_time: string;
  coordinates: AuroraDataPoint[];
  count: number;
}

// NOAA-style aurora color gradient: Green (low) -> Yellow -> Orange -> Red (high)
function getAuroraColor(probability: number): { r: number; g: number; b: number; a: number } {
  if (probability < 5) {
    return { r: 0, g: 0, b: 0, a: 0 };
  } else if (probability < 20) {
    // Green
    return { r: 0, g: 180, b: 80, a: 0.5 };
  } else if (probability < 40) {
    // Bright green
    return { r: 50, g: 220, b: 50, a: 0.6 };
  } else if (probability < 60) {
    // Yellow-green
    return { r: 150, g: 255, b: 50, a: 0.7 };
  } else if (probability < 80) {
    // Yellow-orange
    return { r: 255, g: 200, b: 0, a: 0.8 };
  } else {
    // Orange-red
    return { r: 255, g: 100, b: 50, a: 0.9 };
  }
}

// Get glow color for aurora effect
function getGlowColor(probability: number, layer: number): { r: number; g: number; b: number; a: number } {
  const baseColor = getAuroraColor(probability);
  const alphaMultiplier = 1 - (layer * 0.3);
  return {
    r: Math.min(255, baseColor.r + 20),
    g: Math.min(255, baseColor.g + 20),
    b: Math.min(255, baseColor.b + 20),
    a: baseColor.a * alphaMultiplier * 0.5
  };
}

// Group points into cells for rendering
function groupPointsIntoCells(
  points: AuroraDataPoint[],
  cellSize: number = 4
): Map<string, AuroraDataPoint[]> {
  const cells = new Map<string, AuroraDataPoint[]>();

  for (const point of points) {
    const cellLat = Math.floor(point.Latitude / cellSize) * cellSize;
    const cellLon = Math.floor(point.Longitude / cellSize) * cellSize;
    const key = `${cellLat},${cellLon}`;

    if (!cells.has(key)) {
      cells.set(key, []);
    }
    cells.get(key)!.push(point);
  }

  return cells;
}

// Calculate average probability for a cell
function getCellAverage(points: AuroraDataPoint[]): number {
  if (points.length === 0) return 0;
  const sum = points.reduce((acc, p) => acc + p.Aurora, 0);
  return sum / points.length;
}

// Normalize longitude from 0-360 to -180 to 180 (Cesium format)
function normalizeLongitude(lon: number): number {
  return lon > 180 ? lon - 360 : lon;
}

function AuroraGlobeComponent() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const cesiumViewerRef = useRef<any>(null);
  const cesiumModuleRef = useRef<any>(null);
  const entitiesRef = useRef<any[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cesiumReady, setCesiumReady] = useState(false);

  // Aurora data
  const [auroraData, setAuroraData] = useState<AuroraData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // View controls
  const [hemisphere, setHemisphere] = useState<'north' | 'south'>('north');

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

        // Configure clock for real-time
        viewer.clock.currentTime = Cesium.JulianDate.now();
        viewer.clock.shouldAnimate = true;
        viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
        viewer.clock.multiplier = 1;

        // Enable lighting for day/night terminator
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.showGroundAtmosphere = true;
        if (viewer.scene.skyAtmosphere) {
          viewer.scene.skyAtmosphere.show = true;
        }

        // Set initial view to Arctic region (North Pole aurora view)
        // Position camera directly above to center the globe in viewport
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(0, 90, 31250000),
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

  // Fetch aurora data
  const fetchAuroraData = useCallback(async () => {
    try {
      setDataLoading(true);
      const res = await fetch('/api/noaa/aurora?fetch=latest&minProbability=3');
      if (!res.ok) throw new Error('Failed to fetch aurora data');
      const data = await res.json();
      if (data.success) {
        setAuroraData(data);
        setDataError(null);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Aurora fetch error:', err);
      setDataError(err.message);
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Fetch data on mount and refresh periodically
  useEffect(() => {
    fetchAuroraData();
    const interval = setInterval(fetchAuroraData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAuroraData]);

  // Fly to hemisphere when changed
  useEffect(() => {
    const viewer = cesiumViewerRef.current;
    const Cesium = cesiumModuleRef.current;
    if (!viewer || !Cesium || !cesiumReady) return;

    // Position camera directly above the pole to center the globe
    const targetLat = hemisphere === 'north' ? 90 : -90;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(0, targetLat, 31250000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0,
      },
      duration: 1.5,
    });
  }, [hemisphere, cesiumReady]);

  // Render aurora visualization
  useEffect(() => {
    const viewer = cesiumViewerRef.current;
    const Cesium = cesiumModuleRef.current;
    if (!viewer || !Cesium || !cesiumReady || !auroraData) return;

    // Clear existing entities
    entitiesRef.current.forEach((entity) => {
      try {
        viewer.entities.remove(entity);
      } catch {
        // Ignore cleanup errors
      }
    });
    entitiesRef.current = [];

    const coordinates = auroraData.coordinates || [];
    if (coordinates.length === 0) return;

    const cellSize = 4;
    const cells = groupPointsIntoCells(coordinates, cellSize);
    const glowLayers = 3;
    const baseAltitude = 110000; // Aurora altitude ~110km

    // Render aurora cells with glow effect
    for (let layer = glowLayers - 1; layer >= 0; layer--) {
      const altitudeOffset = layer * 8000;
      const sizeExpansion = layer * 0.4;

      cells.forEach((points, key) => {
        const [latStr, lonStr] = key.split(',');
        const cellLat = parseFloat(latStr);
        const cellLon = parseFloat(lonStr);
        const avgProbability = getCellAverage(points);

        if (avgProbability < 5) return;
        if (layer > 0 && avgProbability < 15) return;

        const color = layer === 0
          ? getAuroraColor(avgProbability)
          : getGlowColor(avgProbability, layer);

        if (color.a < 0.05) return;

        const westLon = normalizeLongitude(cellLon - sizeExpansion);
        const eastLon = normalizeLongitude(cellLon + cellSize + sizeExpansion);
        const southLat = cellLat - sizeExpansion;
        const northLat = cellLat + cellSize + sizeExpansion;

        // Skip cells that cross the antimeridian
        if (westLon > eastLon) return;

        const entity = viewer.entities.add({
          name: `Aurora ${cellLat},${cellLon}`,
          rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(
              westLon,
              Math.max(-90, southLat),
              eastLon,
              Math.min(90, northLat)
            ),
            material: new Cesium.ColorMaterialProperty(
              new Cesium.Color(color.r / 255, color.g / 255, color.b / 255, color.a)
            ),
            height: baseAltitude + altitudeOffset,
            outline: false,
          },
        });
        entitiesRef.current.push(entity);
      });
    }

    // Add glowing edge polylines for high-probability aurora
    const highProbPoints = coordinates.filter((p) => p.Aurora >= 30);
    if (highProbPoints.length > 0) {
      const latBands = new Map<number, AuroraDataPoint[]>();
      highProbPoints.forEach((p) => {
        const band = Math.round(p.Latitude / 3) * 3;
        if (!latBands.has(band)) latBands.set(band, []);
        latBands.get(band)!.push(p);
      });

      latBands.forEach((points, lat) => {
        if (points.length < 5) return;

        const normalized = points.map((p) => ({
          ...p,
          Longitude: normalizeLongitude(p.Longitude),
        }));
        const sorted = [...normalized].sort((a, b) => a.Longitude - b.Longitude);

        const avgProb = getCellAverage(sorted);
        const glowColor = getAuroraColor(avgProb);

        for (let glowLayer = 0; glowLayer < 2; glowLayer++) {
          const layerAltitude = 120000 + (glowLayer * 5000);
          const positions = sorted.map((p) =>
            Cesium.Cartesian3.fromDegrees(p.Longitude, p.Latitude, layerAltitude)
          );

          if (positions.length > 2) {
            const glowPower = 0.6 - (glowLayer * 0.15);
            const lineWidth = Math.max(4, avgProb / 8) - glowLayer;
            const alpha = Math.min(0.85, glowColor.a + 0.2) - (glowLayer * 0.25);

            const glowEntity = viewer.entities.add({
              name: `Aurora Edge ${lat}`,
              polyline: {
                positions: positions,
                width: lineWidth,
                material: new Cesium.PolylineGlowMaterialProperty({
                  glowPower: glowPower,
                  color: new Cesium.Color(
                    glowColor.r / 255,
                    glowColor.g / 255,
                    glowColor.b / 255,
                    alpha
                  ),
                }),
                clampToGround: false,
              },
            });
            entitiesRef.current.push(glowEntity);
          }
        }
      });
    }

    return () => {
      entitiesRef.current.forEach((entity) => {
        try {
          viewer.entities.remove(entity);
        } catch {
          // Ignore cleanup errors
        }
      });
      entitiesRef.current = [];
    };
  }, [cesiumReady, auroraData]);

  // Format time for display
  const formatTime = (timeStr: string | undefined) => {
    if (!timeStr) return '--';
    try {
      return new Date(timeStr).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return '--';
    }
  };

  // Calculate max probability
  const maxProbability = auroraData?.coordinates
    ? Math.max(...auroraData.coordinates.map((p) => p.Aurora), 0)
    : 0;

  // Get activity level
  const getActivityLevel = (prob: number) => {
    if (prob < 20) return { label: 'Quiet', color: 'bg-green-900', textColor: 'text-green-400' };
    if (prob < 40) return { label: 'Minor', color: 'bg-green-600', textColor: 'text-green-400' };
    if (prob < 60) return { label: 'Moderate', color: 'bg-yellow-500', textColor: 'text-yellow-400' };
    if (prob < 80) return { label: 'Active', color: 'bg-orange-500', textColor: 'text-orange-400' };
    return { label: 'Intense', color: 'bg-red-500', textColor: 'text-red-400' };
  };

  const activity = getActivityLevel(maxProbability);

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

  return (
    <div className="relative w-full h-full bg-[#050520]">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500 mx-auto mb-4" />
            <p className="text-white text-xl">Loading Aurora Globe...</p>
          </div>
        </div>
      )}
      <div ref={viewerRef} className="w-full h-full" />

      {/* Header Info Panel - Top Left */}
      {cesiumReady && (
        <div className="absolute top-4 left-4 z-20 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-4 min-w-[220px]">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-bold text-white">Aurora Forecast</h2>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${dataLoading ? 'bg-yellow-500 animate-pulse' : dataError ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <span className="text-xs text-slate-400">
                {dataLoading ? 'Loading...' : dataError ? 'Error' : 'Live'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl font-bold text-white">{maxProbability.toFixed(0)}%</div>
            <div className="flex flex-col">
              <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${activity.color}`}>
                {activity.label}
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-400 mb-3">
            <div>Max aurora probability</div>
            <div className="text-slate-500">
              Updated: {formatTime(auroraData?.observation_time)}
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Data: NOAA SWPC OVATION
          </div>
        </div>
      )}

      {/* Hemisphere Toggle - Top Right */}
      {cesiumReady && (
        <div className="absolute top-4 right-4 z-20 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-3">
          <div className="text-xs text-slate-400 mb-2">Hemisphere View</div>
          <div className="flex gap-1">
            <button
              onClick={() => setHemisphere('north')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                hemisphere === 'north'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              North
            </button>
            <button
              onClick={() => setHemisphere('south')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                hemisphere === 'south'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              South
            </button>
          </div>
        </div>
      )}

      {/* Probability Legend - Bottom Left */}
      {cesiumReady && (
        <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-3">
          <div className="text-xs text-slate-400 mb-2 text-center">Aurora Probability</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">10%</span>
            <div
              className="w-48 h-4 rounded"
              style={{
                background: 'linear-gradient(to right, rgb(0,180,80) 0%, rgb(50,220,50) 25%, rgb(150,255,50) 50%, rgb(255,200,0) 75%, rgb(255,100,50) 100%)',
              }}
            />
            <span className="text-xs text-slate-500">90%</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1 px-6">
            <span>Low</span>
            <span>Moderate</span>
            <span>High</span>
          </div>
        </div>
      )}

      {/* Day/Night Info - Bottom Right */}
      {cesiumReady && (
        <div className="absolute bottom-4 right-4 z-20 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-3 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-slate-800 to-slate-400" />
            <span className="text-slate-400">Day/Night Terminator</span>
          </div>
          <div className="text-slate-500">
            Aurora is most visible on the night side
          </div>
        </div>
      )}
    </div>
  );
}

// Export with SSR disabled
export default dynamic(() => Promise.resolve(AuroraGlobeComponent), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#050520]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500 mx-auto mb-4" />
        <p className="text-white text-xl">Loading Aurora Globe...</p>
      </div>
    </div>
  ),
});
