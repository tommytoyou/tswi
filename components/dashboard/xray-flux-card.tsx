'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface XRayData {
  class: string;
  intensity: number;
  timestamp: string;
}

export function XRayFluxCard() {
  const [data, setData] = useState<XRayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/noaa/xray-flux');
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

  const getFlareColor = (flareClass: string) => {
    const firstChar = flareClass.charAt(0);
    if (firstChar === 'X') return 'bg-red-500';
    if (firstChar === 'M') return 'bg-orange-500';
    if (firstChar === 'C') return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">X-ray Flux</CardTitle>
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
          <CardTitle className="text-base">X-ray Flux</CardTitle>
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
        <CardTitle className="text-base">X-ray Flux</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-2">
          <div className="text-3xl font-bold text-white">{data.class}</div>
          <Badge className={getFlareColor(data.class)}>
            {data.class.charAt(0)}-Class
          </Badge>
        </div>
        <div className="text-xs text-slate-400">
          Solar flare intensity
        </div>
        <div className="text-xs text-slate-500">
          {new Date(data.timestamp).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
