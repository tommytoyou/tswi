import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { AlertSchema } from '@/lib/types';
import { requireSession } from '@/lib/auth/mock';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await requireSession();
    const collection = await getCollection('alerts');

    const alerts = await collection
      .find({ user_id: user._id })
      .sort({ created_at: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSession();
    const body = await request.json();

    const alert = AlertSchema.parse({
      ...body,
      user_id: user._id,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    const collection = await getCollection('alerts');
    const result = await collection.insertOne(alert as any);

    return NextResponse.json({
      success: true,
      data: { _id: result.insertedId, ...alert },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 400 }
    );
  }
}

// TODO: PUT/DELETE endpoints for alert management
// TODO: POST /test endpoint to simulate alert conditions
