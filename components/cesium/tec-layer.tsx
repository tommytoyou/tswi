'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface TecLayerProps {
  viewer: any; // Cesium.Viewer
  Cesium: any; // Cesium module
  visible?: boolean;
}

interface TecGridPoint {
  lat: number;
  lon: number;
  tec: number;
}

interface TecResponse {
  success: boolean;
  data: TecGridPoint[];
  timestamp: string;
  source: string;
  featureCount?: number;
  cached?: boolean;
}

// TEC color scale thresholds
const TEC_COLORS = {
  normal: { min: 0, max: 20, color: { r: 34, g: 197, b: 94 } }, // Green
  elevated: { min: 20, max: 40, color: { r: 234, g: 179, b: 8 } }, // Yellow
  high: { min: 40, max: 60, color: { r: 249, g: 115, b: 22 } }, // Orange
  extreme: { min: 60, max: 100, color: { r: 239, g: 68, b: 68 } }, // Red
};

// Get color for TEC value with interpolation
function getTecColor(tec: number): { r: number; g: number; b: number; alpha: number } {
  let color: { r: number; g: number; b: number };
  let alpha: number;

  if (tec < TEC_COLORS.normal.max) {
    // Green zone (0-20)
    const t = tec / TEC_COLORS.normal.max;
    color = TEC_COLORS.normal.color;
    alpha = 0.15 + t * 0.1; // 0.15-0.25
  } else if (tec < TEC_COLORS.elevated.max) {
    // Yellow zone (20-40)
    const t = (tec - TEC_COLORS.elevated.min) / (TEC_COLORS.elevated.max - TEC_COLORS.elevated.min);
    color = interpolateColor(TEC_COLORS.normal.color, TEC_COLORS.elevated.color, t);
    alpha = 0.25 + t * 0.1; // 0.25-0.35
  } else if (tec < TEC_COLORS.high.max) {
    // Orange zone (40-60)
    const t = (tec - TEC_COLORS.high.min) / (TEC_COLORS.high.max - TEC_COLORS.high.min);
    color = interpolateColor(TEC_COLORS.elevated.color, TEC_COLORS.high.color, t);
    alpha = 0.35 + t * 0.1; // 0.35-0.45
  } else {
    // Red zone (60+)
    const t = Math.min(1, (tec - TEC_COLORS.extreme.min) / (TEC_COLORS.extreme.max - TEC_COLORS.extreme.min));
    color = interpolateColor(TEC_COLORS.high.color, TEC_COLORS.extreme.color, t);
    alpha = 0.45 + t * 0.1; // 0.45-0.55
  }

  return { ...color, alpha };
}

function interpolateColor(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number },
  t: number
): { r: number; g: number; b: number } {
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * t),
    g: Math.round(c1.g + (c2.g - c1.g) * t),
    b: Math.round(c1.b + (c2.b - c1.b) * t),
  };
}

// Normalize longitude to -180 to 180 range (GloTEC may use 0-360 format)
function normalizeLon(lon: number): number {
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}

// Helper to check if viewer is valid and not destroyed
function isViewerValid(viewer: any): boolean {
  return viewer && !viewer.isDestroyed() && viewer.scene && viewer.scene.primitives;
}

