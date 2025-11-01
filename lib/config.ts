import { z } from 'zod';

const configSchema = z.object({
  mongodb: z.object({
    uri: z.string().min(1, 'MongoDB URI is required'),
    dbName: z.string().default('tswi'),
  }),
  cesium: z.object({
    ionToken: z.string().min(1, 'Cesium Ion token is required'),
  }),
  auth: z.object({
    secret: z.string().min(1, 'Auth secret is required'),
  }),
  api: z.object({
    baseUrl: z.string().url(),
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
      baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
    },
  };

  return configSchema.parse(config);
}

export const config = getConfig();
