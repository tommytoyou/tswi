'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { riskColors } from '@/lib/design-system';
import {
  calculateRScale,
  calculateSScale,
  calculateGScale,
  scaleLevelToTier,
} from '@/lib/noaa-scales';

const tierLabels = ['NOMINAL', 'ELEVATED', 'HIGH', 'SEVERE'] as const;
const tierToRiskColors = [
  riskColors.LOW,
  riskColors.MODERATE,
  riskColors.HIGH,
  riskColors.SEVERE,
] as const;

const severityToTier: Record<string, 0 | 1 | 2 | 3> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};
const severityRank: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

interface PostureState {
  rLevel: number | null;
  sLevel: number | null;
  gLevel: number | null;
  mFlare24h: number | null;
  alertCount: number | null;
  topSeverity: string | null;
  loading: boolean;
}

const initialState: PostureState = {
  rLevel: null,
  sLevel: null,
  gLevel: null,
  mFlare24h: null,
  alertCount: null,
  topSeverity: null,
  loading: true,
};

export function ThreatPostureStrip() {
  const [state, setState] = useState<PostureState>(initialState);

  useEffect(() => {
    let cancelled = false;

    const fetchPosture = async () => {
      const next: Partial<PostureState> = {};

      // R-Scale from latest X-ray flux
      try {
        const res = await fetch('/api/noaa/xray-flux?fetch=latest&limit=1');
        const json = await res.json();
        const latest = json?.data?.[json.data.length - 1];
        if (latest && typeof latest.flux === 'number') {
          next.rLevel = calculateRScale(latest.flux);
        }
      } catch {
        // leave rLevel unset → renders '--'
      }

      // S-Scale from latest proton flux
      try {
        const res = await fetch('/api/noaa/proton-flux?fetch=latest&limit=1');
        const json = await res.json();
        const latest = json?.data?.[json.data.length - 1];
        if (latest && typeof latest.p10_pfu === 'number') {
          next.sLevel = calculateSScale(latest.p10_pfu);
        }
      } catch {
        // leave sLevel unset
      }

      // G-Scale from latest Kp index
      try {
        const res = await fetch('/api/noaa/kp-index?fetch=latest&limit=1');
        const json = await res.json();
        const latest = json?.data?.[json.data.length - 1];
        const kp = latest?.kp ?? latest?.kp_index;
        if (typeof kp === 'number') {
          next.gLevel = calculateGScale(kp);
        }
      } catch {
        // leave gLevel unset
      }

      // NOAA SWPC M-class flare probability, next 24h (as published)
      try {
        const res = await fetch('/api/ai/surya-prediction');
        const json = await res.json();
        // 503 / success:false / forecast:null → leave unset (shown as N/A)
        const forecast = res.ok && json?.success ? json?.data?.forecast : null;
        const day1 = Array.isArray(forecast) ? forecast.find((p: { horizon: string }) => p.horizon === '24h') : null;
        if (day1 && typeof day1.M === 'number') {
          next.mFlare24h = day1.M;
        }
      } catch {
        // leave mFlare24h unset
      }

      // Unacknowledged alerts
      try {
        const res = await fetch('/api/alerts/history?acknowledged=false&limit=50');
        const json = await res.json();
        const alerts = json?.data;
        if (Array.isArray(alerts)) {
          next.alertCount = json?.stats?.unacknowledged ?? alerts.length;
          let top: string | null = null;
          for (const a of alerts) {
            const sev = a?.severity;
            if (sev && (top === null || (severityRank[sev] ?? 0) > (severityRank[top] ?? 0))) {
              top = sev;
            }
          }
          next.topSeverity = top;
        }
      } catch {
        // leave alert values unset
      }

      if (!cancelled) {
        setState({ ...initialState, ...next, loading: false });
      }
    };

    fetchPosture();
    const interval = setInterval(fetchPosture, 2 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const { rLevel, sLevel, gLevel, mFlare24h, alertCount, topSeverity } = state;

  // Tier computations
  const scaleTier = Math.max(
    scaleLevelToTier(rLevel ?? 0),
    scaleLevelToTier(sLevel ?? 0),
    scaleLevelToTier(gLevel ?? 0)
  ) as 0 | 1 | 2 | 3;

  const alertTier: 0 | 1 | 2 | 3 = topSeverity ? severityToTier[topSeverity] ?? 0 : 0;

  // Posture comes only from NOAA R/S/G scale levels and active alerts.
  // The flare probability is shown as data, not scored.
  const overallTier = Math.max(scaleTier, alertTier) as 0 | 1 | 2 | 3;

  const labelClass = 'text-[10px] font-mono uppercase tracking-widest text-intel-muted';
  const placeholder = <span className="text-intel-muted">--</span>;

  return (
    <div className="flex flex-row items-stretch w-full h-14 bg-intel-panel border-b border-intel-border flex-shrink-0">
      {/* Segment 1 — Overall Threat Posture */}
      <div className="flex flex-col justify-center px-4 min-w-[160px] flex-1">
        <span className={labelClass}>Threat Posture</span>
        <span className={`text-sm font-bold font-mono ${tierToRiskColors[overallTier].text}`}>
          {state.loading ? placeholder : tierLabels[overallTier]}
        </span>
      </div>

      {/* Segment 2 — R/S/G */}
      <div className="flex flex-col justify-center px-4 min-w-[140px] flex-1 border-l border-intel-border">
        <span className={labelClass}>R/S/G</span>
        {state.loading ? (
          <span className="text-sm font-bold font-mono text-intel-muted">--</span>
        ) : (
          <span className="text-sm font-bold font-mono">
            <span className={tierToRiskColors[scaleLevelToTier(rLevel ?? 0)].text}>
              R{rLevel ?? '--'}
            </span>{' '}
            <span className={tierToRiskColors[scaleLevelToTier(sLevel ?? 0)].text}>
              S{sLevel ?? '--'}
            </span>{' '}
            <span className={tierToRiskColors[scaleLevelToTier(gLevel ?? 0)].text}>
              G{gLevel ?? '--'}
            </span>
          </span>
        )}
      </div>

      {/* Segment 3 — Flare forecast */}
      <div className="flex flex-col justify-center px-4 min-w-[150px] flex-1 border-l border-intel-border">
        <span className={labelClass}>M-flare 24H</span>
        {state.loading ? (
          <span className="text-sm font-bold font-mono text-intel-muted">--</span>
        ) : mFlare24h === null ? (
          <span className="text-sm font-bold font-mono text-intel-muted" title="NOAA flare forecast unavailable">N/A</span>
        ) : (
          <span
            className="text-sm font-bold font-mono text-intel-cyan"
            title="NOAA SWPC M-class flare probability, next 24h"
          >
            {Math.round(mFlare24h * 100)}%
          </span>
        )}
      </div>

      {/* Segment 4 — Active alerts */}
      <div className="flex flex-col justify-center px-4 min-w-[140px] flex-1 border-l border-intel-border">
        <span className={labelClass}>Active Alerts</span>
        {state.loading || alertCount === null ? (
          <span className="text-sm font-bold font-mono text-intel-muted">--</span>
        ) : (
          <span className="flex items-center gap-1.5">
            <Bell
              className={`h-3.5 w-3.5 ${
                alertCount > 0 ? tierToRiskColors[alertTier].text : 'text-intel-cyan'
              }`}
            />
            <span className={`text-sm font-bold font-mono ${tierToRiskColors[alertTier].text}`}>
              {alertCount}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
