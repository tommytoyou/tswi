#!/usr/bin/env node
/**
 * Restore recent NOAA readings from the de-duplicated backups.
 *
 * Reads the newest backups/noaa-<collection>-<YYYYMMDD>.jsonl for each
 * collection and re-inserts only documents with ts in the last 30 days
 * (matching the TTL). Upserts on the natural key, so it is safe to rerun.
 *
 * Usage: node scripts/noaa-restore-recent.mjs
 */
import { config } from 'dotenv';
import { MongoClient, BSON } from 'mongodb';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

config({ path: '.env.local' });

const { EJSON } = BSON;

// Must match NOAA_REALTIME_COLLECTIONS in lib/db.ts
const NATURAL_KEYS = {
  timeseries_noaa_solarwind_plasma: ['ts'],
  timeseries_noaa_xray_flux: ['ts', 'satellite', 'energy'],
  timeseries_noaa_proton_flux: ['ts'],
  timeseries_noaa_dst: ['ts'],
  timeseries_noaa_kp_index: ['ts'],
  timeseries_noaa_solarwind_mag: ['ts'],
};

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH = 1000;

function latestBackup(dir, name) {
  const prefix = `noaa-${name}-`;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && /^\d{8}\.jsonl$/.test(f.slice(prefix.length)))
    .sort();
  return files.length ? path.join(dir, files[files.length - 1]) : null;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in .env.local');
    process.exit(1);
  }

  const dir = path.resolve('backups');
  const cutoff = new Date(Date.now() - WINDOW_MS);
  console.log(`Restoring docs with ts >= ${cutoff.toISOString()}`);

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'tswi');

  let grandTotal = 0;
  try {
    for (const [name, keyFields] of Object.entries(NATURAL_KEYS)) {
      const file = latestBackup(dir, name);
      if (!file) {
        console.log(`${name.padEnd(34)} no backup found, skipped`);
        continue;
      }

      const coll = db.collection(name);
      const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity });
      let scanned = 0;
      let eligible = 0;
      let inserted = 0;
      let ops = [];

      const flush = async () => {
        if (!ops.length) return;
        const res = await coll.bulkWrite(ops, { ordered: false });
        inserted += res.upsertedCount;
        ops = [];
      };

      for await (const line of rl) {
        if (!line.trim()) continue;
        scanned++;
        const doc = EJSON.parse(line, { relaxed: false });
        if (!(doc.ts instanceof Date) || doc.ts < cutoff) continue;
        eligible++;
        delete doc._id; // let MongoDB assign; natural key is the identity
        ops.push({
          updateOne: {
            filter: Object.fromEntries(keyFields.map((f) => [f, doc[f]])),
            update: { $setOnInsert: doc },
            upsert: true,
          },
        });
        if (ops.length >= BATCH) await flush();
      }
      await flush();

      grandTotal += inserted;
      console.log(
        `${name.padEnd(34)} scanned ${String(scanned).padStart(7)}  in window ${String(eligible).padStart(6)}  inserted ${String(inserted).padStart(6)}  (${path.basename(file)})`
      );
    }
  } finally {
    await client.close();
  }

  console.log(`Total restored: ${grandTotal}`);
}

main().catch((err) => {
  console.error('Restore failed:', err.codeName || err.name || 'error', '-', String(err.message).replace(/mongodb(\+srv)?:\/\/\S+/g, '[uri]'));
  process.exit(1);
});
