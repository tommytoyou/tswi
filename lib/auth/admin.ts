import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const ADMIN_SESSION_COOKIE = 'tswi_admin_session';

function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not set');
  }
  return new TextEncoder().encode(secret);
}

export interface AdminSession {
  email: string;
  name: string;
  isAdmin: boolean;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

    if (!token) {
      return null;
    }

    // Throws if NEXTAUTH_SECRET is unset; caught below and treated as no session
    const { payload } = await jwtVerify(token, getJwtSecret());

    if (payload.isAdmin !== true) {
      return null;
    }

    return {
      email: payload.email as string,
      name: payload.name as string,
      isAdmin: true,
    };
  } catch (error) {
    console.error('Error verifying admin session:', error);
    return null;
  }
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    throw new Error('Admin authentication required');
  }
  return session;
}
