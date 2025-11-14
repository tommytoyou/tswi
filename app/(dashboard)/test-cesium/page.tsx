'use client';

import { config } from '@/lib/config';

export default function TestCesiumPage() {
  const token = config.cesium.ionToken;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Cesium Config Test</h1>
      <div className="bg-slate-800 p-4 rounded">
        <p className="text-white mb-2">
          <strong>Token from config:</strong> {token || 'NOT FOUND'}
        </p>
        <p className="text-white mb-2">
          <strong>Token length:</strong> {token?.length || 0}
        </p>
        <p className="text-white mb-2">
          <strong>Token preview:</strong> {token ? token.substring(0, 30) + '...' : 'NONE'}
        </p>
        <p className="text-white mb-2">
          <strong>Status:</strong>{' '}
          <span className={token ? 'text-green-400' : 'text-red-400'}>
            {token ? '✅ Token configured' : '❌ Token missing'}
          </span>
        </p>
      </div>
    </div>
  );
}
