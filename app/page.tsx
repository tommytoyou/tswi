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
          Space Weather Intelligence Platform
        </p>
        <p className="text-lg text-slate-400 mb-12">
          Real-time monitoring of solar wind, geomagnetic indices, TEC, flares, and SEP events
        </p>

        <div className="flex gap-4 justify-center">
          <Link href="/dashboard">
            <Button size="lg" className="text-lg">
              Launch Dashboard
            </Button>
          </Link>
          <Link href="/map">
            <Button size="lg" variant="outline" className="text-lg">
              View Globe
            </Button>
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="p-6 bg-slate-800/50 rounded-lg">
            <h3 className="text-xl font-semibold text-white mb-2">Real-Time Data</h3>
            <p className="text-slate-400">
              Monitor Kp, Dst, solar wind plasma & magnetic field, GOES protons, and TEC with sub-minute cadence
            </p>
          </div>
          <div className="p-6 bg-slate-800/50 rounded-lg">
            <h3 className="text-xl font-semibold text-white mb-2">Smart Alerts</h3>
            <p className="text-slate-400">
              Custom alert rules for storm conditions, flares, SEP events, and TEC gradients
            </p>
          </div>
          <div className="p-6 bg-slate-800/50 rounded-lg">
            <h3 className="text-xl font-semibold text-white mb-2">3D Visualization</h3>
            <p className="text-slate-400">
              Cesium globe with Kp belts, TEC overlays, satellite tracking, and SuperMAG stations
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
