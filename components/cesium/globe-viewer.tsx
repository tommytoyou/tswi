'use client';
import { useEffect, useRef, useState } from 'react';
import { config } from '@/lib/config';
import dynamic from 'next/dynamic';
import { KpAuroraLayer } from './kp-aurora-layer';
import { HfBlackoutLayer } from './hf-blackout-layer';

function GlobeViewerComponent() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const cesiumViewerRef = useRef<any>(null);
  const cesiumModuleRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cesiumReady, setCesiumReady] = useState(false);
  const [showHfBlackout, setShowHfBlackout] = useState(true);
  const [showAurora, setShowAurora] = useState(true);

  useEffect(() => {
    if (!viewerRef.current || cesiumViewerRef.current) return;

    if (!config.cesium.ionToken) {
      setError('Cesium Ion token not configured');
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const initCesium = async () => {
      try {
        // Import Cesium dynamically
        const Cesium = await import('cesium');

        if (!mounted) return;

        // Set Ion token
        Cesium.Ion.defaultAccessToken = config.cesium.ionToken;

        // Create the Cesium viewer
        const viewer = new Cesium.Viewer(viewerRef.current!, {
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

        // Enable lighting for realistic day/night visualization
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.showGroundAtmosphere = true;
        if (viewer.scene.skyAtmosphere) {
          viewer.scene.skyAtmosphere.show = true;
        }

        // Set initial camera position (centered over US)
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(-98.5, 39.8, 15000000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0.0,
          },
        });

        cesiumViewerRef.current = viewer;
        cesiumModuleRef.current = Cesium;
        setIsLoading(false);
        setError(null);
        setCesiumReady(true);

        console.log('✅ Cesium initialized successfully');
      } catch (err: any) {
        console.error('❌ Cesium initialization error:', err);
        setError(err.message || 'Failed to initialize Cesium');
        setIsLoading(false);
      }
    };

    initCesium();

    return () => {
      mounted = false;
      if (cesiumViewerRef.current && !cesiumViewerRef.current.isDestroyed()) {
        try {
          cesiumViewerRef.current.destroy();
          console.log('🗑️ Cesium viewer destroyed');
        } catch (err) {
          console.error('Error destroying Cesium viewer:', err);
        }
      }
    };
  }, []);

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

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4" />
            <p className="text-white text-xl">Loading 3D Globe...</p>
          </div>
        </div>
      )}
      <div ref={viewerRef} className="w-full h-full" />

      {/* Map Layers Panel */}
      {cesiumReady && (
        <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-3 min-w-[180px]">
          <div className="text-sm font-semibold text-white mb-2">Map Layers</div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showAurora}
                onChange={(e) => setShowAurora(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-green-500 focus:ring-green-500 focus:ring-offset-0"
              />
              <span className="text-sm text-slate-300">Aurora Forecast</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showHfBlackout}
                onChange={(e) => setShowHfBlackout(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-0"
              />
              <span className="text-sm text-slate-300">HF Blackout</span>
            </label>
          </div>
        </div>
      )}

      {/* Aurora Layer */}
      {cesiumReady && cesiumViewerRef.current && cesiumModuleRef.current && showAurora && (
        <KpAuroraLayer
          viewer={cesiumViewerRef.current}
          Cesium={cesiumModuleRef.current}
        />
      )}

      {/* HF Blackout Layer */}
      {cesiumReady && cesiumViewerRef.current && cesiumModuleRef.current && (
        <HfBlackoutLayer
          viewer={cesiumViewerRef.current}
          Cesium={cesiumModuleRef.current}
          visible={showHfBlackout}
        />
      )}
    </div>
  );
}

// Export with SSR disabled
export default dynamic(() => Promise.resolve(GlobeViewerComponent), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4" />
        <p className="text-white text-xl">Loading 3D Globe...</p>
      </div>
    </div>
  ),
});