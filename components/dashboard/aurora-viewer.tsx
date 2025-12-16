'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { geoPath, geoCircle, geoGraticule, geoStereographic } from 'd3-geo';
import { contours } from 'd3-contour';
import { feature } from 'topojson-client';

interface AuroraDataPoint {
  Longitude: number;
  Latitude: number;
  Aurora: number;
}

interface AuroraData {
  observation_time: string;
  forecast_time: string;
  coordinates: AuroraDataPoint[];
  count: number;
}

const auroraColors = [
  { value: 0, color: 'rgba(0, 0, 30, 0)' },
  { value: 5, color: 'rgba(0, 60, 120, 0.4)' },
  { value: 15, color: 'rgba(0, 120, 180, 0.6)' },
  { value: 25, color: 'rgba(0, 180, 160, 0.7)' },
  { value: 40, color: 'rgba(50, 220, 100, 0.8)' },
  { value: 55, color: 'rgba(150, 255, 50, 0.85)' },
  { value: 70, color: 'rgba(255, 220, 0, 0.9)' },
  { value: 85, color: 'rgba(255, 140, 0, 0.95)' },
  { value: 100, color: 'rgba(255, 50, 30, 1)' },
];

const colorScale = d3.scaleLinear<string>()
  .domain(auroraColors.map(c => c.value))
  .range(auroraColors.map(c => c.color))
  .clamp(true);

const thresholds = [3, 5, 8, 12, 18, 25, 35, 45, 55, 65, 75, 85, 95];

