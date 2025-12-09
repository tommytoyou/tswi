'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { EyeOff, Target, Maximize2 } from 'lucide-react';
import type { SpacecraftData, PlanetData, ViewMode } from './types';

// Dynamically import the Canvas component to avoid SSR issues with React Three Fiber
const SolarSystemCanvas = dynamic(
  () => import('./solar-system-canvas'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500 mx-auto mb-4" />
          <p className="text-slate-400">Initializing 3D view...</p>
        </div>
      </div>
    ),
  }
);

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

// Agency colors for spacecraft
const AGENCY_COLORS: Record<string, string> = {
  'NASA': '#3B82F6',
  'ESA': '#F4D03F',
  'NASA/ESA': '#8B5CF6',
  'JAXA': '#EF4444',
};

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

      {/* 3D Canvas - dynamically imported to avoid SSR issues */}
      <SolarSystemCanvas
        spacecraft={spacecraft}
        planets={planets}
        viewMode={viewMode}
        showOrbits={showOrbits}
        showPlanetLabels={showPlanetLabels}
        showSpacecraftLabels={showSpacecraftLabels}
        selectedObject={selectedObject}
        onSelect={setSelectedObject}
      />

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
