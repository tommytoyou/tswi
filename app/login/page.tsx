'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Satellite, Lock } from 'lucide-react'
import { validateCredentials, setClientSession, AUTHENTICATED_USER, isClientAuthenticated } from '@/lib/auth/session'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Redirect if already authenticated
  useEffect(() => {
    if (isClientAuthenticated()) {
      router.push('/dashboard')
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Also set client session for additional client-side checks
        setClientSession(data.user)
        router.push('/dashboard')
      } else {
        setError(data.error || 'Invalid username or password')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-900/50 backdrop-blur">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-blue-500/10 p-3">
              <Satellite className="h-8 w-8 text-blue-400" />
            </div>
          </div>
          <div className="space-y-2 text-center">
            <CardTitle className="text-2xl font-bold text-white">Welcome to TSWI</CardTitle>
            <CardDescription className="text-slate-400">
              Terrestrial Space Weather Intelligence
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-200">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            {error && (
              <Alert variant="destructive" className="bg-red-900/20 border-red-800 text-red-400">
                <Lock className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
