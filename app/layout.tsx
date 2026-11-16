import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SessionProvider } from '@/components/providers/session-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TSWI - Tactical Space Weather Intelligence',
  description: 'Real-time monitoring of solar activity and geomagnetic conditions, with NOAA SWPC flare forecasts, for operators whose assets space weather affects.',
  icons: {
    icon: { url: '/favicon.svg', type: 'image/svg+xml' },
  },
  metadataBase: new URL('https://www.tswi.us'),
  openGraph: {
    title: 'TSWI - Tactical Space Weather Intelligence',
    description: 'Real-time monitoring of solar activity and geomagnetic conditions, with NOAA SWPC flare forecasts, for operators whose assets space weather affects.',
    url: 'https://www.tswi.us',
    siteName: 'TSWI',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'TSWI - Tactical Space Weather Intelligence',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TSWI - Tactical Space Weather Intelligence',
    description: 'Real-time monitoring of solar activity and geomagnetic conditions, with NOAA SWPC flare forecasts, for operators whose assets space weather affects.',
    images: ['/api/og'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
