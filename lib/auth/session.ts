import { User } from '@/lib/types';

// Session storage utilities for client-side auth
const SESSION_KEY = 'tswi_session';

// Hardcoded credentials for MVP
const VALID_CREDENTIALS = {
  username: 'multiplanetary',
  password: 'Space2034!',
};

export const AUTHENTICATED_USER: User = {
  _id: 'user_multiplanetary_001',
  email: 'multiplanetary@tswi.space',
  name: 'Multiplanetary',
  plan: 'pro',
  apiKey: 'tswi_multiplanetary_key_12345',
  created_at: new Date('2025-01-15T00:00:00Z'),
};

export interface SessionData {
  user: User;
  expiresAt: number;
}

// Client-side session management
export function getClientSession(): User | null {
  if (typeof window === 'undefined') return null;

  try {
    const sessionData = sessionStorage.getItem(SESSION_KEY);
    if (!sessionData) return null;

    const session: SessionData = JSON.parse(sessionData);

    // Check if session is expired (24 hours)
    if (Date.now() > session.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    return session.user;
  } catch {
    return null;
  }
}

export function setClientSession(user: User): void {
  if (typeof window === 'undefined') return;

  const sessionData: SessionData = {
    user,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
}

export function clearClientSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
}

export function validateCredentials(username: string, password: string): boolean {
  return username === VALID_CREDENTIALS.username && password === VALID_CREDENTIALS.password;
}

export function isClientAuthenticated(): boolean {
  return getClientSession() !== null;
}
