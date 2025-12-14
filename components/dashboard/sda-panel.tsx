'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Satellite,
  AlertTriangle,
  RefreshCw,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Globe2,
  Crosshair,
  Rocket,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  BoxscoreData,
  CDMData,
  ManeuverEvent,
  classifyConjunctionRisk,
  INSPECTOR_SATELLITES,
} from '@/lib/space-track-types';
import { ThreatCatalog } from './threat-catalog';

interface CatalogStats {
  total_payloads: number;
  total_rocket_bodies: number;
  total_debris: number;
  total_objects: number;
  by_country: {
    country: string;
    payloads: number;
    rocket_bodies: number;
    debris: number;
    total: number;
  }[];
}

const getRiskBadgeClass = (risk: string) => {
  switch (risk) {
    case 'CRITICAL':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'HIGH':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'MEDIUM':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'LOW':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};

const getManeuverBadgeClass = (type: string) => {
  switch (type) {
    case 'ORBIT_RAISE':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'ORBIT_LOWER':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'PLANE_CHANGE':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'STATION_KEEPING':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'PHASING':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'RENDEZVOUS':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};

const formatManeuverType = (type: string) => {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

export function SDAPanel() {
  const [catalogStats, setCatalogStats] = useState<CatalogStats | null>(null);
  const [maneuvers, setManeuvers] = useState<ManeuverEvent[]>([]);
  const [conjunctions, setConjunctions] = useState<CDMData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentialsError, setCredentialsError] = useState(false);
  const hasFetched = useRef(false);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setCredentialsError(false);

    try {
      // Fetch all data in parallel
      const [boxscoreRes, maneuversRes, cdmRes] = await Promise.all([
        fetch('/api/space-track?query=boxscore'),
        fetch('/api/maneuvers?watch_list=true&days=30&min_confidence=0.4'),
        fetch('/api/space-track?query=cdm&days=7&limit=20'),
      ]);

      // Process boxscore (catalog statistics)
      const boxscoreData = await boxscoreRes.json();
      if (boxscoreData.success && boxscoreData.data) {
        const data: BoxscoreData[] = boxscoreData.data;
        const stats: CatalogStats = {
          total_payloads: 0,
          total_rocket_bodies: 0,
          total_debris: 0,
          total_objects: 0,
          by_country: [],
        };

        // Sum up totals
        for (const entry of data) {
          stats.total_payloads += entry.ORBITAL_PAYLOAD_COUNT || 0;
          stats.total_rocket_bodies += entry.ORBITAL_ROCKET_BODY_COUNT || 0;
          stats.total_debris += entry.ORBITAL_DEBRIS_COUNT || 0;
          stats.total_objects += entry.ORBITAL_TOTAL_COUNT || 0;

          // Track top countries
          if (entry.ORBITAL_TOTAL_COUNT > 100) {
            stats.by_country.push({
              country: entry.COUNTRY,
              payloads: entry.ORBITAL_PAYLOAD_COUNT,
              rocket_bodies: entry.ORBITAL_ROCKET_BODY_COUNT,
              debris: entry.ORBITAL_DEBRIS_COUNT,
              total: entry.ORBITAL_TOTAL_COUNT,
            });
          }
        }

        // Sort by total objects
        stats.by_country.sort((a, b) => b.total - a.total);
        stats.by_country = stats.by_country.slice(0, 10);

        setCatalogStats(stats);
      } else if (boxscoreData.error?.includes('credentials')) {
        setCredentialsError(true);
      }

      // Process maneuvers
      const maneuversData = await maneuversRes.json();
      if (maneuversData.success && maneuversData.data) {
        setManeuvers(maneuversData.data.slice(0, 10));
      }

      // Process conjunctions
      const cdmData = await cdmRes.json();
      if (cdmData.success && cdmData.data) {
        setConjunctions(cdmData.data.slice(0, 10));
      }
    } catch (err) {
      console.error('Error fetching SDA data:', err);
      setError('Failed to load Space Domain Awareness data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Satellite className="h-6 w-6 animate-pulse" />
          <span>Loading Space Domain Awareness data...</span>
        </div>
      </div>
    );
  }

  if (credentialsError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <Satellite className="h-12 w-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Space-Track Credentials Required</h3>
          <p className="text-slate-400 text-sm mb-4">
            To access Space Domain Awareness data, you need to configure your Space-Track.org credentials.
            Create a free account at{' '}
            <a
              href="https://www.space-track.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              space-track.org
            </a>
            {' '}and add the credentials to your environment variables.
          </p>
          <div className="bg-slate-800/50 rounded p-3 text-left font-mono text-xs text-slate-300">
            <div>SPACE_TRACK_USERNAME=your_username</div>
            <div>SPACE_TRACK_PASSWORD=your_password</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => fetchData()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Satellite className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Space Domain Awareness</h2>
              <p className="text-sm text-slate-400">Orbital catalog, maneuvers, and conjunctions</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Catalog Statistics */}
        {catalogStats && (
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader className="pb-2 py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-blue-400" />
                Space Catalog Totals
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-slate-800/50 rounded p-3 text-center">
                  <div className="text-2xl font-bold text-green-400 font-mono">
                    {catalogStats.total_payloads.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
                    <Target className="h-3 w-3" /> Payloads
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded p-3 text-center">
                  <div className="text-2xl font-bold text-orange-400 font-mono">
                    {catalogStats.total_rocket_bodies.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
                    <Rocket className="h-3 w-3" /> Rocket Bodies
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded p-3 text-center">
                  <div className="text-2xl font-bold text-red-400 font-mono">
                    {catalogStats.total_debris.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
                    <Trash2 className="h-3 w-3" /> Debris
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded p-3 text-center">
                  <div className="text-2xl font-bold text-white font-mono">
                    {catalogStats.total_objects.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400">Total Objects</div>
                </div>
              </div>

              {/* Top Countries */}
              <div className="text-xs text-slate-400 mb-2">Top Contributors</div>
              <div className="grid grid-cols-5 gap-2">
                {catalogStats.by_country.slice(0, 5).map((country) => (
                  <div key={country.country} className="bg-slate-800/30 rounded p-2 text-center">
                    <div className="text-sm font-semibold text-white">{country.country}</div>
                    <div className="text-xs text-slate-400">{country.total.toLocaleString()} objects</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Threat Catalog */}
        <ThreatCatalog />

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Watch List Maneuvers */}
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader className="pb-2 py-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crosshair className="h-4 w-4 text-yellow-400" />
                  Watch List Maneuvers
                </div>
                <Badge variant="outline" className="text-xs">
                  Last 30 days
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {maneuvers.length === 0 ? (
                <div className="text-center py-6 text-slate-500">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No maneuvers detected</p>
                  <p className="text-xs">Monitoring inspector satellites</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {maneuvers.map((maneuver, index) => (
                    <div
                      key={`${maneuver.norad_id}-${maneuver.epoch_after}-${index}`}
                      className="bg-slate-800/50 rounded p-2"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm">
                            {maneuver.object_name}
                          </span>
                          <span className="text-xs text-slate-500">#{maneuver.norad_id}</span>
                        </div>
                        <Badge className={`${getManeuverBadgeClass(maneuver.maneuver_type)} text-xs`}>
                          {formatManeuverType(maneuver.maneuver_type)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          {maneuver.sma_change_km > 0 ? (
                            <TrendingUp className="h-3 w-3 text-green-400" />
                          ) : maneuver.sma_change_km < 0 ? (
                            <TrendingDown className="h-3 w-3 text-red-400" />
                          ) : (
                            <Minus className="h-3 w-3" />
                          )}
                          <span className="font-mono">
                            {maneuver.sma_change_km > 0 ? '+' : ''}
                            {maneuver.sma_change_km.toFixed(2)} km
                          </span>
                        </span>
                        {maneuver.delta_v_estimate_ms !== undefined && (
                          <span className="font-mono">
                            Δv: {maneuver.delta_v_estimate_ms.toFixed(1)} m/s
                          </span>
                        )}
                        <span className="ml-auto">
                          {format(new Date(maneuver.epoch_after), 'MMM dd, HH:mm')}
                        </span>
                      </div>
                      {maneuver.notes && (
                        <div className="text-xs text-slate-500 mt-1">{maneuver.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Watch List Reference */}
              <div className="mt-3 pt-3 border-t border-slate-700">
                <div className="text-xs text-slate-500 mb-2">Monitored Objects</div>
                <div className="flex flex-wrap gap-1">
                  {Object.values(INSPECTOR_SATELLITES).map((sat) => (
                    <Badge
                      key={sat.norad_id}
                      variant="outline"
                      className="text-xs font-mono"
                      title={sat.description}
                    >
                      {sat.name} ({sat.country})
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Conjunctions */}
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader className="pb-2 py-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                  Recent Conjunctions
                </div>
                <Badge variant="outline" className="text-xs">
                  Last 7 days
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {conjunctions.length === 0 ? (
                <div className="text-center py-6 text-slate-500">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No conjunction data available</p>
                  <p className="text-xs">CDM data from Space-Track</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {conjunctions.map((cdm) => {
                    const risk = classifyConjunctionRisk(cdm.PC);
                    return (
                      <div key={cdm.CDM_ID} className="bg-slate-800/50 rounded p-2">
                        <div className="flex items-center justify-between mb-1">
                          <Badge className={`${getRiskBadgeClass(risk)} text-xs`}>
                            {risk}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            TCA: {format(new Date(cdm.TCA), 'MMM dd, HH:mm')} UTC
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-slate-500">Primary</div>
                            <div className="text-white font-medium truncate" title={cdm.SAT_1_NAME}>
                              {cdm.SAT_1_NAME}
                            </div>
                            <div className="text-slate-500 font-mono">#{cdm.SAT_1_ID}</div>
                          </div>
                          <div>
                            <div className="text-slate-500">Secondary</div>
                            <div className="text-white font-medium truncate" title={cdm.SAT_2_NAME}>
                              {cdm.SAT_2_NAME}
                            </div>
                            <div className="text-slate-500 font-mono">#{cdm.SAT_2_ID}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs">
                          <span className="text-slate-400">
                            Miss Distance: <span className="font-mono text-white">{cdm.MIN_RNG.toFixed(0)} m</span>
                          </span>
                          <span className="text-slate-400">
                            Pc: <span className="font-mono text-white">{cdm.PC.toExponential(2)}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Data Source Attribution */}
        <div className="text-center text-xs text-slate-500">
          Data provided by{' '}
          <a
            href="https://www.space-track.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            Space-Track.org
          </a>
          {' '}(18th Space Defense Squadron)
        </div>
      </div>
    </div>
  );
}
