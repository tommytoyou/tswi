'use client';

import { useEffect, useState, useCallback } from 'react';

interface KpAuroraLayerProps {
  viewer: any; // Cesium.Viewer
  Cesium: any; // Cesium module
}

interface AuroraBand {
  kpMin: number;
  kpMax: number;
  latitude: number;
  color: { r: number; g: number; b: number };
  label: string;
}

// Aurora visibility bands based on Kp index
const AURORA_BANDS: AuroraBand[] = [
  { kpMin: 0, kpMax: 1, latitude: 67, color: { r: 0, g: 100, b: 0 }, label: 'Barely Visible' },
  { kpMin: 2, kpMax: 3, latitude: 64, color: { r: 0, g: 180, b: 0 }, label: 'Visible' },
  { kpMin: 4, kpMax: 4, latitude: 60, color: { r: 255, g: 200, b: 0 }, label: 'Active' },
  { kpMin: 5, kpMax: 6, latitude: 55, color: { r: 255, g: 140, b: 0 }, label: 'Strong' },
  { kpMin: 7, kpMax: 8, latitude: 50, color: { r: 255, g: 50, b: 50 }, label: 'Severe' },
  { kpMin: 9, kpMax: 9, latitude: 45, color: { r: 139, g: 0, b: 0 }, label: 'Extreme' },
];

