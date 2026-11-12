'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Sun, AlertCircle } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine } from 'recharts';
import { formatUTC as format } from '@/lib/format-utc';
import { CardSkeleton } from './card-skeleton';
import { chartColors, chartTheme } from '@/lib/design-system';

interface ForecastPeriod {
  horizon: '24h' | '48h' | '72h';
  C: number;
  M: number;
  X: number;
  issued: string;
  source: string;
}

interface FluxPoint {
  time: string;
  flux: number;
  class: string;
}

interface FlareData {
  forecast: ForecastPeriod[] | null;
  reason?: string;
  xray_flux: {
    current: FluxPoint | null;
    timeline: FluxPoint[];
    source: string;
  };
  active_regions_count: number | null;
  generated_at: string;
}

// Flare class thresholds (W/m², 0.1-0.8 nm)
const CLASS_LINES: Array<[string, number]> = [['C', 1e-6], ['M', 1e-5], ['X', 1e-4]];

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** NOAA's date field ("2026-11-11T00:00:00") shown as "2026-11-11". */
const issuedLabel = (issued: string) => issued.slice(0, 10);

export function SuryaCardV2() {
  const [data, setData] = useState<FlareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ai/surya-prediction');
      const result = await response.json().catch(() => null);

      // 503 / success:false: no NOAA data at all. Show no numbers.
      if (!response.ok || !result?.success || !result.data) {
        throw new Error(result?.error || `HTTP ${response.status}`);
      }

      setData(result.data);
      setError(null);
    } catch {
      setData(null);
      setError('Flare data unavailable. Retrying.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  if (loading) return <CardSkeleton />;

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="h-4 w-4" />
            Solar Flare Probability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-intel-muted">{error || 'Flare data unavailable. Retrying.'}</p>
        </CardContent>
      </Card>
    );
  }

  const forecast = data.forecast;
  const current = data.xray_flux.current;
  const chartData = data.xray_flux.timeline.map((p) => ({
    time: format(new Date(p.time), 'HH:mm'),
    flux: p.flux,
    cls: p.class,
  }));

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="h-4 w-4 text-intel-cyan" />
            Solar Flare Probability
          </CardTitle>
          <Badge variant="outline" className="text-intel-cyan border-intel-cyan/30">
            NOAA SWPC
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* NOAA forecast table */}
        {forecast ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">
              NOAA SWPC forecast, issued {issuedLabel(forecast[0].issued)}
            </div>
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="text-xs text-intel-muted">
                  <th className="text-left font-normal py-1">Class</th>
                  {forecast.map((p) => (
                    <th key={p.horizon} className="text-right font-normal py-1">{p.horizon}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['C', 'M', 'X'] as const).map((cls) => (
                  <tr key={cls} className="border-t border-intel-border/40">
                    <td className="py-1 text-slate-300">{cls}-class</td>
                    {forecast.map((p) => (
                      <td key={p.horizon} className="py-1 text-right text-intel-cyan">{pct(p[cls])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-intel-amber/80">
            <AlertCircle className="h-3 w-3" />
            <span>No NOAA forecast available{data.reason ? `: ${data.reason}` : ''}.</span>
          </div>
        )}

        {/* Current observed flux */}
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1 px-2 py-1 bg-intel-panel/50 rounded">
            <Activity className="h-3 w-3 text-intel-cyan" />
            <span className="text-intel-muted">Current X-ray:</span>
            <span className="text-slate-300 font-mono">
              {current ? `${current.class} (${current.flux.toExponential(2)} W/m²) at ${format(new Date(current.time), 'HH:mm')} UTC` : 'N/A'}
            </span>
          </div>
          {data.active_regions_count !== null && (
            <div className="flex items-center gap-1 px-2 py-1 bg-intel-panel/50 rounded">
              <Sun className="h-3 w-3 text-intel-cyan" />
              <span className="text-intel-muted">Active regions:</span>
              <span className="text-slate-300 font-mono">{data.active_regions_count}</span>
            </div>
          )}
        </div>

        {/* Observed flux chart */}
        {chartData.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">
              Observed GOES X-ray flux <span className="text-intel-muted font-normal">· past 24h, UTC</span>
            </div>
            <div className="h-[160px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} opacity={0.1} />
                  <XAxis
                    dataKey="time"
                    stroke={chartTheme.textColor}
                    style={{ fontSize: chartTheme.fontSize }}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={40}
                  />
                  <YAxis
                    scale="log"
                    domain={[1e-8, 1e-3]}
                    ticks={[1e-8, 1e-7, 1e-6, 1e-5, 1e-4, 1e-3]}
                    allowDataOverflow
                    stroke={chartTheme.textColor}
                    style={{ fontSize: chartTheme.fontSize }}
                    tickLine={false}
                    tickFormatter={(v: number) => v.toExponential(0)}
                    width={45}
                  />
                  {CLASS_LINES.map(([label, y]) => (
                    <ReferenceLine
                      key={label}
                      y={y}
                      stroke={chartTheme.textColor}
                      strokeOpacity={0.3}
                      strokeDasharray="2 4"
                      label={{ value: label, position: 'right', fill: chartTheme.textColor, fontSize: 10 }}
                    />
                  ))}
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartTheme.tooltipBg,
                      border: `1px solid ${chartTheme.tooltipBorder}`,
                      borderRadius: '6px',
                      fontSize: chartTheme.fontSize,
                    }}
                    formatter={(value: any, _name: any, item: any) => [
                      `${Number(value).toExponential(2)} W/m² (${item?.payload?.cls})`,
                      'Peak flux',
                    ]}
                    labelFormatter={(t) => `${t} UTC`}
                  />
                  <Area
                    type="monotone"
                    dataKey="flux"
                    stroke={chartColors.warning}
                    fill={chartColors.warning}
                    fillOpacity={0.15}
                    strokeWidth={2}
                    name="X-ray flux"
                    baseValue={1e-8}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center text-xs text-intel-muted">
          <span>Source: NOAA SWPC solar_probabilities.json; GOES X-ray flux</span>
          <span>{format(new Date(data.generated_at), 'HH:mm:ss')} UTC</span>
        </div>
      </CardContent>
    </Card>
  );
}
