'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { config } from '@/lib/config';
import dynamic from 'next/dynamic';
import { KpAuroraLayer } from './kp-aurora-layer';
import { HfBlackoutLayer } from './hf-blackout-layer';
import { TecLayer } from './tec-layer';
import { SatelliteLayer } from './satellite-layer';
import { VulnerabilityLayer } from './vulnerability-layer';

function GlobeViewerComponent() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const cesiumViewerRef = useRef<any>(null);
  const cesiumModuleRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cesiumReady, setCesiumReady] = useState(false);
  const [showHfBlackout, setShowHfBlackout] = useState(true);
  const [showAurora, setShowAurora] = useState(true);
  const [showTec, setShowTec] = useState(false);
  const [showSatellites, setShowSatellites] = useState(true);
  const [showRadiationZones, setShowRadiationZones] = useState(true);
  const [showKpBelts, setShowKpBelts] = useState(false);
  const [showMagnetometers, setShowMagnetometers] = useState(false);
  const [kpValue, setKpValue] = useState<number>(0);

  // Fetch Kp index for radiation zone calculations
  const fetchKpIndex = useCallback(async () => {
    try {
      const response = await fetch('/api/noaa/kp-index');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.latest) {
          setKpValue(data.latest.kp || data.latest.kp_index || 0);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Kp index:', err);
    }
  }, []);

  // Fetch Kp on mount and periodically
  useEffect(() => {
    fetchKpIndex();
    const interval = setInterval(fetchKpIndex, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchKpIndex]);

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

        // Configure clock for real-time sun position
        viewer.clock.currentTime = Cesium.JulianDate.now();
        viewer.clock.shouldAnimate = true;
        viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
        viewer.clock.multiplier = 1; // Real-time (1 second = 1 second)

        // Enable lighting for realistic day/night visualization
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.showGroundAtmosphere = true;
        if (viewer.scene.skyAtmosphere) {
          viewer.scene.skyAtmosphere.show = true;
        }

        // Debug: Log current time info
        const cesiumTime = Cesium.JulianDate.toDate(viewer.clock.currentTime);
        console.log('🌍 Cesium clock initialized:');
        console.log('   Cesium time (UTC):', cesiumTime.toISOString());
        console.log('   Browser UTC:', new Date().toISOString());
        console.log('   Clock multiplier:', viewer.clock.multiplier);
        console.log('   Globe lighting enabled:', viewer.scene.globe.enableLighting);

        // Set initial camera position (centered over US)
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(-98.5, 39.8, 20000000),
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

      {/* Map Layers Panel - Bottom Left */}
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
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showTec}
                onChange={(e) => setShowTec(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-sm text-slate-300">TEC (Ionosphere)</span>
            </label>
          </div>
        </div>
      )}

      {/* Map Layers Panel - Bottom Right */}
      {cesiumReady && (
        <div className="absolute bottom-4 right-4 z-20 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-3 min-w-[180px]">
          <div className="text-sm font-semibold text-white mb-2">Map Layers</div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showSatellites}
                onChange={(e) => setShowSatellites(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-0"
              />
              <span className="text-sm text-slate-300">Satellites</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showRadiationZones}
                onChange={(e) => setShowRadiationZones(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500 focus:ring-offset-0"
              />
              <span className="text-sm text-slate-300">Radiation Zones</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showKpBelts}
                onChange={(e) => setShowKpBelts(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
              />
              <span className="text-sm text-slate-300">Kp Belts</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showMagnetometers}
                onChange={(e) => setShowMagnetometers(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
              />
              <span className="text-sm text-slate-300">Magnetometers</span>
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

      {/* TEC Layer */}
      {cesiumReady && cesiumViewerRef.current && cesiumModuleRef.current && (
        <TecLayer
          viewer={cesiumViewerRef.current}
          Cesium={cesiumModuleRef.current}
          visible={showTec}
        />
      )}

      {/* Satellite Layer */}
      {cesiumReady && cesiumViewerRef.current && cesiumModuleRef.current && (
        <SatelliteLayer
          viewer={cesiumViewerRef.current}
          Cesium={cesiumModuleRef.current}
          visible={showSatellites}
          kpValue={kpValue}
        />
      )}

      {/* Vulnerability/Radiation Zones Layer */}
      {cesiumReady && cesiumViewerRef.current && cesiumModuleRef.current && (
        <VulnerabilityLayer
          viewer={cesiumViewerRef.current}
          Cesium={cesiumModuleRef.current}
          visible={showRadiationZones}
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