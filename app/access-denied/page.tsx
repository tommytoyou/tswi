'use client';

import Link from 'next/link';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <XCircle className="h-16 w-16 text-red-500" />
        </div>

        <h1 className="text-2xl font-bold text-white">Access Not Approved</h1>

        <p className="text-slate-400">
          Your account has not been approved for TSWI access yet.
          If you haven&apos;t already, please submit an access request.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link href="/request-access">
            <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
              Request Access
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 w-full sm:w-auto">
              Back to Home
            </Button>
          </Link>
        </div>

        <p className="text-sm text-slate-500 pt-4">
          Already submitted a request? Please check your email for approval notification.
        </p>
      </div>
    </div>
  );
}
