'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Sparkline } from './sparkline';

export function SolarWindCard() {
  const [data, setData] = useState({
    speed: 0,
    bz: 0,
    density: 0,
    trend: [] as number[],
  });

  useEffect(() => {
    // TODO: Fetch real data from API
    setData({
      speed: 420,
      bz: -2.3,
      density: 6.5,
      trend: [380, 390, 410, 420, 430, 420],
    });
  }, []);

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
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="font-semibold text-white">{data.bz} nT</div>
            <div className="text-xs text-slate-400">Bz</div>
          </div>
          <div>
            <div className="font-semibold text-white">{data.density} /cm³</div>
            <div className="text-xs text-slate-400">Density</div>
          </div>
        </div>
        <Sparkline data={data.trend} color="#3b82f6" />
      </CardContent>
    </Card>
  );
}
