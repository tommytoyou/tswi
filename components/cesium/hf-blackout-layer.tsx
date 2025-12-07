'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { CollapsibleInfoBox } from './collapsible-info-box';

interface HfBlackoutLayerProps {
  viewer: any; // Cesium.Viewer
  Cesium: any; // Cesium module
  visible?: boolean;
}

interface XrayFluxData {
  ts: string;
  flux: number;
  satellite: number;
}

interface FluxResponse {
  success: boolean;
  latest: XrayFluxData | null;
  flareClass: string | null;
}

// Flare class thresholds and display settings
// Only M-class and above cause significant HF radio blackouts
// C-class (R0) does not cause significant blackouts - no overlay shown
const FLARE_CONFIG = {
  'X-class': {
    color: { r: 255, g: 50, b: 50 },
    alpha: 0.35,
    label: 'Severe Blackout',
    description: 'HF Radio Blackout on sunlit side',
    severity: 'R3-R5',
  },
  'M-class': {
    color: { r: 255, g: 150, b: 50 },
    alpha: 0.25,
    label: 'Moderate Blackout',
    description: 'HF Radio degraded on sunlit side',
    severity: 'R1-R2',
  },
};

type FlareClass = keyof typeof FLARE_CONFIG;

function isActiveFlare(flareClass: string | null | undefined): flareClass is FlareClass {
  return flareClass !== null && flareClass !== undefined && flareClass in FLARE_CONFIG;
}

// Calculate subsolar point (point where sun is directly overhead)
function getSubsolarPoint(date: Date): { lat: number; lon: number } {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );

  // Solar declination (approximate)
  const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));

  // Hour angle based on UTC time
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const longitude = (12 - hours) * 15; // 15 degrees per hour

  return {
    lat: declination,
    lon: longitude,
  };
}

