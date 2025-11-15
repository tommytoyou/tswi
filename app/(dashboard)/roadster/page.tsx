'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import RoadsterOrbitViewer from '@/components/roadster/orbit-viewer-2d';

interface RoadsterData {
  name: string;
  details: string;
  launch_date: string;
  earth_distance_km: number;
  earth_distance_mi: number;
  mars_distance_km: number;
  mars_distance_mi: number;
  speed_kph: number;
  speed_mph: number;
  orbit: {
    semi_major_axis_au: number;
    eccentricity: number;
    inclination_deg: number;
    period_days: number;
  };
  position: {
    x: number;
    y: number;
    z: number;
  };
  solar_exposure: {
    total_days: number;
    radiation_dose_estimate_sv: number;
    temperature_estimate_c: number;
  };
  facts: {
    passengers: string[];
    music_playing: string;
  };
}

export default function RoadsterPage() {
  const [data, setData] = useState<RoadsterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRoadsterData();
  }, []);

  const fetchRoadsterData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/roadster?trajectory=true');
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch Roadster data');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Roadster data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-white text-xl">Loading Starman...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="bg-red-900/20 border-red-500 p-6 max-w-md">
          <h3 className="text-red-400 font-bold mb-2">Error</h3>
          <p className="text-red-300 text-sm">{error || 'No data available'}</p>
        </Card>
      </div>
    );
  }

  const daysSinceLaunch = Math.floor((Date.now() - new Date(data.launch_date).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col lg:flex-row gap-4 p-4">
      {/* Stats Panel */}
      <div className="lg:w-96 space-y-4 overflow-y-auto">
        <Card className="bg-slate-800 border-slate-700 p-6">
          <h1 className="text-3xl font-bold text-white mb-2">{data.name}</h1>
          <Badge className="bg-red-500 text-white mb-4">LIVE TRACKING</Badge>
          <p className="text-slate-300 text-sm mb-4">{data.details}</p>
          <div className="text-xs text-slate-400">
            Launched: {new Date(data.launch_date).toLocaleDateString()}
          </div>
          <div className="text-xs text-slate-400">
            Days in space: {daysSinceLaunch.toLocaleString()}
          </div>
        </Card>

        {/* Distance Stats */}
        <Card className="bg-slate-800 border-slate-700 p-6">
          <h3 className="text-white font-semibold mb-4">Current Distance</h3>
          <div className="space-y-3">
            <div>
              <div className="text-slate-400 text-sm">From Earth</div>
              <div className="text-2xl font-bold text-blue-400">
                {(data.earth_distance_km / 1000000).toFixed(2)} M km
              </div>
              <div className="text-sm text-slate-500">
                {(data.earth_distance_mi / 1000000).toFixed(2)} M mi
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-sm">From Mars</div>
              <div className="text-2xl font-bold text-red-400">
                {(data.mars_distance_km / 1000000).toFixed(2)} M km
              </div>
              <div className="text-sm text-slate-500">
                {(data.mars_distance_mi / 1000000).toFixed(2)} M mi
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-sm">Speed</div>
              <div className="text-2xl font-bold text-green-400">
                {data.speed_kph.toLocaleString()} km/h
              </div>
              <div className="text-sm text-slate-500">
                {data.speed_mph.toLocaleString()} mph
              </div>
            </div>
          </div>
        </Card>

        {/* Orbital Parameters */}
        <Card className="bg-slate-800 border-slate-700 p-6">
          <h3 className="text-white font-semibold mb-4">Orbital Parameters</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Semi-major axis:</span>
              <span className="text-white font-mono">{data.orbit.semi_major_axis_au.toFixed(3)} AU</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Eccentricity:</span>
              <span className="text-white font-mono">{data.orbit.eccentricity.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Inclination:</span>
              <span className="text-white font-mono">{data.orbit.inclination_deg.toFixed(2)}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Orbital period:</span>
              <span className="text-white font-mono">{data.orbit.period_days} days</span>
            </div>
          </div>
        </Card>

        {/* Solar Exposure */}
        <Card className="bg-slate-800 border-slate-700 p-6">
          <h3 className="text-white font-semibold mb-4">Solar Exposure</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Total days:</span>
              <span className="text-white font-mono">{data.solar_exposure.total_days.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Radiation dose:</span>
              <span className="text-yellow-400 font-mono">{data.solar_exposure.radiation_dose_estimate_sv.toFixed(2)} Sv</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Est. temperature:</span>
              <span className="text-white font-mono">{data.solar_exposure.temperature_estimate_c.toFixed(0)}°C</span>
            </div>
          </div>
        </Card>

        {/* Fun Facts */}
        <Card className="bg-slate-800 border-slate-700 p-6">
          <h3 className="text-white font-semibold mb-4">Passengers</h3>
          <ul className="space-y-2 text-sm text-slate-300">
            {data.facts.passengers.map((passenger, i) => (
              <li key={i} className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                {passenger}
              </li>
            ))}
          </ul>
          <div className="mt-4 p-3 bg-slate-900 rounded border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">Currently Playing:</div>
            <div className="text-sm text-white font-medium">{data.facts.music_playing}</div>
          </div>
        </Card>
      </div>

      {/* 2D Orbital Visualization */}
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0">
          <RoadsterOrbitViewer roadsterData={data} />
        </div>
      </div>
    </div>
  );
}