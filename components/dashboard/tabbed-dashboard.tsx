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
import { SolarImageryCard } from '@/components/dashboard/solar-imagery-card';
import { CmeCard } from '@/components/dashboard/cme-card';
import { AlertsPanel } from '@/components/dashboard/alerts-panel';
import { SDAPanel } from '@/components/dashboard/sda-panel';
import {
  LayoutDashboard,
  Wind,
  Flame,
  Globe2,
  Sparkles,
  Bell,
  Flag,
  Sun,
  Satellite,
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

const AuroraGlobe = dynamic(() => import('@/components/cesium/aurora-globe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#050520]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500 mx-auto mb-4" />
        <p className="text-slate-400">Loading Aurora Globe...</p>
      </div>
    </div>
  ),
});

const NationalAssetsGlobe = dynamic(() => import('@/components/cesium/national-assets-globe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
      <div className="text-slate-400">Loading National Assets...</div>
    </div>
  ),
});

const HeliocentricViewer = dynamic(
  () => import('@/components/heliocentric/nasa-eyes-viewer'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#050520]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500 mx-auto mb-4" />
          <p className="text-slate-400">Loading NASA Eyes...</p>
        </div>
      </div>
    ),
  }
);

interface TabConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tabs: TabConfig[] = [
  { id: 'solar-wind', label: 'Solar Wind', icon: Wind },
  { id: 'predictive-modelling', label: 'Predictive Modelling', icon: LayoutDashboard },
  { id: 'events', label: 'Events', icon: Flame },
  { id: 'globe', label: 'Globe', icon: Globe2 },
  { id: 'national-assets', label: 'National Assets', icon: Flag },
  { id: 'heliocentric', label: 'Heliocentric', icon: Sun },
  { id: 'aurora', label: 'Aurora', icon: Sparkles },
  { id: 'sda', label: 'SDA', icon: Satellite },
  { id: 'alerts', label: 'Alerts', icon: Bell },
];

export function TabbedDashboard() {
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const validTabs = tabs.map(t => t.id);
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'solar-wind';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
          {/* Predictive Modelling Tab */}
          <TabsContent value="predictive-modelling" className="h-full m-0 p-4 overflow-hidden">
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

          {/* Solar Wind Tab - 3x2 grid that fills viewport */}
          <TabsContent value="solar-wind" className="h-full m-0 p-3 overflow-hidden">
            <div className="h-full grid grid-cols-3 grid-rows-2 gap-3">
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
              <SolarImageryCard key={`imagery-${refreshTrigger}`} />
              <CmeCard key={`cme-${refreshTrigger}`} />
            </div>
          </TabsContent>

          {/* Globe Tab */}
          <TabsContent value="globe" className="h-full m-0 overflow-hidden">
            <GlobeViewer />
          </TabsContent>

          {/* National Assets Tab */}
          <TabsContent value="national-assets" className="h-full m-0 overflow-hidden">
            <NationalAssetsGlobe />
          </TabsContent>

          {/* Heliocentric Tab */}
          <TabsContent value="heliocentric" className="h-full m-0 overflow-hidden">
            <HeliocentricViewer />
          </TabsContent>

          {/* Aurora Tab */}
          <TabsContent value="aurora" className="h-full m-0 overflow-hidden">
            <AuroraGlobe />
          </TabsContent>

          {/* SDA Tab */}
          <TabsContent value="sda" className="h-full m-0 overflow-hidden">
            <SDAPanel />
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
