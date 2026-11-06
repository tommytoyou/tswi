import { MongoClient, Db, Collection, Document, AnyBulkWriteOperation } from 'mongodb';
import { config } from './config';

// ============================================================================
// NOAA REAL-TIME COLLECTIONS
// Plain collections (time-series collections cannot have unique indexes).
// Each has a unique index on its natural key so a re-fetched NOAA window
// never stores the same reading twice, and a TTL index on ts.
// ============================================================================

export const NOAA_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export const NOAA_REALTIME_COLLECTIONS = {
  // plasma-1-day: one row per minute
  timeseries_noaa_solarwind_plasma: ['ts'],
  // xrays feed: two energy bands per time_tag, possibly several GOES satellites
  timeseries_noaa_xray_flux: ['ts', 'satellite', 'energy'],
  // route merges >=10/>=50/>=100 MeV into one doc per time_tag
  timeseries_noaa_proton_flux: ['ts'],
  // Kyoto Dst: one hourly value per time_tag
  timeseries_noaa_dst: ['ts'],
  // planetary_k_index_1m: one row per minute
  timeseries_noaa_kp_index: ['ts'],
  // rtsw_mag_1m: one active-spacecraft record per minute
  timeseries_noaa_solarwind_mag: ['ts'],
} as const;

export type NoaaRealtimeCollection = keyof typeof NOAA_REALTIME_COLLECTIONS;

/**
 * Create the unique natural-key index and 30-day TTL index on each NOAA
 * collection. Errors are logged, not swallowed; returns false if any failed.
 */
export async function ensureNoaaIndexes(): Promise<boolean> {
  const database = await getDb();
  let ok = true;

  for (const [name, keyFields] of Object.entries(NOAA_REALTIME_COLLECTIONS)) {
    const collection = database.collection(name);
    const keySpec = Object.fromEntries(keyFields.map((f) => [f, 1 as const]));

    try {
      await collection.createIndex(keySpec, { unique: true, name: 'natural_key_unique' });
    } catch (error) {
      ok = false;
      console.error(`[DB] Failed to create unique index on ${name}:`, (error as Error).message);
    }

    try {
      await collection.createIndex(
        { ts: 1 },
        { expireAfterSeconds: NOAA_TTL_SECONDS, name: 'ts_ttl_30d' }
      );
    } catch (error) {
      ok = false;
      console.error(`[DB] Failed to create TTL index on ${name}:`, (error as Error).message);
    }
  }

  return ok;
}

/**
 * Upsert NOAA readings on their natural key. $set (not $setOnInsert) so a
 * value NOAA revises after first publishing overwrites the stored one.
 * Throws on failure; callers log with the collection name.
 */
export async function upsertNoaaDocs<T extends Document>(
  name: NoaaRealtimeCollection,
  docs: T[]
): Promise<{ inserted: number; updated: number }> {
  if (docs.length === 0) return { inserted: 0, updated: 0 };

  const keyFields = NOAA_REALTIME_COLLECTIONS[name];
  const ops: AnyBulkWriteOperation<Document>[] = docs.map((doc) => ({
    updateOne: {
      filter: Object.fromEntries(keyFields.map((f) => [f, (doc as Document)[f]])),
      update: { $set: doc },
      upsert: true,
    },
  }));

  const collection = await getCollection(name);
  const result = await collection.bulkWrite(ops, { ordered: false });
  return { inserted: result.upsertedCount, updated: result.modifiedCount };
}

// Global cache for serverless environments
// In serverless, each invocation may reuse the same runtime
// so we cache the client promise to avoid creating multiple connections
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let cachedDb: Db | null = null;

function createClient(): MongoClient {
  const uri = config.mongodb.uri;
  if (!uri) {
    throw new Error(
      'MONGODB_URI environment variable is not set. ' +
      'Ensure it is configured in Vercel for all environments (Production, Preview, Development).'
    );
  }

  return new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 1,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 5000,
    retryWrites: true,
    retryReads: true,
  });
}

