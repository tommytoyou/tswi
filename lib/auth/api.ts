import { getServerSession } from 'next-auth';
import { authOptions } from './config';
import { NextResponse } from 'next/server';
import type { UserRole } from '@/lib/types';

export interface ApiSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    company: string;
  };
}

/**
 * Get the current user session for API routes
 */
export async function getApiSession(): Promise<ApiSession | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return null;
  }
  return session as ApiSession;
}

/**
 * Check if user has AI access (user_ai or admin role)
 */
export function hasAIAccess(role: UserRole): boolean {
  return role === 'user_ai' || role === 'admin';
}

/**
 * Require authentication for an API route
 * Returns null if authenticated, or a NextResponse if not
 */
export async function requireAuth(): Promise<NextResponse | null> {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }
  return null;
}

/**
 * Require AI access for an API route
 * Returns null if authorized, or a NextResponse if not
 */
export async function requireAIAccess(): Promise<NextResponse | null> {
  const session = await getApiSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  if (!hasAIAccess(session.user.role)) {
    return NextResponse.json(
      { success: false, error: 'AI access not enabled for your account' },
      { status: 403 }
    );
  }

  return null;
}
