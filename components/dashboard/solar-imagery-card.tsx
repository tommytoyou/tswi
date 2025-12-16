'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, RefreshCw } from 'lucide-react';

interface WavelengthOption {
  id: string;
  label: string;
  description: string;
  url: string;
  color: string;
}

const WAVELENGTHS: WavelengthOption[] = [
  {
    id: '0304',
    label: 'AIA 304',
    description: 'Chromosphere',
    url: 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0304.jpg',
    color: 'text-orange-400',
  },
  {
    id: '0171',
    label: 'AIA 171',
    description: 'Corona (Blue)',
    url: 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0171.jpg',
    color: 'text-blue-400',
  },
  {
    id: '0193',
    label: 'AIA 193',
    description: 'Corona (Green)',
    url: 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0193.jpg',
    color: 'text-green-400',
  },
  {
    id: 'HMIIC',
    label: 'HMI',
    description: 'Sunspots',
    url: 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIC.jpg',
    color: 'text-yellow-400',
  },
];

export function SolarImageryCard() {
  const [selectedWavelength, setSelectedWavelength] = useState<string>('0304');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [timestamp, setTimestamp] = useState<number>(Date.now());

  const currentWavelength = WAVELENGTHS.find((w) => w.id === selectedWavelength) || WAVELENGTHS[0];

  const refreshImage = useCallback(() => {
    setLoading(true);
    setError(false);
    setTimestamp(Date.now());
    setLastUpdated(new Date());
  }, []);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshImage();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshImage]);

  // Refresh when wavelength changes
  useEffect(() => {
    setLoading(true);
    setError(false);
  }, [selectedWavelength]);

  const handleImageLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleImageError = () => {
    setLoading(false);
    setError(true);
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex-shrink-0 py-2 px-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <div className="absolute inset-0 w-2 h-2 bg-emerald-500 rounded-full animate-ping opacity-75" />
            </div>
            <CardTitle className="text-sm">Solar Imagery</CardTitle>
            <span className="text-xs text-emerald-400 font-medium">LIVE</span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedWavelength} onValueChange={setSelectedWavelength}>
              <SelectTrigger className="w-[140px] h-7 text-xs bg-slate-800 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {WAVELENGTHS.map((wavelength) => (
                  <SelectItem
                    key={wavelength.id}
                    value={wavelength.id}
                    className="text-xs hover:bg-slate-700"
                  >
                    <span className={wavelength.color}>{wavelength.label}</span>
                    <span className="text-slate-400 ml-2">- {wavelength.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={refreshImage}
              className="p-1 rounded hover:bg-slate-700 transition-colors"
              title="Refresh image"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-1 min-h-0">
        <div className="relative flex-1 flex items-center justify-center">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          )}
          {error ? (
            <div className="text-center text-slate-400">
              <p className="mb-2">Failed to load solar image</p>
              <button
                onClick={refreshImage}
                className="text-sm text-blue-400 hover:text-blue-300 underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <img
              key={`${currentWavelength.id}-${timestamp}`}
              src={`${currentWavelength.url}?t=${timestamp}`}
              alt={`NASA SDO ${currentWavelength.label} - ${currentWavelength.description}`}
              className="max-h-[700px] object-contain rounded-lg mx-auto"
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          )}
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-1 flex-shrink-0">
          <span>Last updated:</span>
          <span className="text-slate-400 font-mono">
            {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-500">Auto-refresh: 60s</span>
        </div>
      </CardContent>
    </Card>
  );
}
