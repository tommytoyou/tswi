# TSWI - Space Weather Intelligence Platform

## Overview
Real-time space weather monitoring and forecasting platform built with Next.js 14, MongoDB Atlas, and Cesium for 3D visualization. The platform monitors solar wind, geomagnetic indices (Kp, Dst), Total Electron Content (TEC), solar flares, and Solar Energetic Particle (SEP) events.

## Recent Changes
**2025-11-01**: Migrated from Vercel to Replit
- Configured Next.js to run on port 5000 with 0.0.0.0 host binding for Replit compatibility
- Fixed hydration errors by moving Cesium CSS import from layout head to globals.css
- Updated @types/cesium version from 1.121.0 to 1.70.4 (compatible version)
- Configured development workflow and deployment settings
- Environment variables configured: MONGODB_URI, NEXT_PUBLIC_CESIUM_ION_TOKEN, AUTH_SECRET

## Project Structure
```
app/
  (dashboard)/        # Dashboard routes
    alerts/           # Alert management
    dashboard/        # Main dashboard
    map/              # 3D globe visualization
  api/                # API routes
    alerts/           # Alert API
    forecast/         # Forecast API
    health/           # Health check
    timeseries/       # Time series data API
components/
  cesium/             # Cesium 3D globe components
  dashboard/          # Dashboard UI components
  navigation/         # Navigation components
  ui/                 # Reusable UI components
lib/
  auth/               # Authentication (mock for MVP)
  store/              # Zustand state management
  config.ts           # Configuration management
  db.ts               # MongoDB connection and collections
  types.ts            # TypeScript types
  utils.ts            # Utility functions
```

## Technology Stack
- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS
- **3D Visualization**: Cesium + Resium
- **Database**: MongoDB Atlas (time series collections)
- **State Management**: Zustand
- **UI Components**: Radix UI + custom components
- **Validation**: Zod
- **Package Manager**: npm

## Environment Variables
Required secrets (configured in Replit Secrets):
- `MONGODB_URI`: MongoDB Atlas connection string
- `NEXT_PUBLIC_CESIUM_ION_TOKEN`: Cesium Ion access token for globe visualization
- `AUTH_SECRET`: Secret key for authentication

## Development
- **Port**: 5000 (configured for Replit webview)
- **Host**: 0.0.0.0 (allows Replit proxy access)
- **Dev Command**: `npm run dev`
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`

## Database
MongoDB Atlas with time series collections for:
- Kp index (geomagnetic activity)
- Dst index (disturbance storm time)
- Solar wind plasma data
- Solar wind magnetic field data
- GOES proton flux
- Regional TEC measurements

Collections auto-initialize with proper indexes on first connection.

## Deployment
Configured for Replit Autoscale deployment:
- Stateless Next.js application
- Suitable for web applications
- Automatically scales based on traffic

## Notes
- Cesium CSS is imported via globals.css to avoid Next.js hydration issues
- The app uses MongoDB Atlas for persistent storage (not local database)
- Authentication is currently mock-based (to be replaced with real auth)
- Time series data has automatic expiration (TTL) configured per collection
