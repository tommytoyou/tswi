#!/usr/bin/env node
/**
 * MongoDB storage report.
 *
 * Reads MONGODB_URI from .env.local and prints, per database, its size on
 * disk and every collection's document count, storage size, index size and
 * whether it has a TTL index. Collections are sorted largest first.
 *
 * "data MB" is uncompressed BSON size. Atlas shared-tier quotas (e.g. 512 MB
 * on M0) count data + index size, not compressed storage, so "quota MB"
 * (data + index) is the number to compare against the cluster limit.
 *
 * Prints no connection string and no document contents.
 *
 * Usage: node scripts/db-storage-report.mjs
 */
import { config } from 'dotenv';
import { MongoClient } from 'mongodb';

config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set in .env.local');
  process.exit(1);
}

const MB = 1024 * 1024;
const mb = (bytes) => (bytes / MB).toFixed(2);

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

try {
  await client.connect();
  const { databases, totalSize } = await client.db('admin').admin().listDatabases();

  databases.sort((a, b) => b.sizeOnDisk - a.sizeOnDisk);

  console.log('DATABASES');
  for (const d of databases) {
    console.log(`  ${d.name.padEnd(28)} ${mb(d.sizeOnDisk).padStart(9)} MB`);
  }
  console.log(`  ${'TOTAL'.padEnd(28)} ${mb(totalSize).padStart(9)} MB`);

  for (const d of databases) {
    if (['admin', 'local', 'config'].includes(d.name)) continue;

    const db = client.db(d.name);
    const infos = await db.listCollections({}, { nameOnly: false }).toArray();
    const rows = [];

    for (const info of infos) {
      if (info.type === 'view') continue;
      const coll = db.collection(info.name);
      try {
        const [stats] = await coll
          .aggregate([{ $collStats: { storageStats: {} } }])
          .toArray();
        const s = stats?.storageStats ?? {};
        const indexes = await coll.indexes();
        rows.push({
          name: info.name,
          count: s.count ?? 0,
          storage: s.storageSize ?? 0,
          data: s.size ?? 0,
          index: s.totalIndexSize ?? 0,
          ttl: indexes.some((i) => typeof i.expireAfterSeconds === 'number'),
        });
      } catch (err) {
        rows.push({ name: info.name, count: 0, storage: 0, data: 0, index: 0, ttl: false, error: err.codeName || 'error' });
      }
    }

    rows.sort((a, b) => b.data + b.index - (a.data + a.index));

    const sumStorage = rows.reduce((t, r) => t + r.storage, 0);
    const sumIndex = rows.reduce((t, r) => t + r.index, 0);
    const sumData = rows.reduce((t, r) => t + r.data, 0);

    console.log(`\n${d.name}  (sizeOnDisk ${mb(d.sizeOnDisk)} MB, collections ${mb(sumStorage)} MB + indexes ${mb(sumIndex)} MB)`);
    console.log(`  quota usage (uncompressed data + indexes): ${mb(sumData + sumIndex)} MB`);
    console.log(
      `  ${'collection'.padEnd(32)} ${'docs'.padStart(10)} ${'storage MB'.padStart(11)} ${'index MB'.padStart(9)} ${'data MB'.padStart(9)} ${'quota MB'.padStart(9)}  TTL`
    );
    for (const r of rows) {
      console.log(
        `  ${r.name.padEnd(32)} ${String(r.count).padStart(10)} ${mb(r.storage).padStart(11)} ${mb(r.index).padStart(9)} ${mb(r.data).padStart(9)} ${mb(r.data + r.index).padStart(9)}  ${r.ttl ? 'yes' : 'no'}${r.error ? `  (${r.error})` : ''}`
      );
    }
  }
} catch (err) {
  // Avoid echoing anything that might include the connection string
  console.error('Report failed:', err.codeName || err.name || 'error', '-', String(err.message).replace(/mongodb(\+srv)?:\/\/\S+/g, '[uri]'));
  process.exitCode = 1;
} finally {
  await client.close();
}
