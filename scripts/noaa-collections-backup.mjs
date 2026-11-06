#!/usr/bin/env node
/**
 * Back up the NOAA real-time collections, de-duplicated on their natural key.
 *
 * Streams every document (oldest insert first), keeps the first document seen
 * for each natural key, and writes the unique documents as Extended JSON
 * (one per line) to backups/noaa-<collection>-<YYYYMMDD>.jsonl so Dates and
 * ObjectIds round-trip.
 *
 * Read-only against the database. Prints no connection string.
 *
 * Usage: node scripts/noaa-collections-backup.mjs
 */
import { config } from 'dotenv';
import { MongoClient, BSON } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { once } from 'events';

config({ path: '.env.local' });

const { EJSON } = BSON;

/**
 * Natural keys, derived from how each route in app/api/noaa/* builds documents.
 */
export const NOAA_COLLECTIONS = {
  timeseries_noaa_solarwind_plasma: {
    key: ['ts'],
    why: 'plasma-1-day feed has one row per minute; route stores one doc per time_tag',
  },
  timeseries_noaa_xray_flux: {
    key: ['ts', 'satellite', 'energy'],
    why: 'xrays feed returns two energy bands (0.05-0.4nm, 0.1-0.8nm) per time_tag, and can include more than one GOES satellite',
  },
  timeseries_noaa_proton_flux: {
    key: ['ts'],
    why: 'route merges >=10/>=50/>=100 MeV rows into one doc per time_tag (p10/p50/p100 fields)',
  },
  timeseries_noaa_dst: {
    key: ['ts'],
    why: 'Kyoto Dst feed is one hourly value per time_tag',
  },
  timeseries_noaa_kp_index: {
    key: ['ts'],
    why: 'planetary_k_index_1m feed is one row per minute',
  },
};

function keyOf(doc, fields) {
  return fields
    .map((f) => {
      const v = doc[f];
      return v instanceof Date ? `d:${v.getTime()}` : `v:${JSON.stringify(v)}`;
    })
    .join('|');
}

function datestamp(d = new Date()) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in .env.local');
    process.exit(1);
  }

  const outDir = path.resolve('backups');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = datestamp();

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'tswi');

  const results = [];
  try {
    for (const [name, { key, why }] of Object.entries(NOAA_COLLECTIONS)) {
      console.log(`\n${name}`);
      console.log(`  natural key: ${key.join(' + ')}`);
      console.log(`  why: ${why}`);

      const file = path.join(outDir, `noaa-${name}-${stamp}.jsonl`);
      const out = fs.createWriteStream(file, { encoding: 'utf8' });
      const seen = new Set();
      let total = 0;
      let unique = 0;

      // _id ascending = insertion order, so "first" means earliest stored copy
      const cursor = db.collection(name).find({}).sort({ _id: 1 }).batchSize(5000);
      for await (const doc of cursor) {
        total++;
        const k = keyOf(doc, key);
        if (seen.has(k)) continue;
        seen.add(k);
        unique++;
        if (!out.write(EJSON.stringify(doc, { relaxed: false }) + '\n')) {
          await once(out, 'drain');
        }
      }

      out.end();
      await once(out, 'finish');
      const bytes = fs.statSync(file).size;

      console.log(`  total docs:  ${total}`);
      console.log(`  unique docs: ${unique}`);
      console.log(`  backup:      ${file} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
      results.push({ name, file, total, unique, bytes });
    }
  } finally {
    await client.close();
  }

  // Machine-readable summary for the verification step
  const summaryFile = path.join(outDir, `noaa-backup-summary-${stamp}.json`);
  fs.writeFileSync(summaryFile, JSON.stringify(results, null, 2));
  console.log(`\nSummary: ${summaryFile}`);
}

main().catch((err) => {
  console.error('Backup failed:', err.codeName || err.name || 'error', '-', String(err.message).replace(/mongodb(\+srv)?:\/\/\S+/g, '[uri]'));
  process.exit(1);
});
