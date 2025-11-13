'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Brain } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend } from 'recharts';
import { format, addMinutes } from 'date-fns';
import { CardSkeleton } from './card-skeleton';
import { chartColors, chartTheme, riskColors } from '@/lib/design-system';

interface Prediction {
  time: string;
  flare_probability: number;
  class_probabilities: {
    C: number;
    M: number;
    X: number;
  };
  confidence: number;
}

interface SuryaData {
  model: string;
  prediction_time: string;
  predictions: Prediction[];
  source: string;
}

export function SuryaCardV2() {
  const [data, setData] = useState<SuryaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ai/surya-prediction');
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
      } else {
        throw new Error('Invalid data format');
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
    const interval = setInterval(fetchData, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  if (loading) return <CardSkeleton />;

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Surya AI Flare Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-400">{error || 'No data'}</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate overall risk
  const avgProbability = data.predictions.reduce((sum, p) => sum + p.flare_probability, 0) / data.predictions.length;
  const maxProbability = Math.max(...data.predictions.map(p => p.flare_probability));
  const avgConfidence = data.predictions.reduce((sum, p) => sum + p.confidence, 0) / data.predictions.length;

  let riskLevel: keyof typeof riskColors = 'LOW';
  if (maxProbability > 0.5) riskLevel = 'SEVERE';
  else if (maxProbability > 0.3) riskLevel = 'HIGH';
  else if (maxProbability > 0.15) riskLevel = 'MODERATE';

  const riskColor = riskColors[riskLevel];

  // Format data for timeline chart
  const chartData = data.predictions.map((p, idx) => ({
    time: format(new Date(p.time), 'HH:mm'),
    timestamp: new Date(p.time).getTime(),
    probability: p.flare_probability * 100,
    confidence: p.confidence * 100,
    cClass: Math.max(0, p.class_probabilities.C * 100),
    mClass: Math.max(0, p.class_probabilities.M * 100),
    xClass: Math.max(0, p.class_probabilities.X * 100),
  }));

  const isRealModel = data.source !== 'mock-prediction' && data.source !== 'statistical-fallback';

  return (
    <Card className="border-slate-800 bg-slate-900/50 lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-400" />
            Surya AI Flare Predictions
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-purple-400 border-purple-500/30">
              {isRealModel ? 'NASA/IBM Surya' : 'Statistical Model'}
            </Badge>
            <Badge className={riskColor.badge}>
              {riskLevel} RISK
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="text-xs text-slate-400">Max Probability</div>
            <div className="text-2xl font-bold font-mono" style={{ color: riskColor.chart }}>
              {(maxProbability * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500">Next 2 hours</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-400">Avg Confidence</div>
            <div className="text-2xl font-bold font-mono text-blue-400">
              {(avgConfidence * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-slate-500">Model certainty</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-400">Dominant Class</div>
            <div className="text-2xl font-bold font-mono text-yellow-400">
              {data.predictions[0].class_probabilities.C > data.predictions[0].class_probabilities.M ? 'C' : 'M'}
            </div>
            <div className="text-xs text-slate-500">Expected flare type</div>
          </div>
        </div>

        {/* Prediction Timeline - Flare Probability */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300">Flare Probability Timeline</div>
          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="probabilityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.danger} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={chartColors.danger} stopOpacity={0.1} />
                  </linearGradient>
                </defs>
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
                  stroke={chartTheme.textColor}
                  style={{ fontSize: chartTheme.fontSize }}
                  tickLine={false}
                  domain={[0, 100]}
                  label={{ value: '%', angle: -90, position: 'insideLeft', fill: chartTheme.textColor }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartTheme.tooltipBg,
                    border: `1px solid ${chartTheme.tooltipBorder}`,
                    borderRadius: '6px',
                    fontSize: chartTheme.fontSize,
                  }}
                  formatter={(value: any) => [`${value.toFixed(1)}%`]}
                />
                <Area
                  type="monotone"
                  dataKey="probability"
                  stroke={chartColors.danger}
                  fill="url(#probabilityGradient)"
                  strokeWidth={2}
                  name="Flare Probability"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Flare Class Breakdown */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300">Flare Class Probabilities</div>
          <div className="h-[120px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
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
                  stroke={chartTheme.textColor}
                  style={{ fontSize: chartTheme.fontSize }}
                  tickLine={false}
                  domain={[0, 'auto']}
                  label={{ value: '%', angle: -90, position: 'insideLeft', fill: chartTheme.textColor }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartTheme.tooltipBg,
                    border: `1px solid ${chartTheme.tooltipBorder}`,
                    borderRadius: '6px',
                    fontSize: chartTheme.fontSize,
                  }}
                  formatter={(value: any) => [`${value.toFixed(2)}%`]}
                />
                <Legend
                  wrapperStyle={{ fontSize: chartTheme.fontSize }}
                  iconType="line"
                />
                <Line
                  type="monotone"
                  dataKey="cClass"
                  stroke="#eab308"
                  dot={false}
                  strokeWidth={2}
                  name="C-class"
                />
                <Line
                  type="monotone"
                  dataKey="mClass"
                  stroke="#f97316"
                  dot={false}
                  strokeWidth={2}
                  name="M-class"
                />
                <Line
                  type="monotone"
                  dataKey="xClass"
                  stroke="#ef4444"
                  dot={false}
                  strokeWidth={2}
                  name="X-class"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Footer Info */}
        <div className="flex justify-between items-center text-xs">
          <div className="text-slate-500">
            Model: {data.model} • 2-hour forecast window
          </div>
          <div className="text-slate-400">
            {format(new Date(data.prediction_time), 'HH:mm:ss')} UTC
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
