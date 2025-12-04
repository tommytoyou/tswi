'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Wind } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { CardSkeleton } from './card-skeleton';
import { chartTheme, calculateTrend, getRiskLevel, riskColors } from '@/lib/design-system';

interface SolarWindPlasmaDataPoint {
  ts: string;
  speed_kms: number;
  density_cm3: number;
  temp_k: number;
}

export function SolarWindPlasmaCard() {
  const [data, setData] = useState<SolarWindPlasmaDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/noaa/solar-wind-plasma?fetch=latest&limit=1440'); // 24 hours
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
            <Wind className="h-4 w-4" />
            Solar Wind Plasma
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

  // Calculate trends
  const speedTrend = calculateTrend(latest.speed_kms, previous.speed_kms);
  const densityTrend = calculateTrend(latest.density_cm3, previous.density_cm3);

  // Determine risk level based on speed (high speed streams cause geomagnetic activity)
  // Normal: < 400 km/s, Elevated: 400-500, High: 500-700, Extreme: > 700
  const speedRisk = getRiskLevel(latest.speed_kms, { low: 400, moderate: 500, high: 700 });
  const speedColor = riskColors[speedRisk];

  // Format data for chart - last 3 hours for readability
  const chartData = data.slice(-180).map((d) => ({
    time: new Date(d.ts).getTime(),
    Speed: d.speed_kms,
    Density: d.density_cm3,
  }));

  const TrendIcon = speedTrend === 'up' ? TrendingUp : speedTrend === 'down' ? TrendingDown : Minus;

  // Format temperature for display
  const formatTemp = (temp: number) => {
    if (temp >= 1000000) return `${(temp / 1000000).toFixed(1)}M`;
    if (temp >= 1000) return `${(temp / 1000).toFixed(0)}K`;
    return temp.toFixed(0);
  };

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wind className="h-4 w-4 text-cyan-400" />
            Solar Wind Plasma
          </CardTitle>
          <Badge variant="outline" className={`${speedColor.text} ${speedColor.border}`}>
            {speedRisk}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Values */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">Speed</span>
              <TrendIcon className={`h-3 w-3 ${speedTrend === 'up' ? 'text-orange-400' : speedTrend === 'down' ? 'text-green-400' : 'text-slate-400'}`} />
            </div>
            <div className="text-lg font-bold font-mono text-cyan-400">
              {latest.speed_kms.toFixed(0)}
            </div>
            <div className="text-xs text-slate-500">km/s</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">Density</span>
              {densityTrend !== 'stable' && (
                <TrendIcon className={`h-3 w-3 ${densityTrend === 'up' ? 'text-orange-400' : 'text-green-400'}`} />
              )}
            </div>
            <div className="text-lg font-bold font-mono text-violet-400">
              {latest.density_cm3.toFixed(1)}
            </div>
            <div className="text-xs text-slate-500">/cm³</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">Temp</span>
            </div>
            <div className="text-lg font-bold font-mono text-amber-400">
              {formatTemp(latest.temp_k)}
            </div>
            <div className="text-xs text-slate-500">K</div>
          </div>
        </div>

        {/* Speed indicator bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>300</span>
            <span>500</span>
            <span>700</span>
            <span>900+</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                latest.speed_kms < 400 ? 'bg-green-500' :
                latest.speed_kms < 500 ? 'bg-yellow-500' :
                latest.speed_kms < 700 ? 'bg-orange-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, ((latest.speed_kms - 300) / 600) * 100)}%` }}
            />
          </div>
        </div>

        {/* Time Series Chart */}
        <div className="h-[140px] w-full">
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
                yAxisId="speed"
                stroke={chartTheme.textColor}
                style={{ fontSize: chartTheme.fontSize }}
                tickLine={false}
                domain={['auto', 'auto']}
              />
              <YAxis
                yAxisId="density"
                orientation="right"
                stroke={chartTheme.textColor}
                style={{ fontSize: chartTheme.fontSize }}
                tickLine={false}
                domain={['auto', 'auto']}
                hide
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: chartTheme.tooltipBg,
                  border: `1px solid ${chartTheme.tooltipBorder}`,
                  borderRadius: '6px',
                  fontSize: chartTheme.fontSize,
                }}
                labelFormatter={(time) => format(new Date(time), 'HH:mm:ss')}
                formatter={(value: any, name: string) => [
                  name === 'Speed' ? `${value.toFixed(0)} km/s` : `${value.toFixed(1)} /cm³`,
                  name
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: chartTheme.fontSize }}
                iconType="line"
              />
              <Line
                yAxisId="speed"
                type="monotone"
                dataKey="Speed"
                stroke="#06b6d4"
                dot={false}
                strokeWidth={2}
                name="Speed"
              />
              <Line
                yAxisId="density"
                type="monotone"
                dataKey="Density"
                stroke="#8b5cf6"
                dot={false}
                strokeWidth={1.5}
                name="Density"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Footer Info */}
        <div className="flex justify-between items-center text-xs">
          <div className="text-slate-500">
            Last 3 hours • NOAA SWPC
          </div>
          <div className="text-slate-400">
            {format(new Date(latest.ts), 'HH:mm:ss')} UTC
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
