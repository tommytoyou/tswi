import { z } from 'zod';

const configSchema = z.object({
  mongodb: z.object({
    uri: z.string().optional().default(''),
    dbName: z.string().default('tswi'),
  }),
  cesium: z.object({
    ionToken: z.string().optional().default(''),
  }),
  auth: z.object({
    secret: z.string().default('dev-secret-change-me'),
  }),
  api: z.object({
    baseUrl: z.string().default('http://localhost:3000'),
  }),
});

function getConfig() {
  const config = {
    mongodb: {
      uri: process.env.MONGODB_URI || '',
      dbName: process.env.MONGODB_DB || 'tswi',
    },
    cesium: {
      ionToken: process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || '',
    },
    auth: {
      secret: process.env.AUTH_SECRET || 'dev-secret-change-me',
    },
    api: {
      baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 
        (process.env.REPL_SLUG 
          ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
          : 'http://localhost:3000'),
    },
  };

  const parsed = configSchema.parse(config);

  // Warn in development if important configs are missing
  if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
    if (!parsed.mongodb.uri) {
      console.warn('⚠️  MONGODB_URI not set - database features will not work');
    }
    if (!parsed.cesium.ionToken) {
      console.warn('⚠️  NEXT_PUBLIC_CESIUM_ION_TOKEN not set - Cesium globe will not load');
    }
  }

  return parsed;
}

export const config = getConfig();