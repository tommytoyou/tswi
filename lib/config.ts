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

// Define these at module level so webpack can replace them
const CESIUM_TOKEN = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || '';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.REPL_SLUG
    ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
    : 'http://localhost:3000');

function getConfig() {
  const config = {
    mongodb: {
      uri: process.env.MONGODB_URI || '',
      dbName: process.env.MONGODB_DB || 'tswi',
    },
    cesium: {
      ionToken: CESIUM_TOKEN,
    },
    auth: {
      secret: process.env.AUTH_SECRET || 'dev-secret-change-me',
    },
    api: {
      baseUrl: API_BASE_URL,
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

  // Client-side debug logging
  if (typeof window !== 'undefined') {
    console.log('🔧 Cesium config on client:', {
      hasCesiumToken: !!parsed.cesium.ionToken,
      tokenLength: parsed.cesium.ionToken?.length || 0,
      tokenPreview: parsed.cesium.ionToken ? parsed.cesium.ionToken.substring(0, 20) + '...' : 'NONE',
    });
  }

  return parsed;
}

export const config = getConfig();