export function HfBlackoutLayer({ viewer, Cesium, visible = true }: HfBlackoutLayerProps) {
  const [fluxData, setFluxData] = useState<FluxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const entitiesRef = useRef<any[]>([]);

  // Fetch X-ray flux data
  const fetchFluxData = useCallback(async () => {
    try {
      const response = await fetch('/api/noaa/xray-flux?fetch=latest');

      if (response.ok) {
        const result: FluxResponse = await response.json();
        if (result.success) {
          setFluxData(result);
          setError(null);
        }
      }
    } catch (err: any) {
      console.error('X-ray flux fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Render the blackout zone when data changes
  useEffect(() => {
    if (!viewer || !Cesium || !visible) {
      // Clean up if not visible
      entitiesRef.current.forEach((entity) => {
        if (viewer?.entities?.contains(entity)) {
          viewer.entities.remove(entity);
        }
      });
      entitiesRef.current = [];
      return;
    }

    // Remove existing entities
    entitiesRef.current.forEach((entity) => {
      if (viewer.entities.contains(entity)) {
        viewer.entities.remove(entity);
      }
    });
    entitiesRef.current = [];

    const flareClass = fluxData?.flareClass;

    // Only show blackout zone for C, M, or X class flares
    if (!isActiveFlare(flareClass)) {
      return;
    }

    const config = FLARE_CONFIG[flareClass];
    const newEntities: any[] = [];

    // Get the current subsolar point
    const now = new Date();
    const subsolar = getSubsolarPoint(now);

    // Create a hemisphere (day side) visualization
    // We'll create a series of overlapping polygons to approximate the sunlit hemisphere

    // Method: Create a large ellipse centered on the subsolar point
    // The day side is approximately a circle of 90 degrees radius from the subsolar point

    const numSegments = 72; // Number of segments for smooth circle
    const positions: any[] = [];

    for (let i = 0; i <= numSegments; i++) {
      const angle = (i / numSegments) * 2 * Math.PI;
      // Great circle points 90 degrees from subsolar point
      const lat = Math.asin(
        Math.sin(subsolar.lat * Math.PI / 180) * Math.cos(Math.PI / 2) +
        Math.cos(subsolar.lat * Math.PI / 180) * Math.sin(Math.PI / 2) * Math.cos(angle)
      ) * 180 / Math.PI;

      const lon = subsolar.lon + Math.atan2(
        Math.sin(angle) * Math.sin(Math.PI / 2) * Math.cos(subsolar.lat * Math.PI / 180),
        Math.cos(Math.PI / 2) - Math.sin(subsolar.lat * Math.PI / 180) * Math.sin(lat * Math.PI / 180)
      ) * 180 / Math.PI;

      // Normalize longitude to -180 to 180
      let normalizedLon = lon;
      while (normalizedLon > 180) normalizedLon -= 360;
      while (normalizedLon < -180) normalizedLon += 360;

      positions.push(Cesium.Cartesian3.fromDegrees(normalizedLon, lat, 0));
    }

    // Create the main blackout zone polygon
    const blackoutEntity = viewer.entities.add({
      name: 'HF Radio Blackout Zone',
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: new Cesium.ColorMaterialProperty(
          new Cesium.Color(
            config.color.r / 255,
            config.color.g / 255,
            config.color.b / 255,
            config.alpha
          )
        ),
        height: 0,
        outline: true,
        outlineColor: new Cesium.Color(
          config.color.r / 255,
          config.color.g / 255,
          config.color.b / 255,
          0.8
        ),
        outlineWidth: 2,
      },
    });
    newEntities.push(blackoutEntity);

    // Add a marker at the subsolar point
    const subsolarMarker = viewer.entities.add({
      name: 'Subsolar Point',
      position: Cesium.Cartesian3.fromDegrees(subsolar.lon, subsolar.lat, 0),
      point: {
        pixelSize: 12,
        color: new Cesium.Color(1, 1, 0, 0.9),
        outlineColor: new Cesium.Color(1, 0.5, 0, 1),
        outlineWidth: 2,
      },
      label: {
        text: '☀',
        font: '24px sans-serif',
        fillColor: Cesium.Color.YELLOW,
        style: Cesium.LabelStyle.FILL,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -10),
      },
    });
    newEntities.push(subsolarMarker);

    entitiesRef.current = newEntities;

    return () => {
      newEntities.forEach((entity) => {
        if (viewer.entities.contains(entity)) {
          viewer.entities.remove(entity);
        }
      });
    };
  }, [viewer, Cesium, fluxData, visible]);

  // Update subsolar point periodically (every minute)
  useEffect(() => {
    if (!viewer || !Cesium || !visible || !isActiveFlare(fluxData?.flareClass)) {
      return;
    }

    const updateInterval = setInterval(() => {
      // Force re-render by triggering state update
      setFluxData((prev) => (prev ? { ...prev } : null));
    }, 60000); // Update every minute

    return () => clearInterval(updateInterval);
  }, [viewer, Cesium, visible, fluxData?.flareClass]);

  // Fetch data on mount and refresh periodically
  useEffect(() => {
    fetchFluxData();
    // X-ray data updates every minute
    const interval = setInterval(fetchFluxData, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchFluxData]);

  // Don't render status panel if layer is not visible
  if (!visible) {
    return null;
  }

  // Format flux value for display
  const formatFlux = (flux: number | undefined) => {
    if (!flux) return '--';
    return flux.toExponential(2);
  };

  const flareClass = fluxData?.flareClass;
  const isActive = isActiveFlare(flareClass);
  const config = isActive ? FLARE_CONFIG[flareClass] : null;

  return (
    <CollapsibleInfoBox
      title="HF Radio Blackout"
      indicatorColor={isActive ? `rgb(${config!.color.r}, ${config!.color.g}, ${config!.color.b})` : '#22c55e'}
      indicatorPulse={isActive}
      defaultCollapsed={true}
      className="absolute top-4 right-4 z-20 min-w-[220px]"
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
          {isActive && config ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="text-2xl font-bold"
                  style={{
                    color: `rgb(${config.color.r}, ${config.color.g}, ${config.color.b})`,
                  }}
                >
                  {flareClass}
                </div>
                <div className="flex flex-col">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium text-white"
                    style={{
                      backgroundColor: `rgb(${config.color.r}, ${config.color.g}, ${config.color.b})`,
                    }}
                  >
                    {config.label}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">{config.severity}</span>
                </div>
              </div>

              <div className="text-xs text-slate-400 mb-3">
                <div>{config.description}</div>
                <div className="text-slate-500 mt-1">
                  X-ray Flux: {formatFlux(fluxData?.latest?.flux)} W/m²
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-slate-500 mb-1">Severity Scale:</div>
                <div className="flex items-center gap-1">
                  <div
                    className="flex-1 h-3 rounded-sm"
                    style={{
                      background:
                        'linear-gradient(to right, rgb(255,150,50) 0%, rgb(255,50,50) 100%)',
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>M</span>
                  <span>X</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-2">
              <div className="text-green-400 text-lg font-semibold mb-1">No HF Blackout</div>
              <div className="text-xs text-slate-400">
                X-ray flux: {formatFlux(fluxData?.latest?.flux)} W/m²
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {fluxData?.flareClass || 'Background'} levels
              </div>
            </div>
          )}

          <div className="mt-3 pt-2 border-t border-slate-700">
            <div className="text-xs text-slate-500">
              GOES Satellite {fluxData?.latest?.satellite || '--'}
            </div>
          </div>
        </>
      )}
    </CollapsibleInfoBox>
  );
}
