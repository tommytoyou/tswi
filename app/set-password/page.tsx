'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Satellite, Eye, EyeOff, Check, AlertCircle, Mail } from 'lucide-react';
import Link from 'next/link';

const MIN_PASSWORD_LENGTH = 12;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-900/50 backdrop-blur">
        {children}
      </Card>
    </div>
  );
}

function Header({
  icon,
  tone,
  title,
  description,
}: {
  icon: React.ReactNode;
  tone: 'blue' | 'green' | 'red';
  title: string;
  description: string;
}) {
  const toneClass = {
    blue: 'bg-blue-500/10',
    green: 'bg-green-500/10',
    red: 'bg-red-500/10',
  }[tone];
  return (
    <CardHeader className="space-y-4">
      <div className="flex justify-center">
        <div className={`rounded-full p-3 ${toneClass}`}>{icon}</div>
      </div>
      <div className="space-y-2 text-center">
        <CardTitle className="text-2xl font-bold text-white">{title}</CardTitle>
        <CardDescription className="text-slate-400">{description}</CardDescription>
      </div>
    </CardHeader>
  );
}

function BackToLogin() {
  return (
    <div className="text-center pt-4 border-t border-slate-700">
      <Link href="/login" className="text-sm text-blue-400 hover:text-blue-300">
        Back to Login
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// No token: request a link by email
// ---------------------------------------------------------------------------

function RequestLinkForm() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await response.json();
      setMessage(data.message || 'If that email is registered, a link has been sent.');
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (message) {
    return (
      <Shell>
        <Header
          icon={<Mail className="h-8 w-8 text-blue-400" />}
          tone="blue"
          title="Check Your Email"
          description={message}
        />
        <CardContent>
          <p className="text-sm text-slate-400 text-center mb-4">
            The link expires in 60 minutes and can be used once.
          </p>
          <BackToLogin />
        </CardContent>
      </Shell>
    );
  }

  return (
    <Shell>
      <Header
        icon={<Satellite className="h-8 w-8 text-blue-400" />}
        tone="blue"
        title="Set Up or Reset Password"
        description="Enter the email you requested access with and we'll send you a link."
      />
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
          </div>

          <Button
            type="submit"
            disabled={!email || isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Sending...' : 'Send Link'}
          </Button>

          <BackToLogin />
        </form>
      </CardContent>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// With token: choose a new password
// ---------------------------------------------------------------------------

function SetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'form' | 'success' | 'invalid'>('form');

  const passwordRequirements = [
    { label: `At least ${MIN_PASSWORD_LENGTH} characters`, met: password.length >= MIN_PASSWORD_LENGTH },
    { label: 'Passwords match', met: password === confirmPassword && password.length > 0 },
  ];

  const canSubmit = passwordRequirements.every((req) => req.met);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();

      if (data.success) {
        setStatus('success');
      } else if (response.status === 400 && data.error === 'Link invalid or expired') {
        setStatus('invalid');
      } else {
        setError(data.error || 'Failed to set password');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'success') {
    return (
      <Shell>
        <Header
          icon={<Check className="h-8 w-8 text-green-400" />}
          tone="green"
          title="Password Set!"
          description="Your password has been set. You can now sign in with your email and password."
        />
        <CardContent>
          <Link href="/login">
            <Button className="w-full bg-blue-600 hover:bg-blue-700">Go to Login</Button>
          </Link>
        </CardContent>
      </Shell>
    );
  }

  if (status === 'invalid') {
    return (
      <Shell>
        <Header
          icon={<AlertCircle className="h-8 w-8 text-red-400" />}
          tone="red"
          title="Link invalid or expired"
          description="This link has already been used or is more than 60 minutes old. Request a new one."
        />
        <CardContent className="space-y-4">
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => router.push('/set-password')}
          >
            Request a New Link
          </Button>
          <BackToLogin />
        </CardContent>
      </Shell>
    );
  }

  return (
    <Shell>
      <Header
        icon={<Satellite className="h-8 w-8 text-blue-400" />}
        tone="blue"
        title="Set Your Password"
        description="Choose a password for email sign-in."
      />
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                autoComplete="new-password"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
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
              autoComplete="new-password"
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              required
            />
          </div>

          <div className="space-y-2 pt-2">
            {passwordRequirements.map((req) => (
              <div key={req.label} className="flex items-center gap-2 text-sm">
                <div
                  className={`h-4 w-4 rounded-full flex items-center justify-center ${
                    req.met ? 'bg-green-500/20' : 'bg-slate-700'
                  }`}
                >
                  {req.met && <Check className="h-3 w-3 text-green-400" />}
                </div>
                <span className={req.met ? 'text-green-400' : 'text-slate-500'}>{req.label}</span>
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

          <BackToLogin />
        </form>
      </CardContent>
    </Shell>
  );
}

function SetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  // key forces a fresh form state when navigating from token view back to request view
  return token ? <SetPasswordForm key="token" token={token} /> : <RequestLinkForm key="request" />;
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordContent />
    </Suspense>
  );
}
