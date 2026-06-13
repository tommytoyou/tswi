'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { CardSkeleton } from './card-skeleton';
import { chartColors, chartTheme, calculateTrend, getRiskLevel, riskColors } from '@/lib/design-system';

interface SolarWindDataPoint {
  ts: string;
  bx_gsm: number;
  by_gsm: number;
  bz_gsm: number;
  bt: number;
}

export function SolarWindCardV2() {
  const [data, setData] = useState<SolarWindDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/noaa/solar-wind?limit=1440'); // 24 hours
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
            <Activity className="h-4 w-4" />
            Solar Wind Magnetic Field
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

  // Calculate trends
  const bzTrend = calculateTrend(latest.bz_gsm, previous.bz_gsm);
  const btTrend = calculateTrend(latest.bt, previous.bt);

  // Determine risk level based on Bz (southward Bz is concerning)
  const bzRisk = getRiskLevel(Math.abs(latest.bz_gsm), { low: 5, moderate: 10, high: 15 });
  const bzColor = riskColors[bzRisk];

  // Format data for chart
  const chartData = data.slice(-180).map((d) => ({ // Last 3 hours for readability
    time: new Date(d.ts).getTime(),
    Bx: d.bx_gsm,
    By: d.by_gsm,
    Bz: d.bz_gsm,
    Bt: d.bt,
  }));

  const TrendIcon = bzTrend === 'up' ? TrendingUp : bzTrend === 'down' ? TrendingDown : Minus;

  return (
    <Card className="border-slate-800 bg-slate-900/50 h-full flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-intel-cyan" />
            Solar Wind Magnetic Field
          </CardTitle>
          <Badge variant="outline" className={`${bzColor.text} ${bzColor.border}`}>
            {bzRisk}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 py-2 px-3 gap-2">
        {/* Current Values */}
        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-intel-muted">Bx</span>
              <TrendIcon className={`h-3 w-3 ${btTrend === 'up' ? 'text-green-400' : btTrend === 'down' ? 'text-red-400' : 'text-slate-400'}`} />
            </div>
            <div className="text-lg font-bold font-mono" style={{ color: chartColors.bx }}>
              {latest.bx_gsm.toFixed(1)}
            </div>
            <div className="text-xs text-intel-muted">nT</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-intel-muted">By</span>
            </div>
            <div className="text-lg font-bold font-mono" style={{ color: chartColors.by }}>
              {latest.by_gsm.toFixed(1)}
            </div>
            <div className="text-xs text-intel-muted">nT</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-intel-muted">Bz</span>
              <TrendIcon className={`h-3 w-3 ${bzTrend === 'up' ? 'text-green-400' : bzTrend === 'down' ? 'text-red-400' : 'text-slate-400'}`} />
            </div>
            <div className="text-lg font-bold font-mono" style={{ color: chartColors.bz }}>
              {latest.bz_gsm.toFixed(1)}
            </div>
            <div className="text-xs text-intel-muted">nT</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-intel-muted">Bt</span>
            </div>
            <div className="text-lg font-bold font-mono" style={{ color: chartColors.bt }}>
              {latest.bt.toFixed(1)}
            </div>
            <div className="text-xs text-intel-muted">nT</div>
          </div>
        </div>

        {/* Time Series Chart */}
        <div className="flex-1 min-h-0 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={chartTheme.gridColor}
                opacity={0.1}
              />
              <XAxis
                dataKey="time"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(time) => format(new Date(time), 'HH:mm')}
                stroke={chartTheme.textColor}
                style={{ fontSize: chartTheme.fontSize }}
                tickLine={false}
              />
              <YAxis
                stroke={chartTheme.textColor}
                style={{ fontSize: chartTheme.fontSize }}
                tickLine={false}
                label={{ value: 'nT', angle: -90, position: 'insideLeft', fill: chartTheme.textColor }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: chartTheme.tooltipBg,
                  border: `1px solid ${chartTheme.tooltipBorder}`,
                  borderRadius: '6px',
                  fontSize: chartTheme.fontSize,
                }}
                labelFormatter={(time) => format(new Date(time), 'HH:mm:ss')}
                formatter={(value: any) => [`${value.toFixed(2)} nT`]}
              />
              <Legend
                wrapperStyle={{ fontSize: chartTheme.fontSize }}
                iconType="line"
              />
              <Line
                type="monotone"
                dataKey="Bx"
                stroke={chartColors.bx}
                dot={false}
                strokeWidth={1.5}
                name="Bx (GSM)"
              />
              <Line
                type="monotone"
                dataKey="By"
                stroke={chartColors.by}
                dot={false}
                strokeWidth={1.5}
                name="By (GSM)"
              />
              <Line
                type="monotone"
                dataKey="Bz"
                stroke={chartColors.bz}
                dot={false}
                strokeWidth={2}
                name="Bz (GSM)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Footer Info */}
        <div className="flex justify-between items-center text-xs flex-shrink-0">
          <div className="text-intel-muted">
            Last 3h • NOAA SWPC
          </div>
          <div className="text-intel-muted">
            {format(new Date(latest.ts), 'HH:mm')} UTC
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
