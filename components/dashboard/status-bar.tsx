'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Download, Clock, Database, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { statusColors, refreshIntervals } from '@/lib/design-system';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StatusBarProps {
  lastUpdated: Date;
  onRefresh: () => void;
  onExport?: () => void;
  refreshInterval: number;
  onRefreshIntervalChange: (interval: number) => void;
  autoRefresh: boolean;
  onAutoRefreshToggle: () => void;
}

export function StatusBar({
  lastUpdated,
  onRefresh,
  onExport,
  refreshInterval,
  onRefreshIntervalChange,
  autoRefresh,
  onAutoRefreshToggle,
}: StatusBarProps) {
  const [timeUntilRefresh, setTimeUntilRefresh] = useState(0);
  const [dbStatus, setDbStatus] = useState<'online' | 'offline' | 'loading'>('loading');
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'loading'>('loading');

  // Calculate time until next refresh
  useEffect(() => {
    if (!autoRefresh) {
      setTimeUntilRefresh(0);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastUpdated.getTime();
      const remaining = Math.max(0, refreshInterval - elapsed);
      setTimeUntilRefresh(Math.ceil(remaining / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [lastUpdated, refreshInterval, autoRefresh]);

  // Check system health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        // Check API health
        const apiResponse = await fetch('/api/noaa/solar-wind', { method: 'HEAD' });
        setApiStatus(apiResponse.ok ? 'online' : 'offline');

        // If API is working, assume DB is online (since API queries DB)
        setDbStatus(apiResponse.ok ? 'online' : 'offline');
      } catch (error) {
        setApiStatus('offline');
        setDbStatus('offline');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-3">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Left: System Status */}
        <div className="flex items-center gap-6">
          {/* Database Status */}
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-400">MongoDB</span>
            <div className={`h-2 w-2 rounded-full ${statusColors[dbStatus]} animate-pulse`} />
          </div>

          {/* API Status */}
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-400">NOAA API</span>
            <div className={`h-2 w-2 rounded-full ${statusColors[apiStatus]} animate-pulse`} />
          </div>

          {/* Last Updated */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-400">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
            {autoRefresh && timeUntilRefresh > 0 && (
              <span className="text-xs text-slate-500">
                (next in {timeUntilRefresh}s)
              </span>
            )}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {/* Auto Refresh Toggle */}
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={onAutoRefreshToggle}
            className="h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto
          </Button>

          {/* Refresh Interval */}
          <Select
            value={refreshInterval.toString()}
            onValueChange={(value) => onRefreshIntervalChange(parseInt(value))}
          >
            <SelectTrigger className="h-8 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {refreshIntervals.map((interval) => (
                <SelectItem key={interval.value} value={interval.value.toString()}>
                  {interval.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Manual Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="h-8"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>

          {/* Export */}
          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="h-8"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
