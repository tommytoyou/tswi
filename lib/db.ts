import { MongoClient, Db, Collection, Document } from 'mongodb';
import { config } from './config';

// Global cache for serverless environments
// In serverless, each invocation may reuse the same runtime
// so we cache the client promise to avoid creating multiple connections
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let cachedDb: Db | null = null;

function createClient(): MongoClient {
  return new MongoClient(config.mongodb.uri, {
    maxPoolSize: 10,
    minPoolSize: 1,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
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

// Initialize time series collections if they don't exist
export async function initializeCollections(): Promise<void> {
  const database = await getDb();
  const collections = await database.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);

  const timeSeriesCollections = [
    {
      name: 'timeseries_kp',
      timeField: 'ts',
      metaField: 'meta',
      granularity: 'minutes' as const,
      expireAfterSeconds: 90 * 24 * 60 * 60, // 90 days
    },
    {
      name: 'timeseries_dst',
      timeField: 'ts',
      metaField: 'meta',
      granularity: 'hours' as const,
      expireAfterSeconds: 180 * 24 * 60 * 60, // 180 days
    },
    {
      name: 'timeseries_solarwind_plasma',
      timeField: 'ts',
      metaField: 'meta',
      granularity: 'minutes' as const,
      expireAfterSeconds: 30 * 24 * 60 * 60, // 30 days
    },
    {
      name: 'timeseries_solarwind_mag',
      timeField: 'ts',
      metaField: 'meta',
      granularity: 'minutes' as const,
      expireAfterSeconds: 30 * 24 * 60 * 60, // 30 days
    },
    {
      name: 'timeseries_goes_protons',
      timeField: 'ts',
      metaField: 'meta',
      granularity: 'minutes' as const,
      expireAfterSeconds: 90 * 24 * 60 * 60, // 90 days
    },
    {
      name: 'timeseries_tec_regional',
      timeField: 'ts',
      metaField: 'meta',
      granularity: 'minutes' as const,
      expireAfterSeconds: 90 * 24 * 60 * 60, // 90 days
    },
    // NOAA Real-Time Data Collections (7-day TTL to stay within 512MB free tier)
    {
      name: 'timeseries_noaa_solarwind_mag',
      timeField: 'ts',
      metaField: 'meta',
      granularity: 'minutes' as const,
      expireAfterSeconds: 7 * 24 * 60 * 60, // 7 days
    },
    {
      name: 'timeseries_noaa_solarwind_plasma',
      timeField: 'ts',
      metaField: 'meta',
      granularity: 'minutes' as const,
      expireAfterSeconds: 7 * 24 * 60 * 60, // 7 days
    },
    {
      name: 'timeseries_noaa_kp_index',
      timeField: 'ts',
      metaField: 'meta',
      granularity: 'minutes' as const,
      expireAfterSeconds: 7 * 24 * 60 * 60, // 7 days
    },
    {
      name: 'timeseries_noaa_xray_flux',
      timeField: 'ts',
      metaField: 'meta',
      granularity: 'minutes' as const,
      expireAfterSeconds: 7 * 24 * 60 * 60, // 7 days
    },
    {
      name: 'timeseries_noaa_proton_flux',
      timeField: 'ts',
      metaField: 'meta',
      granularity: 'minutes' as const,
      expireAfterSeconds: 7 * 24 * 60 * 60, // 7 days
    },
    {
      name: 'timeseries_noaa_dst',
      timeField: 'ts',
      metaField: 'meta',
      granularity: 'hours' as const,
      expireAfterSeconds: 7 * 24 * 60 * 60, // 7 days
    },
  ];

  for (const tsConfig of timeSeriesCollections) {
    if (!collectionNames.includes(tsConfig.name)) {
      try {
        await database.createCollection(tsConfig.name, {
          timeseries: {
            timeField: tsConfig.timeField,
            metaField: tsConfig.metaField,
            granularity: tsConfig.granularity,
          },
          expireAfterSeconds: tsConfig.expireAfterSeconds,
        });
        console.log(`✅ Created time series collection: ${tsConfig.name}`);
      } catch (error) {
        console.error(`❌ Error creating ${tsConfig.name}:`, error);
      }
    }
  }

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

  // Update TTL (expireAfterSeconds) on existing timeseries collections
  // This ensures existing collections get updated TTL settings
  const ttlUpdates = [
    { name: 'timeseries_noaa_xray_flux', expireAfterSeconds: 7 * 24 * 60 * 60 },
    { name: 'timeseries_noaa_solarwind_plasma', expireAfterSeconds: 7 * 24 * 60 * 60 },
    { name: 'timeseries_noaa_solarwind_mag', expireAfterSeconds: 7 * 24 * 60 * 60 },
    { name: 'timeseries_noaa_proton_flux', expireAfterSeconds: 7 * 24 * 60 * 60 },
    { name: 'timeseries_noaa_dst', expireAfterSeconds: 7 * 24 * 60 * 60 },
    { name: 'timeseries_noaa_kp_index', expireAfterSeconds: 7 * 24 * 60 * 60 },
  ];

  for (const update of ttlUpdates) {
    if (collectionNames.includes(update.name)) {
      try {
        await database.command({
          collMod: update.name,
          expireAfterSeconds: update.expireAfterSeconds,
        });
        console.log(`✅ Updated TTL for ${update.name} to ${update.expireAfterSeconds / 86400} days`);
      } catch (error: any) {
        // Ignore errors if TTL is already set or collection doesn't support it
        if (!error.message?.includes('already set')) {
          console.log(`Note: Could not update TTL for ${update.name}: ${error.message}`);
        }
      }
    }
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
