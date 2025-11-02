'use client';

import { useEffect, useRef, useState } from 'react';
import { config } from '@/lib/config';

export default function GlobeViewer() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const cesiumViewerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  // Only render on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !viewerRef.current || cesiumViewerRef.current) return;

    if (!config.cesium.ionToken) {
      setError('Cesium Ion token not configured');
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const initCesium = async () => {
      try {
        const Cesium = await import('cesium');

        if (!mounted) return;

        (window as any).CESIUM_BASE_URL = '/cesium/';
        (Cesium as any).Ion.defaultAccessToken = config.cesium.ionToken;

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
        });

        viewer.scene.globe.enableLighting = true;
        viewer.camera.setView({
          destination: (Cesium as any).Cartesian3.fromDegrees(-98.5, 39.8, 15000000),
        });

        cesiumViewerRef.current = viewer;
        setIsLoading(false);
        setError(null);

      } catch (err: any) {
        console.error('Cesium error:', err);
        setError(err.message || 'Failed to initialize Cesium');
        setIsLoading(false);
      }
    };

    initCesium();

    return () => {
      mounted = false;
      if (cesiumViewerRef.current && !cesiumViewerRef.current.isDestroyed()) {
        cesiumViewerRef.current.destroy();
      }
    };
  }, [isClient]);

  // Don't render anything until client-side
  if (!isClient) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-white text-xl">Loading 3D Globe...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="max-w-md p-6 bg-red-900/20 border border-red-500 rounded-lg">
          <h3 className="text-red-400 font-bold mb-2">Globe Error</h3>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-white text-xl">Loading 3D Globe...</p>
        </div>
      </div>
    );
  }

  return <div ref={viewerRef} className="w-full h-full" />;
}