export default function AuroraViewer() {
  const northCanvasRef = useRef<HTMLCanvasElement>(null);
  const southCanvasRef = useRef<HTMLCanvasElement>(null);
  const [auroraData, setAuroraData] = useState<AuroraData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [worldData, setWorldData] = useState<any>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json', { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        const countries = feature(data, data.objects.countries);
        setWorldData(countries);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Failed to load world data:', err);
        }
      });
    return () => controller.abort();
  }, []);

  const fetchAuroraData = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/noaa/aurora?fetch=latest', { signal });
      if (!res.ok) throw new Error('Failed to fetch aurora data');
      const data = await res.json();
      if (data.success) {
        setAuroraData(data);
        setError(null);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Aurora fetch error:', err);
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchAuroraData(controller.signal);
    const interval = setInterval(() => fetchAuroraData(controller.signal), 5 * 60 * 1000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchAuroraData]);

  const createPolarGrid = useCallback((
    points: AuroraDataPoint[],
    hemisphere: 'north' | 'south'
  ): { values: number[], width: number, height: number } => {
    const width = 360;
    const height = 50;
    const values = new Array(width * height).fill(0);
    const counts = new Array(width * height).fill(0);

    const filteredPoints = points.filter(p => {
      if (hemisphere === 'north') {
        return p.Latitude >= 40;
      } else {
        return p.Latitude <= -40;
      }
    });

    for (const point of filteredPoints) {
      const lon = Math.floor(point.Longitude) % 360;
      const distFromPole = hemisphere === 'north'
        ? 90 - point.Latitude
        : 90 + point.Latitude;

      const y = Math.floor(distFromPole);

      if (lon >= 0 && lon < width && y >= 0 && y < height) {
        const idx = y * width + lon;
        values[idx] += point.Aurora;
        counts[idx]++;
      }
    }

    for (let i = 0; i < values.length; i++) {
      if (counts[i] > 0) {
        values[i] /= counts[i];
      }
    }

    return { values: gaussianBlur(values, width, height, 4), width, height };
  }, []);

  function gaussianBlur(values: number[], width: number, height: number, radius: number): number[] {
    const result = [...values];
    const kernel: number[] = [];
    const sigma = radius / 2;
    let sum = 0;

    for (let i = -radius; i <= radius; i++) {
      const val = Math.exp(-(i * i) / (2 * sigma * sigma));
      kernel.push(val);
      sum += val;
    }
    kernel.forEach((_, i) => kernel[i] /= sum);

    const temp = [...result];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let val = 0;
        for (let k = -radius; k <= radius; k++) {
          const xx = (x + k + width) % width;
          val += temp[y * width + xx] * kernel[k + radius];
        }
        result[y * width + x] = val;
      }
    }

    temp.splice(0, temp.length, ...result);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let val = 0;
        for (let k = -radius; k <= radius; k++) {
          const yy = Math.max(0, Math.min(height - 1, y + k));
          val += temp[yy * width + x] * kernel[k + radius];
        }
        result[y * width + x] = val;
      }
    }

    return result;
  }

  const gridToGeo = (
    gridX: number,
    gridY: number,
    hemisphere: 'north' | 'south'
  ): [number, number] => {
    const lon = gridX;
    const lat = hemisphere === 'north'
      ? 90 - gridY
      : -(90 - gridY);
    return [lon > 180 ? lon - 360 : lon, lat];
  };

  const renderPolar = useCallback((
    canvas: HTMLCanvasElement,
    hemisphere: 'north' | 'south',
    points: AuroraDataPoint[]
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.offsetWidth;
    const displayHeight = canvas.offsetHeight;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);

    const size = Math.min(displayWidth, displayHeight);
    const centerX = displayWidth / 2;
    const centerY = displayHeight / 2;
    const radius = size / 2 - 40;

    ctx.fillStyle = '#050520';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    const projection = geoStereographic()
      .scale(radius * 1.5)
      .translate([centerX, centerY])
      .rotate([0, hemisphere === 'north' ? -90 : 90, 0])
      .clipAngle(55);

    const pathGenerator = geoPath(projection, ctx);

    ctx.save();
    const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.3, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(0, 80, 60, 0.1)');
    gradient.addColorStop(0.5, 'rgba(0, 60, 100, 0.05)');
    gradient.addColorStop(1, 'rgba(0, 0, 30, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    ctx.restore();

    const grid = createPolarGrid(points, hemisphere);
    const contourGenerator = contours()
      .size([grid.width, grid.height])
      .thresholds(thresholds)
      .smooth(true);

    const contourData = contourGenerator(grid.values);

    contourData.forEach(contour => {
      if (contour.value < 3) return;

      const color = colorScale(contour.value);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;

      contour.coordinates.forEach(polygon => {
        polygon.forEach((ring, ringIndex) => {
          ctx.beginPath();

          ring.forEach((point, i) => {
            const [lon, lat] = gridToGeo(point[0], point[1], hemisphere);
            const projected = projection([lon, lat]);

            if (projected) {
              if (i === 0) {
                ctx.moveTo(projected[0], projected[1]);
              } else {
                ctx.lineTo(projected[0], projected[1]);
              }
            }
          });

          ctx.closePath();
          if (ringIndex === 0) {
            ctx.fill();
          }
        });
      });
    });

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    contourData.filter(c => c.value >= 40).forEach(contour => {
      const glowColor = d3.color(colorScale(contour.value));
      if (glowColor) {
        glowColor.opacity = 0.3;
        ctx.shadowColor = glowColor.formatRgb();
        ctx.shadowBlur = 15;
        ctx.fillStyle = 'rgba(0,0,0,0)';

        contour.coordinates.forEach(polygon => {
          polygon.forEach((ring) => {
            ctx.beginPath();
            ring.forEach((point, i) => {
              const [lon, lat] = gridToGeo(point[0], point[1], hemisphere);
              const projected = projection([lon, lat]);
              if (projected) {
                if (i === 0) ctx.moveTo(projected[0], projected[1]);
                else ctx.lineTo(projected[0], projected[1]);
              }
            });
            ctx.closePath();
            ctx.stroke();
          });
        });
      }
    });
    ctx.restore();

    ctx.strokeStyle = 'rgba(100, 120, 140, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    [80, 70, 60, 50, 40].forEach(lat => {
      const adjustedLat = hemisphere === 'north' ? lat : -lat;
      const circle = geoCircle()
        .center([0, hemisphere === 'north' ? 90 : -90])
        .radius(90 - Math.abs(adjustedLat))();

      ctx.beginPath();
      pathGenerator(circle);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(80, 100, 120, 0.25)';
    ctx.lineWidth = 0.5;
    const graticule = geoGraticule()
      .step([30, 90])
      .extent([[-180, hemisphere === 'north' ? 40 : -90], [180, hemisphere === 'north' ? 90 : -40]]);

    ctx.beginPath();
    pathGenerator(graticule());
    ctx.stroke();

    if (worldData) {
      ctx.strokeStyle = 'rgba(150, 160, 180, 0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      pathGenerator(worldData);
      ctx.stroke();
    }

    const polePos = projection([0, hemisphere === 'north' ? 90 : -90]);
    if (polePos) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(polePos[0], polePos[1], 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(hemisphere === 'north' ? 'N' : 'S', polePos[0], polePos[1] - 10);
    }

    ctx.fillStyle = 'rgba(150, 170, 190, 0.8)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';

    [70, 60, 50].forEach(lat => {
      const adjustedLat = hemisphere === 'north' ? lat : -lat;
      const labelPos = projection([15, adjustedLat]);
      if (labelPos) {
        ctx.fillText(`${Math.abs(lat)}°`, labelPos[0] + 5, labelPos[1] + 4);
      }
    });

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      hemisphere === 'north' ? 'Northern Hemisphere' : 'Southern Hemisphere',
      centerX,
      24
    );

  }, [worldData, createPolarGrid]);

  useEffect(() => {
    if (!auroraData?.coordinates || auroraData.coordinates.length === 0) return;

    const northCanvas = northCanvasRef.current;
    const southCanvas = southCanvasRef.current;

    if (northCanvas) {
      renderPolar(northCanvas, 'north', auroraData.coordinates);
    }

    if (southCanvas) {
      renderPolar(southCanvas, 'south', auroraData.coordinates);
    }
  }, [auroraData, worldData, renderPolar]);

  useEffect(() => {
    const handleResize = () => {
      if (auroraData?.coordinates) {
        const northCanvas = northCanvasRef.current;
        const southCanvas = southCanvasRef.current;

        if (northCanvas) {
          renderPolar(northCanvas, 'north', auroraData.coordinates);
        }

        if (southCanvas) {
          renderPolar(southCanvas, 'south', auroraData.coordinates);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [auroraData, renderPolar]);

  const formatTime = (timeStr: string | undefined) => {
    if (!timeStr) return '--';
    try {
      return new Date(timeStr).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return '--';
    }
  };

  const maxProbability = auroraData?.coordinates
    ? Math.max(...auroraData.coordinates.map(p => p.Aurora), 0)
    : 0;

  return (
    <div className="h-full flex flex-col bg-[#050520]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white">OVATION Aurora Forecast</h2>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-500 animate-pulse' : error ? 'bg-red-500' : 'bg-emerald-500'}`} />
            <span className="text-xs text-slate-400">
              {loading ? 'Loading...' : error ? 'Error' : 'Live'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <div>
            <span className="text-slate-500">Obs:</span>{' '}
            <span className="text-slate-300">{formatTime(auroraData?.observation_time)}</span>
          </div>
          <div>
            <span className="text-slate-500">Max:</span>{' '}
            <span className="text-emerald-400 font-semibold">{maxProbability.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 relative min-w-0">
          <canvas
            ref={northCanvasRef}
            className="w-full h-full"
          />
        </div>

        <div className="w-20 flex flex-col items-center justify-center py-4 border-x border-slate-800/30 flex-shrink-0">
          <div className="text-xs text-slate-400 mb-2 font-medium">Probability</div>
          <div className="flex-1 w-4 rounded-lg overflow-hidden flex flex-col-reverse shadow-lg max-h-48">
            {auroraColors.slice(1).map((c, i) => (
              <div
                key={c.value}
                className="flex-1"
                style={{
                  background: `linear-gradient(to top, ${auroraColors[i].color}, ${c.color})`
                }}
              />
            ))}
          </div>
          <div className="flex flex-col items-center mt-2 text-xs text-slate-500 gap-0.5">
            <span>100%</span>
            <div className="flex-1" />
            <span>0%</span>
          </div>
        </div>

        <div className="flex-1 relative min-w-0">
          <canvas
            ref={southCanvasRef}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Footer legend */}
      <div className="flex items-center justify-center gap-4 px-4 py-2 border-t border-slate-800/50 bg-slate-900/50 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: 'rgb(0, 120, 180)' }} />
          <span className="text-xs text-slate-400">Low</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: 'rgb(0, 180, 160)' }} />
          <span className="text-xs text-slate-400">Moderate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: 'rgb(150, 255, 50)' }} />
          <span className="text-xs text-slate-400">High</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: 'rgb(255, 220, 0)' }} />
          <span className="text-xs text-slate-400">Very High</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: 'rgb(255, 50, 30)' }} />
          <span className="text-xs text-slate-400">Extreme</span>
        </div>
        <span className="ml-4 text-xs text-slate-600">
          Data: NOAA SWPC
        </span>
      </div>
    </div>
  );
}
