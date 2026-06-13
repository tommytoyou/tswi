'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Compass } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';
import { CardSkeleton } from './card-skeleton';
import { chartColors, chartTheme, calculateTrend, riskColors } from '@/lib/design-system';

interface DstDataPoint {
  ts: string;
  dst_nt: number;
  storm_level: string;
}

const stormLevelInfo: Record<string, { label: string; color: string; risk: keyof typeof riskColors }> = {
  'quiet': { label: 'Quiet', color: riskColors.LOW.text, risk: 'LOW' },
  'minor': { label: 'Minor Storm', color: riskColors.MODERATE.text, risk: 'MODERATE' },
  'moderate': { label: 'Moderate Storm', color: riskColors.HIGH.text, risk: 'HIGH' },
  'intense': { label: 'Intense Storm', color: riskColors.SEVERE.text, risk: 'SEVERE' },
  'super-storm': { label: 'Super-Storm', color: riskColors.SEVERE.text, risk: 'SEVERE' },
};

export function DstCard() {
  const [data, setData] = useState<DstDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/noaa/dst?fetch=latest&limit=168'); // 7 days hourly
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
    const interval = setInterval(fetchData, 60 * 60 * 1000); // 1 hour refresh (data is hourly)
    return () => clearInterval(interval);
  }, []);

  if (loading) return <CardSkeleton />;

  if (error || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Compass className="h-4 w-4" />
            Dst Index (Ring Current)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-intel-red">{error || 'No data'}</p>
        </CardContent>
      </Card>
    );
  }

  const latest = data[data.length - 1];
  const previous = data[Math.max(0, data.length - 24)]; // 24 hours ago

  // Calculate trend (for Dst, more negative = worse)
  const dstTrend = calculateTrend(Math.abs(latest.dst_nt), Math.abs(previous.dst_nt));
  const TrendIcon = dstTrend === 'up' ? TrendingDown : dstTrend === 'down' ? TrendingUp : Minus;

  // Get storm level info
  const stormInfo = stormLevelInfo[latest.storm_level] || stormLevelInfo['quiet'];

  // Format data for chart - show last 72 hours (3 days)
  const chartData = data.slice(-72).map((d) => ({
    time: new Date(d.ts).getTime(),
    Dst: d.dst_nt,
  }));

  // Find min Dst in the period (most intense storm)
  const minDst = Math.min(...chartData.map(d => d.Dst));

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Compass className="h-4 w-4 text-intel-cyan" />
            Dst Index
          </CardTitle>
          <Badge
            variant="outline"
            className={`${riskColors[stormInfo.risk].text} ${riskColors[stormInfo.risk].border}`}
          >
            {stormInfo.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 py-2 px-3 gap-2">
        {/* Current Value */}
        <div className="flex items-baseline gap-3 flex-shrink-0">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1">
              <span className="text-xs text-intel-muted">Current</span>
              <TrendIcon className={`h-3 w-3 ${
                latest.dst_nt < previous.dst_nt ? 'text-intel-red' :
                latest.dst_nt > previous.dst_nt ? 'text-intel-cyan' : 'text-intel-muted'
              }`} />
            </div>
            <div className={`text-2xl font-bold font-mono ${
              latest.dst_nt > -20 ? 'text-green-400' :
              latest.dst_nt > -50 ? 'text-yellow-400' :
              latest.dst_nt > -100 ? 'text-orange-400' : 'text-red-400'
            }`}>
              {latest.dst_nt} <span className="text-xs text-intel-muted font-normal">nT</span>
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-xs text-intel-muted">72h Min</span>
            <div className="text-lg font-bold font-mono text-slate-300">
              {minDst} <span className="text-xs text-intel-muted font-normal">nT</span>
            </div>
          </div>
        </div>

        {/* Storm Level Indicator */}
        <div className="space-y-0.5 flex-shrink-0">
          <div className="flex justify-between text-[10px] text-intel-muted">
            <span>Quiet</span>
            <span>-20</span>
            <span>-50</span>
            <span>-100</span>
            <span>-200</span>
          </div>
          <div className="grid grid-cols-5 gap-0.5">
            {['quiet', 'minor', 'moderate', 'intense', 'super-storm'].map((level, idx) => {
              const thresholds = [0, -20, -50, -100, -200];
              const isActive = latest.dst_nt <= thresholds[idx];
              return (
                <div
                  key={level}
                  className={`h-1.5 rounded ${
                    isActive
                      ? idx === 0
                        ? 'bg-green-500'
                        : idx === 1
                        ? 'bg-yellow-500'
                        : idx === 2
                        ? 'bg-orange-400'
                        : idx === 3
                        ? 'bg-orange-500'
                        : 'bg-red-500'
                      : 'bg-slate-800'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Time Series Chart */}
        <div className="flex-1 min-h-0 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="dstGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.secondary} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={chartColors.secondary} stopOpacity={0}/>
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
                tickFormatter={(time) => format(new Date(time), 'MMM d')}
                stroke={chartTheme.textColor}
                style={{ fontSize: chartTheme.fontSize }}
                tickLine={false}
              />
              <YAxis
                domain={['auto', 20]}
                stroke={chartTheme.textColor}
                style={{ fontSize: chartTheme.fontSize }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: chartTheme.tooltipBg,
                  border: `1px solid ${chartTheme.tooltipBorder}`,
                  borderRadius: '6px',
                  fontSize: chartTheme.fontSize,
                }}
                labelFormatter={(time) => format(new Date(time), 'MMM d HH:mm')}
                formatter={(value: any) => [`${value} nT`, 'Dst']}
              />
              {/* Storm thresholds */}
              <ReferenceLine y={-20} stroke={chartColors.warning} strokeDasharray="3 3" />
              <ReferenceLine y={-50} stroke={chartColors.proton} strokeDasharray="3 3" />
              <ReferenceLine y={-100} stroke={chartColors.danger} strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="Dst"
                stroke={chartColors.secondary}
                fill="url(#dstGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Footer Info */}
        <div className="flex justify-between items-center text-xs flex-shrink-0">
          <div className="text-intel-muted">
            72h • Kyoto WDC
          </div>
          <div className="text-intel-muted">
            {format(new Date(latest.ts), 'MMM d HH:mm')} UTC
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
