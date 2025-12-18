'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  ChevronUp,
  Satellite,
  Target,
  Eye,
  AlertTriangle,
  Shield,
  Calendar,
  Radio,
  Grip,
  ExternalLink,
  Sun,
  Moon,
  MapPin,
  Navigation,
  RefreshCw,
} from 'lucide-react';
import {
  THREAT_DATABASE,
  getThreatSummary,
  ThreatSatellite,
  ThreatLevel,
  OrbitType,
  ThreatCountry,
} from '@/lib/threat-database';
import {
  TLEData,
  SatellitePosition,
  propagateAllPositions,
  clearSatrecCache,
  formatCoordinate,
  formatAltitude,
} from '@/lib/orbital-propagation';

const getThreatBadgeClass = (level: ThreatLevel) => {
  switch (level) {
    case 'HIGH':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'MEDIUM':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'LOW':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};

const getOrbitBadgeClass = (orbit: OrbitType) => {
  switch (orbit) {
    case 'GEO':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'LEO':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'MEO':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'HEO':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};

const getCountryBadgeClass = (country: ThreatCountry) => {
  switch (country) {
    case 'Russia':
      return 'bg-red-900/30 text-red-300 border-red-700/30';
    case 'China':
      return 'bg-amber-900/30 text-amber-300 border-amber-700/30';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};

const getCountryFlag = (country: ThreatCountry) => {
  switch (country) {
    case 'Russia':
      return 'RUS';
    case 'China':
      return 'PRC';
    default:
      return country;
  }
};

interface ThreatCardProps {
  satellite: ThreatSatellite;
  position: SatellitePosition | null;
  isExpanded: boolean;
  onToggle: () => void;
}

function ThreatCard({ satellite, position, isExpanded, onToggle }: ThreatCardProps) {
  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
      {/* Header - Always Visible */}
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex-shrink-0">
            <div className={`p-2 rounded-lg ${
              satellite.threatLevel === 'HIGH'
                ? 'bg-red-500/10 border border-red-500/20'
                : satellite.threatLevel === 'MEDIUM'
                ? 'bg-yellow-500/10 border border-yellow-500/20'
                : 'bg-green-500/10 border border-green-500/20'
            }`}>
              <Satellite className={`h-4 w-4 ${
                satellite.threatLevel === 'HIGH'
                  ? 'text-red-400'
                  : satellite.threatLevel === 'MEDIUM'
                  ? 'text-yellow-400'
                  : 'text-green-400'
              }`} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white">{satellite.name}</span>
              <span className="text-xs text-slate-500 font-mono">#{satellite.noradId}</span>
              {/* Sunlight/Eclipse Indicator */}
              {position && (
                <span title={position.inSunlight ? 'In sunlight' : 'In eclipse'}>
                  {position.inSunlight ? (
                    <Sun className="h-3.5 w-3.5 text-yellow-400" />
                  ) : (
                    <Moon className="h-3.5 w-3.5 text-blue-400" />
                  )}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge className={`${getCountryBadgeClass(satellite.country)} text-xs`}>
                {getCountryFlag(satellite.country)}
              </Badge>
              <Badge className={`${getOrbitBadgeClass(satellite.orbitType)} text-xs`}>
                {satellite.orbitType}
              </Badge>
              <Badge className={`${getThreatBadgeClass(satellite.threatLevel)} text-xs`}>
                {satellite.threatLevel}
              </Badge>
            </div>
            {/* Real-time Position Display */}
            {position && (
              <div className="flex items-center gap-3 mt-2 text-xs font-mono">
                <span className="text-slate-400 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {formatCoordinate(position.latitude, true)} {formatCoordinate(position.longitude, false)}
                </span>
                <span className="text-slate-400 flex items-center gap-1">
                  <Navigation className="h-3 w-3" />
                  {formatAltitude(position.altitude)}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 ml-2">
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-3 pt-0 border-t border-slate-700/50 space-y-3">
          {/* Aliases */}
          {satellite.aliases && satellite.aliases.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 mb-1">Also known as</div>
              <div className="text-sm text-slate-300">{satellite.aliases.join(', ')}</div>
            </div>
          )}

          {/* Launch Date */}
          {satellite.launchDate && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-slate-400">Launch:</span>
              <span className="text-white font-mono">{satellite.launchDate}</span>
            </div>
          )}

          {/* Capabilities */}
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <Shield className="h-3.5 w-3.5" />
              Known Capabilities
            </div>
            <ul className="space-y-1">
              {satellite.capabilities.map((cap, idx) => (
                <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-slate-600 mt-1">•</span>
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Observed Behaviors */}
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <Eye className="h-3.5 w-3.5" />
              Observed Behaviors
            </div>
            <div className="space-y-2">
              {satellite.observedBehaviors.map((behavior, idx) => (
                <div key={idx} className="bg-slate-900/50 rounded p-2">
                  <div className="flex items-center gap-2 mb-1">
                    {behavior.date && (
                      <span className="text-xs font-mono text-slate-500">{behavior.date}</span>
                    )}
                    {behavior.target && (
                      <Badge variant="outline" className="text-xs">
                        <Target className="h-3 w-3 mr-1" />
                        {behavior.target}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-300">{behavior.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {satellite.notes && (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded p-2">
              <div className="flex items-center gap-2 text-xs text-yellow-500/80 mb-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Assessment Notes
              </div>
              <p className="text-sm text-slate-300">{satellite.notes}</p>
            </div>
          )}

          {/* Sources */}
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <ExternalLink className="h-3.5 w-3.5" />
              Sources / References
            </div>
            <ul className="space-y-1">
              {satellite.sources.map((source, idx) => (
                <li key={idx} className="text-xs text-slate-400">
                  • {source}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

type FilterCountry = 'all' | ThreatCountry;
type FilterThreat = 'all' | ThreatLevel;
type FilterOrbit = 'all' | OrbitType;

const POSITION_UPDATE_INTERVAL = 30000; // 30 seconds
const TLE_REFRESH_INTERVAL = 3600000; // 1 hour

export function ThreatCatalog() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterCountry, setFilterCountry] = useState<FilterCountry>('all');
  const [filterThreat, setFilterThreat] = useState<FilterThreat>('all');
  const [filterOrbit, setFilterOrbit] = useState<FilterOrbit>('all');
  const [tles, setTles] = useState<TLEData[]>([]);
  const [positions, setPositions] = useState<Map<number, SatellitePosition>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  const summary = getThreatSummary();

  // Fetch TLEs from Celestrak API
  const fetchTLEs = useCallback(async (signal?: AbortSignal) => {
    try {
      setTrackingError(null);
      const response = await fetch('/api/celestrak', { signal });
      if (!response.ok) {
        throw new Error('Failed to fetch orbital data');
      }
      const data = await response.json();
      if (data.tles && data.tles.length > 0) {
        clearSatrecCache();
        setTles(data.tles);
        // Also set initial positions from API
        if (data.positions) {
          const posMap = new Map<number, SatellitePosition>();
          data.positions.forEach((pos: SatellitePosition) => {
            posMap.set(pos.noradId, pos);
          });
          setPositions(posMap);
          setLastUpdate(new Date());
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching TLEs:', error);
        setTrackingError('Unable to fetch live tracking data');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update positions using client-side propagation
  const updatePositions = useCallback(() => {
    if (tles.length === 0) return;
    const newPositions = propagateAllPositions(tles);
    setPositions(newPositions);
    setLastUpdate(new Date());
  }, [tles]);

  // Initial fetch and set up intervals
  useEffect(() => {
    const controller = new AbortController();
    fetchTLEs(controller.signal);

    // Refresh TLEs periodically
    const tleInterval = setInterval(() => fetchTLEs(controller.signal), TLE_REFRESH_INTERVAL);

    return () => {
      controller.abort();
      clearInterval(tleInterval);
    };
  }, [fetchTLEs]);

  // Position update interval (runs more frequently)
  useEffect(() => {
    if (tles.length === 0) return;

    const positionInterval = setInterval(updatePositions, POSITION_UPDATE_INTERVAL);

    return () => {
      clearInterval(positionInterval);
    };
  }, [tles, updatePositions]);

  const filteredSatellites = THREAT_DATABASE.filter(sat => {
    if (filterCountry !== 'all' && sat.country !== filterCountry) return false;
    if (filterThreat !== 'all' && sat.threatLevel !== filterThreat) return false;
    if (filterOrbit !== 'all' && sat.orbitType !== filterOrbit) return false;
    return true;
  });

  const toggleExpanded = (noradId: number) => {
    setExpandedId(expandedId === noradId ? null : noradId);
  };

  const trackedCount = positions.size;

  return (
    <Card className="bg-slate-900/50 border-slate-700">
      <CardHeader className="pb-2 py-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-red-400" />
            Threat Catalog
          </div>
          <div className="flex items-center gap-2">
            {/* Tracking Status */}
            {isLoading ? (
              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Loading
              </Badge>
            ) : trackingError ? (
              <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30">
                Offline
              </Badge>
            ) : trackedCount > 0 ? (
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5 animate-pulse" />
                {trackedCount} Live
              </Badge>
            ) : null}
            <Badge variant="outline" className="text-xs">
              {THREAT_DATABASE.length} Assets
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-slate-800/50 rounded p-2">
            <div className="text-lg font-bold text-red-400">{summary.byThreatLevel.HIGH}</div>
            <div className="text-xs text-slate-500">HIGH</div>
          </div>
          <div className="bg-slate-800/50 rounded p-2">
            <div className="text-lg font-bold text-yellow-400">{summary.byThreatLevel.MEDIUM}</div>
            <div className="text-xs text-slate-500">MEDIUM</div>
          </div>
          <div className="bg-slate-800/50 rounded p-2">
            <div className="text-lg font-bold text-red-300">{summary.byCountry.Russia}</div>
            <div className="text-xs text-slate-500">Russia</div>
          </div>
          <div className="bg-slate-800/50 rounded p-2">
            <div className="text-lg font-bold text-amber-300">{summary.byCountry.China}</div>
            <div className="text-xs text-slate-500">China</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value as FilterCountry)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-600"
          >
            <option value="all">All Countries</option>
            <option value="Russia">Russia</option>
            <option value="China">China</option>
          </select>
          <select
            value={filterThreat}
            onChange={(e) => setFilterThreat(e.target.value as FilterThreat)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-600"
          >
            <option value="all">All Threat Levels</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
          <select
            value={filterOrbit}
            onChange={(e) => setFilterOrbit(e.target.value as FilterOrbit)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-600"
          >
            <option value="all">All Orbits</option>
            <option value="LEO">LEO</option>
            <option value="GEO">GEO</option>
          </select>
        </div>

        {/* Satellite List */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredSatellites.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <Satellite className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No satellites match filters</p>
            </div>
          ) : (
            filteredSatellites.map((satellite) => (
              <ThreatCard
                key={satellite.noradId}
                satellite={satellite}
                position={positions.get(satellite.noradId) || null}
                isExpanded={expandedId === satellite.noradId}
                onToggle={() => toggleExpanded(satellite.noradId)}
              />
            ))
          )}
        </div>

        {/* Data Attribution */}
        <div className="text-xs text-slate-500 pt-2 border-t border-slate-700 space-y-1">
          <div>Intelligence: Space Force, CSIS, Secure World Foundation</div>
          <div className="flex items-center justify-between">
            <span>Orbital data: Celestrak (SGP4)</span>
            {lastUpdate && (
              <span className="text-slate-600">
                Updated: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
