'use client';

import { useEffect, useRef, useState } from 'react';
import { config } from '@/lib/config';

export default function GlobeViewer() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const cesiumViewerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!viewerRef.current || cesiumViewerRef.current) return;

    if (!config.cesium.ionToken) {
      setError('Cesium Ion token not configured.');
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const initCesium = async () => {
      try {
        console.log('Loading Cesium from npm...');

        // Import from npm package
        const Cesium = await import('cesium');

        if (!mounted) return;

        console.log('Setting Ion token...');
        (Cesium as any).Ion.defaultAccessToken = config.cesium.ionToken;

        console.log('Creating viewer...');
        const viewer = new (Cesium as any).Viewer(viewerRef.current, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          vrButton: false,
          geocoder: false,
          homeButton: true,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: true,
          terrainProvider: new (Cesium as any).EllipsoidTerrainProvider(),
        });

        viewer.scene.globe.enableLighting = true;

        viewer.camera.setView({
          destination: (Cesium as any).Cartesian3.fromDegrees(-98.5, 39.8, 15000000),
        });

        cesiumViewerRef.current = viewer;
        setIsLoading(false);
        setError(null);

        console.log('✅ Cesium initialized!');

      } catch (err: any) {
        console.error('Cesium error:', err);
        setError(err?.message || 'Failed to initialize Cesium');
        setIsLoading(false);
      }
    };

    initCesium();

    return () => {
      mounted = false;
      if (cesiumViewerRef.current && !cesiumViewerRef.current.isDestroyed()) {
        cesiumViewerRef.current.destroy();
        cesiumViewerRef.current = null;
      }
    };
  }, []);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="max-w-md p-6 bg-red-900/20 border border-red-500 rounded-lg">
          <h3 className="text-red-400 font-semibold mb-2">Cesium Error</h3>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading Globe...</p>
        </div>
      </div>
    );
  }

  return <div ref={viewerRef} className="w-full h-full" />;
}