'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Sparkline } from './sparkline';

export function SepCard() {
  const [data, setData] = useState({
    p10: 0,
    p50: 0,
    trend: [] as number[],
  });

  useEffect(() => {
    // TODO: Fetch real data from API
    setData({
      p10: 2.5,
      p50: 0.8,
      trend: [1.2, 1.5, 2.0, 2.5, 3.0, 2.5],
    });
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">SEP Protons</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xl font-bold text-white">{data.p10}</div>
            <div className="text-xs text-slate-400">≥10 MeV pfu</div>
          </div>
          <div>
            <div className="text-xl font-bold text-white">{data.p50}</div>
            <div className="text-xs text-slate-400">≥50 MeV pfu</div>
          </div>
        </div>
        <Sparkline data={data.trend} color="#ef4444" />
      </CardContent>
    </Card>
  );
}
