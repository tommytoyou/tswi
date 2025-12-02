'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Satellite, Bell, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getClientSession, clearClientSession } from '@/lib/auth/session'

export default function TopNav() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    const session = getClientSession()
    setUser(session)
  }, [])

  const handleLogout = async () => {
    if (isLoggingOut) return

    setIsLoggingOut(true)
    try {
      // Call logout API to clear server-side cookie
      await fetch('/api/auth/logout', { method: 'POST' })

      // Clear client-side session
      clearClientSession()

      // Redirect to login
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="w-full border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Satellite className="h-5 w-5" />
          <span className="font-semibold tracking-tight">TSWI</span>
        </Link>

        <nav className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm hover:underline">
            Dashboard
          </Link>
          <Link href="/map" className="text-sm hover:underline">
            Globe
          </Link>
          <Link href="/aurora" className="text-sm hover:underline">
            Aurora
          </Link>
          <Link href="/roadster" className="text-sm hover:underline">
            Roadster
          </Link>
          <Link href="/agent" className="text-sm hover:underline flex items-center gap-1">
            <span>🤖</span> Agent
          </Link>
          <Button size="sm" variant="outline" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alerts
          </Button>

          {user && (
            <>
              <div className="flex items-center gap-2 text-sm text-slate-400 border-l pl-3 ml-1">
                <User className="h-4 w-4" />
                <span>{user.name}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-2 text-slate-400 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
