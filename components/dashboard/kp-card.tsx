'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface KpData {
  current: number;
  status: string;
  timestamp: string;
}

export function KpCard() {
  const [data, setData] = useState<KpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/noaa/kp-index');
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();

      // Extract latest data from API response
      if (result.success && result.latest) {
        const kpValue = result.latest.kp || result.latest.kp_index || 0;
        let status = 'Quiet';
        if (kpValue >= 7) status = 'Severe';
        else if (kpValue >= 5) status = 'Strong';
        else if (kpValue >= 4) status = 'Active';

        setData({
          current: kpValue,
          status: status,
          timestamp: result.latest.ts || new Date().toISOString(),
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

  const getKpColor = (kp: number) => {
    if (kp >= 7) return 'bg-red-500';
    if (kp >= 5) return 'bg-orange-500';
    if (kp >= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kp Index</CardTitle>
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
          <CardTitle className="text-base">Kp Index</CardTitle>
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
        <CardTitle className="text-base">Kp Index</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-2">
          <div className="text-3xl font-bold text-white">{data.current}</div>
          <Badge className={getKpColor(data.current)}>{data.status}</Badge>
        </div>
        <div className="text-xs text-slate-400">
          Geomagnetic activity level
        </div>
        <div className="text-xs text-slate-500">
          {new Date(data.timestamp).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
