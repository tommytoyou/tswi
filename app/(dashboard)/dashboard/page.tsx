import { Suspense } from 'react';
import { TabbedDashboard } from '@/components/dashboard/tabbed-dashboard';

function DashboardLoading() {
  return (
    <div className="h-screen flex items-center justify-center bg-slate-950">
      <div className="text-slate-400">Loading Dashboard...</div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <TabbedDashboard />
    </Suspense>
  );
}
