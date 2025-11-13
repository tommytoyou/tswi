/**
 * TSWI Professional Design System
 * Enterprise-grade space weather intelligence platform
 */

// Risk Level Color System
export const riskColors = {
  LOW: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    badge: 'bg-green-500',
    chart: '#10b981', // green-500
  },
  MODERATE: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    badge: 'bg-yellow-500',
    chart: '#eab308', // yellow-500
  },
  HIGH: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    badge: 'bg-orange-500',
    chart: '#f97316', // orange-500
  },
  SEVERE: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    badge: 'bg-red-500',
    chart: '#ef4444', // red-500
  },
} as const;

// Chart Color Palette (NASA-inspired)
export const chartColors = {
  primary: '#3b82f6', // blue-500
  secondary: '#8b5cf6', // violet-500
  success: '#10b981', // green-500
  warning: '#f59e0b', // amber-500
  danger: '#ef4444', // red-500
  info: '#06b6d4', // cyan-500

  // Magnetic field components
  bx: '#3b82f6', // blue-500
  by: '#8b5cf6', // violet-500
  bz: '#10b981', // green-500
  bt: '#f59e0b', // amber-500

  // Solar metrics
  xray: '#ef4444', // red-500
  proton: '#f97316', // orange-500
  electron: '#06b6d4', // cyan-500

  // Grid and axis
  grid: '#334155', // slate-700
  axis: '#64748b', // slate-500
  background: '#0f172a', // slate-900
} as const;

// Flare Classification Colors
export const flareColors = {
  A: '#10b981', // green-500 - Background
  B: '#22c55e', // green-400 - Quiet
  C: '#eab308', // yellow-500 - Minor
  M: '#f97316', // orange-500 - Moderate
  X: '#ef4444', // red-500 - Major
} as const;

// Kp Index Classification
export const kpLevels = [
  { min: 0, max: 2, label: 'Quiet', color: chartColors.success, risk: 'LOW' },
  { min: 3, max: 3, label: 'Unsettled', color: chartColors.info, risk: 'LOW' },
  { min: 4, max: 4, label: 'Active', color: chartColors.warning, risk: 'MODERATE' },
  { min: 5, max: 6, label: 'Minor Storm', color: '#f97316', risk: 'HIGH' },
  { min: 7, max: 8, label: 'Moderate Storm', color: chartColors.danger, risk: 'HIGH' },
  { min: 9, max: 9, label: 'Severe Storm', color: '#dc2626', risk: 'SEVERE' },
] as const;

// Get Kp level info
export function getKpLevel(kp: number) {
  return kpLevels.find(level => kp >= level.min && kp <= level.max) || kpLevels[0];
}

// Get flare class color
export function getFlareColor(flareClass: string): string {
  const firstChar = flareClass.charAt(0).toUpperCase();
  return flareColors[firstChar as keyof typeof flareColors] || flareColors.A;
}

// Chart theme configuration
export const chartTheme = {
  fontSize: 11,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  textColor: '#94a3b8', // slate-400
  gridColor: '#334155', // slate-700
  tooltipBg: '#1e293b', // slate-800
  tooltipBorder: '#475569', // slate-600
};

// Time range options
export const timeRanges = [
  { label: '1H', value: 1, hours: 1 },
  { label: '6H', value: 6, hours: 6 },
  { label: '24H', value: 24, hours: 24 },
  { label: '7D', value: 168, hours: 168 },
] as const;

// Refresh intervals
export const refreshIntervals = [
  { label: '30s', value: 30000 },
  { label: '1m', value: 60000 },
  { label: '2m', value: 120000 },
  { label: '5m', value: 300000 },
] as const;

// Status indicators
export const statusColors = {
  online: 'bg-green-500',
  offline: 'bg-red-500',
  degraded: 'bg-yellow-500',
  loading: 'bg-blue-500',
} as const;

// Animation durations
export const animations = {
  fast: 150,
  normal: 300,
  slow: 500,
  chart: 1000,
} as const;

// Utility function to get risk level from value
export function getRiskLevel(value: number, thresholds: { low: number; moderate: number; high: number }): keyof typeof riskColors {
  if (value >= thresholds.high) return 'SEVERE';
  if (value >= thresholds.moderate) return 'HIGH';
  if (value >= thresholds.low) return 'MODERATE';
  return 'LOW';
}

// Format numbers for display
export function formatMetric(value: number, decimals: number = 1): string {
  if (Math.abs(value) >= 1000000) {
    return (value / 1000000).toFixed(decimals) + 'M';
  }
  if (Math.abs(value) >= 1000) {
    return (value / 1000).toFixed(decimals) + 'K';
  }
  return value.toFixed(decimals);
}

// Calculate trend direction
export function calculateTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
  const change = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(change) < 5) return 'stable';
  return change > 0 ? 'up' : 'down';
}
