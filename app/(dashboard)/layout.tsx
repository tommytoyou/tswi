'use client';

import React from 'react';
import { useActivityTracker } from '@/hooks/useActivityTracker';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Initialize activity tracking
  useActivityTracker();

  return <>{children}</>;
}
