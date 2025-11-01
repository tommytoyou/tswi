# TSWI - Space Weather Intelligence Platform

Real-time space weather monitoring and forecasting platform built with Next.js 14, TypeScript, CesiumJS, and MongoDB Atlas.

## Features

- **Real-Time Monitoring**: Solar wind, Kp/Dst indices, SEP events, TEC gradients
- **Smart Alerts**: Custom alert rules with multi-channel notifications
- **3D Globe Visualization**: Cesium-powered map with satellite tracking and space weather overlays
- **Time Series Analysis**: MongoDB Atlas time series collections with optimized retention
- **Forecasting**: AI-driven Kp, Dst, and TEC predictions

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **3D Visualization**: CesiumJS
- **State Management**: Zustand
- **Database**: MongoDB Atlas (time series collections)
- **Validation**: Zod
- **Deployment**: Vercel-ready

## Getting Started

### Prerequisites

- Node.js 18.17+
- MongoDB Atlas account
- Cesium Ion account (free tier)

### Installation

1. Clone the repository
```bash
git clone <repo-url>
cd tswi
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```

Edit `.env` and add your:
- MongoDB Atlas connection string
- Cesium Ion access token

4. Initialize database and seed demo data
```bash
npm run seed
```

5. Run development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
tswi/
├── app/              # Next.js 14 App Router
│   ├── (dashboard)/  # Dashboard layout group
│   └── api/          # API routes
├── components/       # React components
│   ├── ui/          # shadcn/ui components
│   ├── cesium/      # Cesium globe components
│   ├── dashboard/   # Dashboard cards
│   └── navigation/  # Navigation components
├── lib/             # Shared utilities
│   ├── db.ts        # MongoDB connection
│   ├── config.ts    # Environment configuration
│   ├── types.ts     # TypeScript types
│   ├── auth/        # Authentication (mock for MVP)
│   └── store/       # Zustand state management
└── scripts/         # Utility scripts
    └── seed.ts      # Database seeding
```

## Database Schema

### Time Series Collections

1. **timeseries_kp** (1 min, 90 days): Kp index
2. **timeseries_dst** (1 hour, 180 days): Dst index
3. **timeseries_solarwind_plasma** (1 min, 30 days): Speed, density, temperature
4. **timeseries_solarwind_mag** (1 min, 30 days): Bx, By, Bz, Bt
5. **timeseries_goes_protons** (5 min, 90 days): SEP flux at 10/50/100 MeV
6. **timeseries_tec_regional** (15 min, 90 days): Regional TEC and gradients

### Standard Collections

- **alerts**: User alert rules
- **events_observed**: Space weather events (flares, CMEs, SEP, etc.)
- **forecasts**: Kp, Dst, TEC predictions
- **users**: User accounts (mock auth for MVP)
- **satellites**: TLE data for tracked satellites
- **ground_stations**: SuperMAG magnetometer stations

## API Routes

- `GET /api/health` - Health check
- `GET /api/timeseries` - Query time series data
- `GET /api/alerts` - List user alerts
- `POST /api/alerts` - Create new alert rule
- `GET /api/forecast` - Get latest forecasts

## Deployment

### Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Environment Variables for Production

- `MONGODB_URI`: Production MongoDB Atlas connection string
- `NEXT_PUBLIC_CESIUM_ION_TOKEN`: Cesium Ion access token
- `AUTH_SECRET`: Strong secret key for authentication

## TODO: Future Work

- [ ] Real authentication (NextAuth.js/Clerk)
- [ ] External data ingestion (NOAA SWPC, NASA DONKI APIs)
- [ ] Real-time WebSocket updates
- [ ] Satellite pass time calculations
- [ ] Flight path routing with space weather constraints
- [ ] Advanced forecasting with ML models
- [ ] Email/SMS/webhook alert delivery
- [ ] User dashboard customization
- [ ] Historical data export
- [ ] API rate limiting and usage tracking

## License

Proprietary - All rights reserved

## Contact

For questions or support, contact: operator@tswi.space
