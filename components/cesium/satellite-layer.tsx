'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import * as satellite from 'satellite.js';
import { checkRadiationZone } from './vulnerability-layer';

interface SatelliteLayerProps {
  viewer: any; // Cesium.Viewer
  Cesium: any; // Cesium module
  visible?: boolean;
  kpValue?: number;
  onDangerStatus?: (inDanger: number, zones: Map<string, string[]>) => void;
}

interface TLEData {
  name: string;
  line1: string;
  line2: string;
  noradId: string;
  type: 'station' | 'weather' | 'comms' | 'starlink';
}

interface SatellitePosition {
  name: string;
  noradId: string;
  type: TLEData['type'];
  latitude: number;
  longitude: number;
  altitude: number; // km
  velocity: number; // km/s
  satrec: satellite.SatRec;
  inDanger?: boolean;
  dangerZone?: string | null;
  dangerIntensity?: number;
}

interface SatellitesResponse {
  success: boolean;
  satellites: TLEData[];
  count: number;
  timestamp: string;
}

// Color scheme for satellite types
const SATELLITE_COLORS: Record<TLEData['type'], { r: number; g: number; b: number }> = {
  station: { r: 255, g: 215, b: 0 },    // Gold for ISS
  weather: { r: 34, g: 197, b: 94 },    // Green for weather
  comms: { r: 59, g: 130, b: 246 },     // Blue for comms
  starlink: { r: 168, g: 85, b: 247 },  // Purple for Starlink
};

