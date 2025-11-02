'use client'

import Link from 'next/link'
import { Satellite, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function TopNav() {
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
          <Button size="sm" variant="outline" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alerts
          </Button>
        </nav>
      </div>
    </header>
  )
}