export function KpAuroraLayer({ viewer, Cesium }: KpAuroraLayerProps) {
  const [kpValue, setKpValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auroraEntities, setAuroraEntities] = useState<any[]>([]);

  const fetchKpData = useCallback(async () => {
    try {
      const response = await fetch('/api/noaa/kp-index');
      if (!response.ok) throw new Error('Failed to fetch Kp data');
      const result = await response.json();

      if (result.success && result.latest) {
        const kp = result.latest.kp || result.latest.kp_index || 0;
        setKpValue(kp);
        setError(null);
      }
    } catch (err: any) {
      console.error('Kp fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create aurora oval band at specified latitude for both hemispheres
  const createAuroraBand = useCallback(
    (latitude: number, color: { r: number; g: number; b: number }, isActive: boolean) => {
      if (!viewer || !Cesium) return [];

      const entities: any[] = [];
      const alpha = isActive ? 0.4 : 0.15;
      const bandWidth = isActive ? 5 : 3; // degrees

      // Create positions for an ellipse/oval shape
      // The aurora oval is not a perfect circle - it's offset toward the night side
      const createOvalPositions = (centerLat: number, hemisphere: 'north' | 'south') => {
        const positions: any[] = [];
        const latSign = hemisphere === 'north' ? 1 : -1;
        const baseLat = centerLat * latSign;

        // Create a slightly elliptical shape offset toward night side
        for (let lon = 0; lon <= 360; lon += 5) {
          // Vary latitude slightly to create oval effect (wider on night side)
          const lonRad = Cesium.Math.toRadians(lon);
          const latOffset = Math.sin(lonRad) * 3; // 3 degree variation
          const lat = baseLat + latOffset * latSign;

          positions.push(Cesium.Cartesian3.fromDegrees(lon - 180, lat));
        }

        return positions;
      };

      // Northern hemisphere aurora band
      const northPositions = createOvalPositions(latitude, 'north');
      const northEntity = viewer.entities.add({
        name: `Aurora Band ${latitude}°N`,
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(northPositions),
          material: new Cesium.ColorMaterialProperty(
            new Cesium.Color(color.r / 255, color.g / 255, color.b / 255, alpha)
          ),
          outline: true,
          outlineColor: new Cesium.Color(color.r / 255, color.g / 255, color.b / 255, alpha + 0.2),
          outlineWidth: 1,
          height: 100000, // 100km altitude (ionosphere)
          extrudedHeight: 100000 + bandWidth * 20000, // Band thickness
        },
      });
      entities.push(northEntity);

      // Create inner edge polygon for band effect (northern)
      const innerNorthPositions = createOvalPositions(latitude + bandWidth, 'north');
      const northInnerEntity = viewer.entities.add({
        name: `Aurora Band Inner ${latitude}°N`,
        polyline: {
          positions: innerNorthPositions,
          width: 2,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: new Cesium.Color(color.r / 255, color.g / 255, color.b / 255, alpha + 0.3),
          }),
          clampToGround: false,
        },
      });
      entities.push(northInnerEntity);

      // Southern hemisphere aurora band
      const southPositions = createOvalPositions(latitude, 'south');
      const southEntity = viewer.entities.add({
        name: `Aurora Band ${latitude}°S`,
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(southPositions),
          material: new Cesium.ColorMaterialProperty(
            new Cesium.Color(color.r / 255, color.g / 255, color.b / 255, alpha)
          ),
          outline: true,
          outlineColor: new Cesium.Color(color.r / 255, color.g / 255, color.b / 255, alpha + 0.2),
          outlineWidth: 1,
          height: 100000,
          extrudedHeight: 100000 + bandWidth * 20000,
        },
      });
      entities.push(southEntity);

      // Create inner edge polygon for band effect (southern)
      const innerSouthPositions = createOvalPositions(latitude + bandWidth, 'south');
      const southInnerEntity = viewer.entities.add({
        name: `Aurora Band Inner ${latitude}°S`,
        polyline: {
          positions: innerSouthPositions,
          width: 2,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: new Cesium.Color(color.r / 255, color.g / 255, color.b / 255, alpha + 0.3),
          }),
          clampToGround: false,
        },
      });
      entities.push(southInnerEntity);

      return entities;
    },
    [viewer, Cesium]
  );

  // Update aurora visualization when Kp changes
  useEffect(() => {
    if (!viewer || !Cesium || kpValue === null) return;

    // Remove existing aurora entities
    auroraEntities.forEach((entity) => {
      if (viewer.entities.contains(entity)) {
        viewer.entities.remove(entity);
      }
    });

    // Find the active band for current Kp
    const activeBand = AURORA_BANDS.find((band) => kpValue >= band.kpMin && kpValue <= band.kpMax);

    const newEntities: any[] = [];

    if (activeBand) {
      // Create the active aurora band with full visibility
      const activeEntities = createAuroraBand(activeBand.latitude, activeBand.color, true);
      newEntities.push(...activeEntities);

      // Create faded bands for lower activity levels (shows potential extent)
      AURORA_BANDS.filter((band) => band.latitude > activeBand.latitude).forEach((band) => {
        const fadedEntities = createAuroraBand(band.latitude, band.color, false);
        newEntities.push(...fadedEntities);
      });
    }

    setAuroraEntities(newEntities);

    // Cleanup on unmount
    return () => {
      newEntities.forEach((entity) => {
        if (viewer.entities.contains(entity)) {
          viewer.entities.remove(entity);
        }
      });
    };
  }, [viewer, Cesium, kpValue, createAuroraBand]);

  // Fetch Kp data on mount and set up refresh interval
  useEffect(() => {
    fetchKpData();
    const interval = setInterval(fetchKpData, 2 * 60 * 1000); // Refresh every 2 minutes
    return () => clearInterval(interval);
  }, [fetchKpData]);

  // Find current band info for legend
  const currentBand = kpValue !== null
    ? AURORA_BANDS.find((band) => kpValue >= band.kpMin && kpValue <= band.kpMax)
    : null;

  return (
    <div className="absolute top-4 left-4 z-20 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-3 min-w-[200px]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
        <span className="text-sm font-semibold text-white">Aurora / Kp Index</span>
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
            <div className="text-3xl font-bold text-white">
              {kpValue !== null ? kpValue.toFixed(1) : '--'}
            </div>
            {currentBand && (
              <div
                className="px-2 py-1 rounded text-xs font-medium text-white"
                style={{
                  backgroundColor: `rgb(${currentBand.color.r}, ${currentBand.color.g}, ${currentBand.color.b})`,
                }}
              >
                {currentBand.label}
              </div>
            )}
          </div>

          <div className="text-xs text-slate-400 mb-3">
            Aurora visible at {currentBand ? `${currentBand.latitude}°+` : '--'} latitude
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500 mb-1">Kp Scale:</div>
            {AURORA_BANDS.map((band) => (
              <div
                key={band.kpMin}
                className={`flex items-center gap-2 text-xs ${
                  currentBand?.kpMin === band.kpMin ? 'opacity-100' : 'opacity-50'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{
                    backgroundColor: `rgb(${band.color.r}, ${band.color.g}, ${band.color.b})`,
                  }}
                />
                <span className="text-slate-300">
                  {band.kpMin === band.kpMax ? `Kp ${band.kpMin}` : `Kp ${band.kpMin}-${band.kpMax}`}
                </span>
                <span className="text-slate-500">{band.latitude}°+</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
