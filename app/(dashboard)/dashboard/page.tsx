'use client';

import { useEffect, useState, useCallback } from 'react';
import { SolarWindCardV2 } from '@/components/dashboard/solar-wind-card-v2';
import { SolarWindPlasmaCard } from '@/components/dashboard/solar-wind-plasma-card';
import { KpCardV2 } from '@/components/dashboard/kp-card-v2';
import { XRayFluxCardV2 } from '@/components/dashboard/xray-flux-card-v2';
import { ProtonFluxCard } from '@/components/dashboard/proton-flux-card';
import { DstCard } from '@/components/dashboard/dst-card';
import { SuryaCardV2 } from '@/components/dashboard/surya-card-v2';
import { SolarEventsCard } from '@/components/dashboard/solar-events-card';

import { StatusBar } from '@/components/dashboard/status-bar';
import { Satellite } from 'lucide-react';

export default function DashboardPage() {
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshInterval, setRefreshInterval] = useState(120000); // 2 minutes default
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    setLastUpdated(new Date());
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      handleRefresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, handleRefresh]);

  // Export functionality
  const handleExport = useCallback(async () => {
    try {
      // Fetch all current data
      const [solarWind, solarWindPlasma, kpIndex, xrayFlux, protonFlux, dst, suryaPrediction] = await Promise.all([
        fetch('/api/noaa/solar-wind?limit=60').then(r => r.json()),
        fetch('/api/noaa/solar-wind-plasma?limit=60').then(r => r.json()),
        fetch('/api/noaa/kp-index?limit=60').then(r => r.json()),
        fetch('/api/noaa/xray-flux?limit=60').then(r => r.json()),
        fetch('/api/noaa/proton-flux?limit=60').then(r => r.json()),
        fetch('/api/noaa/dst?limit=60').then(r => r.json()),
        fetch('/api/ai/surya-prediction').then(r => r.json()),
      ]);

      // Create CSV content
      const csvContent = [
        'TSWI Space Weather Dashboard Export',
        `Generated: ${new Date().toISOString()}`,
        '',
        'Solar Wind Magnetic Field (Latest)',
        'Bx (nT),By (nT),Bz (nT),Bt (nT)',
        solarWind.data?.[solarWind.data.length - 1] ?
          `${solarWind.data[solarWind.data.length - 1].bx_gsm},${solarWind.data[solarWind.data.length - 1].by_gsm},${solarWind.data[solarWind.data.length - 1].bz_gsm},${solarWind.data[solarWind.data.length - 1].bt}` : '',
        '',
        'Solar Wind Plasma (Latest)',
        'Speed (km/s),Density (/cm³),Temperature (K)',
        solarWindPlasma.data?.[solarWindPlasma.data.length - 1] ?
          `${solarWindPlasma.data[solarWindPlasma.data.length - 1].speed_kms},${solarWindPlasma.data[solarWindPlasma.data.length - 1].density_cm3},${solarWindPlasma.data[solarWindPlasma.data.length - 1].temp_k}` : '',
        '',
        'Kp Index',
        'Timestamp,Kp Value',
        ...(kpIndex.data?.slice(-10).map((d: any) => `${d.ts},${d.kp}`) || []),
        '',
        'X-ray Flux',
        'Timestamp,Flux (W/m²)',
        ...(xrayFlux.data?.slice(-10).map((d: any) => `${d.ts},${d.flux}`) || []),
        '',
        'Proton Flux',
        'Timestamp,>10 MeV (pfu),>50 MeV (pfu),>100 MeV (pfu),S-Scale',
        ...(protonFlux.data?.slice(-10).map((d: any) => `${d.ts},${d.p10_pfu},${d.p50_pfu},${d.p100_pfu},${d.s_scale}`) || []),
        '',
        'Dst Index',
        'Timestamp,Dst (nT),Storm Level',
        ...(dst.data?.slice(-10).map((d: any) => `${d.ts},${d.dst_nt},${d.storm_level}`) || []),
        '',
        'Surya AI Predictions',
        'Time,Flare Probability,C-Class,M-Class,X-Class,Confidence',
        ...(suryaPrediction.data?.predictions?.map((p: any) =>
          `${p.time},${p.flare_probability},${p.class_probabilities.C},${p.class_probabilities.M},${p.class_probabilities.X},${p.confidence}`
        ) || []),
      ].join('\n');

      // Create download
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tswi-export-${new Date().toISOString().slice(0, 16)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-[1600px] mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Satellite className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">
                Tactical Space Weather Intelligence
              </h1>
              <p className="text-sm text-slate-400">
                Real-time space weather monitoring and AI-powered predictions
              </p>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <StatusBar
          lastUpdated={lastUpdated}
          onRefresh={handleRefresh}
          onExport={handleExport}
          refreshInterval={refreshInterval}
          onRefreshIntervalChange={setRefreshInterval}
          autoRefresh={autoRefresh}
          onAutoRefreshToggle={() => setAutoRefresh(!autoRefresh)}
        />

        {/* AI Predictions Section */}
        <div>
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              AI-Powered Predictions
            </h2>
          </div>
          <SuryaCardV2 key={refreshTrigger} />
        </div>

        {/* Real-time Data Grid */}
        <div>
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Real-Time Space Weather Data
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SolarWindCardV2 key={`sw-${refreshTrigger}`} />
            <SolarWindPlasmaCard key={`plasma-${refreshTrigger}`} />
            <KpCardV2 key={`kp-${refreshTrigger}`} />
            <XRayFluxCardV2 key={`xray-${refreshTrigger}`} />
            <ProtonFluxCard key={`proton-${refreshTrigger}`} />
            <DstCard key={`dst-${refreshTrigger}`} />
          </div>
        </div>

        {/* Events and Additional Data */}
        <div>
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Events & Additional Data
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SolarEventsCard key={`events-${refreshTrigger}`} />
            
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 pt-8 pb-4">
          <p>
            Data sources: NOAA Space Weather Prediction Center (SWPC), NASA DONKI, IBM/NASA Surya AI
          </p>
          <p className="mt-1">
            TSWI is an experimental platform for space weather intelligence • Not for operational use
          </p>
        </div>
      </div>
    </div>
  );
}
