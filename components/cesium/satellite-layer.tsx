'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import * as satellite from 'satellite.js';
import { checkRadiationZone } from './vulnerability-layer';
import { CollapsibleInfoBox } from './collapsible-info-box';

interface SatelliteLayerProps {
  viewer: any; // Cesium.Viewer
  Cesium: any; // Cesium module
  visible?: boolean;
  kpValue?: number;
  onDangerStatus?: (inDanger: number, zones: Map<string, string[]>) => void;
}

// Constellation types
type ConstellationType = 'station' | 'starlink' | 'iridium' | 'noaa' | 'goes' | 'gps' | 'science' | 'military';

interface TLEData {
  name: string;
  line1: string;
  line2: string;
  noradId: string;
  type: ConstellationType;
  orbitalPlane?: string;
}

interface OrbitalPlaneData {
  id: string;
  inclination: number;
  raan: number;
  satelliteCount: number;
  representative: {
    name: string;
    noradId: string;
    line1: string;
    line2: string;
  };
}

interface SatellitePosition {
  name: string;
  noradId: string;
  type: ConstellationType;
  latitude: number;
  longitude: number;
  altitude: number; // km
  velocity: number; // km/s
  satrec: satellite.SatRec;
  inDanger?: boolean;
  dangerZone?: string | null;
  dangerIntensity?: number;
  orbitalPlane?: string;
  isOrbitalPlaneRep?: boolean;
}

interface SatellitesResponse {
  success: boolean;
  satellites: TLEData[];
  count: number;
  countByType: Record<string, number>;
  timestamp: string;
  orbitalPlanes?: {
    starlink: OrbitalPlaneData[];
    iridium: OrbitalPlaneData[];
  };
  starlinkPlaneCount?: number;
  iridiumPlaneCount?: number;
  totalStarlinkSatellites?: number;
  totalIridiumSatellites?: number;
}

// Color scheme for constellation types
const CONSTELLATION_COLORS: Record<ConstellationType, { r: number; g: number; b: number }> = {
  station: { r: 255, g: 215, b: 0 },    // Yellow/Gold for space stations
  starlink: { r: 168, g: 85, b: 247 },  // Purple for Starlink
  iridium: { r: 6, g: 182, b: 212 },    // Cyan for Iridium
  noaa: { r: 34, g: 197, b: 94 },       // Green for NOAA
  goes: { r: 249, g: 115, b: 22 },      // Orange for GOES
  gps: { r: 59, g: 130, b: 246 },       // Blue for GPS
  science: { r: 255, g: 255, b: 255 },  // White for NASA Science
  military: { r: 239, g: 68, b: 68 },   // Red for Military
};

