'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Satellite, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function SetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const passwordRequirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Passwords match', met: password === confirmPassword && password.length > 0 },
  ];

  const canSubmit = passwordRequirements.every(req => req.met) && email.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase(), password }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || 'Failed to set password');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4">
        <Card className="w-full max-w-md border-slate-700 bg-slate-900/50 backdrop-blur">
          <CardHeader className="space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-500/10 p-3">
                <Check className="h-8 w-8 text-green-400" />
              </div>
            </div>
            <div className="space-y-2 text-center">
              <CardTitle className="text-2xl font-bold text-white">Password Set!</CardTitle>
              <CardDescription className="text-slate-400">
                Your password has been set successfully. You can now sign in with your email and password.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                Go to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
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
            <CardTitle className="text-2xl font-bold text-white">Set Your Password</CardTitle>
            <CardDescription className="text-slate-400">
              Set up a password for email login. You must be an approved user.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                required
              />
              <p className="text-xs text-slate-500">
                Use the email address you requested access with.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-300">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                required
              />
            </div>

            <div className="space-y-2 pt-2">
              {passwordRequirements.map((req, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div className={`h-4 w-4 rounded-full flex items-center justify-center ${
                    req.met ? 'bg-green-500/20' : 'bg-slate-700'
                  }`}>
                    {req.met && <Check className="h-3 w-3 text-green-400" />}
                  </div>
                  <span className={req.met ? 'text-green-400' : 'text-slate-500'}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>

            <Button
              type="submit"
              disabled={!canSubmit || isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Setting Password...' : 'Set Password'}
            </Button>

            <div className="text-center pt-4 border-t border-slate-700">
              <Link href="/login" className="text-sm text-blue-400 hover:text-blue-300">
                Back to Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
