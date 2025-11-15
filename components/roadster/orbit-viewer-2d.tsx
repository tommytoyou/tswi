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

    console.log('🎨 Drawing orbit with data:', roadsterData);

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
      const scale = Math.min(rect.width, rect.height) / 3.5; // Scale factor for AU

      // Conversion factor: position data is in millions of miles, we need AU
      const MILLION_MILES_TO_AU = 1 / 92.956; // 1 AU = 92.956 million miles

      // Clear canvas
      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Draw stars background
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 150; i++) {
        const x = Math.random() * rect.width;
        const y = Math.random() * rect.height;
        const size = Math.random() * 2;
        ctx.globalAlpha = Math.random() * 0.8 + 0.2;
        ctx.fillRect(x, y, size, size);
      }
      ctx.globalAlpha = 1;

      // Draw Sun at center
      const sunGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 20);
      sunGradient.addColorStop(0, '#fef08a');
      sunGradient.addColorStop(0.5, '#fbbf24');
      sunGradient.addColorStop(1, '#f59e0b');
      ctx.fillStyle = sunGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
      ctx.fill();
      
      // Sun label
      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('☀️ Sun', centerX, centerY + 40);

      // Draw Earth's orbit (1 AU)
      ctx.strokeStyle = '#3b82f680'; // blue with transparency
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, scale * 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Earth
      const earthX = centerX + scale * 1;
      const earthY = centerY;
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(earthX, earthY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = '#dbeafe';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('🌍 Earth', earthX + 15, earthY + 5);

      // Draw Mars orbit (~1.52 AU)
      ctx.strokeStyle = '#ef444480'; // red with transparency
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, scale * 1.52, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Mars
      const marsX = centerX + scale * 1.52;
      const marsY = centerY;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(marsX, marsY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = '#fecaca';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('♦️ Mars', marsX + 15, marsY + 5);

      // Draw Roadster's orbit if trajectory exists
      if (roadsterData.trajectory && roadsterData.trajectory.length > 1) {
        console.log('✅ Drawing roadster trajectory with', roadsterData.trajectory.length, 'points');
        
        ctx.strokeStyle = '#fb923c'; // orange
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        let started = false;
        roadsterData.trajectory.forEach((point: any) => {
          // Convert from millions of miles to AU
          const x = centerX + (point.x * MILLION_MILES_TO_AU * scale);
          const y = centerY + (point.y * MILLION_MILES_TO_AU * scale);
          
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        });
        
        ctx.closePath();
        ctx.stroke();
      } else {
        console.log('⚠️ No trajectory data available');
      }

      // Draw Roadster's current position - CONVERT FROM MILLIONS OF MILES TO AU
      const roadsterAU_X = roadsterData.position.x * MILLION_MILES_TO_AU;
      const roadsterAU_Y = roadsterData.position.y * MILLION_MILES_TO_AU;
      const roadsterX = centerX + (roadsterAU_X * scale);
      const roadsterY = centerY + (roadsterAU_Y * scale);
      
      console.log('🚗 Roadster position:', { 
        raw_millions_miles: roadsterData.position,
        converted_AU: { x: roadsterAU_X, y: roadsterAU_Y },
        screen: { x: roadsterX, y: roadsterY },
        center: { x: centerX, y: centerY }
      });
      
      // Roadster glow effect
      const roadsterGlow = ctx.createRadialGradient(roadsterX, roadsterY, 0, roadsterX, roadsterY, 20);
      roadsterGlow.addColorStop(0, '#ef4444ff');
      roadsterGlow.addColorStop(0.5, '#ef444480');
      roadsterGlow.addColorStop(1, '#ef444400');
      ctx.fillStyle = roadsterGlow;
      ctx.beginPath();
      ctx.arc(roadsterX, roadsterY, 20, 0, Math.PI * 2);
      ctx.fill();
      
      // Roadster dot
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(roadsterX, roadsterY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Roadster label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚗', roadsterX, roadsterY - 20);
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('Roadster', roadsterX, roadsterY - 35);

      // Draw info overlay
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; // slate-900 with transparency
      ctx.fillRect(10, 10, 280, 80);
      
      ctx.fillStyle = '#94a3b8'; // slate-400
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
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