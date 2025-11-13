'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface SolarEvent {
  type: string;
  date: string;
  intensity?: string;
}

interface SolarEventsData {
  events: SolarEvent[];
  lastUpdated: string;
}

export function SolarEventsCard() {
  const [data, setData] = useState<SolarEventsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/noaa/solar-events');
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();

      // Extract and transform event data from API response
      if (result.success && result.data) {
        const events: SolarEvent[] = result.data.map((event: any) => ({
          type: event.event_type || 'Unknown',
          date: event.begin_time || new Date().toISOString(),
          intensity: event.class_type
            ? `${event.class_type}${event.intensity ? event.intensity : ''}`
            : undefined,
        }));

        setData({
          events: events,
          lastUpdated: new Date().toISOString(),
        });
      } else {
        setData({ events: [], lastUpdated: new Date().toISOString() });
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

  const getEventColor = (type: string) => {
    if (type.includes('CME')) return 'bg-purple-500';
    if (type.includes('Flare')) return 'bg-orange-500';
    return 'bg-blue-500';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solar Events</CardTitle>
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
          <CardTitle className="text-base">Solar Events</CardTitle>
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
        <CardTitle className="text-base">Solar Events</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.events.length > 0 ? (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {data.events.slice(0, 3).map((event, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Badge className={getEventColor(event.type)} variant="secondary">
                    {event.type}
                  </Badge>
                  {event.intensity && (
                    <span className="text-slate-300">{event.intensity}</span>
                  )}
                </div>
                <span className="text-slate-500">
                  {new Date(event.date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No recent events</p>
        )}
        <div className="text-xs text-slate-500 pt-2">
          Updated: {new Date(data.lastUpdated).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}
