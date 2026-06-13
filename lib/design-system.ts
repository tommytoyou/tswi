/**
 * TSWI Professional Design System
 * Enterprise-grade space weather intelligence platform
 */

// Risk Level Color System
export const riskColors = {
  LOW: {
    bg: 'bg-[#5B9BD5]/8',
    border: 'border-[#5B9BD5]/25',
    text: 'text-[#5B9BD5]',
    badge: 'bg-[#5B9BD5]',
    chart: '#5B9BD5', // muted steel blue
  },
  MODERATE: {
    bg: 'bg-[#C9A875]/8',
    border: 'border-[#C9A875]/25',
    text: 'text-[#C9A875]',
    badge: 'bg-[#C9A875]',
    chart: '#C9A875', // muted amber
  },
  HIGH: {
    bg: 'bg-[#D9534F]/8',
    border: 'border-[#D9534F]/25',
    text: 'text-[#D9534F]',
    badge: 'bg-[#D9534F]',
    chart: '#D9534F', // safety red
  },
  SEVERE: {
    bg: 'bg-[#FF3B30]/8',
    border: 'border-[#FF3B30]/25',
    text: 'text-[#FF3B30]',
    badge: 'bg-[#FF3B30]',
    chart: '#FF3B30', // alert red
  },
} as const;

// Chart Color Palette (muted intel console)
export const chartColors = {
  primary: '#5B9BD5', // muted steel blue
  secondary: '#7FA8A3', // muted slate cyan
  success: '#6B9080', // muted sage green
  warning: '#C9A875', // muted amber
  danger: '#D9534F', // safety red - alerts/threats only
  info: '#5EA8C7', // muted cyan

  // Magnetic field components
  bx: '#5B9BD5', // muted steel blue
  by: '#7FA8A3', // muted slate cyan
  bz: '#6B9080', // muted sage green
  bt: '#C9A875', // muted amber

  // Solar metrics
  xray: '#D9534F', // safety red
  proton: '#C9744D', // muted burnt orange
  electron: '#5EA8C7', // muted cyan

  // Grid and axis
  grid: '#2A3744', // intel border
  axis: '#6B7E8F', // muted steel
  background: '#0F1923', // deep console navy
} as const;

// Flare Classification Colors
export const flareColors = {
  A: '#6B9080', // muted sage green - Background
  B: '#7FA8A3', // muted slate cyan - Quiet
  C: '#C9A875', // muted amber - Minor
  M: '#C9744D', // muted burnt orange - Moderate
  X: '#FF3B30', // alert red - Major
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
  textColor: '#8DA3B5', // muted steel
  gridColor: '#334155', // slate-700
  tooltipBg: '#1A2333', // intel panel
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
