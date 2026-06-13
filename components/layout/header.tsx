'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Satellite, Clock, User, LogOut, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header() {
  const { data: session } = useSession();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await signOut({ callbackUrl: '/login' });
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  const formatUTC = (date: Date) => {
    return date.toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
  };

  const hasAIAccess = session?.user?.role === 'user_ai' || session?.user?.role === 'admin';

  return (
    <>
      {/* Classification / handling strip */}
      <div className="w-full h-5 bg-intel-panel border-b border-intel-border flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] tracking-widest text-intel-muted uppercase font-mono">
          TSWI // OFFICIAL USE ONLY // SPACE WEATHER INTELLIGENCE
        </span>
      </div>

      <header className="h-12 bg-intel-bg border-b border-intel-border flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Satellite className="h-5 w-5 text-intel-cyan" />
          <span className="font-bold text-white tracking-tight">TSWI</span>
        </div>
        <span className="text-xs font-mono text-intel-muted hidden sm:inline">Tactical Space Weather Intelligence</span>
      </div>

      <div className="flex items-center gap-4">
        {/* System status — TODO: wire up to /api/health (bg-intel-amber = degraded, bg-intel-red = down) */}
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-intel-cyan" />
          <span className="text-[10px] font-mono uppercase text-intel-muted">SYSTEM NOMINAL</span>
        </div>

        <div className="flex items-center gap-2 text-intel-muted">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-mono">{formatUTC(currentTime)}</span>
        </div>

        {session?.user && (
          <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
            {hasAIAccess && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-intel-cyan/15 text-intel-cyan rounded text-xs">
                <Sparkles className="h-3 w-3" />
                AI
              </span>
            )}
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="h-6 w-6 rounded-full"
              />
            ) : (
              <User className="h-4 w-4 text-slate-500" />
            )}
            <span className="text-sm text-slate-400 hidden md:inline">{session.user.name}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="h-7 px-2 text-slate-500 hover:text-white"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      </header>
    </>
  );
}
