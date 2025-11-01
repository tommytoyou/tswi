'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Sparkline } from './sparkline';

export function DstCard() {
  const [data, setData] = useState({
    current: 0,
    trend: [] as number[],
  });

  useEffect(() => {
    // TODO: Fetch real data from API
    setData({
      current: -35,
      trend: [-20, -25, -30, -35, -40, -35],
    });
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dst Index</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-3xl font-bold text-white">{data.current} nT</div>
          <div className="text-xs text-slate-400">Ring current strength</div>
        </div>
        <Sparkline data={data.trend} color="#8b5cf6" />
      </CardContent>
    </Card>
  );
}
