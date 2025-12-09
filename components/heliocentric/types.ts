// Types for heliocentric view components

export interface HeliocentricPosition {
  x: number;
  y: number;
  z: number;
  distanceFromSun: number;
}

export interface SpacecraftData {
  id: string;
  name: string;
  horizonsId: string;
  type: 'deep-space' | 'inner-solar' | 'outer-solar' | 'earth-orbit';
  agency: 'NASA' | 'ESA' | 'NASA/ESA' | 'JAXA';
  missionStatus: 'active' | 'extended' | 'nominal';
  description: string;
  position: HeliocentricPosition | null;
  error?: string;
}

export interface PlanetData {
  id: string;
  name: string;
  horizonsId: string;
  color: string;
  size: number;
  position: HeliocentricPosition | null;
  orbitRadius: number;
}

export type ViewMode = 'inner' | 'outer' | 'full';

export interface SolarSystemCanvasProps {
  spacecraft: SpacecraftData[];
  planets: PlanetData[];
  viewMode: ViewMode;
  showOrbits: boolean;
  showPlanetLabels: boolean;
  showSpacecraftLabels: boolean;
  selectedObject: PlanetData | SpacecraftData | null;
  onSelect: (data: PlanetData | SpacecraftData | null) => void;
}
