'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { CollapsibleInfoBox } from './collapsible-info-box';

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

// Color gradient for aurora probability - VIBRANT colors matching NOAA
// Returns RGBA values based on probability (0-100)
function getAuroraColor(probability: number): { r: number; g: number; b: number; a: number } {
  if (probability < 5) {
    return { r: 0, g: 0, b: 0, a: 0 }; // Transparent
  } else if (probability < 15) {
    // Bright blue
    return { r: 0, g: 100, b: 255, a: 0.5 };
  } else if (probability < 30) {
    // Blue-green (cyan)
    return { r: 0, g: 200, b: 200, a: 0.6 };
  } else if (probability < 50) {
    // Bright green
    return { r: 0, g: 255, b: 100, a: 0.7 };
  } else if (probability < 70) {
    // Green-yellow
    return { r: 150, g: 255, b: 0, a: 0.8 };
  } else {
    // Yellow-red (intense)
    return { r: 255, g: 200, b: 0, a: 0.9 };
  }
}

// Get glow layer color (slightly different for bloom effect)
function getGlowColor(probability: number, layer: number): { r: number; g: number; b: number; a: number } {
  const baseColor = getAuroraColor(probability);
  // Each layer is more transparent and slightly larger
  const alphaMultiplier = 1 - (layer * 0.25);
  return {
    r: Math.min(255, baseColor.r + 30),
    g: Math.min(255, baseColor.g + 30),
    b: Math.min(255, baseColor.b + 30),
    a: baseColor.a * alphaMultiplier * 0.4
  };
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

    // Use larger cells (5 degrees) for smoother appearance
    const cellSize = 5;
    const cells = groupPointsIntoCells(coordinates, cellSize);

    // Number of glow layers for bloom effect
    const glowLayers = 3;
    const baseAltitude = 110000; // Aurora altitude ~110km

    // Render multiple layers for glow/bloom effect (outer layers first)
    for (let layer = glowLayers - 1; layer >= 0; layer--) {
      const altitudeOffset = layer * 5000; // Each layer slightly higher
      const sizeExpansion = layer * 0.5; // Each outer layer slightly larger

      cells.forEach((points, key) => {
        const [latStr, lonStr] = key.split(',');
        const cellLat = parseFloat(latStr);
        const cellLon = parseFloat(lonStr);
        const avgProbability = getCellAverage(points);

        if (avgProbability < 5) return; // Skip low probability cells

        // For outer glow layers, only render higher probability areas
        if (layer > 0 && avgProbability < 15) return;

        const color = layer === 0
          ? getAuroraColor(avgProbability)
          : getGlowColor(avgProbability, layer);

        // Skip if color is essentially transparent
        if (color.a < 0.05) return;

        // Normalize longitude from 0-360 to -180 to 180 for Cesium
        // Expand cells slightly for outer glow layers
        const westLon = normalizeLongitude(cellLon - sizeExpansion);
        const eastLon = normalizeLongitude(cellLon + cellSize + sizeExpansion);
        const southLat = cellLat - sizeExpansion;
        const northLat = cellLat + cellSize + sizeExpansion;

        // Skip cells that cross the antimeridian (would have west > east)
        if (westLon > eastLon) return;

        // Create rectangle for this cell
        const entity = viewer.entities.add({
          name: `Aurora Cell ${cellLat},${cellLon} L${layer}`,
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
        newEntities.push(entity);
      });
    }

    // Add glowing edge polylines for high-probability aurora regions
    // Find contours of high aurora probability
    const highProbPoints = coordinates.filter((p) => p.Aurora >= 25);
    if (highProbPoints.length > 0) {
      // Group by latitude bands for edge detection
      const latBands = new Map<number, AuroraDataPoint[]>();
      highProbPoints.forEach((p) => {
        const band = Math.round(p.Latitude / 3) * 3; // Larger bands for smoother lines
        if (!latBands.has(band)) latBands.set(band, []);
        latBands.get(band)!.push(p);
      });

      // Create multiple glow polylines along the aurora edge for bloom effect
      latBands.forEach((points, lat) => {
        if (points.length < 5) return;

        // Normalize longitudes and sort to create a path
        const normalized = points.map((p) => ({
          ...p,
          Longitude: normalizeLongitude(p.Longitude),
        }));
        const sorted = [...normalized].sort((a, b) => a.Longitude - b.Longitude);

        const avgProb = getCellAverage(sorted);
        const glowColor = getAuroraColor(avgProb);

        // Create multiple polyline layers for enhanced glow
        for (let glowLayer = 0; glowLayer < 3; glowLayer++) {
          const layerAltitude = 115000 + (glowLayer * 3000);
          const positions = sorted.map((p) =>
            Cesium.Cartesian3.fromDegrees(p.Longitude, p.Latitude, layerAltitude)
          );

          if (positions.length > 2) {
            const glowPower = 0.5 - (glowLayer * 0.1);
            const lineWidth = Math.max(3, avgProb / 10) - glowLayer;
            const alpha = Math.min(0.9, glowColor.a + 0.3) - (glowLayer * 0.2);

            const glowEntity = viewer.entities.add({
              name: `Aurora Edge ${lat} L${glowLayer}`,
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
            newEntities.push(glowEntity);
          }
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
    <CollapsibleInfoBox
      title="Aurora Forecast"
      subtitle="OVATION"
      indicatorColor="#4ade80"
      indicatorPulse={true}
      defaultCollapsed={true}
      className="absolute top-4 left-4 z-20 min-w-[200px]"
    >
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
                    'linear-gradient(to right, transparent 0%, rgb(0,100,255) 15%, rgb(0,200,200) 30%, rgb(0,255,100) 50%, rgb(150,255,0) 70%, rgb(255,200,0) 100%)',
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
    </CollapsibleInfoBox>
  );
}
