import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.MONGODB_DB || 'tswi';

async function seed() {
  console.log('🌱 Starting seed process...');

  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not set in environment');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(DB_NAME);

    // SEED DEMO USER
    const usersCollection = db.collection('users');
    await usersCollection.deleteMany({});

    const demoUser = {
      userId: 'user_demo_001',
      email: 'operator@tswi.space',
      name: 'Demo Operator',
      plan: 'pro',
      apiKey: 'tswi_demo_key_12345',
      created_at: new Date('2025-01-15T00:00:00Z'),
    };

    await usersCollection.insertOne(demoUser as any);
    console.log('✅ Demo user created');

    // SEED ALERT RULES
    const alertsCollection = db.collection('alerts');
    await alertsCollection.deleteMany({});

    const alertRules = [
      {
        user_id: 'user_demo_001',
        name: 'Storm Watch',
        conditions: { bz_lt: -5, speed_gt: 550, window_min: 30 },
        channel: 'email',
        target: 'operator@tswi.space',
        status: 'active',
        last_triggered_at: new Date('2025-11-01T08:30:00Z'),
        created_at: new Date('2025-01-20T00:00:00Z'),
        updated_at: new Date('2025-01-20T00:00:00Z'),
      },
      {
        user_id: 'user_demo_001',
        name: 'HF Caution',
        conditions: { kp_ge: 5, window_min: 60 },
        channel: 'webhook',
        target: 'https://hooks.tswi.space/alerts',
        status: 'active',
        created_at: new Date('2025-01-20T00:00:00Z'),
        updated_at: new Date('2025-01-20T00:00:00Z'),
      },
      {
        user_id: 'user_demo_001',
        name: 'SEP Watch',
        conditions: { proton_gt: 10, window_min: 15 },
        channel: 'email',
        target: 'operator@tswi.space',
        status: 'active',
        created_at: new Date('2025-01-20T00:00:00Z'),
        updated_at: new Date('2025-01-20T00:00:00Z'),
      },
      {
        user_id: 'user_demo_001',
        name: 'GNSS Risk NA-mid',
        conditions: { tec_gradient_gt: 3.0, region: 'NA-mid', window_min: 60 },
        channel: 'email',
        target: 'operator@tswi.space',
        status: 'active',
        created_at: new Date('2025-01-20T00:00:00Z'),
        updated_at: new Date('2025-01-20T00:00:00Z'),
      },
      {
        user_id: 'user_demo_001',
        name: 'Flare Alert',
        conditions: { flare_class_ge: 'M' },
        channel: 'webhook',
        target: 'https://hooks.tswi.space/flares',
        status: 'active',
        last_triggered_at: new Date('2025-11-01T06:45:00Z'),
        created_at: new Date('2025-01-20T00:00:00Z'),
        updated_at: new Date('2025-01-20T00:00:00Z'),
      },
    ];

    await alertsCollection.insertMany(alertRules);
    console.log(`✅ ${alertRules.length} alert rules created`);

    // SEED TIME SERIES DATA
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Kp data (1 min cadence)
    console.log('📊 Seeding Kp time series...');
    const kpData = [];
    for (let i = 0; i < 24 * 60; i++) {
      const ts = new Date(oneDayAgo.getTime() + i * 60 * 1000);
      const hour = ts.getUTCHours();
      
      let kp = 3 + Math.sin(hour / 24 * Math.PI) + Math.random() * 0.5;
      if (hour >= 8 && hour <= 12) {
        kp = Math.min(9, kp + 2);
      }
      
      kpData.push({
        ts,
        kp: Math.round(kp * 10) / 10,
        meta: {},
      });
    }
    await db.collection('timeseries_kp').insertMany(kpData);
    console.log(`✅ ${kpData.length} Kp data points`);

    // Dst data
    console.log('📊 Seeding Dst time series...');
    const dstData = [];
    for (let i = 0; i < 24; i++) {
      const ts = new Date(oneDayAgo.getTime() + i * 60 * 60 * 1000);
      const hour = ts.getUTCHours();
      
      let dst = -20 + Math.random() * 10;
      if (hour >= 8 && hour <= 12) {
        dst = -50 - Math.random() * 20;
      }
      
      dstData.push({ ts, dst: Math.round(dst), meta: {} });
    }
    await db.collection('timeseries_dst').insertMany(dstData);
    console.log(`✅ ${dstData.length} Dst data points`);

    // Solar Wind Plasma
    console.log('📊 Seeding solar wind plasma...');
    const plasmaData = [];
    for (let i = 0; i < 24 * 60; i++) {
      const ts = new Date(oneDayAgo.getTime() + i * 60 * 1000);
      const hour = ts.getUTCHours();
      
      let speed = 400 + Math.random() * 50;
      if (hour >= 8 && hour <= 12) {
        speed = 600 + Math.random() * 50;
      }
      
      plasmaData.push({
        ts,
        speed_kms: Math.round(speed),
        density_cm3: 5 + Math.random() * 3,
        temp_k: 100000 + Math.random() * 50000,
        meta: {},
      });
    }
    await db.collection('timeseries_solarwind_plasma').insertMany(plasmaData);
    console.log(`✅ ${plasmaData.length} plasma data points`);

    // Solar Wind Magnetic Field
    console.log('📊 Seeding solar wind magnetic field...');
    const magData = [];
    for (let i = 0; i < 24 * 60; i++) {
      const ts = new Date(oneDayAgo.getTime() + i * 60 * 1000);
      const hour = ts.getUTCHours();
      const minute = ts.getUTCMinutes();
      
      let bz = -2 + Math.random() * 4;
      if (hour === 9 && minute <= 45) {
        bz = -7 + Math.random() * 2;
      }
      
      magData.push({
        ts,
        bz_nt: Math.round(bz * 10) / 10,
        by_nt: Math.round((Math.random() * 6 - 3) * 10) / 10,
        bx_nt: Math.round((Math.random() * 6 - 3) * 10) / 10,
        bt_nt: Math.round((5 + Math.random() * 3) * 10) / 10,
        meta: {},
      });
    }
    await db.collection('timeseries_solarwind_mag').insertMany(magData);
    console.log(`✅ ${magData.length} magnetic field data points`);

    // GOES Protons
    console.log('📊 Seeding GOES protons...');
    const protonsData = [];
    for (let i = 0; i < 24 * 12; i++) {
      const ts = new Date(oneDayAgo.getTime() + i * 5 * 60 * 1000);
      const hour = ts.getUTCHours();
      
      let p10 = 1 + Math.random() * 2;
      if (hour >= 10 && hour <= 14) {
        p10 = 12 + Math.random() * 5;
      }
      
      protonsData.push({
        ts,
        p10_pfu: Math.round(p10 * 10) / 10,
        p50_pfu: Math.round((p10 * 0.3) * 10) / 10,
        p100_pfu: Math.round((p10 * 0.1) * 10) / 10,
        meta: {},
      });
    }
    await db.collection('timeseries_goes_protons').insertMany(protonsData);
    console.log(`✅ ${protonsData.length} proton data points`);

    // TEC Regional
    console.log('📊 Seeding TEC regional...');
    const tecData = [];
    const regions = ['NA-mid', 'EU-high', 'polar-north', 'polar-south'];
    
    for (let i = 0; i < 24 * 4; i++) {
      for (const region of regions) {
        const ts = new Date(oneDayAgo.getTime() + i * 15 * 60 * 1000);
        const hour = ts.getUTCHours();
        
        let tec_grad = 1 + Math.random();
        if (region === 'NA-mid' && hour >= 9 && hour <= 11) {
          tec_grad = 4 + Math.random() * 2;
        }
        
        tecData.push({
          ts,
          region_id: region,
          tec_mean: 10 + Math.random() * 20,
          tec_grad: Math.round(tec_grad * 10) / 10,
          meta: {},
        });
      }
    }
    await db.collection('timeseries_tec_regional').insertMany(tecData);
    console.log(`✅ ${tecData.length} TEC data points`);

    // SEED EVENTS
    const eventsCollection = db.collection('events_observed');
    await eventsCollection.deleteMany({});

    const events = [
      {
        ts: new Date('2025-11-01T06:45:00Z'),
        kind: 'flare_event',
        severity: 'moderate',
        source: 'GOES-16',
        payload: { class: 'M2.1', region: 'AR3482', peak_flux: '2.1e-5' },
        evidence_uris: ['https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json'],
      },
      {
        ts: new Date('2025-11-01T08:30:00Z'),
        kind: 'alert_fired',
        severity: 'high',
        source: 'tswi-alerting',
        payload: { alert_name: 'Storm Watch', conditions_met: ['bz_lt', 'speed_gt'] },
        evidence_uris: ['timeseries_solarwind_mag?start=2025-11-01T08:00:00Z'],
      },
      {
        ts: new Date('2025-11-01T09:15:00Z'),
        kind: 'solarwind_flag_bz_south',
        severity: 'high',
        source: 'tswi-detector',
        payload: { bz_min: -7.2, duration_min: 45 },
        evidence_uris: ['timeseries_solarwind_mag?start=2025-11-01T09:00:00Z'],
      },
      {
        ts: new Date('2025-11-01T10:00:00Z'),
        kind: 'sep_event',
        severity: 'moderate',
        source: 'GOES-18',
        payload: { p10_max_pfu: 15.3, p50_max_pfu: 4.2 },
        evidence_uris: ['timeseries_goes_protons?start=2025-11-01T10:00:00Z'],
      },
      {
        ts: new Date('2025-11-01T10:30:00Z'),
        kind: 'tec_spike',
        severity: 'moderate',
        source: 'tswi-tec-monitor',
        payload: { region: 'NA-mid', gradient_max: 5.2 },
        evidence_uris: ['timeseries_tec_regional?region=NA-mid'],
      },
    ];

    await eventsCollection.insertMany(events);
    console.log(`✅ ${events.length} events created`);

    // SEED FORECASTS
    const forecastsCollection = db.collection('forecasts');
    await forecastsCollection.deleteMany({});

    const forecasts = [
      {
        ts: now,
        kind: 'kp',
        horizon_min: 360,
        value: 5,
        p10: 4,
        p90: 6,
        summary: 'Moderate geomagnetic storm conditions expected in next 6 hours',
        evidence: ['Solar wind speed elevated at 620 km/s', 'IMF Bz southward at -7 nT'],
      },
      {
        ts: now,
        kind: 'dst',
        horizon_min: 360,
        value: -60,
        p10: -80,
        p90: -40,
        summary: 'Ring current intensification likely',
        evidence: ['Sustained southward Bz observed'],
      },
    ];

    await forecastsCollection.insertMany(forecasts);
    console.log(`✅ ${forecasts.length} forecasts created`);

    // SEED SATELLITES
    const satellitesCollection = db.collection('satellites');
    await satellitesCollection.deleteMany({});

    const satellites = [
      {
        name: 'ISS',
        norad_id: 25544,
        tle_line1: '1 25544U 98067A   25305.50000000  .00016717  00000-0  10270-3 0  9005',
        tle_line2: '2 25544  51.6400 208.5000 0006703  80.0000 280.2000 15.54509710123456',
        color: '#FFD700',
        enabled: true,
      },
      {
        name: 'SWARM-A',
        norad_id: 39451,
        tle_line1: '1 39451U 13067A   25305.50000000  .00000345  00000-0  50000-4 0  9008',
        tle_line2: '2 39451  87.4000 180.0000 0005000 100.0000 260.0000 15.40000000654321',
        color: '#00CED1',
        enabled: true,
      },
      {
        name: 'NOAA-21',
        norad_id: 54234,
        tle_line1: '1 54234U 22150A   25305.50000000  .00000234  00000-0  40000-4 0  9001',
        tle_line2: '2 54234  98.7000 150.0000 0001200  90.0000 270.0000 14.20000000123789',
        color: '#FF6347',
        enabled: true,
      },
      {
        name: 'Starlink-12345',
        norad_id: 50000,
        tle_line1: '1 50000U 21001A   25305.50000000  .00002000  00000-0  15000-3 0  9002',
        tle_line2: '2 50000  53.0000 120.0000 0002000  70.0000 290.0000 15.20000000234567',
        color: '#9370DB',
        enabled: true,
      },
      {
        name: 'NEUMAN-DEMO',
        norad_id: 99999,
        tle_line1: '1 99999U 25001A   25305.50000000  .00000100  00000-0  10000-4 0  9000',
        tle_line2: '2 99999  98.0000 100.0000 0015000  60.0000 300.0000 14.80000000012345',
        color: '#00FF00',
        enabled: true,
      },
    ];

    await satellitesCollection.insertMany(satellites);
    console.log(`✅ ${satellites.length} satellites created`);

    // SEED GROUND STATIONS
    const stationsCollection = db.collection('ground_stations');
    await stationsCollection.deleteMany({});

    const stations = [
      { name: 'Yellowknife', lat: 62.48, lon: -114.48, network: 'CARISMA', enabled: true },
      { name: 'Fort Churchill', lat: 58.76, lon: -94.09, network: 'CARISMA', enabled: true },
      { name: 'Poker Flat', lat: 65.12, lon: -147.47, network: 'THEMIS', enabled: true },
      { name: 'Gillam', lat: 56.38, lon: -94.64, network: 'CARISMA', enabled: true },
      { name: 'Fort Simpson', lat: 61.76, lon: -121.24, network: 'CARISMA', enabled: true },
      { name: 'Dawson', lat: 64.05, lon: -139.43, network: 'CARISMA', enabled: true },
      { name: 'Rankin Inlet', lat: 62.82, lon: -92.11, network: 'CARISMA', enabled: true },
      { name: 'Athabasca', lat: 54.71, lon: -113.32, network: 'CARISMA', enabled: true },
      { name: 'Inuvik', lat: 68.36, lon: -133.72, network: 'CARISMA', enabled: true },
      { name: 'Baker Lake', lat: 64.32, lon: -96.02, network: 'CARISMA', enabled: true },
      { name: 'Tromso', lat: 69.66, lon: 18.94, network: 'IMAGE', enabled: true },
      { name: 'Longyearbyen', lat: 78.15, lon: 15.83, network: 'IMAGE', enabled: true },
      { name: 'Kiruna', lat: 67.84, lon: 20.42, network: 'IMAGE', enabled: true },
      { name: 'Sodankyla', lat: 67.37, lon: 26.63, network: 'IMAGE', enabled: true },
      { name: 'Abisko', lat: 68.36, lon: 18.82, network: 'IMAGE', enabled: true },
      { name: 'Kevo', lat: 69.76, lon: 27.01, network: 'IMAGE', enabled: true },
      { name: 'Hornsund', lat: 77.00, lon: 15.55, network: 'IMAGE', enabled: true },
      { name: 'Ny-Alesund', lat: 78.93, lon: 11.93, network: 'IMAGE', enabled: true },
      { name: 'Bjornoya', lat: 74.50, lon: 19.00, network: 'IMAGE', enabled: true },
      { name: 'Hopen', lat: 76.51, lon: 25.01, network: 'IMAGE', enabled: true },
    ];

    await stationsCollection.insertMany(stations);
    console.log(`✅ ${stations.length} ground stations created`);

    console.log('\n✅ Seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}

seed().catch(console.error);