// Constellation display names
const CONSTELLATION_NAMES: Record<ConstellationType, string> = {
  station: 'Space Stations',
  starlink: 'Starlink',
  iridium: 'Iridium',
  noaa: 'NOAA',
  goes: 'GOES',
  gps: 'GPS',
  science: 'NASA Science',
  military: 'Military',
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

// Default visibility for each constellation
const DEFAULT_VISIBILITY: Record<ConstellationType, boolean> = {
  station: true,
  starlink: true,
  iridium: true,
  noaa: true,
  goes: true,
  gps: true,
  science: true,
  military: true,
};

export function SatelliteLayer({ viewer, Cesium, visible = true, kpValue = 0, onDangerStatus }: SatelliteLayerProps) {
  const [satellites, setSatellites] = useState<SatellitePosition[]>([]);
  const [orbitalPlanes, setOrbitalPlanes] = useState<{
    starlink: OrbitalPlaneData[];
    iridium: OrbitalPlaneData[];
  }>({ starlink: [], iridium: [] });
  const [constellationVisibility, setConstellationVisibility] = useState<Record<ConstellationType, boolean>>(DEFAULT_VISIBILITY);
  const [showOrbitalTracks, setShowOrbitalTracks] = useState(true);
  const [totalStarlinkSats, setTotalStarlinkSats] = useState(0);
  const [totalIridiumSats, setTotalIridiumSats] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSatellite, setSelectedSatellite] = useState<SatellitePosition | null>(null);
  const entitiesRef = useRef<any[]>([]);
  const orbitEntitiesRef = useRef<any[]>([]);
  const orbitalTrackEntitiesRef = useRef<any[]>([]);
  const satrecsRef = useRef<Map<string, satellite.SatRec>>(new Map());
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch TLE data and initialize satrecs
  const fetchSatellites = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/satellites?includeOrbitalPlanes=true');

      if (!response.ok) {
        throw new Error('Failed to fetch satellite data');
      }

      const data: SatellitesResponse = await response.json();

      if (!data.success || !data.satellites) {
        throw new Error('Invalid satellite data');
      }

      // Store orbital plane data
      if (data.orbitalPlanes) {
        setOrbitalPlanes(data.orbitalPlanes);
      }
      if (data.totalStarlinkSatellites) {
        setTotalStarlinkSats(data.totalStarlinkSatellites);
      }
      if (data.totalIridiumSatellites) {
        setTotalIridiumSats(data.totalIridiumSatellites);
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
            const isOrbitalPlaneRep = sat.type === 'starlink' || sat.type === 'iridium';
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
              orbitalPlane: sat.orbitalPlane,
              isOrbitalPlaneRep,
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
      orbitalTrackEntitiesRef.current.forEach(entity => {
        try {
          viewer?.entities?.remove(entity);
        } catch {
          // Ignore cleanup errors
        }
      });
      entitiesRef.current = [];
      orbitEntitiesRef.current = [];
      orbitalTrackEntitiesRef.current = [];
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
    orbitalTrackEntitiesRef.current.forEach(entity => {
      try {
        viewer.entities.remove(entity);
      } catch {
        // Ignore cleanup errors
      }
    });
    entitiesRef.current = [];
    orbitEntitiesRef.current = [];
    orbitalTrackEntitiesRef.current = [];

    // Filter satellites by visibility settings
    const visibleSatellites = satellites.filter(sat => constellationVisibility[sat.type]);

    // Add satellite entities
    visibleSatellites.forEach(sat => {
      // Use danger color if satellite is in a radiation zone
      const baseColor = sat.inDanger ? DANGER_COLOR : CONSTELLATION_COLORS[sat.type];
      const cesiumColor = new Cesium.Color(baseColor.r / 255, baseColor.g / 255, baseColor.b / 255, 1.0);

      // Build label text - add danger zone indicator
      let labelText = sat.name;
      if (sat.inDanger && sat.dangerZone) {
        labelText = `⚠️ ${sat.name}\n[${sat.dangerZone === 'SAA' ? 'In SAA' : 'High Radiation'}]`;
      }

      // For orbital plane representatives, indicate the plane
      const isOrbitalRep = sat.isOrbitalPlaneRep && sat.orbitalPlane;

      // Create satellite point
      const entity = viewer.entities.add({
        name: sat.name,
        position: Cesium.Cartesian3.fromDegrees(
          sat.longitude,
          sat.latitude,
          sat.altitude * 1000 // Convert km to meters
        ),
        point: {
          pixelSize: sat.inDanger ? 14 : (sat.type === 'station' ? 12 : (isOrbitalRep ? 6 : 8)),
          color: cesiumColor,
          outlineColor: sat.inDanger ? Cesium.Color.YELLOW : Cesium.Color.WHITE,
          outlineWidth: sat.inDanger ? 3 : (isOrbitalRep ? 1 : 2),
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
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, isOrbitalRep ? 2e7 : 5e7),
        },
        properties: {
          noradId: sat.noradId,
          type: sat.type,
          altitude: sat.altitude,
          velocity: sat.velocity,
          inDanger: sat.inDanger,
          dangerZone: sat.dangerZone,
          orbitalPlane: sat.orbitalPlane,
        },
      });

      entitiesRef.current.push(entity);

      // Generate and draw orbit path (orbital tracks for Starlink/Iridium plane reps)
      if (showOrbitalTracks || !isOrbitalRep) {
        try {
          // Estimate orbital period from altitude (rough approximation)
          const earthRadius = 6371; // km
          const semiMajorAxis = earthRadius + sat.altitude;
          const periodMinutes = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / 398600.4418) / 60;

          const orbitPath = generateOrbitPath(sat.satrec, new Date(), periodMinutes, isOrbitalRep ? 180 : 120);

          if (orbitPath.length > 10) {
            const positions = orbitPath.map(p =>
              Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, p.altitude * 1000)
            );

            // For orbital plane reps (Starlink/Iridium), use dashed line style
            const orbitEntity = viewer.entities.add({
              polyline: {
                positions,
                width: isOrbitalRep ? 1 : 1.5,
                material: isOrbitalRep
                  ? new Cesium.PolylineDashMaterialProperty({
                      color: new Cesium.Color(baseColor.r / 255, baseColor.g / 255, baseColor.b / 255, 0.5),
                      dashLength: 16,
                    })
                  : new Cesium.Color(baseColor.r / 255, baseColor.g / 255, baseColor.b / 255, 0.4),
                clampToGround: false,
              },
            });

            if (isOrbitalRep) {
              orbitalTrackEntitiesRef.current.push(orbitEntity);
            } else {
              orbitEntitiesRef.current.push(orbitEntity);
            }
          }
        } catch {
          // Orbit generation failed, skip
        }
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
      orbitalTrackEntitiesRef.current.forEach(entity => {
        try {
          viewer.entities.remove(entity);
        } catch {
          // Ignore cleanup errors
        }
      });
      entitiesRef.current = [];
      orbitEntitiesRef.current = [];
      orbitalTrackEntitiesRef.current = [];
    };
  }, [viewer, Cesium, satellites, visible, constellationVisibility, showOrbitalTracks]);

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

  // Toggle constellation visibility
  const toggleConstellation = (type: ConstellationType) => {
    setConstellationVisibility(prev => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  // Get counts for visible constellations
  const getConstellationCount = (type: ConstellationType): number => {
    if (type === 'starlink') {
      return orbitalPlanes.starlink.length; // Show number of orbital planes
    }
    if (type === 'iridium') {
      return orbitalPlanes.iridium.length; // Show number of orbital planes
    }
    return satellites.filter(s => s.type === type).length;
  };

  // Get total satellite count for a constellation (including grouped)
  const getTotalCount = (type: ConstellationType): number | null => {
    if (type === 'starlink' && totalStarlinkSats > 0) {
      return totalStarlinkSats;
    }
    if (type === 'iridium' && totalIridiumSats > 0) {
      return totalIridiumSats;
    }
    return null;
  };

  return (
    <>
      {/* Satellite Legend */}
      <CollapsibleInfoBox
        title="Satellites"
        indicatorColor="#eab308"
        defaultCollapsed={true}
        className="absolute top-4 right-4 z-20 min-w-[220px]"
      >
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500" />
            Loading constellations...
          </div>
        ) : error ? (
          <div className="text-red-400 text-sm">{error}</div>
        ) : (
          <>
            <div className="text-xs text-slate-400 mb-2">
              Tracking {satellites.length} satellites
              {(totalStarlinkSats > 0 || totalIridiumSats > 0) && (
                <span className="text-slate-500"> (grouped by orbital plane)</span>
              )}
            </div>

            {/* Danger Status */}
            {(() => {
              const dangerSats = satellites.filter(s => s.inDanger && constellationVisibility[s.type]);
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

            {/* Constellation Toggles */}
            <div className="space-y-1">
              {(Object.keys(CONSTELLATION_COLORS) as ConstellationType[]).map(type => {
                const count = getConstellationCount(type);
                const totalCount = getTotalCount(type);
                const color = CONSTELLATION_COLORS[type];
                const isVisible = constellationVisibility[type];
                const isOrbitalPlaneType = type === 'starlink' || type === 'iridium';

                if (count === 0) return null;

                return (
                  <label
                    key={type}
                    className={`flex items-center gap-2 cursor-pointer hover:bg-slate-800/50 px-1 py-0.5 rounded ${!isVisible ? 'opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => toggleConstellation(type)}
                      className="w-3 h-3 rounded border-slate-600 bg-slate-800 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-0"
                    />
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
                    />
                    <span className="text-xs text-slate-300 flex-1">
                      {CONSTELLATION_NAMES[type]}
                      {isOrbitalPlaneType ? (
                        <span className="text-slate-500"> ({count} planes{totalCount ? `, ${totalCount} sats` : ''})</span>
                      ) : (
                        <span className="text-slate-500"> ({count})</span>
                      )}
                    </span>
                  </label>
                );
              })}

              {/* Danger indicator in legend */}
              {satellites.some(s => s.inDanger) && (
                <div className="flex items-center gap-2 px-1 py-0.5 mt-1 border-t border-slate-700 pt-2">
                  <div className="w-3 h-3" />
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: `rgb(${DANGER_COLOR.r}, ${DANGER_COLOR.g}, ${DANGER_COLOR.b})` }}
                  />
                  <span className="text-xs text-slate-300">In Radiation Zone</span>
                </div>
              )}
            </div>

            {/* Orbital Track Toggle */}
            {(orbitalPlanes.starlink.length > 0 || orbitalPlanes.iridium.length > 0) && (
              <div className="mt-2 pt-2 border-t border-slate-700">
                <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-800/50 px-1 py-0.5 rounded">
                  <input
                    type="checkbox"
                    checked={showOrbitalTracks}
                    onChange={() => setShowOrbitalTracks(!showOrbitalTracks)}
                    className="w-3 h-3 rounded border-slate-600 bg-slate-800 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-0"
                  />
                  <span className="text-xs text-slate-300">Show orbital tracks</span>
                </label>
              </div>
            )}

            <div className="mt-2 pt-2 border-t border-slate-700">
              <div className="text-xs text-slate-500">Updates every 30s</div>
            </div>
          </>
        )}
      </CollapsibleInfoBox>

      {/* Selected Satellite Details */}
      {selectedSatellite && (
        <div className={`absolute bottom-20 right-4 z-20 bg-slate-900/95 backdrop-blur-sm rounded-lg border ${selectedSatellite.inDanger ? 'border-red-600' : 'border-slate-700'} p-4 min-w-[240px]`}>
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                {selectedSatellite.inDanger && <span className="text-red-400">⚠️ </span>}
                {selectedSatellite.name}
              </h3>
              <p className="text-xs text-slate-400">
                {CONSTELLATION_NAMES[selectedSatellite.type]} • NORAD {selectedSatellite.noradId}
              </p>
              {selectedSatellite.orbitalPlane && (
                <p className="text-xs text-slate-500">
                  Orbital Plane: {selectedSatellite.orbitalPlane}
                </p>
              )}
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
