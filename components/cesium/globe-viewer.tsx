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
      setError('Cesium Ion token not configured. Please add NEXT_PUBLIC_CESIUM_ION_TOKEN to Replit Secrets.');
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const initCesium = async () => {
      try {
        const Cesium = await import('cesium');

        if (!mounted) return;

        Cesium.Ion.defaultAccessToken = config.cesium.ionToken;

        const viewer = new Cesium.Viewer(viewerRef.current!, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          vrButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: true,
          navigationHelpButton: false,
          navigationInstructionsInitiallyVisible: false,
          imageryProvider: new Cesium.IonImageryProvider({ assetId: 2 }),
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity,
        });

        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.dynamicAtmosphereLighting = true;
        viewer.scene.globe.dynamicAtmosphereLightingFromSun = false;

        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(-98.5, 39.8, 15000000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
        });

        viewer.scene.globe.depthTestAgainstTerrain = false;

        cesiumViewerRef.current = viewer;
        setIsLoading(false);
        setError(null);

        console.log('✅ Cesium initialized successfully');

      } catch (err) {
        console.error('❌ Cesium initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize Cesium');
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
          <div className="mt-4 text-xs text-slate-400">
            <p className="mb-2">Troubleshooting steps:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Check that NEXT_PUBLIC_CESIUM_ION_TOKEN is set in Replit Secrets</li>
              <li>Verify your Cesium Ion token is valid at ion.cesium.com</li>
              <li>Try refreshing the page</li>
              <li>Check browser console for additional errors</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Initializing Cesium Globe...</p>
          <p className="text-slate-400 text-sm mt-2">This may take a moment in Replit</p>
        </div>
      </div>
    );
  }

  return <div ref={viewerRef} className="w-full h-full" />;
}