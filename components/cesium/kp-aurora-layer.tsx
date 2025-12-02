'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface KpAuroraLayerProps {
  viewer: any; // Cesium.Viewer
  Cesium: any; // Cesium module
}

interface AuroraDataPoint {
  Longitude: number;
  Latitude: number;
  Aurora: number; // 0-100 probability
}

interface AuroraData {
  observation_time: string;
  forecast_time: string;
  coordinates: AuroraDataPoint[];
  count: number;
}

// Color gradient for aurora probability
// Returns RGBA values based on probability (0-100)
function getAuroraColor(probability: number): { r: number; g: number; b: number; a: number } {
  if (probability < 5) {
    return { r: 0, g: 0, b: 0, a: 0 }; // Transparent
  } else if (probability < 15) {
    // Dim green
    return { r: 0, g: 80, b: 40, a: 0.2 };
  } else if (probability < 30) {
    // Green
    return { r: 0, g: 140, b: 60, a: 0.35 };
  } else if (probability < 50) {
    // Brighter green
    return { r: 50, g: 200, b: 80, a: 0.5 };
  } else if (probability < 70) {
    // Green-yellow
    return { r: 150, g: 230, b: 100, a: 0.6 };
  } else if (probability < 85) {
    // Bright green-white
    return { r: 180, g: 255, b: 150, a: 0.7 };
  } else {
    // Intense white-green
    return { r: 220, g: 255, b: 220, a: 0.85 };
  }
}

