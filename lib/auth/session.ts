import { User } from '@/lib/types';

// DEPRECATED: This file is kept for backwards compatibility
// Real authentication is now handled by NextAuth.js in lib/auth/config.ts
// Client session is now managed by next-auth/react

const SESSION_KEY = 'tswi_session';

export interface SessionData {
  user: User;
  expiresAt: number;
}

// DEPRECATED: Use useSession from next-auth/react instead
export function getClientSession(): User | null {
  if (typeof window === 'undefined') return null;

  try {
    const sessionData = sessionStorage.getItem(SESSION_KEY);
    if (!sessionData) return null;

    const session: SessionData = JSON.parse(sessionData);

    if (Date.now() > session.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    return session.user;
  } catch {
    return null;
  }
}

// DEPRECATED: Session is now managed by next-auth
export function setClientSession(user: User): void {
  if (typeof window === 'undefined') return;

  const sessionData: SessionData = {
    user,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
}

// DEPRECATED: Use signOut from next-auth/react instead
export function clearClientSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
}

// DEPRECATED: Use useSession from next-auth/react instead
export function isClientAuthenticated(): boolean {
  return getClientSession() !== null;
}
