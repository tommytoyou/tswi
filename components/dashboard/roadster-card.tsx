'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, Car } from 'lucide-react';

interface RoadsterData {
  distance_km: number;
  distance_au: number;
  speed_kmh: number;
  last_updated: string;
}

export function RoadsterCard() {
  const [data, setData] = useState<RoadsterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/roadster');
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      setData(result);
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Car className="h-4 w-4" />
            Roadster Position
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
            <Car className="h-4 w-4" />
            Roadster Position
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
          <Car className="h-4 w-4" />
          Roadster Position
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-2xl font-bold text-white">
            {(data.distance_au || 0).toFixed(2)} AU
          </div>
          <div className="text-xs text-slate-400">Distance from Earth</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="font-semibold text-white">
              {((data.distance_km || 0) / 1_000_000).toFixed(1)}M km
            </div>
            <div className="text-xs text-slate-400">Distance (km)</div>
          </div>
          <div>
            <div className="font-semibold text-white">
              {(data.speed_kmh || 0).toLocaleString()} km/h
            </div>
            <div className="text-xs text-slate-400">Speed</div>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Updated: {data.last_updated ? new Date(data.last_updated).toLocaleString() : 'N/A'}
        </div>
      </CardContent>
    </Card>
  );
}
