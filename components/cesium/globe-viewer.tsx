'use client';

import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { config } from '@/lib/config';

// Set Cesium Ion token
Cesium.Ion.defaultAccessToken = config.cesium.ionToken;

export default function GlobeViewer() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const cesiumViewerRef = useRef<Cesium.Viewer | null>(null);

  useEffect(() => {
    if (!viewerRef.current || cesiumViewerRef.current) return;

    // Initialize Cesium Viewer
    const viewer = new Cesium.Viewer(viewerRef.current, {
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
      imageryProvider: new Cesium.IonImageryProvider({ assetId: 2 }),
      terrainProvider: Cesium.Terrain.fromWorldTerrain(),
    });

    // Enable lighting
    viewer.scene.globe.enableLighting = true;

    // Set initial camera position
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(-98.5, 39.8, 15000000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
    });

    // TODO: Add Kp latitude bands as color-coded regions
    // TODO: Add TEC raster overlay from timeseries data
    // TODO: Add satellite tracks from TLE data
    // TODO: Add SuperMAG ground station markers
    // TODO: Add time scrubber for last 24 hours
    // TODO: Add satellite search and selection
    // TODO: Add click handler for pass time calculations

    cesiumViewerRef.current = viewer;

    return () => {
      if (cesiumViewerRef.current) {
        cesiumViewerRef.current.destroy();
        cesiumViewerRef.current = null;
      }
    };
  }, []);

  return <div ref={viewerRef} className="w-full h-full" />;
}
