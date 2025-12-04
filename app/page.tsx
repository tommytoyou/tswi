import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="max-w-4xl mx-auto text-center px-4">
        <h1 className="text-6xl font-bold text-white mb-4">
          TSWI
        </h1>
        <p className="text-2xl text-slate-300 mb-2">
          Tactical Space Weather Intelligence
        </p>
        <p className="text-lg text-slate-400 mb-12">
          Real-time monitoring of solar wind, geomagnetic indices, aurora forecasts, and AI-powered predictions
        </p>

        <Link href="/dashboard">
          <Button size="lg" className="text-lg px-8">
            Launch Dashboard
          </Button>
        </Link>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="p-6 bg-slate-800/50 rounded-lg">
            <h3 className="text-xl font-semibold text-white mb-2">Real-Time Data</h3>
            <p className="text-slate-400">
              Monitor Kp, Dst, solar wind plasma & magnetic field, GOES protons, and X-ray flux with minute cadence
            </p>
          </div>
          <div className="p-6 bg-slate-800/50 rounded-lg">
            <h3 className="text-xl font-semibold text-white mb-2">AI Predictions</h3>
            <p className="text-slate-400">
              Solar flare probability forecasts powered by IBM/NASA Surya AI model with confidence metrics
            </p>
          </div>
          <div className="p-6 bg-slate-800/50 rounded-lg">
            <h3 className="text-xl font-semibold text-white mb-2">Custom Alerts</h3>
            <p className="text-slate-400">
              Set up alert rules for storm conditions, flares, and SEP events with webhook and email notifications
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