// Calculate satellite position from TLE
function calculatePosition(satrec: satellite.SatRec, date: Date): {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
} | null {
  try {
    const positionAndVelocity = satellite.propagate(satrec, date);

    if (!positionAndVelocity || !positionAndVelocity.position || typeof positionAndVelocity.position === 'boolean') {
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
    const altitude = positionGd.height; // km

    // Calculate velocity magnitude
    const velocity = Math.sqrt(
      velocityEci.x ** 2 + velocityEci.y ** 2 + velocityEci.z ** 2
    );

    return { latitude, longitude, altitude, velocity };
  } catch {
    return null;
  }
}

// Generate orbit path points
function generateOrbitPath(
  satrec: satellite.SatRec,
  startDate: Date,
  periodMinutes: number,
  numPoints: number = 100
): { latitude: number; longitude: number; altitude: number }[] {
  const points: { latitude: number; longitude: number; altitude: number }[] = [];
  const stepMs = (periodMinutes * 60 * 1000) / numPoints;

  for (let i = 0; i < numPoints; i++) {
    const time = new Date(startDate.getTime() + i * stepMs);
    const pos = calculatePosition(satrec, time);
    if (pos) {
      points.push({
        latitude: pos.latitude,
        longitude: pos.longitude,
        altitude: pos.altitude,
      });
    }
  }

  return points;
}

// Warning color for satellites in radiation zones
const DANGER_COLOR = { r: 255, g: 50, b: 50 }; // Red

export function SatelliteLayer({ viewer, Cesium, visible = true, kpValue = 0, onDangerStatus }: SatelliteLayerProps) {
  const [satellites, setSatellites] = useState<SatellitePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSatellite, setSelectedSatellite] = useState<SatellitePosition | null>(null);
  const entitiesRef = useRef<any[]>([]);
  const orbitEntitiesRef = useRef<any[]>([]);
  const satrecsRef = useRef<Map<string, satellite.SatRec>>(new Map());
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch TLE data and initialize satrecs
  const fetchSatellites = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/satellites');

      if (!response.ok) {
        throw new Error('Failed to fetch satellite data');
      }

      const data: SatellitesResponse = await response.json();

      if (!data.success || !data.satellites) {
        throw new Error('Invalid satellite data');
      }

      // Parse TLE data and create satrecs
      const newSatrecs = new Map<string, satellite.SatRec>();
      const positions: SatellitePosition[] = [];
      const now = new Date();

      for (const sat of data.satellites) {
        try {
          const satrec = satellite.twoline2satrec(sat.line1, sat.line2);
          newSatrecs.set(sat.noradId, satrec);

          const pos = calculatePosition(satrec, now);
          if (pos) {
            const radiationCheck = checkRadiationZone(pos.latitude, pos.longitude, kpValue);
            positions.push({
              name: sat.name,
              noradId: sat.noradId,
              type: sat.type,
              latitude: pos.latitude,
              longitude: pos.longitude,
              altitude: pos.altitude,
              velocity: pos.velocity,
              satrec,
              inDanger: radiationCheck.inDanger,
              dangerZone: radiationCheck.zone,
              dangerIntensity: radiationCheck.intensity,
            });
          }
        } catch (e) {
          console.warn(`Failed to parse TLE for ${sat.name}:`, e);
        }
      }

      satrecsRef.current = newSatrecs;
      setSatellites(positions);
      setError(null);
    } catch (err: any) {
      console.error('Satellite fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update satellite positions
  const updatePositions = useCallback(() => {
    if (satrecsRef.current.size === 0) return;

    const now = new Date();
    const newPositions: SatellitePosition[] = [];

    satellites.forEach(sat => {
      const satrec = satrecsRef.current.get(sat.noradId);
      if (satrec) {
        const pos = calculatePosition(satrec, now);
        if (pos) {
          const radiationCheck = checkRadiationZone(pos.latitude, pos.longitude, kpValue);
          newPositions.push({
            ...sat,
            latitude: pos.latitude,
            longitude: pos.longitude,
            altitude: pos.altitude,
            velocity: pos.velocity,
            inDanger: radiationCheck.inDanger,
            dangerZone: radiationCheck.zone,
            dangerIntensity: radiationCheck.intensity,
          });
        }
      }
    });

    if (newPositions.length > 0) {
      setSatellites(newPositions);
    }
  }, [satellites, kpValue]);

  // Render satellites on the globe
  useEffect(() => {
    if (!viewer || !Cesium || !visible) {
      // Clean up entities if not visible
      entitiesRef.current.forEach(entity => {
        try {
          viewer?.entities?.remove(entity);
        } catch {
          // Ignore cleanup errors
        }
      });
      orbitEntitiesRef.current.forEach(entity => {
        try {
          viewer?.entities?.remove(entity);
        } catch {
          // Ignore cleanup errors
        }
      });
      entitiesRef.current = [];
      orbitEntitiesRef.current = [];
      return;
    }

    if (satellites.length === 0) return;

    // Remove existing entities
    entitiesRef.current.forEach(entity => {
      try {
        viewer.entities.remove(entity);
      } catch {
        // Ignore cleanup errors
      }
    });
    orbitEntitiesRef.current.forEach(entity => {
      try {
        viewer.entities.remove(entity);
      } catch {
        // Ignore cleanup errors
      }
    });
    entitiesRef.current = [];
    orbitEntitiesRef.current = [];

    // Add satellite entities
    satellites.forEach(sat => {
      // Use danger color if satellite is in a radiation zone
      const baseColor = sat.inDanger ? DANGER_COLOR : SATELLITE_COLORS[sat.type];
      const cesiumColor = new Cesium.Color(baseColor.r / 255, baseColor.g / 255, baseColor.b / 255, 1.0);

      // Build label text - add danger zone indicator
      let labelText = sat.name;
      if (sat.inDanger && sat.dangerZone) {
        labelText = `⚠️ ${sat.name}\n[${sat.dangerZone === 'SAA' ? 'In SAA' : 'High Radiation'}]`;
      }

      // Create satellite point
      const entity = viewer.entities.add({
        name: sat.name,
        position: Cesium.Cartesian3.fromDegrees(
          sat.longitude,
          sat.latitude,
          sat.altitude * 1000 // Convert km to meters
        ),
        point: {
          pixelSize: sat.inDanger ? 14 : (sat.type === 'station' ? 12 : 8),
          color: cesiumColor,
          outlineColor: sat.inDanger ? Cesium.Color.YELLOW : Cesium.Color.WHITE,
          outlineWidth: sat.inDanger ? 3 : 2,
          scaleByDistance: new Cesium.NearFarScalar(1e6, 1.5, 1e8, 0.5),
        },
        label: {
          text: labelText,
          font: sat.inDanger ? '13px sans-serif' : '12px sans-serif',
          fillColor: sat.inDanger ? Cesium.Color.YELLOW : Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -15),
          scaleByDistance: new Cesium.NearFarScalar(1e6, 1.0, 1e8, 0.3),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5e7),
        },
        properties: {
          noradId: sat.noradId,
          type: sat.type,
          altitude: sat.altitude,
          velocity: sat.velocity,
          inDanger: sat.inDanger,
          dangerZone: sat.dangerZone,
        },
      });

      entitiesRef.current.push(entity);

      // Generate and draw orbit path
      try {
        // Estimate orbital period from altitude (rough approximation)
        const earthRadius = 6371; // km
        const semiMajorAxis = earthRadius + sat.altitude;
        const periodMinutes = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / 398600.4418) / 60;

        const orbitPath = generateOrbitPath(sat.satrec, new Date(), periodMinutes, 120);

        if (orbitPath.length > 10) {
          const positions = orbitPath.map(p =>
            Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, p.altitude * 1000)
          );

          const orbitEntity = viewer.entities.add({
            polyline: {
              positions,
              width: 1.5,
              material: new Cesium.Color(baseColor.r / 255, baseColor.g / 255, baseColor.b / 255, 0.4),
              clampToGround: false,
            },
          });

          orbitEntitiesRef.current.push(orbitEntity);
        }
      } catch {
        // Orbit generation failed, skip
      }
    });

    // Set up click handler for satellite details
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: any) => {
      const pickedObject = viewer.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && pickedObject.id?.properties) {
        const props = pickedObject.id.properties;
        const noradId = props.noradId?.getValue();
        const sat = satellites.find(s => s.noradId === noradId);
        if (sat) {
          setSelectedSatellite(sat);
        }
      } else {
        setSelectedSatellite(null);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
      entitiesRef.current.forEach(entity => {
        try {
          viewer.entities.remove(entity);
        } catch {
          // Ignore cleanup errors
        }
      });
      orbitEntitiesRef.current.forEach(entity => {
        try {
          viewer.entities.remove(entity);
        } catch {
          // Ignore cleanup errors
        }
      });
      entitiesRef.current = [];
      orbitEntitiesRef.current = [];
    };
  }, [viewer, Cesium, satellites, visible]);

  // Fetch data on mount
  useEffect(() => {
    fetchSatellites();
  }, [fetchSatellites]);

  // Set up position update interval (every 30 seconds)
  useEffect(() => {
    if (!visible) {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      return;
    }

    updateIntervalRef.current = setInterval(updatePositions, 30000);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, [visible, updatePositions]);

  // Don't render UI if layer is not visible
  if (!visible) {
    return null;
  }

  const getTypeLabel = (type: TLEData['type']): string => {
    switch (type) {
      case 'station':
        return 'Space Station';
      case 'weather':
        return 'Weather';
      case 'comms':
        return 'Communications';
      case 'starlink':
        return 'Starlink';
      default:
        return 'Unknown';
    }
  };

  return (
    <>
      {/* Satellite Legend */}
      <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-3 min-w-[180px]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-sm font-semibold text-white">Satellites</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500" />
            Loading...
          </div>
        ) : error ? (
          <div className="text-red-400 text-sm">{error}</div>
        ) : (
          <>
            <div className="text-xs text-slate-400 mb-2">
              Tracking {satellites.length} satellites
            </div>

            {/* Danger Status */}
            {(() => {
              const dangerSats = satellites.filter(s => s.inDanger);
              const inSAA = dangerSats.filter(s => s.dangerZone === 'SAA').length;
              const inPolar = dangerSats.length - inSAA;

              if (dangerSats.length > 0) {
                return (
                  <div className="bg-red-900/50 border border-red-600 rounded px-2 py-1.5 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-red-400 text-lg">⚠️</span>
                      <span className="text-xs text-red-300 font-medium">
                        {dangerSats.length} in radiation zones
                      </span>
                    </div>
                    <div className="text-xs text-red-400 mt-1">
                      {inSAA > 0 && <span>SAA: {inSAA}</span>}
                      {inSAA > 0 && inPolar > 0 && <span> • </span>}
                      {inPolar > 0 && <span>Polar: {inPolar}</span>}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Type Legend */}
            <div className="space-y-1.5">
              {Object.entries(SATELLITE_COLORS).map(([type, color]) => {
                const count = satellites.filter(s => s.type === type).length;
                if (count === 0) return null;
                return (
                  <div key={type} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
                    />
                    <span className="text-xs text-slate-300">
                      {getTypeLabel(type as TLEData['type'])} ({count})
                    </span>
                  </div>
                );
              })}
              {/* Danger indicator in legend */}
              {satellites.some(s => s.inDanger) && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: `rgb(${DANGER_COLOR.r}, ${DANGER_COLOR.g}, ${DANGER_COLOR.b})` }}
                  />
                  <span className="text-xs text-slate-300">In Radiation Zone</span>
                </div>
              )}
            </div>

            <div className="mt-3 pt-2 border-t border-slate-700">
              <div className="text-xs text-slate-500">Updates every 30s</div>
            </div>
          </>
        )}
      </div>

      {/* Selected Satellite Details */}
      {selectedSatellite && (
        <div className={`absolute bottom-52 left-4 z-20 bg-slate-900/95 backdrop-blur-sm rounded-lg border ${selectedSatellite.inDanger ? 'border-red-600' : 'border-slate-700'} p-4 min-w-[240px]`}>
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                {selectedSatellite.inDanger && <span className="text-red-400">⚠️ </span>}
                {selectedSatellite.name}
              </h3>
              <p className="text-xs text-slate-400">
                {getTypeLabel(selectedSatellite.type)} • NORAD {selectedSatellite.noradId}
              </p>
            </div>
            <button
              onClick={() => setSelectedSatellite(null)}
              className="text-slate-400 hover:text-white text-lg leading-none"
            >
              ×
            </button>
          </div>

          {/* Radiation Warning */}
          {selectedSatellite.inDanger && selectedSatellite.dangerZone && (
            <div className="bg-red-900/50 border border-red-600 rounded px-2 py-1.5 mb-3">
              <div className="text-xs text-red-300 font-medium">
                {selectedSatellite.dangerZone === 'SAA' ? 'In South Atlantic Anomaly' : `In ${selectedSatellite.dangerZone} Radiation`}
              </div>
              <div className="text-xs text-red-400">
                Radiation intensity: {((selectedSatellite.dangerIntensity || 0) * 100).toFixed(0)}%
              </div>
            </div>
          )}

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Altitude</span>
              <span className="text-white font-mono">
                {selectedSatellite.altitude.toFixed(1)} km
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Velocity</span>
              <span className="text-white font-mono">
                {selectedSatellite.velocity.toFixed(2)} km/s
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Latitude</span>
              <span className="text-white font-mono">
                {selectedSatellite.latitude.toFixed(4)}°
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Longitude</span>
              <span className="text-white font-mono">
                {selectedSatellite.longitude.toFixed(4)}°
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Radiation Status</span>
              <span className={`font-mono ${selectedSatellite.inDanger ? 'text-red-400' : 'text-green-400'}`}>
                {selectedSatellite.inDanger ? 'EXPOSED' : 'Safe'}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
