/**
 * Next.js instrumentation hook: runs once per server start (per instance on
 * serverless). Node-only work lives in instrumentation-node.ts so the MongoDB
 * driver is never bundled for the Edge runtime (middleware).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
