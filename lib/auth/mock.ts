import { User } from '@/lib/types';

// DEPRECATED: This file is kept for backwards compatibility
// Real authentication is now handled by NextAuth.js in lib/auth/config.ts

export const MOCK_USER: User = {
  _id: 'user_demo_001',
  email: 'operator@tswi.space',
  name: 'Demo Operator',
  company: 'TSWI',
  role: 'user_ai',
  created_at: new Date('2025-01-15T00:00:00Z'),
  last_login: new Date(),
};

export async function getSession(): Promise<User | null> {
  // DEPRECATED: Use getServerSession from next-auth instead
  return MOCK_USER;
}

export async function requireSession(): Promise<User> {
  const user = await getSession();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export function isAuthenticated(): boolean {
  // DEPRECATED: Use session check from next-auth instead
  return true;
}
