import { User } from '@/lib/types';

// TODO: Replace with real authentication (NextAuth.js, Clerk, Auth0, etc.)
// This is a mock implementation for MVP development

export const MOCK_USER: User = {
  _id: 'user_demo_001',
  email: 'operator@tswi.space',
  name: 'Demo Operator',
  plan: 'pro',
  apiKey: 'tswi_demo_key_12345',
  created_at: new Date('2025-01-15T00:00:00Z'),
};

export async function getSession(): Promise<User | null> {
  // TODO: Implement real session check
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
  // TODO: Check real auth token
  return true;
}
