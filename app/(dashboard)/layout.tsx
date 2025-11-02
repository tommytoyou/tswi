import React from 'react'
import TopNav from '@/components/navigation/top-nav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  )
}
