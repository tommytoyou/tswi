'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Radiation } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { format } from 'date-fns';
import { CardSkeleton } from './card-skeleton';
import { chartTheme, calculateTrend, riskColors } from '@/lib/design-system';

interface ProtonFluxDataPoint {
  ts: string;
  p10_pfu: number;
  p50_pfu: number;
  p100_pfu: number;
  s_scale: number;
}

const sScaleLabels: Record<number, { label: string; color: string; risk: keyof typeof riskColors }> = {
  0: { label: 'None', color: 'text-green-400', risk: 'LOW' },
  1: { label: 'S1 Minor', color: 'text-yellow-400', risk: 'MODERATE' },
  2: { label: 'S2 Moderate', color: 'text-orange-400', risk: 'HIGH' },
  3: { label: 'S3 Strong', color: 'text-orange-500', risk: 'HIGH' },
  4: { label: 'S4 Severe', color: 'text-red-400', risk: 'SEVERE' },
  5: { label: 'S5 Extreme', color: 'text-red-500', risk: 'SEVERE' },
};

export function ProtonFluxCard() {
  const [data, setData] = useState<ProtonFluxDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/noaa/proton-flux?fetch=latest&limit=288'); // 24 hours
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
    const interval = setInterval(fetchData, 5 * 60 * 1000); // 5 minute refresh
    return () => clearInterval(interval);
  }, []);

  if (loading) return <CardSkeleton />;

  if (error || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Radiation className="h-4 w-4" />
            Proton Flux (Radiation)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-400">{error || 'No data'}</p>
        </CardContent>
      </Card>
    );
  }

  const latest = data[data.length - 1];
  const previous = data[Math.max(0, data.length - 12)]; // 1 hour ago (5-min intervals)

  // Calculate trend
  const p10Trend = calculateTrend(latest.p10_pfu, previous.p10_pfu);
  const TrendIcon = p10Trend === 'up' ? TrendingUp : p10Trend === 'down' ? TrendingDown : Minus;

  // Get S-scale info
  const sScale = sScaleLabels[latest.s_scale] || sScaleLabels[0];

  // Format data for chart - use log scale visualization
  const chartData = data.slice(-144).map((d) => ({
    time: new Date(d.ts).getTime(),
    '>10 MeV': d.p10_pfu,
    '>50 MeV': d.p50_pfu,
    '>100 MeV': d.p100_pfu,
  }));

  // Format large numbers
  const formatFlux = (flux: number) => {
    if (flux >= 1000) return `${(flux / 1000).toFixed(1)}K`;
    if (flux >= 1) return flux.toFixed(1);
    return flux.toFixed(2);
  };

  return (
    <Card className="border-slate-800 bg-slate-900/50 h-full flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radiation className="h-4 w-4 text-orange-400" />
            Proton Flux
          </CardTitle>
          <Badge
            variant="outline"
            className={`${riskColors[sScale.risk].text} ${riskColors[sScale.risk].border}`}
          >
            {sScale.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 py-2 px-3 gap-2">
        {/* Current Values */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">&gt;10 MeV</span>
              <TrendIcon className={`h-3 w-3 ${p10Trend === 'up' ? 'text-red-400' : p10Trend === 'down' ? 'text-green-400' : 'text-slate-400'}`} />
            </div>
            <div className="text-lg font-bold font-mono text-orange-400">
              {formatFlux(latest.p10_pfu)}
            </div>
            <div className="text-xs text-slate-500">pfu</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">&gt;50 MeV</span>
            </div>
            <div className="text-lg font-bold font-mono text-amber-400">
              {formatFlux(latest.p50_pfu)}
            </div>
            <div className="text-xs text-slate-500">pfu</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">&gt;100 MeV</span>
            </div>
            <div className="text-lg font-bold font-mono text-yellow-400">
              {formatFlux(latest.p100_pfu)}
            </div>
            <div className="text-xs text-slate-500">pfu</div>
          </div>
        </div>

        {/* S-Scale Threshold Indicator */}
        <div className="space-y-0.5 flex-shrink-0">
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>S1</span>
            <span>S2</span>
            <span>S3</span>
            <span>S4</span>
            <span>S5</span>
          </div>
          <div className="grid grid-cols-5 gap-0.5">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className={`h-1.5 rounded ${
                  level <= latest.s_scale
                    ? level <= 1
                      ? 'bg-yellow-500'
                      : level <= 2
                      ? 'bg-orange-400'
                      : level <= 3
                      ? 'bg-orange-500'
                      : 'bg-red-500'
                    : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Time Series Chart - Log Scale */}
        <div className="flex-1 min-h-0 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
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
                scale="log"
                domain={[0.1, 'auto']}
                stroke={chartTheme.textColor}
                style={{ fontSize: chartTheme.fontSize }}
                tickLine={false}
                tickFormatter={(val) => val >= 1000 ? `${val/1000}K` : val}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: chartTheme.tooltipBg,
                  border: `1px solid ${chartTheme.tooltipBorder}`,
                  borderRadius: '6px',
                  fontSize: chartTheme.fontSize,
                }}
                labelFormatter={(time) => format(new Date(time), 'HH:mm:ss')}
                formatter={(value: any) => [`${value.toFixed(2)} pfu`]}
              />
              <Legend
                wrapperStyle={{ fontSize: chartTheme.fontSize }}
                iconType="line"
              />
              {/* S1 threshold line */}
              <ReferenceLine
                y={10}
                stroke="#eab308"
                strokeDasharray="3 3"
                label={{ value: 'S1', position: 'right', fill: '#eab308', fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey=">10 MeV"
                stroke="#f97316"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey=">50 MeV"
                stroke="#f59e0b"
                dot={false}
                strokeWidth={1.5}
              />
              <Line
                type="monotone"
                dataKey=">100 MeV"
                stroke="#eab308"
                dot={false}
                strokeWidth={1}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Footer Info */}
        <div className="flex justify-between items-center text-xs flex-shrink-0">
          <div className="text-slate-500">
            12h • GOES SWPC
          </div>
          <div className="text-slate-400">
            {format(new Date(latest.ts), 'HH:mm')} UTC
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