export function TecLayer({ viewer, Cesium, visible = true }: TecLayerProps) {
  const [tecData, setTecData] = useState<TecResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const primitiveCollectionRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup primitive safely
  const cleanupPrimitive = useCallback(() => {
    if (primitiveCollectionRef.current && isViewerValid(viewer)) {
      try {
        viewer.scene.primitives.remove(primitiveCollectionRef.current);
      } catch (e) {
        // Ignore cleanup errors - viewer may be destroyed
      }
    }
    primitiveCollectionRef.current = null;
  }, [viewer]);

  // Fetch TEC data with abort support
  const fetchTecData = useCallback(async () => {
    // Abort any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/noaa/tec?resolution=low', {
        signal: abortControllerRef.current.signal,
      });

      // Check if component is still mounted before processing
      if (!isMountedRef.current) return;

      if (response.ok) {
        const result: TecResponse = await response.json();

        // Check again after parsing JSON
        if (!isMountedRef.current) return;

        if (result.success) {
          setTecData(result);
          setError(null);
        }
      }
    } catch (err: any) {
      // Ignore abort errors
      if (err.name === 'AbortError') return;

      // Check if still mounted
      if (!isMountedRef.current) return;

      console.error('TEC fetch error:', err);
      setError(err.message);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Component mount/unmount tracking
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      // Set unmounted FIRST before any cleanup
      isMountedRef.current = false;

      // Abort any pending fetch
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Clean up primitives
      cleanupPrimitive();
    };
  }, [cleanupPrimitive]);

  // Render TEC grid when data changes
  useEffect(() => {
    // Early exit if component unmounted or viewer destroyed
    if (!isMountedRef.current) return;
    if (!isViewerValid(viewer) || !Cesium) return;

    if (!visible) {
      cleanupPrimitive();
      return;
    }

    if (!tecData?.data || tecData.data.length === 0) {
      return;
    }

    // Check again before any viewer operations
    if (!isMountedRef.current || !isViewerValid(viewer)) return;

    // Remove existing primitive collection
    cleanupPrimitive();

    // Double-check after cleanup
    if (!isMountedRef.current || !isViewerValid(viewer)) return;

    // Create new primitive collection for better performance
    const instances: any[] = [];

    // Use low resolution data - limit to ~500 points max for performance
    const dataToRender = tecData.data.slice(0, 500);

    // Determine grid spacing from data
    const gridSpacing = dataToRender.length > 300 ? 10 : 20;
    const halfGrid = gridSpacing / 2;

    for (const point of dataToRender) {
      // Check mounted state periodically during heavy loop
      if (!isMountedRef.current) return;

      // Normalize longitude from potential 0-360 to -180 to 180 range
      const normalizedLon = normalizeLon(point.lon);

      // Create rectangle for each grid point
      let west = normalizeLon(normalizedLon - halfGrid);
      let east = normalizeLon(normalizedLon + halfGrid);
      const south = Math.max(-90, point.lat - halfGrid);
      const north = Math.min(90, point.lat + halfGrid);

      // Validate coordinates are in valid range
      if (west < -180 || west > 180 || east < -180 || east > 180) {
        continue; // Skip invalid coordinates
      }

      // Skip rectangles that cross the antimeridian (west > east after normalization)
      if (west >= east) {
        continue;
      }

      // Skip invalid latitude ranges
      if (south >= north || south < -90 || north > 90) {
        continue;
      }

      const color = getTecColor(point.tec);

      instances.push(
        new Cesium.GeometryInstance({
          geometry: new Cesium.RectangleGeometry({
            rectangle: Cesium.Rectangle.fromDegrees(west, south, east, north),
            height: 0,
          }),
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(
              new Cesium.Color(color.r / 255, color.g / 255, color.b / 255, color.alpha)
            ),
          },
        })
      );
    }

    // Final check before adding to scene
    if (!isMountedRef.current || !isViewerValid(viewer)) return;

    // Create ground primitive for all rectangles
    const groundPrimitive = new Cesium.GroundPrimitive({
      geometryInstances: instances,
      appearance: new Cesium.PerInstanceColorAppearance({
        translucent: true,
        flat: true,
      }),
      asynchronous: true,
    });

    // Final check before adding
    if (!isMountedRef.current || !isViewerValid(viewer)) return;

    try {
      viewer.scene.primitives.add(groundPrimitive);
      primitiveCollectionRef.current = groundPrimitive;
    } catch (e) {
      // Viewer may have been destroyed between check and add
      console.warn('Failed to add TEC primitive:', e);
    }

    return () => {
      cleanupPrimitive();
    };
  }, [viewer, Cesium, tecData, visible, cleanupPrimitive]);

  // Fetch data on mount and refresh every 10 minutes
  useEffect(() => {
    fetchTecData();
    const interval = setInterval(() => {
      if (isMountedRef.current) {
        fetchTecData();
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(interval);
  }, [fetchTecData]);

  // Don't render legend if layer is not visible
  if (!visible) {
    return null;
  }

  // Get max TEC for display
  const maxTec = tecData?.data?.reduce((max, p) => Math.max(max, p.tec), 0) || 0;
  const dataLength = tecData?.data?.length || 1;
  const avgTec = (tecData?.data?.reduce((sum, p) => sum + p.tec, 0) || 0) / dataLength;

  // Determine current conditions
  const getConditionLabel = (tec: number): { label: string; color: string } => {
    if (tec < 20) return { label: 'Normal', color: 'text-green-400' };
    if (tec < 40) return { label: 'Elevated', color: 'text-yellow-400' };
    if (tec < 60) return { label: 'High', color: 'text-orange-400' };
    return { label: 'Extreme', color: 'text-red-400' };
  };

  const condition = getConditionLabel(maxTec);

  return (
    <div className="absolute top-[220px] left-4 z-20 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-3 min-w-[200px]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full bg-blue-500" />
        <div>
          <span className="text-sm font-semibold text-white">Total Electron Content</span>
          <span className="text-xs text-slate-500 ml-2">(GloTEC)</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
          Loading...
        </div>
      ) : error ? (
        <div className="text-red-400 text-sm">{error}</div>
      ) : (
        <>
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-400">Peak TEC</span>
              <span className={`text-sm font-bold ${condition.color}`}>
                {maxTec.toFixed(1)} TECU
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Average</span>
              <span className="text-sm text-slate-300">{avgTec.toFixed(1)} TECU</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-slate-400">Conditions</span>
              <span className={`text-sm font-medium ${condition.color}`}>{condition.label}</span>
            </div>
          </div>

          {/* Color Scale Legend */}
          <div className="space-y-1">
            <div className="text-xs text-slate-500 mb-1">TEC Scale (TECU)</div>
            <div
              className="h-3 rounded-sm"
              style={{
                background: `linear-gradient(to right,
                  rgb(${TEC_COLORS.normal.color.r}, ${TEC_COLORS.normal.color.g}, ${TEC_COLORS.normal.color.b}) 0%,
                  rgb(${TEC_COLORS.elevated.color.r}, ${TEC_COLORS.elevated.color.g}, ${TEC_COLORS.elevated.color.b}) 33%,
                  rgb(${TEC_COLORS.high.color.r}, ${TEC_COLORS.high.color.g}, ${TEC_COLORS.high.color.b}) 66%,
                  rgb(${TEC_COLORS.extreme.color.r}, ${TEC_COLORS.extreme.color.g}, ${TEC_COLORS.extreme.color.b}) 100%)`,
              }}
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>0</span>
              <span>20</span>
              <span>40</span>
              <span>60+</span>
            </div>
          </div>

          {/* Scale Labels */}
          <div className="mt-3 space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{
                  backgroundColor: `rgb(${TEC_COLORS.normal.color.r}, ${TEC_COLORS.normal.color.g}, ${TEC_COLORS.normal.color.b})`,
                }}
              />
              <span className="text-slate-400">0-20: Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{
                  backgroundColor: `rgb(${TEC_COLORS.elevated.color.r}, ${TEC_COLORS.elevated.color.g}, ${TEC_COLORS.elevated.color.b})`,
                }}
              />
              <span className="text-slate-400">20-40: Elevated</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{
                  backgroundColor: `rgb(${TEC_COLORS.high.color.r}, ${TEC_COLORS.high.color.g}, ${TEC_COLORS.high.color.b})`,
                }}
              />
              <span className="text-slate-400">40-60: High</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{
                  backgroundColor: `rgb(${TEC_COLORS.extreme.color.r}, ${TEC_COLORS.extreme.color.g}, ${TEC_COLORS.extreme.color.b})`,
                }}
              />
              <span className="text-slate-400">60+: Extreme (GPS issues)</span>
            </div>
          </div>

          {/* Data Source */}
          <div className="mt-3 pt-2 border-t border-slate-700">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Source</span>
              <span className="text-slate-400">NOAA GloTEC</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-slate-500">Data Points</span>
              <span className="text-slate-400">{tecData?.featureCount || tecData?.data?.length || '--'}</span>
            </div>
            <div className="text-xs text-slate-600 mt-1">Updates every 10 min</div>
          </div>
        </>
      )}
    </div>
  );
}
