import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const ADMIN_SESSION_COOKIE = 'tswi_admin_session';
const JWT_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'admin-secret-key');

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

    const { payload } = await jwtVerify(token, JWT_SECRET);

    if (!payload.isAdmin) {
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
