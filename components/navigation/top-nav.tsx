'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function TopNav() {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/map', label: 'Globe' },
    { href: '/alerts', label: 'Alerts' },
  ];

  return (
    <nav className="bg-slate-900 border-b border-slate-800">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white">
            ⚡ TSWI
          </Link>

          <div className="flex items-center gap-6">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm font-medium transition-colors hover:text-white ${
                  pathname === href ? 'text-white' : 'text-slate-400'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="text-sm text-slate-400">Demo Mode</div>
        </div>
      </div>
    </nav>
  );
}