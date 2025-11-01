import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = await getDb();
    await db.admin().ping();

    return NextResponse.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Database connection failed',
      },
      { status: 500 }
    );
  }
}
