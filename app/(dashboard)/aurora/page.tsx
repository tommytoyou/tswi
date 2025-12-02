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

// NOAA-inspired color scale with vibrant aurora colors
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

// Probability thresholds for smooth contours
const thresholds = [3, 5, 8, 12, 18, 25, 35, 45, 55, 65, 75, 85, 95];

export default function AuroraPage() {
  const northCanvasRef = useRef<HTMLCanvasElement>(null);
  const southCanvasRef = useRef<HTMLCanvasElement>(null);
  const [auroraData, setAuroraData] = useState<AuroraData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [worldData, setWorldData] = useState<any>(null);

  // Fetch world topology for continent outlines
  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(res => res.json())
      .then(data => {
        const countries = feature(data, data.objects.countries);
        setWorldData(countries);
      })
      .catch(err => console.error('Failed to load world data:', err));
  }, []);

  // Fetch aurora data
  const fetchAuroraData = useCallback(async () => {
    try {
      const res = await fetch('/api/noaa/aurora?fetch=latest');
      if (!res.ok) throw new Error('Failed to fetch aurora data');
      const data = await res.json();
      if (data.success) {
        setAuroraData(data);
        setError(null);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Aurora fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuroraData();
    const interval = setInterval(fetchAuroraData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAuroraData]);

  // Create gridded data for contour generation
  // Grid is in polar coordinates: x = longitude (0-360), y = distance from pole (0 = pole, 50 = 40° lat)
  const createPolarGrid = useCallback((
    points: AuroraDataPoint[],
    hemisphere: 'north' | 'south'
  ): { values: number[], width: number, height: number } => {
    const width = 360;  // 1 degree longitude resolution
    const height = 50;  // degrees from pole (covers 40° to 90° latitude)
    const values = new Array(width * height).fill(0);
    const counts = new Array(width * height).fill(0);

    // Filter points for hemisphere and polar region
    const filteredPoints = points.filter(p => {
      if (hemisphere === 'north') {
        return p.Latitude >= 40;
      } else {
        return p.Latitude <= -40;
      }
    });

    // Map points to grid (using distance from pole)
    for (const point of filteredPoints) {
      const lon = Math.floor(point.Longitude) % 360;
      // Distance from pole (0 = pole, 50 = 40° lat)
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

    // Average where multiple points
    for (let i = 0; i < values.length; i++) {
      if (counts[i] > 0) {
        values[i] /= counts[i];
      }
    }

    // Apply gaussian blur for smoother contours
    return { values: gaussianBlur(values, width, height, 4), width, height };
  }, []);

  // Gaussian blur for smooth gradients
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

    // Horizontal pass (with wrapping for longitude)
    const temp = [...result];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let val = 0;
        for (let k = -radius; k <= radius; k++) {
          const xx = (x + k + width) % width; // Wrap around for longitude
          val += temp[y * width + xx] * kernel[k + radius];
        }
        result[y * width + x] = val;
      }
    }

    // Vertical pass
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

  // Convert polar grid coordinates to geographic coordinates
  const gridToGeo = (
    gridX: number,
    gridY: number,
    hemisphere: 'north' | 'south'
  ): [number, number] => {
    const lon = gridX;
    // gridY is distance from pole (0 = pole, 50 = 40° lat)
    const lat = hemisphere === 'north'
      ? 90 - gridY
      : -(90 - gridY);
    return [lon > 180 ? lon - 360 : lon, lat];
  };

  // Render polar projection
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
    const radius = size / 2 - 50;

    // Dark blue background
    ctx.fillStyle = '#050520';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Create polar stereographic projection
    const projection = geoStereographic()
      .scale(radius * 1.5)
      .translate([centerX, centerY])
      .rotate([0, hemisphere === 'north' ? -90 : 90, 0])
      .clipAngle(55);  // Show down to ~35° from pole

    const pathGenerator = geoPath(projection, ctx);

    // Draw aurora oval glow effect (background)
    ctx.save();
    const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.3, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(0, 80, 60, 0.1)');
    gradient.addColorStop(0.5, 'rgba(0, 60, 100, 0.05)');
    gradient.addColorStop(1, 'rgba(0, 0, 30, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    ctx.restore();

    // Create grid and contours
    const grid = createPolarGrid(points, hemisphere);
    const contourGenerator = contours()
      .size([grid.width, grid.height])
      .thresholds(thresholds)
      .smooth(true);

    const contourData = contourGenerator(grid.values);

    // Draw filled contours from lowest to highest
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

    // Add glow effect for high probability areas
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

    // Draw latitude circles (from pole outward: 80°, 70°, 60°, 50°)
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

    // Draw longitude lines (every 30 degrees)
    ctx.strokeStyle = 'rgba(80, 100, 120, 0.25)';
    ctx.lineWidth = 0.5;
    const graticule = geoGraticule()
      .step([30, 90])
      .extent([[-180, hemisphere === 'north' ? 40 : -90], [180, hemisphere === 'north' ? 90 : -40]]);

    ctx.beginPath();
    pathGenerator(graticule());
    ctx.stroke();

    // Draw continent outlines
    if (worldData) {
      ctx.strokeStyle = 'rgba(150, 160, 180, 0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      pathGenerator(worldData);
      ctx.stroke();
    }

    // Draw pole marker
    const polePos = projection([0, hemisphere === 'north' ? 90 : -90]);
    if (polePos) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(polePos[0], polePos[1], 4, 0, Math.PI * 2);
      ctx.fill();

      // Pole label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(hemisphere === 'north' ? 'N' : 'S', polePos[0], polePos[1] - 10);
    }

    // Latitude labels
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

    // Hemisphere title
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      hemisphere === 'north' ? 'Northern Hemisphere' : 'Southern Hemisphere',
      centerX,
      28
    );

  }, [worldData, createPolarGrid]);

  // Re-render when data changes
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

  // Handle window resize
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
    <div className="h-[calc(100vh-80px)] flex flex-col bg-[#050520]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">OVATION Aurora Forecast</h1>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-500 animate-pulse' : error ? 'bg-red-500' : 'bg-emerald-500'}`} />
            <span className="text-sm text-slate-400">
              {loading ? 'Loading...' : error ? 'Error' : 'Live'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm text-slate-400">
          <div>
            <span className="text-slate-500">Observation:</span>{' '}
            <span className="text-slate-300">{formatTime(auroraData?.observation_time)}</span>
          </div>
          <div>
            <span className="text-slate-500">Forecast:</span>{' '}
            <span className="text-slate-300">{formatTime(auroraData?.forecast_time)}</span>
          </div>
          <div>
            <span className="text-slate-500">Max Probability:</span>{' '}
            <span className="text-emerald-400 font-semibold">{maxProbability.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Main content - dual polar view */}
      <div className="flex-1 flex min-h-0">
        {/* Northern Hemisphere */}
        <div className="flex-1 relative min-w-0">
          <canvas
            ref={northCanvasRef}
            className="w-full h-full"
          />
        </div>

        {/* Divider with legend */}
        <div className="w-24 flex flex-col items-center justify-center py-6 border-x border-slate-800/30">
          <div className="text-xs text-slate-400 mb-3 font-medium">Probability</div>
          <div className="flex-1 w-5 rounded-lg overflow-hidden flex flex-col-reverse shadow-lg max-h-64">
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
          <div className="flex flex-col items-center mt-3 text-xs text-slate-500 gap-1">
            <span>100%</span>
            <div className="flex-1" />
            <span>0%</span>
          </div>
        </div>

        {/* Southern Hemisphere */}
        <div className="flex-1 relative min-w-0">
          <canvas
            ref={southCanvasRef}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Footer legend */}
      <div className="flex items-center justify-center gap-6 px-6 py-3 border-t border-slate-800/50 bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: 'rgb(0, 120, 180)' }} />
          <span className="text-xs text-slate-400">Low (5-20%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: 'rgb(0, 180, 160)' }} />
          <span className="text-xs text-slate-400">Moderate (20-40%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: 'rgb(150, 255, 50)' }} />
          <span className="text-xs text-slate-400">High (40-60%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: 'rgb(255, 220, 0)' }} />
          <span className="text-xs text-slate-400">Very High (60-80%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: 'rgb(255, 50, 30)' }} />
          <span className="text-xs text-slate-400">Extreme (80%+)</span>
        </div>
        <div className="ml-6 text-xs text-slate-600">
          Data: NOAA Space Weather Prediction Center (SWPC)
        </div>
      </div>
    </div>
  );
}
