'use client';

import dynamic from 'next/dynamic';
import { useStore } from '@/lib/store';
import { Switch } from '@/components/ui/switch';

const GlobeViewer = dynamic(() => import('@/components/cesium/globe-viewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
      <p className="text-white">Loading Cesium Globe...</p>
    </div>
  ),
});

export default function MapPage() {
  const { kpBelts, tec, satellites, magnetometers, toggleLayer } = useStore();

  return (
    <div className="h-[calc(100vh-80px)] relative">
      {/* Layer Controls */}
      <div className="absolute top-4 right-4 z-10 bg-slate-900/90 backdrop-blur-sm p-4 rounded-lg space-y-3 min-w-[200px]">
        <h3 className="text-white font-semibold mb-2">Map Layers</h3>
        
        <div className="flex items-center justify-between">
          <label className="text-sm text-slate-300">Kp Belts</label>
          <Switch checked={kpBelts} onCheckedChange={() => toggleLayer('kpBelts')} />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-slate-300">TEC Overlay</label>
          <Switch checked={tec} onCheckedChange={() => toggleLayer('tec')} />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-slate-300">Satellites</label>
          <Switch checked={satellites} onCheckedChange={() => toggleLayer('satellites')} />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-slate-300">Magnetometers</label>
          <Switch checked={magnetometers} onCheckedChange={() => toggleLayer('magnetometers')} />
        </div>
      </div>

      {/* TODO: Add time scrubber control for last 24h */}
      {/* TODO: Add satellite search/select panel */}
      {/* TODO: Add click handler for pass time calculations */}

      <GlobeViewer />
    </div>
  );
}
