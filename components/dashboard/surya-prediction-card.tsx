'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles } from 'lucide-react';

interface SuryaPrediction {
  riskLevel: string;
  confidence: number;
  prediction: string;
  timestamp: string;
}

export function SuryaPredictionCard() {
  const [data, setData] = useState<SuryaPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ai/surya-prediction');
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();

      // Parse the API response
      if (result.success && result.data && result.data.predictions) {
        const predictions = result.data.predictions;
        const avgProbability = predictions.reduce((sum: number, p: any) => sum + p.flare_probability, 0) / predictions.length;
        const avgConfidence = predictions.reduce((sum: number, p: any) => sum + p.confidence, 0) / predictions.length;

        let riskLevel = 'LOW';
        if (avgProbability > 0.3) riskLevel = 'HIGH';
        else if (avgProbability > 0.15) riskLevel = 'MEDIUM';

        const predictionText = `Solar flare probability: ${(avgProbability * 100).toFixed(1)}% over the next 2 hours. Highest risk for ${predictions[0].class_probabilities.C > predictions[0].class_probabilities.M ? 'C-class' : 'M-class'} flares.`;

        setData({
          riskLevel,
          confidence: avgConfidence,
          prediction: predictionText,
          timestamp: result.data.prediction_time || new Date().toISOString(),
        });
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
    const interval = setInterval(fetchData, 2 * 60 * 1000); // 2 minutes
    return () => clearInterval(interval);
  }, []);

  const getRiskColor = (level: string) => {
    if (level === 'HIGH') return 'bg-red-500';
    if (level === 'MEDIUM') return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Surya AI Predictions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Surya AI Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-400">{error || 'No data'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Surya AI Predictions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge className={getRiskColor(data.riskLevel)}>
            {data.riskLevel} RISK
          </Badge>
          <span className="text-sm text-slate-400">
            {Math.round(data.confidence * 100)}% confidence
          </span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          {data.prediction}
        </p>
        <div className="text-xs text-slate-500">
          Generated: {new Date(data.timestamp).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
