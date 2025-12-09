'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Eye, EyeOff, Target, Info, Maximize2, Minimize2 } from 'lucide-react';

// Types
interface HeliocentricPosition {
  x: number;
  y: number;
  z: number;
  distanceFromSun: number;
}

interface SpacecraftData {
  id: string;
  name: string;
  horizonsId: string;
  type: 'deep-space' | 'inner-solar' | 'outer-solar' | 'earth-orbit';
  agency: 'NASA' | 'ESA' | 'NASA/ESA' | 'JAXA';
  missionStatus: 'active' | 'extended' | 'nominal';
  description: string;
  position: HeliocentricPosition | null;
  error?: string;
}

interface PlanetData {
  id: string;
  name: string;
  horizonsId: string;
  color: string;
  size: number;
  position: HeliocentricPosition | null;
  orbitRadius: number;
}

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

type ViewMode = 'inner' | 'outer' | 'full';

// Agency colors for spacecraft
const AGENCY_COLORS: Record<string, string> = {
  'NASA': '#3B82F6',
  'ESA': '#F4D03F',
  'NASA/ESA': '#8B5CF6',
  'JAXA': '#EF4444',
};

// Scale factors for different views
const VIEW_SCALES: Record<ViewMode, { scale: number; cameraDistance: number }> = {
  inner: { scale: 8, cameraDistance: 12 },
  outer: { scale: 1.2, cameraDistance: 50 },
  full: { scale: 0.15, cameraDistance: 200 },
};

// Sun component
function Sun() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001;
    }
  });

  return (
    <group>
      {/* Sun glow */}
      <mesh>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshBasicMaterial color="#FFD700" transparent opacity={0.3} />
      </mesh>
      {/* Sun core */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshBasicMaterial color="#FFA500" />
      </mesh>
      {/* Point light from sun */}
      <pointLight color="#FFD700" intensity={2} distance={100} />
    </group>
  );
}

// Planet orbit ring
function OrbitRing({ radius, color }: { radius: number; color: string }) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
    return pts;
  }, [radius]);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={0.5}
      transparent
      opacity={0.3}
    />
  );
}

