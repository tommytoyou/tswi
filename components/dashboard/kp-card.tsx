'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkline } from './sparkline';

export function KpCard() {
  const [data, setData] = useState({
    current: 0,
    status: '',
    trend: [] as number[],
  });

  useEffect(() => {
    // TODO: Fetch real data from API
    setData({
      current: 4,
      status: 'Active',
      trend: [3, 3, 4, 4, 5, 4],
    });
  }, []);

  const getKpColor = (kp: number) => {
    if (kp >= 7) return 'bg-red-500';
    if (kp >= 5) return 'bg-orange-500';
    if (kp >= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

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
        <Sparkline data={data.trend} color="#eab308" />
      </CardContent>
    </Card>
  );
}
