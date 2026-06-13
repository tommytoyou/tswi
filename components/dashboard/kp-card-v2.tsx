'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { format, subHours } from 'date-fns';
import { CardSkeleton } from './card-skeleton';
import { getKpLevel, chartTheme, calculateTrend, riskColors } from '@/lib/design-system';

interface KpDataPoint {
  ts: string;
  kp: number;
  kp_index: number;
}

export function KpCardV2() {
  const [data, setData] = useState<KpDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/noaa/kp-index?limit=480'); // 8 hours (one reading per minute)
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        setData(result.data);
      } else {
        throw new Error('No data available');
      }
      setError(null);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <CardSkeleton />;

  if (error || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Kp Index (Geomagnetic Activity)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-intel-red">{error || 'No data'}</p>
        </CardContent>
      </Card>
    );
  }

  const latest = data[data.length - 1];
  const previous = data[Math.max(0, data.length - 60)]; // 1 hour ago
  const currentKp = latest.kp || latest.kp_index;

  const kpLevel = getKpLevel(currentKp);
  const trend = calculateTrend(currentKp, previous.kp || previous.kp_index);
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  // Group data by 3-hour intervals for better visualization
  const groupedData: { time: string; kp: number; timestamp: number }[] = [];
  for (let i = 0; i < data.length; i += 180) { // Every 180 minutes = 3 hours
    const slice = data.slice(i, i + 180);
    if (slice.length > 0) {
      const avgKp = slice.reduce((sum, d) => sum + (d.kp || d.kp_index), 0) / slice.length;
      groupedData.push({
        time: format(new Date(slice[0].ts), 'HH:mm'),
        kp: Math.round(avgKp),
        timestamp: new Date(slice[0].ts).getTime(),
      });
    }
  }

  const chartData = groupedData.slice(-8); // Last 24 hours (8 x 3-hour periods)

  return (
    <Card className="border-slate-800 bg-slate-900/50 h-full flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-intel-cyan" />
            Kp Index
          </CardTitle>
          <Badge
            className={riskColors[kpLevel.risk as keyof typeof riskColors].badge}
          >
            {kpLevel.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 py-2 px-3 gap-2">
        {/* Current Value */}
        <div className="flex items-baseline gap-2 flex-shrink-0">
          <div className="text-3xl font-bold font-mono" style={{ color: kpLevel.color }}>
            {currentKp}
          </div>
          <div className="flex items-center gap-2">
            <TrendIcon
              className={`h-4 w-4 ${
                trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-green-400' : 'text-slate-400'
              }`}
            />
            <div className="text-xs text-intel-muted">
              <div>3-hour Kp</div>
            </div>
          </div>
        </div>

        {/* Storm Level Indicator */}
        <div className="grid grid-cols-10 gap-0.5 flex-shrink-0">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
            <div
              key={level}
              className={`h-1.5 rounded ${
                level <= currentKp
                  ? level < 4
                    ? 'bg-green-500'
                    : level < 5
                    ? 'bg-yellow-500'
                    : level < 7
                    ? 'bg-orange-500'
                    : 'bg-red-500'
                  : 'bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* 24-Hour History Bar Chart */}
        <div className="flex-1 min-h-0 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={chartTheme.gridColor}
                opacity={0.1}
              />
              <XAxis
                dataKey="time"
                stroke={chartTheme.textColor}
                style={{ fontSize: chartTheme.fontSize }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 9]}
                ticks={[0, 3, 5, 7, 9]}
                stroke={chartTheme.textColor}
                style={{ fontSize: chartTheme.fontSize }}
                tickLine={false}
                label={{ value: 'Kp', angle: -90, position: 'insideLeft', fill: chartTheme.textColor }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: chartTheme.tooltipBg,
                  border: `1px solid ${chartTheme.tooltipBorder}`,
                  borderRadius: '6px',
                  fontSize: chartTheme.fontSize,
                }}
                formatter={(value: any) => [`Kp ${value}`, 'Index']}
              />
              <ReferenceLine y={4} stroke="#eab308" strokeDasharray="3 3" label={{ value: 'Active', position: 'right', fill: '#eab308', fontSize: 10 }} />
              <ReferenceLine y={5} stroke="#f97316" strokeDasharray="3 3" label={{ value: 'Storm', position: 'right', fill: '#f97316', fontSize: 10 }} />
              {/* Cell fills derive from getKpLevel().color (token-driven, already updated in the design-system pass) — no hardcoded colors here.
                  NOTE: the ReferenceLine strokes/labels above still use hardcoded hex (#eab308, #f97316); leave for a later chart-color pass. */}
              <Bar dataKey="kp" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => {
                  const level = getKpLevel(entry.kp);
                  return <Cell key={`cell-${index}`} fill={level.color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Footer Info */}
        <div className="flex justify-between items-center text-xs flex-shrink-0">
          <div className="text-intel-muted">
            24h • NOAA SWPC
          </div>
          <div className="text-intel-muted">
            {format(new Date(latest.ts), 'HH:mm')} UTC
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
