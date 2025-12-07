import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Satellite, Sparkles, Bell, Globe, Zap, Shield } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Satellite className="h-6 w-6 text-blue-400" />
            <span className="text-xl font-bold text-white">TSWI</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
              </span>
              Private Beta
            </span>
          </div>
          <Link href="/login">
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative flex flex-col items-center justify-center min-h-screen px-4 pt-20">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Tactical
            </span>
            <br />
            Space Weather
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Intelligence
            </span>
          </h1>

          <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
            Real-time monitoring of solar activity, geomagnetic conditions, and AI-powered predictions for space weather events that impact Earth.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/request-access">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 w-full sm:w-auto">
                <Zap className="h-5 w-5 mr-2" />
                Request Access
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 text-lg px-8 w-full sm:w-auto">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="relative max-w-6xl mx-auto w-full px-4 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Globe className="h-6 w-6 text-blue-400" />}
              title="Real-Time Monitoring"
              description="Track solar wind, Kp index, Dst, proton flux, and X-ray data with minute-level updates from NOAA and NASA sources."
            />
            <FeatureCard
              icon={<Sparkles className="h-6 w-6 text-purple-400" />}
              title="AI Predictions"
              description="Solar flare probability forecasts powered by machine learning models with confidence metrics and 2-hour horizons."
            />
            <FeatureCard
              icon={<Bell className="h-6 w-6 text-amber-400" />}
              title="Smart Alerts"
              description="Configure custom alert rules for storm conditions, flares, and SEP events with email and webhook notifications."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 max-w-4xl mx-auto">
            <FeatureCard
              icon={<Satellite className="h-6 w-6 text-green-400" />}
              title="3D Visualization"
              description="Interactive globe showing satellite positions, magnetometer stations, and aurora predictions."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6 text-red-400" />}
              title="Operational Intelligence"
              description="Decision support for satellite operators, aviation, power grid management, and HF communications."
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Satellite className="h-5 w-5" />
            <span>TSWI - Tactical Space Weather Intelligence</span>
          </div>
          <div className="text-sm text-slate-500">
            Data from NOAA SWPC and NASA
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:bg-slate-800/50 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
