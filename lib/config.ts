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
  const defaultBaseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
    : 'http://localhost:5000';

  const config = {
    mongodb: {
      uri: process.env.MONGODB_URI || '',
      dbName: process.env.MONGODB_DB || 'tswi',
    },
    cesium: {
      ionToken: process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || '',
    },
    auth: {
      secret: process.env.AUTH_SECRET || '',
    },
    api: {
      baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || defaultBaseUrl,
    },
  };

  try {
    return configSchema.parse(config);
  } catch (error) {
    console.error('❌ Configuration validation failed:');
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    throw new Error('Missing or invalid required environment variables. Please check your Replit Secrets.');
  }
}

export const config = getConfig();
