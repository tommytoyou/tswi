'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sun, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';
import { CardSkeleton } from './card-skeleton';
import { getFlareColor, chartTheme, calculateTrend } from '@/lib/design-system';

interface XRayDataPoint {
  ts: string;
  flux: number;
  energy: string;
  satellite?: number;
}

export function XRayFluxCardV2() {
  const [data, setData] = useState<XRayDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flareClass, setFlareClass] = useState<string>('A-class');

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/noaa/xray-flux?limit=720'); // 6 hours
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        setData(result.data);
        setFlareClass(result.flareClass || 'A-class');
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
            <Sun className="h-4 w-4" />
            X-ray Flux (GOES)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-400">{error || 'No data'}</p>
        </CardContent>
      </Card>
    );
  }

  const latest = data[data.length - 1];
  const previous = data[Math.max(0, data.length - 60)]; // 1 hour ago

  const trend = calculateTrend(latest.flux, previous.flux);
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  // Format data for chart (use log scale for better visualization)
  const chartData = data.filter((_, i) => i % 2 === 0).map((d) => ({ // Sample every 2nd point
    time: new Date(d.ts).getTime(),
    flux: d.flux,
    logFlux: Math.log10(d.flux), // Log scale for better vis
  }));

  const flareColor = getFlareColor(flareClass);
  const flareLevel = flareClass.charAt(0);

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="h-4 w-4 text-orange-400" />
            X-ray Flux
          </CardTitle>
          <Badge
            style={{ backgroundColor: flareColor }}
            className="font-bold"
          >
            {flareClass}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Value */}
        <div className="flex items-baseline gap-3">
          <div className="text-3xl font-bold font-mono" style={{ color: flareColor }}>
            {flareLevel}
          </div>
          <div className="flex items-center gap-2">
            <TrendIcon
              className={`h-5 w-5 ${
                trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-green-400' : 'text-slate-400'
              }`}
            />
            <div className="text-xs text-slate-400">
              <div>Solar X-ray flux</div>
              <div className="text-slate-500">{latest.flux.toExponential(2)} W/m²</div>
            </div>
          </div>
        </div>

        {/* Flare Class Reference Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>A</span>
            <span>B</span>
            <span>C</span>
            <span>M</span>
            <span>X</span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden bg-slate-800">
            <div className="absolute inset-0 flex">
              <div className="flex-1 bg-green-900/30" />
              <div className="flex-1 bg-green-700/30" />
              <div className="flex-1 bg-yellow-600/30" />
              <div className="flex-1 bg-orange-600/30" />
              <div className="flex-1 bg-red-600/30" />
            </div>
            <div
              className="absolute top-0 bottom-0 w-1 bg-white rounded"
              style={{
                left: `${
                  flareLevel === 'A' ? '10%' :
                  flareLevel === 'B' ? '30%' :
                  flareLevel === 'C' ? '50%' :
                  flareLevel === 'M' ? '70%' :
                  '90%'
                }`,
              }}
            />
          </div>
        </div>

        {/* Area Chart (Log Scale) */}
        <div className="h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="fluxGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={flareColor} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={flareColor} stopOpacity={0.1} />
                </linearGradient>
              </defs>
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
                domain={[-9, -3]}
                ticks={[-9, -8, -7, -6, -5, -4, -3]}
                tickFormatter={(value) => {
                  const classes = ['A', 'A', 'B', 'C', 'M', 'M', 'X'];
                  return classes[value + 9] || '';
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: chartTheme.tooltipBg,
                  border: `1px solid ${chartTheme.tooltipBorder}`,
                  borderRadius: '6px',
                  fontSize: chartTheme.fontSize,
                }}
                labelFormatter={(time) => format(new Date(time), 'HH:mm:ss')}
                formatter={(value: any, name: string, props: any) => [
                  `${props.payload.flux.toExponential(2)} W/m²`,
                  'X-ray Flux'
                ]}
              />
              {/* Reference lines for flare classes */}
              <ReferenceLine y={-8} stroke="#22c55e" strokeDasharray="2 2" opacity={0.3} />
              <ReferenceLine y={-7} stroke="#eab308" strokeDasharray="2 2" opacity={0.3} />
              <ReferenceLine y={-6} stroke="#f97316" strokeDasharray="2 2" opacity={0.3} />
              <ReferenceLine y={-5} stroke="#ef4444" strokeDasharray="2 2" opacity={0.3} />
              <Area
                type="monotone"
                dataKey="logFlux"
                stroke={flareColor}
                fill="url(#fluxGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Footer Info */}
        <div className="flex justify-between items-center text-xs">
          <div className="text-slate-500">
            Last 6 hours • GOES-{data.find(d => d.satellite !== undefined)?.satellite ?? 18}
          </div>
          <div className="text-slate-400">
            {format(new Date(latest.ts), 'HH:mm:ss')} UTC
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
