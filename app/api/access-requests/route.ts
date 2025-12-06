import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { AccessRequestSchema } from '@/lib/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Schema for creating a new access request
const CreateAccessRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  name: z.string().min(1, 'Name is required'),
  company: z.string().min(1, 'Company is required'),
  use_case: z.string().min(10, 'Please provide more details about your use case (at least 10 characters)'),
});

// POST - Create new access request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validationResult = CreateAccessRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, name, company, use_case } = validationResult.data;

    const db = await getDb();
    const accessRequestsCollection = db.collection('access_requests');

    // Check if email already has a pending or approved request
    const existingRequest = await accessRequestsCollection.findOne({ email });
    if (existingRequest) {
      if (existingRequest.status === 'approved') {
        return NextResponse.json(
          { success: false, error: 'This email has already been approved. Please sign in.' },
          { status: 400 }
        );
      }
      if (existingRequest.status === 'pending') {
        return NextResponse.json(
          { success: false, error: 'An access request for this email is already pending review.' },
          { status: 400 }
        );
      }
      // If rejected, allow resubmission by updating the existing request
      await accessRequestsCollection.updateOne(
        { email },
        {
          $set: {
            name,
            company,
            use_case,
            status: 'pending',
            created_at: new Date(),
            reviewed_at: null,
            reviewed_by: null,
          },
        }
      );
      return NextResponse.json({
        success: true,
        message: 'Your access request has been resubmitted.',
      });
    }

    // Check if user is already in users collection
    const usersCollection = db.collection('users');
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'This email already has access. Please sign in.' },
        { status: 400 }
      );
    }

    // Create new access request
    const newRequest = {
      email,
      name,
      company,
      use_case,
      status: 'pending' as const,
      created_at: new Date(),
      reviewed_at: null,
      reviewed_by: null,
    };

    await accessRequestsCollection.insertOne(newRequest);

    return NextResponse.json({
      success: true,
      message: 'Your access request has been submitted. You will receive an email when approved.',
    });
  } catch (error) {
    console.error('Error creating access request:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
