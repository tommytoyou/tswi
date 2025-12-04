'use client';

import { useEffect, useState } from 'react';
import { Satellite, Clock, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getClientSession, clearClientSession } from '@/lib/auth/session';
import { useRouter } from 'next/navigation';

export function Header() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const session = getClientSession();
    setUser(session);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      clearClientSession();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const formatUTC = (date: Date) => {
    return date.toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
  };

  return (
    <header className="h-12 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Satellite className="h-5 w-5 text-blue-400" />
          <span className="font-bold text-white tracking-tight">TSWI</span>
        </div>
        <span className="text-xs text-slate-500 hidden sm:inline">Tactical Space Weather Intelligence</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-mono">{formatUTC(currentTime)}</span>
        </div>

        {user && (
          <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
            <User className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-slate-400">{user.name}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="h-7 px-2 text-slate-500 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