async function getClientWithRetry(retries = 3): Promise<MongoClient> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Check if we have a cached promise
      if (global._mongoClientPromise) {
        const client = await global._mongoClientPromise;

        // Check if topology is closed or client is disconnected
        const isTopologyClosed = (client as any).topology?.s?.state === 'closed';
        const isConnected = (client as any).topology?.isConnected?.();

        if (isTopologyClosed || isConnected === false) {
          console.log('[MongoDB] Topology closed or disconnected, reconnecting...');
          global._mongoClientPromise = undefined;
          // Continue to create new client below
        } else {
          // Verify the client is still connected by pinging
          try {
            await client.db('admin').command({ ping: 1 });
            return client;
          } catch (pingError) {
            // Connection is stale or topology closed, clear cache and retry
            const errorMessage = pingError instanceof Error ? pingError.message : String(pingError);
            console.log(`[MongoDB] Connection check failed (${errorMessage}), reconnecting...`);
            global._mongoClientPromise = undefined;
            // Continue to create new client below
          }
        }
      }

      // Create new client and cache the promise
      const newClient = createClient();
      global._mongoClientPromise = newClient.connect();
      const connectedClient = await global._mongoClientPromise;
      console.log('✅ Connected to MongoDB Atlas');
      return connectedClient;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MongoDB] Connection attempt ${attempt}/${retries} failed:`, errorMessage);

      // Clear cached promise on error
      global._mongoClientPromise = undefined;

      if (attempt === retries) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
    }
  }

  throw new Error('Failed to connect to MongoDB after retries');
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  const client = await getClientWithRetry();
  const db = client.db(config.mongodb.dbName);
  cachedDb = db;
  return { client, db };
}

export async function getDb(): Promise<Db> {
  // Always verify connection health in serverless
  const { db } = await connectToDatabase();
  return db;
}

// Time Series Collections
export async function getTimeSeriesCollection<T extends Document = Document>(name: string): Promise<Collection<T>> {
  const database = await getDb();
  return database.collection<T>(name);
}

// Standard Collections
export async function getCollection<T extends Document = Document>(name: string): Promise<Collection<T>> {
  const database = await getDb();
  return database.collection<T>(name);
}

// Create indexes for the app's standard collections.
// NOTE: not called at startup; NOAA real-time indexes are created by
// ensureNoaaIndexes() from instrumentation.ts.
export async function initializeCollections(): Promise<void> {
  const database = await getDb();

  // Create indexes
  const eventsObserved = database.collection('events_observed');
  await eventsObserved.createIndex({ kind: 1, ts: -1 });
  await eventsObserved.createIndex({ ts: -1 });

  const alerts = database.collection('alerts');
  await alerts.createIndex({ user_id: 1 });
  await alerts.createIndex({ status: 1 });

  const forecasts = database.collection('forecasts');
  await forecasts.createIndex({ kind: 1, ts: -1 });

  // Auth collections indexes
  const accessRequests = database.collection('access_requests');
  await accessRequests.createIndex({ email: 1 }, { unique: true });
  await accessRequests.createIndex({ status: 1 });
  await accessRequests.createIndex({ created_at: -1 });

  const users = database.collection('users');
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ role: 1 });

  const admins = database.collection('admins');
  await admins.createIndex({ email: 1 }, { unique: true });

  // Invites collection indexes
  const invites = database.collection('invites');
  await invites.createIndex({ inviteCode: 1 }, { unique: true });
  await invites.createIndex({ email: 1 });
  await invites.createIndex({ status: 1 });
  await invites.createIndex({ createdAt: -1 });

  // User activity collection indexes
  const userActivity = database.collection('user_activity');
  await userActivity.createIndex({ userId: 1, timestamp: -1 });
  await userActivity.createIndex({ timestamp: -1 });
  await userActivity.createIndex({ eventType: 1, timestamp: -1 });
  await userActivity.createIndex({ sessionId: 1 });
  await userActivity.createIndex({ userId: 1, eventType: 1, timestamp: -1 });
  // TTL index to auto-delete user activity older than 30 days
  await userActivity.createIndex(
    { timestamp: 1 },
    { expireAfterSeconds: 30 * 24 * 60 * 60, name: 'ttl_30_days' }
  );

  console.log('✅ Indexes created');

  // NOAA real-time collections: unique natural-key + 30-day TTL indexes
  if (!(await ensureNoaaIndexes())) {
    console.error('[DB] One or more NOAA indexes failed to create; see errors above');
  }

  console.log('✅ TTL indexes configured');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (global._mongoClientPromise) {
    try {
      const client = await global._mongoClientPromise;
      await client.close();
      console.log('MongoDB connection closed');
    } catch (error) {
      console.error('Error closing MongoDB connection:', error);
    }
  }
  process.exit(0);
});
