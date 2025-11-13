'use client';

import { useEffect, useState } from 'react';
import { SolarWindCard } from '@/components/dashboard/solar-wind-card';
import { KpCard } from '@/components/dashboard/kp-card';
import { XRayFluxCard } from '@/components/dashboard/xray-flux-card';
import { SolarEventsCard } from '@/components/dashboard/solar-events-card';
import { SuryaPredictionCard } from '@/components/dashboard/surya-prediction-card';
import { RoadsterCard } from '@/components/dashboard/roadster-card';

export default function DashboardPage() {
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    // Update the timestamp every 2 minutes
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Space Weather Dashboard</h1>
        <div className="text-sm text-slate-400">
          Last updated: {lastUpdated.toLocaleTimeString()} UTC
        </div>
      </div>

      {/* AI Predictions Row */}
      <div className="grid grid-cols-1 gap-6">
        <SuryaPredictionCard />
      </div>

      {/* Main Grid: NOAA Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <SolarWindCard />
        <KpCard />
        <XRayFluxCard />
      </div>

      {/* Events and Roadster Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SolarEventsCard />
        <RoadsterCard />
      </div>
    </div>
  );
}
