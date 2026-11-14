/**
 * One-time / manual seed of the shared TLE catalog (MongoDB tle_catalog) from
 * this machine, for when CelesTrak blocks the server's IP.
 *
 *   npx tsx --env-file=.env.local scripts/seed-tle-catalog.ts
 *
 * Makes the same requests as the server refresh (GROUP=active, the tagged
 * groups and EXTRA_CATNR_IDS), once each, then records the refresh time.
 */
async function main() {
  const { refreshTleCatalogIfStale } = await import('../lib/tle-catalog');
  const status = await refreshTleCatalogIfStale({ force: true });
  console.log('Seed result:', status);
  process.exit(status.startsWith('ok') ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
