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

    // Check if Cesium token is set
    if (!config.cesium.ionToken) {
      setError('Cesium Ion token not configured. Please add NEXT_PUBLIC_CESIUM_ION_TOKEN to Replit Secrets.');
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const initCesium = async () => {
      try {
        // Dynamic import of Cesium
        const Cesium = await import('cesium');

        if (!mounted) return;

        // Set Cesium Ion token
        Cesium.Ion.defaultAccessToken = config.cesium.ionToken;

        // Initialize Cesium Viewer with Replit-friendly settings
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
          // Use a simpler imagery provider for better performance
          imageryProvider: new Cesium.IonImageryProvider({ assetId: 2 }),
          // Disable terrain for faster loading in Replit
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          requestRenderMode: true, // Only render when needed
          maximumRenderTimeChange: Infinity,
        });

        // Enable lighting
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.dynamicAtmosphereLighting = true;
        viewer.scene.globe.dynamicAtmosphereLightingFromSun = false;

        // Set initial camera position
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(-98.5, 39.8, 15000000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
        });

        // Disable depth testing for better performance
        viewer.scene.globe.depthTestAgainstTerrain = false;

        cesiumViewerRef.current = viewer;
        setIsLoading(false);
        setError(null);

        console.log('✅ Cesium initialized successfully');

        // TODO: Add Kp latitude bands as color-coded regions
        // TODO: Add TEC raster overlay from timeseries data
        // TODO: Add satellite tracks from TLE data
        // TODO: Add SuperMAG ground station markers
        // TODO: Add time scrubber for last 24 hours
        // TODO: Add satellite search and selection
        // TODO: Add click handler for pass time calculations

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
```

## 🎯 Key Improvements:

1. **Better Error Handling** - Shows specific error messages if Cesium fails to load
2. **Token Validation** - Checks if the token is set before attempting to load
3. **Performance Optimizations** for Replit:
   - `requestRenderMode: true` - Only renders when needed
   - `EllipsoidTerrainProvider` - Simpler terrain for faster loading
   - Disabled depth testing
4. **Loading States** - Shows spinner while initializing
5. **Troubleshooting Guide** - If it fails, shows what to check

## 🔍 Check Cesium Token

Make sure in your Replit Secrets you have:
```
NEXT_PUBLIC_CESIUM_ION_TOKEN=your_actual_token_here