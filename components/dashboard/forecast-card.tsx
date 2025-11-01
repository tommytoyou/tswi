'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function ForecastCard() {
  const [forecast, setForecast] = useState({
    value: 0,
    p10: 0,
    p90: 0,
    summary: '',
  });

  useEffect(() => {
    // TODO: Fetch real forecast from API
    setForecast({
      value: 5,
      p10: 4,
      p90: 6,
      summary: 'Moderate geomagnetic storm conditions expected in next 6 hours',
    });
  }, []);

  return (
    <Card className="bg-gradient-to-r from-blue-900/30 to-purple-900/30">
      <CardHeader>
        <CardTitle>Kp Forecast (Next 6h)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-8">
          <div>
            <div className="text-5xl font-bold text-white">{forecast.value}</div>
            <div className="text-sm text-slate-400 mt-1">
              Range: {forecast.p10} - {forecast.p90}
            </div>
          </div>
          <div className="flex-1">
            <p className="text-slate-300">{forecast.summary}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
