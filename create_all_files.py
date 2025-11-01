#!/usr/bin/env python3
import os

# All remaining files to create
files = {
    'app/(dashboard)/layout.tsx': '''import { TopNav } from '@/components/navigation/top-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1 p-6 bg-slate-950">
        {children}
      </main>
    </div>
  );
}
''',
    'app/(dashboard)/dashboard/page.tsx': '''import { SolarWindCard } from '@/components/dashboard/solar-wind-card';
import { KpCard } from '@/components/dashboard/kp-card';
import { DstCard } from '@/components/dashboard/dst-card';
import { SepCard } from '@/components/dashboard/sep-card';
import { ForecastCard } from '@/components/dashboard/forecast-card';

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Space Weather Dashboard</h1>
        <div className="text-sm text-slate-400">
          Last updated: {new Date().toLocaleTimeString()} UTC
        </div>
      </div>

      {/* Top Row: Forecast */}
      <div className="grid grid-cols-1 gap-6">
        <ForecastCard />
      </div>

      {/* Main Grid: Key Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SolarWindCard />
        <KpCard />
        <DstCard />
        <SepCard />
      </div>

      {/* TODO: Add recent events timeline */}
      {/* TODO: Add active alerts panel */}
      {/* TODO: Add quick satellite status */}
    </div>
  );
}
''',
    'app/(dashboard)/map/page.tsx': ''''use client';

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
''',
    'app/(dashboard)/alerts/page.tsx': '''import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AlertsPage() {
  // TODO: Fetch alerts from API
  const mockAlerts = [
    {
      id: '1',
      name: 'Storm Watch',
      conditions: 'Bz < -5 nT, Speed > 550 km/s',
      status: 'active' as const,
      lastTriggered: new Date('2025-11-01T08:30:00Z'),
    },
    {
      id: '2',
      name: 'HF Caution',
      conditions: 'Kp >= 5',
      status: 'active' as const,
      lastTriggered: null,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Alert Rules</h1>
          <p className="text-slate-400 mt-1">Manage custom space weather alerts</p>
        </div>
        <Button>+ New Alert</Button>
      </div>

      {/* Alert Rules List */}
      <div className="space-y-4">
        {mockAlerts.map((alert) => (
          <Card key={alert.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{alert.name}</CardTitle>
                  <CardDescription className="mt-2">
                    {alert.conditions}
                  </CardDescription>
                </div>
                <Badge variant={alert.status === 'active' ? 'default' : 'secondary'}>
                  {alert.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-400">
                  {alert.lastTriggered
                    ? `Last triggered: ${alert.lastTriggered.toLocaleString()}`
                    : 'Never triggered'}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Test</Button>
                  <Button variant="outline" size="sm">Edit</Button>
                  <Button variant="destructive" size="sm">Delete</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* TODO: Add alert creation modal */}
      {/* TODO: Add evidence drawer for triggered alerts */}
      {/* TODO: Add alert history timeline */}
    </div>
  );
}
''',
}

# Create all files
for path, content in files.items():
    dir_path = os.path.dirname(path)
    if dir_path:
        os.makedirs(dir_path, exist_ok=True)
    with open(path, 'w') as f:
        f.write(content)
    print(f"✓ {path}")

print("\nDashboard pages created!")
