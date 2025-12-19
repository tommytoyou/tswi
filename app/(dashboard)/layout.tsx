import React from 'react';
import { ActivityTrackerProvider } from '@/hooks/useActivityTracker';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ActivityTrackerProvider>
      {children}
    </ActivityTrackerProvider>
  );
}
