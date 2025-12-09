'use client';

import { useRef, useMemo, Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { SpacecraftData, PlanetData, ViewMode, SolarSystemCanvasProps } from './types';

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

  useFrame(() => {
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
    const pts: [number, number, number][] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push([Math.cos(angle) * radius, 0, Math.sin(angle) * radius]);
    }
    return pts;
  }, [radius]);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={0.5}
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

// Main canvas component - this is what gets dynamically imported
export default function SolarSystemCanvas({
  spacecraft,
  planets,
  viewMode,
  showOrbits,
  showPlanetLabels,
  showSpacecraftLabels,
  selectedObject,
  onSelect,
}: SolarSystemCanvasProps) {
  return (
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
          onSelect={onSelect}
        />
      </Suspense>
    </Canvas>
  );
}
