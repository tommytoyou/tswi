'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface SolarWindData {
  bx: number;
  by: number;
  bz: number;
  speed: number;
  density: number;
  timestamp: string;
}

export function SolarWindCard() {
  const [data, setData] = useState<SolarWindData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/noaa/solar-wind');
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();

      // Extract latest data from API response
      if (result.success && result.data && result.data.length > 0) {
        const latest = result.data[result.data.length - 1];
        setData({
          bx: latest.bx_gsm || 0,
          by: latest.by_gsm || 0,
          bz: latest.bz_gsm || 0,
          speed: 0, // Not available in mag data, would need plasma data
          density: 0, // Not available in mag data, would need plasma data
          timestamp: latest.ts || new Date().toISOString(),
        });
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
    const interval = setInterval(fetchData, 2 * 60 * 1000); // 2 minutes
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solar Wind</CardTitle>
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
          <CardTitle className="text-base">Solar Wind</CardTitle>
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
        <CardTitle className="text-base">Solar Wind</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-2xl font-bold text-white">{data.speed} km/s</div>
          <div className="text-xs text-slate-400">Speed</div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="font-semibold text-white">{data.bx.toFixed(1)} nT</div>
            <div className="text-xs text-slate-400">Bx</div>
          </div>
          <div>
            <div className="font-semibold text-white">{data.by.toFixed(1)} nT</div>
            <div className="text-xs text-slate-400">By</div>
          </div>
          <div>
            <div className="font-semibold text-white">{data.bz.toFixed(1)} nT</div>
            <div className="text-xs text-slate-400">Bz</div>
          </div>
        </div>
        <div>
          <div className="font-semibold text-white">{data.density.toFixed(1)} /cm³</div>
          <div className="text-xs text-slate-400">Density</div>
        </div>
        <div className="text-xs text-slate-500">
          {new Date(data.timestamp).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
