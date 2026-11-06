/**
 * Create the NOAA real-time collections' unique natural-key and 30-day TTL
 * indexes (see ensureNoaaIndexes in lib/db.ts). Safe to run repeatedly.
 *
 * Usage: npx tsx scripts/noaa-ensure-indexes.ts
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  // Import after env is loaded: lib/config reads MONGODB_URI at import time
  const { ensureNoaaIndexes, getDb, NOAA_REALTIME_COLLECTIONS } = await import('../lib/db');

  const ok = await ensureNoaaIndexes();
  const db = await getDb();

  for (const name of Object.keys(NOAA_REALTIME_COLLECTIONS)) {
    const indexes = await db.collection(name).indexes();
    const summary = indexes
      .map((i) => {
        const keys = Object.keys(i.key).join('+');
        const flags = [i.unique ? 'unique' : '', typeof i.expireAfterSeconds === 'number' ? `ttl=${i.expireAfterSeconds}s` : '']
          .filter(Boolean)
          .join(',');
        return `${i.name}(${keys}${flags ? ' ' + flags : ''})`;
      })
      .join('  ');
    console.log(`${name.padEnd(34)} ${summary}`);
  }

  if (!ok) {
    console.error('One or more indexes failed to create.');
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Index setup failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