// Group nearby points into cells for efficient rendering
function groupPointsIntoCells(
  points: AuroraDataPoint[],
  cellSize: number = 5
): Map<string, AuroraDataPoint[]> {
  const cells = new Map<string, AuroraDataPoint[]>();

  for (const point of points) {
    // Create cell key based on rounded lat/lon
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

export function KpAuroraLayer({ viewer, Cesium }: KpAuroraLayerProps) {
  const [auroraData, setAuroraData] = useState<AuroraData | null>(null);
  const [kpValue, setKpValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const entitiesRef = useRef<any[]>([]);
  const primitiveCollectionRef = useRef<any>(null);

  // Fetch OVATION aurora data
  const fetchAuroraData = useCallback(async () => {
    try {
      // Fetch both aurora data and Kp index in parallel
      const [auroraRes, kpRes] = await Promise.all([
        fetch('/api/noaa/aurora?fetch=latest&minProbability=5'),
        fetch('/api/noaa/kp-index'),
      ]);

      if (auroraRes.ok) {
        const auroraResult = await auroraRes.json();
        if (auroraResult.success) {
          setAuroraData(auroraResult);
          setError(null);
        }
      }

      if (kpRes.ok) {
        const kpResult = await kpRes.json();
        if (kpResult.success && kpResult.latest) {
          setKpValue(kpResult.latest.kp || kpResult.latest.kp_index || 0);
        }
      }
    } catch (err: any) {
      console.error('Aurora fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Render aurora heatmap when data changes
  useEffect(() => {
    if (!viewer || !Cesium || !auroraData) return;

    // Remove existing entities
    entitiesRef.current.forEach((entity) => {
      if (viewer.entities.contains(entity)) {
        viewer.entities.remove(entity);
      }
    });
    entitiesRef.current = [];

    // Remove existing primitive collection
    if (primitiveCollectionRef.current) {
      viewer.scene.primitives.remove(primitiveCollectionRef.current);
      primitiveCollectionRef.current = null;
    }

    const newEntities: any[] = [];
    const coordinates = auroraData.coordinates || [];

    if (coordinates.length === 0) return;

    // Group points into cells for more efficient rendering
    const cellSize = 3; // 3-degree cells
    const cells = groupPointsIntoCells(coordinates, cellSize);

    // Create a primitive collection for better performance
    const instances: any[] = [];

    cells.forEach((points, key) => {
      const [latStr, lonStr] = key.split(',');
      const cellLat = parseFloat(latStr);
      const cellLon = parseFloat(lonStr);
      const avgProbability = getCellAverage(points);

      if (avgProbability < 5) return; // Skip low probability cells

      const color = getAuroraColor(avgProbability);

      // Normalize longitude from 0-360 to -180 to 180 for Cesium
      const westLon = normalizeLongitude(cellLon);
      const eastLon = normalizeLongitude(cellLon + cellSize);

      // Skip cells that cross the antimeridian (would have west > east)
      if (westLon > eastLon) return;

      // Create rectangle for this cell
      const entity = viewer.entities.add({
        name: `Aurora Cell ${cellLat},${cellLon}`,
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(
            westLon,
            cellLat,
            eastLon,
            cellLat + cellSize
          ),
          material: new Cesium.ColorMaterialProperty(
            new Cesium.Color(color.r / 255, color.g / 255, color.b / 255, color.a)
          ),
          height: 110000, // Aurora altitude ~110km
          outline: false,
        },
      });
      newEntities.push(entity);
    });

    // Add glowing edge polylines for high-probability aurora regions
    // Find contours of high aurora probability
    const highProbPoints = coordinates.filter((p) => p.Aurora >= 30);
    if (highProbPoints.length > 0) {
      // Group by latitude bands for edge detection
      const latBands = new Map<number, AuroraDataPoint[]>();
      highProbPoints.forEach((p) => {
        const band = Math.round(p.Latitude / 2) * 2;
        if (!latBands.has(band)) latBands.set(band, []);
        latBands.get(band)!.push(p);
      });

      // Create glow polylines along the aurora edge
      latBands.forEach((points, lat) => {
        if (points.length < 5) return;

        // Normalize longitudes and sort to create a path
        const normalized = points.map((p) => ({
          ...p,
          Longitude: normalizeLongitude(p.Longitude),
        }));
        const sorted = [...normalized].sort((a, b) => a.Longitude - b.Longitude);

        // Find the outer edge (equatorward)
        const positions = sorted.map((p) =>
          Cesium.Cartesian3.fromDegrees(p.Longitude, p.Latitude, 115000)
        );

        if (positions.length > 2) {
          const avgProb = getCellAverage(sorted);
          const glowColor = getAuroraColor(avgProb);

          const glowEntity = viewer.entities.add({
            name: `Aurora Edge ${lat}`,
            polyline: {
              positions: positions,
              width: Math.max(2, avgProb / 20),
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.3,
                color: new Cesium.Color(
                  glowColor.r / 255,
                  glowColor.g / 255,
                  glowColor.b / 255,
                  Math.min(0.8, glowColor.a + 0.2)
                ),
              }),
              clampToGround: false,
            },
          });
          newEntities.push(glowEntity);
        }
      });
    }

    entitiesRef.current = newEntities;

    return () => {
      newEntities.forEach((entity) => {
        if (viewer.entities.contains(entity)) {
          viewer.entities.remove(entity);
        }
      });
    };
  }, [viewer, Cesium, auroraData]);

  // Fetch data on mount and refresh periodically
  useEffect(() => {
    fetchAuroraData();
    // OVATION updates every 5 minutes
    const interval = setInterval(fetchAuroraData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAuroraData]);

  // Format time for display
  const formatTime = (timeStr: string | undefined) => {
    if (!timeStr) return '--';
    try {
      return new Date(timeStr).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '--';
    }
  };

  // Calculate max probability in current data
  const maxProbability = auroraData?.coordinates
    ? Math.max(...auroraData.coordinates.map((p) => p.Aurora), 0)
    : 0;

  // Get activity level description
  const getActivityLevel = (prob: number) => {
    if (prob < 20) return { label: 'Quiet', color: 'bg-green-900' };
    if (prob < 40) return { label: 'Minor', color: 'bg-green-600' };
    if (prob < 60) return { label: 'Moderate', color: 'bg-yellow-500' };
    if (prob < 80) return { label: 'Active', color: 'bg-orange-500' };
    return { label: 'Intense', color: 'bg-red-500' };
  };

  const activity = getActivityLevel(maxProbability);

  return (
    <div className="absolute top-4 left-4 z-20 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-3 min-w-[220px]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
        <span className="text-sm font-semibold text-white">OVATION Aurora Forecast</span>
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
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl font-bold text-white">{maxProbability.toFixed(0)}%</div>
            <div className="flex flex-col">
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium text-white ${activity.color}`}
              >
                {activity.label}
              </span>
              {kpValue !== null && (
                <span className="text-xs text-slate-400 mt-1">Kp {kpValue.toFixed(1)}</span>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-400 mb-3">
            <div>Max aurora probability</div>
            <div className="text-slate-500">
              Updated: {formatTime(auroraData?.observation_time)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500 mb-1">Probability Scale:</div>
            <div className="flex items-center gap-1">
              <div
                className="flex-1 h-3 rounded-sm"
                style={{
                  background:
                    'linear-gradient(to right, transparent 0%, rgb(0,80,40) 15%, rgb(0,140,60) 30%, rgb(50,200,80) 50%, rgb(150,230,100) 70%, rgb(220,255,220) 100%)',
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-700">
            <div className="text-xs text-slate-500">
              Data points: {auroraData?.count || 0}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
