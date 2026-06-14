'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Sun, Radiation, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { riskColors } from '@/lib/design-system';
import { calculateRScale, calculateSScale, calculateGScale } from '@/lib/noaa-scales';

interface ScaleData {
  current: number;
  max24h: number;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

// NOAA Space Weather Scale definitions
const scaleDefinitions = {
  R: {
    name: 'Radio Blackout',
    icon: Sun,
    iconColor: 'text-intel-cyan',
    levels: ['R0', 'R1', 'R2', 'R3', 'R4', 'R5'],
    descriptions: ['None', 'Minor', 'Moderate', 'Strong', 'Severe', 'Extreme'],
  },
  S: {
    name: 'Solar Radiation Storm',
    icon: Radiation,
    iconColor: 'text-intel-cyan',
    levels: ['S0', 'S1', 'S2', 'S3', 'S4', 'S5'],
    descriptions: ['None', 'Minor', 'Moderate', 'Strong', 'Severe', 'Extreme'],
  },
  G: {
    name: 'Geomagnetic Storm',
    icon: Zap,
    iconColor: 'text-intel-cyan',
    levels: ['G0', 'G1', 'G2', 'G3', 'G4', 'G5'],
    descriptions: ['None', 'Minor', 'Moderate', 'Strong', 'Severe', 'Extreme'],
  },
};

// Color coding based on scale level — maps to the muted intel riskColors token set.
function getScaleColor(level: number): typeof riskColors[keyof typeof riskColors] {
  if (level === 0) return riskColors.LOW;
  if (level === 1 || level === 2) return riskColors.MODERATE;
  if (level === 3) return riskColors.HIGH;
  return riskColors.SEVERE;
}

interface ScaleBoxProps {
  type: 'R' | 'S' | 'G';
  current: number;
  max24h: number;
  loading: boolean;
  error: string | null;
}

function ScaleBox({ type, current, max24h, loading, error }: ScaleBoxProps) {
  const def = scaleDefinitions[type];
  const Icon = def.icon;
  const currentColors = getScaleColor(current);
  const max24hColors = getScaleColor(max24h);

  if (loading) {
    return (
      <div className="flex-1 p-4 rounded-lg bg-intel-panel/50 border border-intel-border animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 bg-slate-700 rounded" />
          <div className="w-24 h-4 bg-slate-700 rounded" />
        </div>
        <div className="w-16 h-12 bg-slate-700 rounded mx-auto" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-4 rounded-lg bg-intel-panel/50 border border-intel-border">
        <div className="flex items-center gap-2 mb-3">
          <Icon className={`h-5 w-5 ${def.iconColor}`} />
          <span className="text-xs text-intel-muted font-medium">{def.name}</span>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-600">{type}--</div>
          <div className="text-xs text-intel-red mt-1">No data</div>
        </div>
      </div>
    );
  }

  const showMax = max24h > current;

  return (
    <div className={`flex-1 p-4 rounded-lg ${currentColors.bg} border ${currentColors.border} transition-colors duration-300`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${def.iconColor}`} />
          <span className="text-xs text-slate-300 font-medium hidden sm:inline">{def.name}</span>
        </div>
        {current >= 3 && (
          <AlertTriangle className="h-4 w-4 text-intel-red animate-pulse" />
        )}
      </div>

      {/* Current Level - Large Display */}
      <div className="text-center">
        <div className={`text-4xl sm:text-5xl font-bold font-mono ${currentColors.text}`}>
          {type}{current}
        </div>
        <div className="text-xs text-intel-muted mt-1">
          {def.descriptions[current]}
        </div>
      </div>

      {/* 24h Max (if different from current) */}
      {showMax && (
        <div className={`mt-3 pt-2 border-t ${currentColors.border} flex items-center justify-center gap-2`}>
          <TrendingUp className="h-3 w-3 text-intel-muted" />
          <span className="text-xs text-intel-muted">24h max:</span>
          <span className={`text-sm font-bold font-mono ${max24hColors.text}`}>
            {type}{max24h}
          </span>
        </div>
      )}

      {/* Scale bar */}
      <div className="mt-3 flex gap-0.5">
        {[0, 1, 2, 3, 4, 5].map((level) => {
          const isActive = level <= current;
          const colors = getScaleColor(level);
          return (
            <div
              key={level}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                isActive ? colors.badge : 'bg-intel-border'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

export function RsgScalesCard() {
  const [rScale, setRScale] = useState<ScaleData>({ current: 0, max24h: 0, loading: true, error: null, lastUpdated: null });
  const [sScale, setSScale] = useState<ScaleData>({ current: 0, max24h: 0, loading: true, error: null, lastUpdated: null });
  const [gScale, setGScale] = useState<ScaleData>({ current: 0, max24h: 0, loading: true, error: null, lastUpdated: null });

  // Fetch X-ray flux for R-Scale
  const fetchRScale = async () => {
    try {
      const response = await fetch('/api/noaa/xray-flux?fetch=latest&limit=1440'); // 24 hours of data
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        const latest = result.data[result.data.length - 1];
        const current = calculateRScale(latest.flux);

        // Find max in last 24 hours
        const max24h = Math.max(...result.data.map((d: { flux: number }) => calculateRScale(d.flux)));

        setRScale({
          current,
          max24h,
          loading: false,
          error: null,
          lastUpdated: new Date(latest.ts),
        });
      } else {
        throw new Error('No data');
      }
    } catch {
      setRScale(prev => ({ ...prev, loading: false, error: 'Failed to load' }));
    }
  };

  // Fetch proton flux for S-Scale
  const fetchSScale = async () => {
    try {
      const response = await fetch('/api/noaa/proton-flux?fetch=latest&limit=288'); // 24 hours
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        const latest = result.data[result.data.length - 1];
        const current = calculateSScale(latest.p10_pfu);

        // Find max in last 24 hours
        const max24h = Math.max(...result.data.map((d: { p10_pfu: number }) => calculateSScale(d.p10_pfu)));

        setSScale({
          current,
          max24h,
          loading: false,
          error: null,
          lastUpdated: new Date(latest.ts),
        });
      } else {
        throw new Error('No data');
      }
    } catch {
      setSScale(prev => ({ ...prev, loading: false, error: 'Failed to load' }));
    }
  };

  // Fetch Kp index for G-Scale
  const fetchGScale = async () => {
    try {
      const response = await fetch('/api/noaa/kp-index?fetch=latest&limit=1440'); // 24 hours
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        const latest = result.data[result.data.length - 1];
        const kp = latest.kp || latest.kp_index;
        const current = calculateGScale(kp);

        // Find max in last 24 hours
        const max24h = Math.max(...result.data.map((d: { kp?: number; kp_index?: number }) => {
          const kpVal = d.kp || d.kp_index || 0;
          return calculateGScale(kpVal);
        }));

        setGScale({
          current,
          max24h,
          loading: false,
          error: null,
          lastUpdated: new Date(latest.ts),
        });
      } else {
        throw new Error('No data');
      }
    } catch {
      setGScale(prev => ({ ...prev, loading: false, error: 'Failed to load' }));
    }
  };

  useEffect(() => {
    // Fetch all scales
    fetchRScale();
    fetchSScale();
    fetchGScale();

    // Refresh every 2 minutes
    const interval = setInterval(() => {
      fetchRScale();
      fetchSScale();
      fetchGScale();
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Get the most recent timestamp
  const timestamps = [rScale.lastUpdated, sScale.lastUpdated, gScale.lastUpdated].filter(Boolean) as Date[];
  const latestUpdate = timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : null;

  // Check if any scale is elevated
  const maxScale = Math.max(rScale.current, sScale.current, gScale.current);
  const isElevated = maxScale >= 1;

  return (
    <Card className={isElevated ? 'ring-1 ring-intel-amber/30' : ''}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">NOAA Space Weather Scales</span>
            {isElevated && (
              <span className="px-2 py-0.5 text-xs font-medium bg-intel-amber/15 text-intel-amber rounded">
                ACTIVE
              </span>
            )}
          </div>
          {latestUpdate && (
            <span className="text-xs text-intel-muted">
              {format(latestUpdate, 'HH:mm')} UTC
            </span>
          )}
        </div>

        {/* Scale Boxes */}
        <div className="flex gap-3">
          <ScaleBox
            type="R"
            current={rScale.current}
            max24h={rScale.max24h}
            loading={rScale.loading}
            error={rScale.error}
          />
          <ScaleBox
            type="S"
            current={sScale.current}
            max24h={sScale.max24h}
            loading={sScale.loading}
            error={sScale.error}
          />
          <ScaleBox
            type="G"
            current={gScale.current}
            max24h={gScale.max24h}
            loading={gScale.loading}
            error={gScale.error}
          />
        </div>

        {/* Footer legend */}
        <div className="mt-4 pt-3 border-t border-slate-800">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-intel-muted justify-center">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-intel-cyan" /> 0: None
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-intel-amber" /> 1-2: Minor/Moderate
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#C9744D]" /> 3: Strong
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-intel-red" /> 4-5: Severe/Extreme
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
