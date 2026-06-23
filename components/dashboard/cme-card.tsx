'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sun, Clock, Zap, ExternalLink, AlertTriangle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { CardSkeleton } from './card-skeleton';
import { riskColors } from '@/lib/design-system';

interface ProcessedCme {
  id: string;
  startTime: string;
  sourceLocation?: string;
  activeRegion?: number | null;
  speed?: number;
  halfAngle?: number;
  isEarthDirected: boolean;
  estimatedArrival?: string | null;
  arrivalHours?: number | null;
  speedCategory: 'slow' | 'moderate' | 'fast' | 'extreme';
  linkedFlare?: string | null;
  note?: string;
  enlilModelUrl?: string;
}

interface CmeResponse {
  success: boolean;
  data: ProcessedCme[];
  count: number;
  earthDirectedCount: number;
  incomingCount: number;
  nextArrival?: string | null;
}

const speedCategoryInfo: Record<string, { label: string; color: string; risk: keyof typeof riskColors }> = {
  slow: { label: 'Slow', color: riskColors.LOW.text, risk: 'LOW' },
  moderate: { label: 'Moderate', color: riskColors.MODERATE.text, risk: 'MODERATE' },
  fast: { label: 'Fast', color: riskColors.HIGH.text, risk: 'HIGH' },
  extreme: { label: 'Extreme', color: riskColors.SEVERE.text, risk: 'SEVERE' },
};

function formatArrivalTime(arrivalHours: number | null | undefined): string {
  if (!arrivalHours) return 'N/A';
  if (arrivalHours < 1) return `${Math.round(arrivalHours * 60)}m`;
  if (arrivalHours < 24) return `${Math.round(arrivalHours)}h`;
  return `${Math.round(arrivalHours / 24)}d ${Math.round(arrivalHours % 24)}h`;
}

export function CmeCard() {
  const [data, setData] = useState<CmeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/nasa/cme?days=7');
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();

      if (result.success) {
        setData(result);
      } else {
        throw new Error(result.error || 'No data available');
      }
      setError(null);
    } catch (err) {
      setError('Failed to load CME data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15 * 60 * 1000); // 15 minute refresh
    return () => clearInterval(interval);
  }, []);

  if (loading) return <CardSkeleton />;

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="h-4 w-4" />
            Coronal Mass Ejections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-intel-red">{error || 'No data'}</p>
        </CardContent>
      </Card>
    );
  }

  // Get Earth-directed CMEs first
  const earthDirectedCmes = data.data.filter(cme => cme.isEarthDirected);
  const otherCmes = data.data.filter(cme => !cme.isEarthDirected);

  // Determine overall risk level
  const hasIncoming = earthDirectedCmes.some(cme => cme.arrivalHours && cme.arrivalHours > 0);
  const hasFast = earthDirectedCmes.some(cme => cme.speedCategory === 'fast' || cme.speedCategory === 'extreme');
  const riskLevel = hasIncoming && hasFast ? 'SEVERE' : hasIncoming ? 'HIGH' : earthDirectedCmes.length > 0 ? 'MODERATE' : 'LOW';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="h-4 w-4 text-intel-cyan" />
            CME Tracking
          </CardTitle>
          <Badge
            variant="outline"
            className={`${riskColors[riskLevel].text} ${riskColors[riskLevel].border}`}
          >
            {data.earthDirectedCount} Earth-Directed
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <span className="text-xs text-intel-muted">Total (7d)</span>
            <div className="text-2xl font-bold font-mono text-slate-200">
              {data.count}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-intel-muted">Earth-Directed</span>
            <div className={`text-2xl font-bold font-mono ${data.earthDirectedCount > 0 ? 'text-intel-amber' : 'text-slate-200'}`}>
              {data.earthDirectedCount}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-intel-muted">Incoming</span>
            <div className={`text-2xl font-bold font-mono ${data.incomingCount > 0 ? 'text-intel-red' : 'text-slate-200'}`}>
              {data.incomingCount}
            </div>
          </div>
        </div>

        {/* Incoming CME Alert */}
        {data.incomingCount > 0 && (
          <div className="p-3 rounded-lg bg-intel-red/10 border border-intel-red/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-intel-red" />
              <span className="text-sm font-semibold text-intel-red">Incoming CME Detected</span>
            </div>
            {earthDirectedCmes
              .filter(cme => cme.arrivalHours && cme.arrivalHours > 0)
              .slice(0, 2)
              .map(cme => (
                <div key={cme.id} className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-300 font-mono">
                    {cme.speed ? `${cme.speed} km/s` : 'Speed TBD'}
                  </span>
                  <span className="text-intel-red">
                    <Clock className="inline h-3 w-3 mr-1" />
                    ETA: {formatArrivalTime(cme.arrivalHours)}
                  </span>
                </div>
              ))}
          </div>
        )}

        {/* Recent CME List */}
        <div className="space-y-2">
          <span className="text-xs text-intel-muted uppercase tracking-wider">Recent CMEs</span>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {data.data.length === 0 ? (
              <div className="text-sm text-intel-muted text-center py-4">
                No CMEs detected in the last 7 days
              </div>
            ) : (
              data.data.slice(0, 6).map((cme) => {
                const speedInfo = speedCategoryInfo[cme.speedCategory];
                return (
                  <div
                    key={cme.id}
                    className={`p-2 rounded border ${
                      cme.isEarthDirected
                        ? 'border-intel-amber/30 bg-intel-amber/5'
                        : 'border-intel-border bg-intel-panel/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {cme.isEarthDirected && (
                          <span className="text-intel-amber" title="Earth-Directed">
                            <AlertTriangle className="h-3 w-3" />
                          </span>
                        )}
                        <span className="text-xs font-mono text-slate-300">
                          {format(new Date(cme.startTime), 'MMM d HH:mm')}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`${speedInfo.color} text-xs border-current`}
                      >
                        {cme.speed ? `${cme.speed} km/s` : 'N/A'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-intel-muted">
                        {cme.sourceLocation || 'Location N/A'}
                        {cme.activeRegion && ` (AR${cme.activeRegion})`}
                      </span>
                      {cme.isEarthDirected && cme.arrivalHours && cme.arrivalHours > 0 ? (
                        <span className="text-intel-amber">
                          ETA: {formatArrivalTime(cme.arrivalHours)}
                        </span>
                      ) : cme.isEarthDirected && cme.estimatedArrival ? (
                        <span className="text-intel-muted">
                          Arrived: {formatDistanceToNow(new Date(cme.estimatedArrival), { addSuffix: true })}
                        </span>
                      ) : null}
                    </div>
                    {cme.linkedFlare && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-intel-amber">
                        <Zap className="h-3 w-3" />
                        Linked: {cme.linkedFlare}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Speed Legend */}
        <div className="flex justify-between items-center text-xs">
          <div className="flex gap-3">
            <span className={riskColors.LOW.text}>&lt;500: Slow</span>
            <span className={riskColors.MODERATE.text}>500-1000: Mod</span>
            <span className={riskColors.HIGH.text}>1000-2000: Fast</span>
            <span className={riskColors.SEVERE.text}>&gt;2000: Extreme</span>
          </div>
        </div>

        {/* Footer Info */}
        <div className="flex justify-between items-center text-xs">
          <div className="text-intel-muted">
            Last 7 days • NASA DONKI
          </div>
          <a
            href="https://kauai.ccmc.gsfc.nasa.gov/DONKI/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-intel-cyan hover:text-intel-cyan/80 flex items-center gap-1"
          >
            DONKI <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