// Planet component
function Planet({
  data,
  scale,
  showLabel,
  onSelect,
  isSelected,
}: {
  data: PlanetData;
  scale: number;
  showLabel: boolean;
  onSelect: (data: PlanetData | SpacecraftData | null) => void;
  isSelected: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  if (!data.position) return null;

  const x = data.position.x * scale;
  const y = data.position.z * scale; // Use Z as Y for top-down view
  const z = -data.position.y * scale; // Use -Y as Z

  const visualSize = Math.max(0.15, data.size * 0.15);

  return (
    <group position={[x, y, z]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(data);
        }}
      >
        <sphereGeometry args={[visualSize, 16, 16]} />
        <meshStandardMaterial
          color={data.color}
          emissive={data.color}
          emissiveIntensity={isSelected ? 0.5 : 0.2}
        />
      </mesh>
      {showLabel && (
        <Html distanceFactor={10} center style={{ pointerEvents: 'none' }}>
          <div className="text-white text-xs bg-slate-900/80 px-1 py-0.5 rounded whitespace-nowrap">
            {data.name}
          </div>
        </Html>
      )}
      {isSelected && (
        <mesh>
          <ringGeometry args={[visualSize + 0.1, visualSize + 0.15, 32]} />
          <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// Spacecraft component
function Spacecraft({
  data,
  scale,
  showLabel,
  onSelect,
  isSelected,
}: {
  data: SpacecraftData;
  scale: number;
  showLabel: boolean;
  onSelect: (data: PlanetData | SpacecraftData | null) => void;
  isSelected: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  if (!data.position) return null;

  const x = data.position.x * scale;
  const y = data.position.z * scale;
  const z = -data.position.y * scale;

  const agencyColor = AGENCY_COLORS[data.agency] || '#ffffff';

  useFrame((state) => {
    if (meshRef.current) {
      // Pulsing effect
      const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.3 + 1;
      meshRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={[x, y, z]}>
      {/* Spacecraft dot */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(data);
        }}
      >
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Agency color ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.15, 16]} />
        <meshBasicMaterial color={agencyColor} side={THREE.DoubleSide} />
      </mesh>
      {showLabel && (
        <Html distanceFactor={10} center style={{ pointerEvents: 'none' }}>
          <div
            className="text-xs px-1 py-0.5 rounded whitespace-nowrap"
            style={{
              backgroundColor: `${agencyColor}CC`,
              color: '#ffffff',
            }}
          >
            {data.name}
          </div>
        </Html>
      )}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.2, 0.25, 32]} />
          <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

// Camera controller for programmatic zoom
function CameraController({ viewMode }: { viewMode: ViewMode }) {
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3());

  useEffect(() => {
    const distance = VIEW_SCALES[viewMode].cameraDistance;
    targetPosition.current.set(distance * 0.7, distance * 0.5, distance * 0.7);
  }, [viewMode]);

  useFrame(() => {
    camera.position.lerp(targetPosition.current, 0.02);
  });

  return null;
}

// Main scene component
function SolarSystemScene({
  spacecraft,
  planets,
  viewMode,
  showOrbits,
  showPlanetLabels,
  showSpacecraftLabels,
  selectedObject,
  onSelect,
}: {
  spacecraft: SpacecraftData[];
  planets: PlanetData[];
  viewMode: ViewMode;
  showOrbits: boolean;
  showPlanetLabels: boolean;
  showSpacecraftLabels: boolean;
  selectedObject: PlanetData | SpacecraftData | null;
  onSelect: (data: PlanetData | SpacecraftData | null) => void;
}) {
  const scale = VIEW_SCALES[viewMode].scale;

  return (
    <>
      <CameraController viewMode={viewMode} />
      <ambientLight intensity={0.1} />
      <Sun />

      {/* Orbit rings */}
      {showOrbits &&
        planets.map((planet) => (
          <OrbitRing
            key={`orbit-${planet.id}`}
            radius={planet.orbitRadius * scale}
            color={planet.color}
          />
        ))}

      {/* Planets */}
      {planets.map((planet) => (
        <Planet
          key={planet.id}
          data={planet}
          scale={scale}
          showLabel={showPlanetLabels}
          onSelect={onSelect}
          isSelected={selectedObject?.id === planet.id}
        />
      ))}

      {/* Spacecraft */}
      {spacecraft.map((sc) => (
        <Spacecraft
          key={sc.id}
          data={sc}
          scale={scale}
          showLabel={showSpacecraftLabels}
          onSelect={onSelect}
          isSelected={selectedObject?.id === sc.id}
        />
      ))}

      {/* Click on background to deselect */}
      <mesh
        position={[0, 0, 0]}
        onClick={() => onSelect(null)}
        visible={false}
      >
        <sphereGeometry args={[1000, 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} />
      </mesh>

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={500}
      />
    </>
  );
}

// Info panel component
function InfoPanel({
  selectedObject,
  onClose,
}: {
  selectedObject: PlanetData | SpacecraftData | null;
  onClose: () => void;
}) {
  if (!selectedObject) return null;

  const isSpacecraft = 'agency' in selectedObject;

  return (
    <div className="absolute bottom-4 left-4 bg-slate-900/95 border border-slate-700 rounded-lg p-4 max-w-sm backdrop-blur-sm">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-bold text-white">{selectedObject.name}</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1"
        >
          <EyeOff className="w-4 h-4" />
        </button>
      </div>

      {isSpacecraft ? (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: AGENCY_COLORS[(selectedObject as SpacecraftData).agency],
                color: '#ffffff',
              }}
            >
              {(selectedObject as SpacecraftData).agency}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                (selectedObject as SpacecraftData).missionStatus === 'active'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}
            >
              {(selectedObject as SpacecraftData).missionStatus}
            </span>
          </div>
          <p className="text-slate-300 text-sm mb-3">
            {(selectedObject as SpacecraftData).description}
          </p>
        </>
      ) : (
        <div className="mb-2">
          <span
            className="inline-block w-3 h-3 rounded-full mr-2"
            style={{ backgroundColor: (selectedObject as PlanetData).color }}
          />
          <span className="text-slate-400 text-sm">Planet</span>
        </div>
      )}

      {selectedObject.position && (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Distance from Sun:</span>
            <span className="text-white font-mono">
              {selectedObject.position.distanceFromSun.toFixed(3)} AU
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">X coordinate:</span>
            <span className="text-white font-mono">
              {selectedObject.position.x.toFixed(3)} AU
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Y coordinate:</span>
            <span className="text-white font-mono">
              {selectedObject.position.y.toFixed(3)} AU
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Z coordinate:</span>
            <span className="text-white font-mono">
              {selectedObject.position.z.toFixed(3)} AU
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Legend component
function Legend({ spacecraft }: { spacecraft: SpacecraftData[] }) {
  const agencies = [...new Set(spacecraft.map((s) => s.agency))];

  return (
    <div className="absolute top-4 right-4 bg-slate-900/95 border border-slate-700 rounded-lg p-3 backdrop-blur-sm">
      <h4 className="text-sm font-semibold text-white mb-2">Legend</h4>
      <div className="space-y-1">
        {agencies.map((agency) => (
          <div key={agency} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full border-2"
              style={{ borderColor: AGENCY_COLORS[agency], backgroundColor: 'white' }}
            />
            <span className="text-xs text-slate-300">{agency}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main component
export default function SolarSystemViewer() {
  const [viewMode, setViewMode] = useState<ViewMode>('inner');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spacecraft, setSpacecraft] = useState<SpacecraftData[]>([]);
  const [planets, setPlanets] = useState<PlanetData[]>([]);
  const [stats, setStats] = useState<ApiResponse['stats'] | null>(null);

  // UI toggles
  const [showOrbits, setShowOrbits] = useState(true);
  const [showPlanetLabels, setShowPlanetLabels] = useState(true);
  const [showSpacecraftLabels, setShowSpacecraftLabels] = useState(true);
  const [selectedObject, setSelectedObject] = useState<PlanetData | SpacecraftData | null>(null);

  // Fetch data
  const fetchData = async (view: ViewMode) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/spacecraft?view=${view}`);
      const data: ApiResponse = await response.json();

      if (!data.success) {
        throw new Error('Failed to fetch spacecraft data');
      }

      setSpacecraft(data.spacecraft);
      setPlanets(data.planets);
      setStats(data.stats);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(viewMode);
  }, [viewMode]);

  const handleViewChange = (newView: ViewMode) => {
    setViewMode(newView);
    setSelectedObject(null);
  };

  return (
    <div className="w-full h-full bg-[#050520] relative">
      {/* Controls */}
      <div className="absolute top-4 left-4 z-10 space-y-2">
        {/* View mode selector */}
        <div className="bg-slate-900/95 border border-slate-700 rounded-lg p-2 backdrop-blur-sm">
          <div className="text-xs text-slate-400 mb-2">View Mode</div>
          <div className="flex gap-1">
            {[
              { id: 'inner' as ViewMode, label: 'Inner System' },
              { id: 'outer' as ViewMode, label: 'Outer System' },
              { id: 'full' as ViewMode, label: 'Full System' },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => handleViewChange(mode.id)}
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  viewMode === mode.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Toggle controls */}
        <div className="bg-slate-900/95 border border-slate-700 rounded-lg p-2 backdrop-blur-sm space-y-2">
          <div className="text-xs text-slate-400 mb-1">Display Options</div>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showOrbits}
              onChange={(e) => setShowOrbits(e.target.checked)}
              className="rounded border-slate-600"
            />
            Orbit Lines
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showPlanetLabels}
              onChange={(e) => setShowPlanetLabels(e.target.checked)}
              className="rounded border-slate-600"
            />
            Planet Labels
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showSpacecraftLabels}
              onChange={(e) => setShowSpacecraftLabels(e.target.checked)}
              className="rounded border-slate-600"
            />
            Spacecraft Labels
          </label>
        </div>

        {/* Stats */}
        {stats && (
          <div className="bg-slate-900/95 border border-slate-700 rounded-lg p-2 backdrop-blur-sm">
            <div className="text-xs text-slate-400 mb-1">Statistics</div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Spacecraft tracked:</span>
                <span className="text-white">{stats.successfulFetches}/{stats.totalSpacecraft}</span>
              </div>
              {stats.furthestFromSun && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Furthest:</span>
                  <span className="text-white">
                    {stats.furthestFromSun.name} ({stats.furthestFromSun.distance.toFixed(1)} AU)
                  </span>
                </div>
              )}
              {stats.closestToSun && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Closest to Sun:</span>
                  <span className="text-white">
                    {stats.closestToSun.name} ({stats.closestToSun.distance.toFixed(3)} AU)
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <Legend spacecraft={spacecraft} />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#050520]/80 z-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500 mx-auto mb-4" />
            <p className="text-slate-400">Fetching spacecraft positions from NASA JPL Horizons...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#050520]/80 z-20">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => fetchData(viewMode)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas
        camera={{
          position: [10, 8, 10],
          fov: 60,
          near: 0.1,
          far: 1000,
        }}
      >
        <color attach="background" args={['#050520']} />
        <fog attach="fog" args={['#050520', 50, 200]} />
        <Suspense fallback={null}>
          <SolarSystemScene
            spacecraft={spacecraft}
            planets={planets}
            viewMode={viewMode}
            showOrbits={showOrbits}
            showPlanetLabels={showPlanetLabels}
            showSpacecraftLabels={showSpacecraftLabels}
            selectedObject={selectedObject}
            onSelect={setSelectedObject}
          />
        </Suspense>
      </Canvas>

      {/* Info panel for selected object */}
      <InfoPanel
        selectedObject={selectedObject}
        onClose={() => setSelectedObject(null)}
      />

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-400 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Target className="w-3 h-3" />
          <span>Click objects for details</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Maximize2 className="w-3 h-3" />
          <span>Scroll to zoom, drag to rotate</span>
        </div>
      </div>
    </div>
  );
}
