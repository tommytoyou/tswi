'use client';
import { useEffect, useRef, useState } from 'react';
import { config } from '@/lib/config';
import dynamic from 'next/dynamic';

interface RoadsterViewerProps {
  roadsterData: any;
}

function RoadsterViewerComponent({ roadsterData }: RoadsterViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const cesiumViewerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('🚀 Roadster viewer useEffect triggered');
    console.log('📦 roadsterData:', roadsterData);
    console.log('📍 viewerRef.current:', viewerRef.current);
    console.log('🔧 cesiumViewerRef.current:', cesiumViewerRef.current);

    // Don't initialize if we don't have data
    if (!roadsterData) {
      console.log('⏳ Waiting for roadsterData...');
      return;
    }

    // Don't initialize if viewer ref isn't ready
    if (!viewerRef.current) {
      console.log('⏳ Waiting for viewerRef...');
      return;
    }

    // Don't re-initialize if already created
    if (cesiumViewerRef.current) {
      console.log('✅ Cesium viewer already initialized');
      return;
    }

    if (!config.cesium.ionToken) {
      console.error('❌ Cesium Ion token not configured');
      setError('Cesium Ion token not configured');
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const initCesium = async () => {
      try {
        console.log('🔄 Starting Cesium initialization...');
        const Cesium = await import('cesium');
        console.log('✅ Cesium module loaded');

        if (!mounted) {
          console.log('⚠️ Component unmounted, aborting');
          return;
        }

        Cesium.Ion.defaultAccessToken = config.cesium.ionToken;
        console.log('✅ Cesium Ion token set');

        console.log('🌍 Creating Cesium Viewer...');
        const viewer = new Cesium.Viewer(viewerRef.current!, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: true,
          vrButton: false,
          geocoder: false,
          homeButton: true,
          infoBox: true,
          sceneModePicker: true,
          selectionIndicator: true,
          timeline: false,
          navigationHelpButton: true,
        });
        console.log('✅ Cesium Viewer created');

        // Enable lighting for realistic space visualization
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.showGroundAtmosphere = true;
        if (viewer.scene.skyAtmosphere) {
          viewer.scene.skyAtmosphere.show = true;
        }
        console.log('✅ Scene settings configured');

        // Convert AU position to kilometers for Cesium
        const AU_TO_KM = 149597870.7;
        console.log('📍 Roadster position:', roadsterData.position);
        const position = Cesium.Cartesian3.fromElements(
          roadsterData.position.x * AU_TO_KM * 1000,
          roadsterData.position.y * AU_TO_KM * 1000,
          roadsterData.position.z * AU_TO_KM * 1000
        );
        console.log('✅ Position converted to Cartesian3');

        // Add the Roadster as a point entity
        console.log('🚗 Adding Roadster entity...');
        const roadster = viewer.entities.add({
          name: 'Tesla Roadster (Starman)',
          position: position,
          point: {
            pixelSize: 12,
            color: Cesium.Color.RED,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
          },
          label: {
            text: '🚗 Tesla Roadster',
            font: '14pt sans-serif',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -15),
          },
          description: `
            <div style="font-family: sans-serif;">
              <h3>Tesla Roadster (Starman)</h3>
              <p><strong>Distance from Earth:</strong> ${(roadsterData.earth_distance_km / 1000000).toFixed(2)} million km</p>
              <p><strong>Distance from Mars:</strong> ${(roadsterData.mars_distance_km / 1000000).toFixed(2)} million km</p>
              <p><strong>Speed:</strong> ${roadsterData.speed_kph.toLocaleString()} km/h</p>
              <p><strong>Launched:</strong> ${new Date(roadsterData.launch_date).toLocaleDateString()}</p>
              <p>${roadsterData.details}</p>
            </div>
          `,
        });
        console.log('✅ Roadster entity added');

        // Draw orbital path if available
        console.log('🛰️ Checking for trajectory data...');
        console.log('Trajectory available:', !!roadsterData.trajectory);
        console.log('Trajectory length:', roadsterData.trajectory?.length);

        if (roadsterData.trajectory && roadsterData.trajectory.length > 0) {
          console.log(`🎨 Rendering trajectory with ${roadsterData.trajectory.length} points...`);
          const pathPositions = roadsterData.trajectory.map((point: any) => {
            return Cesium.Cartesian3.fromElements(
              point.x * AU_TO_KM * 1000,
              point.y * AU_TO_KM * 1000,
              point.z * AU_TO_KM * 1000
            );
          });

          viewer.entities.add({
            name: 'Roadster Orbit',
            polyline: {
              positions: pathPositions,
              width: 2,
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.2,
                color: Cesium.Color.RED.withAlpha(0.5),
              }),
            },
          });
          console.log('✅ Trajectory rendered');
        } else {
          console.log('⚠️ No trajectory data to render');
        }

        // Add Earth for reference
        console.log('🌍 Adding Earth reference...');
        const earth = viewer.entities.add({
          name: 'Earth',
          position: Cesium.Cartesian3.ZERO,
          point: {
            pixelSize: 15,
            color: Cesium.Color.BLUE,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
          },
          label: {
            text: '🌍 Earth',
            font: '14pt sans-serif',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -15),
          },
        });
        console.log('✅ Earth reference added');

        // Add Sun for reference
        console.log('☀️ Adding Sun reference...');
        const sun = viewer.entities.add({
          name: 'Sun',
          position: Cesium.Cartesian3.fromElements(0, 0, 0),
          point: {
            pixelSize: 20,
            color: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.ORANGE,
            outlineWidth: 3,
          },
          label: {
            text: '☀️ Sun',
            font: '16pt sans-serif',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -20),
          },
        });
        console.log('✅ Sun reference added');

        // Set camera to view the entire orbit
        console.log('📷 Setting camera view...');
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromElements(
            0,
            0,
            roadsterData.orbit.semi_major_axis_au * AU_TO_KM * 3000
          ),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0.0,
          },
        });
        console.log('✅ Camera view set');

        // Fly to Roadster after a moment
        console.log('🎬 Scheduling flyTo animation...');
        setTimeout(() => {
          console.log('🚁 Executing flyTo...');
          viewer.flyTo(roadster, {
            duration: 3,
            offset: new Cesium.HeadingPitchRange(
              0,
              Cesium.Math.toRadians(-45),
              roadsterData.earth_distance_km * 1000 * 2
            ),
          });
        }, 1000);

        cesiumViewerRef.current = viewer;
        console.log('🎯 Setting isLoading to false...');
        setIsLoading(false);
        setError(null);

        console.log('✅✅✅ Roadster viewer initialized successfully!');
      } catch (err: any) {
        console.error('❌❌❌ Cesium initialization error:', err);
        console.error('Error details:', err.stack);
        setError(err.message || 'Failed to initialize Cesium');
        setIsLoading(false);
      }
    };

    console.log('▶️ Calling initCesium()...');
    initCesium();

    return () => {
      console.log('🧹 Cleanup: unmounting Roadster viewer');
      mounted = false;
      if (cesiumViewerRef.current && !cesiumViewerRef.current.isDestroyed()) {
        try {
          cesiumViewerRef.current.destroy();
          console.log('✅ Cesium viewer destroyed');
        } catch (err) {
          console.error('❌ Error destroying Cesium viewer:', err);
        }
      }
    };
  }, [roadsterData]);

  console.log('🎨 Render - isLoading:', isLoading, 'error:', error);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="max-w-md p-6 bg-red-900/20 border border-red-500 rounded-lg">
          <h3 className="text-red-400 font-bold mb-2">Visualization Error</h3>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-500 mx-auto mb-4" />
          <p className="text-white text-xl">Plotting trajectory...</p>
        </div>
      </div>
    );
  }

  return <div ref={viewerRef} className="w-full h-full" />;
}

// Export with SSR disabled
export default dynamic(() => Promise.resolve(RoadsterViewerComponent), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-500 mx-auto mb-4" />
        <p className="text-white text-xl">Plotting trajectory...</p>
      </div>
    </div>
  ),
});
