/**
 * Node.js startup tasks, imported from instrumentation.ts.
 *
 * Ensures the NOAA real-time collections have their unique natural-key and
 * 30-day TTL indexes, so a new environment never accumulates duplicate
 * readings. Runs in the background so startup never waits on the database;
 * createIndex is idempotent.
 */
import { ensureNoaaIndexes } from './lib/db';

void (async () => {
  try {
    const ok = await ensureNoaaIndexes();
    if (!ok) {
      console.error('[startup] NOAA index setup finished with errors (see above)');
    }
  } catch (error) {
    console.error(
      '[startup] NOAA index setup failed:',
      error instanceof Error ? error.message : String(error)
    );
  }
})();
