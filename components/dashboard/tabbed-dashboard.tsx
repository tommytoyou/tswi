'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Header } from '@/components/layout/header';
import { RsgScalesCard } from '@/components/dashboard/rsg-scales-card';
import { SuryaCardV2 } from '@/components/dashboard/surya-card-v2';
import { SolarWindCardV2 } from '@/components/dashboard/solar-wind-card-v2';
import { SolarWindPlasmaCard } from '@/components/dashboard/solar-wind-plasma-card';
import { KpCardV2 } from '@/components/dashboard/kp-card-v2';
import { XRayFluxCardV2 } from '@/components/dashboard/xray-flux-card-v2';
import { ProtonFluxCard } from '@/components/dashboard/proton-flux-card';
import { DstCard } from '@/components/dashboard/dst-card';
import { SolarEventsCard } from '@/components/dashboard/solar-events-card';
import { CmeCard } from '@/components/dashboard/cme-card';
import { AlertsPanel } from '@/components/dashboard/alerts-panel';
import { useStore } from '@/lib/store';
import { Switch } from '@/components/ui/switch';
import {
  LayoutDashboard,
  Wind,
  Flame,
  Globe2,
  Sparkles,
  Bell,
} from 'lucide-react';

// Dynamic imports for heavy components
const GlobeViewer = dynamic(() => import('@/components/cesium/globe-viewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
      <div className="text-slate-400">Loading Globe...</div>
    </div>
  ),
});

const AuroraViewer = dynamic(() => import('@/components/dashboard/aurora-viewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
      <div className="text-slate-400">Loading Aurora...</div>
    </div>
  ),
});

interface TabConfig {
  id: string;
  label: string;
  icon: React.ElementType;
}

const tabs: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'solar-wind', label: 'Solar Wind', icon: Wind },
  { id: 'events', label: 'Events', icon: Flame },
  { id: 'globe', label: 'Globe', icon: Globe2 },
  { id: 'aurora', label: 'Aurora', icon: Sparkles },
  { id: 'alerts', label: 'Alerts', icon: Bell },
];

export function TabbedDashboard() {
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const validTabs = tabs.map(t => t.id);
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'overview';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { kpBelts, tec, satellites, magnetometers, toggleLayer } = useStore();

  // Sync tab with URL param changes
  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 120000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      <Header />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        {/* Tab Navigation */}
        <div className="bg-slate-900/50 border-b border-slate-800 px-4 py-2 flex-shrink-0">
          <TabsList className="bg-transparent gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="gap-2 px-4 py-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 hover:text-slate-200"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Tab Content - fills remaining space */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Overview Tab */}
          <TabsContent value="overview" className="h-full m-0 p-4 overflow-hidden">
            <div className="h-full flex flex-col gap-4">
              {/* RSG Scales - fits content */}
              <div className="flex-shrink-0">
                <RsgScalesCard key={`rsg-${refreshTrigger}`} />
              </div>
              {/* AI Predictions - takes remaining space */}
              <div className="flex-1 min-h-0">
                <SuryaCardV2 key={`surya-${refreshTrigger}`} />
              </div>
            </div>
          </TabsContent>

          {/* Solar Wind Tab */}
          <TabsContent value="solar-wind" className="h-full m-0 p-4 overflow-hidden">
            <div className="h-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
              <SolarWindCardV2 key={`sw-${refreshTrigger}`} />
              <SolarWindPlasmaCard key={`plasma-${refreshTrigger}`} />
              <KpCardV2 key={`kp-${refreshTrigger}`} />
              <XRayFluxCardV2 key={`xray-${refreshTrigger}`} />
              <ProtonFluxCard key={`proton-${refreshTrigger}`} />
              <DstCard key={`dst-${refreshTrigger}`} />
            </div>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="h-full m-0 p-4 overflow-hidden">
            <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SolarEventsCard key={`events-${refreshTrigger}`} />
              <CmeCard key={`cme-${refreshTrigger}`} />
            </div>
          </TabsContent>

          {/* Globe Tab */}
          <TabsContent value="globe" className="h-full m-0 overflow-hidden relative">
            {/* Layer Controls */}
            <div className="absolute top-4 right-4 z-10 bg-slate-900/90 backdrop-blur-sm p-3 rounded-lg space-y-2 min-w-[180px]">
              <h3 className="text-white font-semibold text-sm mb-2">Map Layers</h3>

              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-300">Kp Belts</label>
                <Switch checked={kpBelts} onCheckedChange={() => toggleLayer('kpBelts')} />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-300">TEC Overlay</label>
                <Switch checked={tec} onCheckedChange={() => toggleLayer('tec')} />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-300">Satellites</label>
                <Switch checked={satellites} onCheckedChange={() => toggleLayer('satellites')} />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-300">Magnetometers</label>
                <Switch checked={magnetometers} onCheckedChange={() => toggleLayer('magnetometers')} />
              </div>
            </div>

            <GlobeViewer />
          </TabsContent>

          {/* Aurora Tab */}
          <TabsContent value="aurora" className="h-full m-0 overflow-hidden">
            <AuroraViewer />
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="h-full m-0 overflow-hidden">
            <AlertsPanel />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
