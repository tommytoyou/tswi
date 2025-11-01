import { create } from 'zustand';
import { User } from '@/lib/types';

// ============================================================================
// GLOBAL STATE TYPES
// ============================================================================

interface AuthState {
  user: User | null;
  apiKey: string | null;
  plan: 'free' | 'pro' | 'enterprise' | null;
  setAuth: (user: User) => void;
  clearAuth: () => void;
}

interface TimeWindowState {
  windowHours: 6 | 12 | 24;
  setWindowHours: (hours: 6 | 12 | 24) => void;
}

interface MapLayersState {
  kpBelts: boolean;
  tec: boolean;
  satellites: boolean;
  magnetometers: boolean;
  toggleLayer: (layer: keyof Omit<MapLayersState, 'toggleLayer'>) => void;
}

interface SatelliteState {
  selectedSatellite: { name: string; noradId: number } | null;
  setSelectedSatellite: (sat: { name: string; noradId: number } | null) => void;
}

interface RoutePlannerState {
  flightPath: Array<{ lat: number; lon: number; alt: number }> | null;
  setFlightPath: (path: Array<{ lat: number; lon: number; alt: number }> | null) => void;
}

interface AlertsState {
  activeAlerts: Array<{ id: string; name: string; triggered_at: Date }>;
  unreadCount: number;
  addAlert: (alert: { id: string; name: string; triggered_at: Date }) => void;
  markAsRead: () => void;
}

interface ForecastState {
  latestKpForecast: {
    value: number;
    p10: number;
    p90: number;
    summary: string;
  } | null;
  setLatestKpForecast: (forecast: {
    value: number;
    p10: number;
    p90: number;
    summary: string;
  }) => void;
}

interface UIState {
  theme: 'light' | 'dark';
  loading: { [key: string]: boolean };
  toasts: Array<{ id: string; message: string; type: 'info' | 'warning' | 'error' | 'success' }>;
  setTheme: (theme: 'light' | 'dark') => void;
  setLoading: (key: string, isLoading: boolean) => void;
  addToast: (message: string, type: 'info' | 'warning' | 'error' | 'success') => void;
  removeToast: (id: string) => void;
}

// ============================================================================
// ZUSTAND STORE
// ============================================================================

interface AppStore
  extends AuthState,
    TimeWindowState,
    MapLayersState,
    SatelliteState,
    RoutePlannerState,
    AlertsState,
    ForecastState,
    UIState {}

export const useStore = create<AppStore>((set) => ({
  // Auth
  user: null,
  apiKey: null,
  plan: null,
  setAuth: (user) => set({ user, apiKey: user.apiKey, plan: user.plan }),
  clearAuth: () => set({ user: null, apiKey: null, plan: null }),

  // Time Window
  windowHours: 24,
  setWindowHours: (hours) => set({ windowHours: hours }),

  // Map Layers
  kpBelts: true,
  tec: true,
  satellites: true,
  magnetometers: true,
  toggleLayer: (layer) => set((state) => ({ [layer]: !state[layer] })),

  // Satellite Selection
  selectedSatellite: null,
  setSelectedSatellite: (sat) => set({ selectedSatellite: sat }),

  // Route Planner
  flightPath: null,
  setFlightPath: (path) => set({ flightPath: path }),

  // Alerts
  activeAlerts: [],
  unreadCount: 0,
  addAlert: (alert) =>
    set((state) => ({
      activeAlerts: [...state.activeAlerts, alert],
      unreadCount: state.unreadCount + 1,
    })),
  markAsRead: () => set({ unreadCount: 0 }),

  // Forecast
  latestKpForecast: null,
  setLatestKpForecast: (forecast) => set({ latestKpForecast: forecast }),

  // UI
  theme: 'dark',
  loading: {},
  toasts: [],
  setTheme: (theme) => set({ theme }),
  setLoading: (key, isLoading) =>
    set((state) => ({
      loading: { ...state.loading, [key]: isLoading },
    })),
  addToast: (message, type) =>
    set((state) => ({
      toasts: [...state.toasts, { id: `${Date.now()}`, message, type }],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
