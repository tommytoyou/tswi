import { MongoClient, Db, Collection, Document } from 'mongodb';
import { config } from './config';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (client && db) {
    return { client, db };
  }

  try {
    client = new MongoClient(config.mongodb.uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 60000,
    });

    await client.connect();
    db = client.db(config.mongodb.dbName);

    console.log('✅ Connected to MongoDB Atlas');

    return { client, db };
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

export async function getDb(): Promise<Db> {
  if (!db) {
    const connection = await connectToDatabase();
    return connection.db;
  }
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
    // NOAA Real-Time Data Collections
    {
      name: 'timeseries_noaa_solarwind_mag',
      timeField: 'ts',
      metaField: 'meta',
      granularity: 'minutes' as const,
      expireAfterSeconds: 30 * 24 * 60 * 60, // 30 days
    },
    {
      name: 'timeseries_noaa_kp_index',
      timeField: 'ts',
      metaField: 'meta',
      granularity: 'minutes' as const,
      expireAfterSeconds: 90 * 24 * 60 * 60, // 90 days
    },
    {
      name: 'timeseries_noaa_xray_flux',
      timeField: 'ts',
      metaField: 'meta',
      granularity: 'minutes' as const,
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

  console.log('✅ Indexes created');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  }
});
