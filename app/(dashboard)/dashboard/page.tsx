import { SolarWindCard } from '@/components/dashboard/solar-wind-card';
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
