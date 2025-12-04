import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * CRON JOB: Data Ingestion
 * Runs every 1 minute to fetch latest NOAA data
 * Called by Vercel Cron or can be triggered manually with CRON_SECRET
 */
export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = {
      solarWind: { success: false, records: 0 },
      kpIndex: { success: false, records: 0 },
      xrayFlux: { success: false, records: 0 },
      solarEvents: { success: false, records: 0 },
      solarWindPlasma: { success: false, records: 0 },
      protonFlux: { success: false, records: 0 },
      dst: { success: false, records: 0 },
    };

    // Fetch all NOAA data sources in parallel
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000';

    const [solarWindRes, kpIndexRes, xrayFluxRes, solarEventsRes, plasmaRes, protonRes, dstRes] = await Promise.allSettled([
      fetch(`${baseUrl}/api/noaa/solar-wind?fetch=latest`),
      fetch(`${baseUrl}/api/noaa/kp-index?fetch=latest`),
      fetch(`${baseUrl}/api/noaa/xray-flux?fetch=latest`),
      fetch(`${baseUrl}/api/noaa/solar-events?fetch=latest`),
      fetch(`${baseUrl}/api/noaa/solar-wind-plasma?fetch=latest`),
      fetch(`${baseUrl}/api/noaa/proton-flux?fetch=latest`),
      fetch(`${baseUrl}/api/noaa/dst?fetch=latest`),
    ]);

    // Process solar wind data
    if (solarWindRes.status === 'fulfilled' && solarWindRes.value.ok) {
      const data = await solarWindRes.value.json();
      results.solarWind = { success: true, records: data.data?.length || 0 };
    }

    // Process Kp index data
    if (kpIndexRes.status === 'fulfilled' && kpIndexRes.value.ok) {
      const data = await kpIndexRes.value.json();
      results.kpIndex = { success: true, records: data.data?.length || 0 };
    }

    // Process X-ray flux data
    if (xrayFluxRes.status === 'fulfilled' && xrayFluxRes.value.ok) {
      const data = await xrayFluxRes.value.json();
      results.xrayFlux = { success: true, records: data.data?.length || 0 };
    }

    // Process solar events data
    if (solarEventsRes.status === 'fulfilled' && solarEventsRes.value.ok) {
      const data = await solarEventsRes.value.json();
      results.solarEvents = { success: true, records: data.data?.length || 0 };
    }

    // Process solar wind plasma data
    if (plasmaRes.status === 'fulfilled' && plasmaRes.value.ok) {
      const data = await plasmaRes.value.json();
      results.solarWindPlasma = { success: true, records: data.data?.length || 0 };
    }

    // Process proton flux data
    if (protonRes.status === 'fulfilled' && protonRes.value.ok) {
      const data = await protonRes.value.json();
      results.protonFlux = { success: true, records: data.data?.length || 0 };
    }

    // Process DST data
    if (dstRes.status === 'fulfilled' && dstRes.value.ok) {
      const data = await dstRes.value.json();
      results.dst = { success: true, records: data.data?.length || 0 };
    }

    // Log ingestion results
    const db = await getDb();
    await db.collection('system_logs').insertOne({
      type: 'data_ingestion',
      timestamp: new Date(),
      results,
      success: Object.values(results).every(r => r.success),
    });

    return NextResponse.json({
      success: true,
      message: 'Data ingestion completed',
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Data ingestion error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Data ingestion failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
