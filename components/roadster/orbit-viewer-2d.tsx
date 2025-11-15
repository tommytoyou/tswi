'use client';
import { useEffect, useRef } from 'react';

interface RoadsterOrbitViewerProps {
  roadsterData: any;
}

export default function RoadsterOrbitViewer({ roadsterData }: RoadsterOrbitViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !roadsterData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      draw();
    };

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const scale = Math.min(rect.width, rect.height) / 4; // Scale factor for AU

      // Clear canvas
      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Draw stars background
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * rect.width;
        const y = Math.random() * rect.height;
        const size = Math.random() * 1.5;
        ctx.fillRect(x, y, size, size);
      }

      // Draw Sun at center
      ctx.fillStyle = '#fbbf24'; // yellow-400
      ctx.beginPath();
      ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.fillText('☀️ Sun', centerX - 20, centerY + 30);

      // Draw Earth's orbit (1 AU)
      ctx.strokeStyle = '#3b82f6'; // blue-500
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, scale * 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Earth
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(centerX + scale * 1, centerY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText('🌍 Earth', centerX + scale * 1 - 20, centerY + 20);

      // Draw Mars orbit (~1.5 AU)
      ctx.strokeStyle = '#ef4444'; // red-500
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, scale * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Mars
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(centerX + scale * 1.5, centerY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText('🔴 Mars', centerX + scale * 1.5 - 20, centerY + 20);

      // Draw Roadster's elliptical orbit
      if (roadsterData.trajectory && roadsterData.trajectory.length > 0) {
        ctx.strokeStyle = '#f97316'; // orange-500
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        roadsterData.trajectory.forEach((point: any, i: number) => {
          const x = centerX + point.x * scale;
          const y = centerY + point.y * scale;
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        
        ctx.closePath();
        ctx.stroke();
      }

      // Draw Roadster's current position
      const roadsterX = centerX + roadsterData.position.x * scale;
      const roadsterY = centerY + roadsterData.position.y * scale;
      
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(roadsterX, roadsterY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px sans-serif';
      ctx.fillText('🚗 Roadster', roadsterX - 30, roadsterY - 15);

      // Draw distance info
      ctx.fillStyle = '#94a3b8'; // slate-400
      ctx.font = '12px monospace';
      ctx.fillText(
        `Distance from Earth: ${(roadsterData.earth_distance_km / 1000000).toFixed(2)} M km`,
        20,
        30
      );
      ctx.fillText(
        `Distance from Mars: ${(roadsterData.mars_distance_km / 1000000).toFixed(2)} M km`,
        20,
        50
      );
      ctx.fillText(
        `Speed: ${roadsterData.speed_kph.toLocaleString()} km/h`,
        20,
        70
      );
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
    };
  }, [roadsterData]);

  if (!roadsterData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-500 mx-auto mb-4" />
          <p className="text-white text-xl">Loading orbital data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-slate-900">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}