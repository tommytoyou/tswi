import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAdminSession } from '@/lib/auth/admin';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

// POST - Reject an access request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminSession = await getAdminSession();
    if (!adminSession) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const db = await getDb();
    const accessRequestsCollection = db.collection('access_requests');

    // Find the access request
    const accessRequest = await accessRequestsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!accessRequest) {
      return NextResponse.json(
        { success: false, error: 'Access request not found' },
        { status: 404 }
      );
    }

    if (accessRequest.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'This request has already been processed' },
        { status: 400 }
      );
    }

    // Update access request status
    await accessRequestsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'rejected',
          reviewed_at: new Date(),
          reviewed_by: adminSession.email,
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Access request rejected',
    });
  } catch (error) {
    console.error('Error rejecting access request:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}
