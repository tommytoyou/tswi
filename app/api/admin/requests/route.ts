import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAdminSession } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

// GET - List all access requests
export async function GET(request: NextRequest) {
  try {
    const adminSession = await getAdminSession();
    if (!adminSession) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';

    const db = await getDb();
    const accessRequestsCollection = db.collection('access_requests');

    const query = status === 'all' ? {} : { status };
    const requests = await accessRequestsCollection
      .find(query)
      .sort({ created_at: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      requests,
    });
  } catch (error) {
    console.error('Error fetching access requests:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}
