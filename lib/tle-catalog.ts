import type { AnyBulkWriteOperation, Collection } from 'mongodb';
import { getCollection } from '@/lib/db';

/**
 * Shared TLE catalog, stored in MongoDB (collection tle_catalog).
 *
 * CelesTrak updates GP data about every 2 hours and blocks IPs (HTTP 403) that
 * download the same data more often than that. Every route that needs TLEs
 * reads them from here; only refreshTleCatalogIfStale() talks to CelesTrak,
 * and it makes at most one attempt per 2 hours across all serverless instances
 * (successful or not). On any CelesTrak failure the last good copy is kept.
 */

export interface TleRecord {
  noradId: string;
  name: string;
  line1: string;
  line2: string;
  epoch: Date | null;
  fetchedAt: Date;
  /** CelesTrak groups this object belongs to (e.g. 'starlink', 'gps-ops') */
  groups?: string[];
}

interface TleCatalogMeta {
  _id: string;
  lastAttemptAt?: Date;
  lastSuccessAt?: Date;
  lastStatus?: string;
  count?: number;
  activeBytes?: number;
}

const CATALOG_COLLECTION = 'tle_catalog';
const META_COLLECTION = 'tle_catalog_meta';
const META_ID = 'celestrak';
export const TLE_REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000;

const CELESTRAK_BASE = 'https://celestrak.org/NORAD/elements/gp.php';
export const CELESTRAK_USER_AGENT =
  'TSWI-SpaceWeather/1.0 (+https://www.tswi.us; shared TLE catalog, refreshed at most every 2 hours)';

/** Small CelesTrak groups stored as membership tags on catalog entries. */
const TAGGED_GROUPS = ['stations', 'iridium-NEXT', 'noaa', 'goes', 'gps-ops', 'science', 'military'];

/**
 * Objects some views need that are not in GROUP=active (for example inactive
 * spacecraft in the threat catalog). Fetched by CATNR during each refresh.
 * Keep in sync with THREAT_NORAD_IDS in app/api/celestrak/route.ts.
 */
export const EXTRA_CATNR_IDS = ['47852', '45916', '49944', '40258', '43432', '49502', '52939', '41838', '41628'];

interface ParsedTle {
  noradId: string;
  name: string;
  line1: string;
  line2: string;
}

/** Parse 3-line (name + 2 lines) or bare 2-line TLE text. */
export function parseTleText(text: string): ParsedTle[] {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim() !== '');
  const out: ParsedTle[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const line1 = lines[i].trim();
    const line2 = lines[i + 1].trim();
    if (!line1.startsWith('1 ') || !line2.startsWith('2 ')) continue;
    const prev = i > 0 ? lines[i - 1].trim() : '';
    const name = prev && !prev.startsWith('1 ') && !prev.startsWith('2 ') ? prev : '';
    const noradId = String(parseInt(line1.substring(2, 7).trim(), 10));
    if (noradId === 'NaN') continue;
    out.push({ noradId, name, line1, line2 });
    i++;
  }
  return out;
}

/** TLE epoch from line 1, columns 19-32 (YYDDD.DDDDDDDD). */
export function epochFromLine1(line1: string): Date | null {
  const yy = parseInt(line1.substring(18, 20), 10);
  const doy = parseFloat(line1.substring(20, 32));
  if (!Number.isFinite(yy) || !Number.isFinite(doy)) return null;
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  return new Date(Date.UTC(year, 0, 1) + (doy - 1) * 86400000);
}

async function fetchCelesTrak(query: string): Promise<{ ok: boolean; status: number; bytes: number; text: string }> {
  const url = `${CELESTRAK_BASE}?${query}`;
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': CELESTRAK_USER_AGENT },
    });
    const text = await response.text();
    const bytes = Buffer.byteLength(text);
    console.log(`[TLE] CelesTrak ${query} -> HTTP ${response.status}, ${bytes} bytes`);
    return { ok: response.ok, status: response.status, bytes, text };
  } catch (error) {
    console.error(`[TLE] CelesTrak ${query} request failed:`, error instanceof Error ? error.message : error);
    return { ok: false, status: 0, bytes: 0, text: '' };
  }
}

let indexesEnsured = false;
async function catalogCollection(): Promise<Collection<TleRecord>> {
  const collection = await getCollection<TleRecord>(CATALOG_COLLECTION);
  if (!indexesEnsured) {
    await collection.createIndex({ noradId: 1 }, { unique: true });
    await collection.createIndex({ groups: 1 });
    indexesEnsured = true;
  }
  return collection;
}

function upsertOp(t: ParsedTle, fetchedAt: Date, addGroup?: string): AnyBulkWriteOperation<TleRecord> {
  const update: any = {
    $set: {
      noradId: t.noradId,
      line1: t.line1,
      line2: t.line2,
      epoch: epochFromLine1(t.line1),
      fetchedAt,
      ...(t.name ? { name: t.name } : {}),
    },
    $setOnInsert: t.name ? {} : { name: `NORAD ${t.noradId}` },
  };
  if (addGroup) update.$addToSet = { groups: addGroup };
  return { updateOne: { filter: { noradId: t.noradId }, update, upsert: true } };
}

/** Replace a group's membership with `members` (upserting their TLEs). */
async function applyGroup(collection: Collection<TleRecord>, group: string, members: ParsedTle[], fetchedAt: Date) {
  const ids = members.map((m) => m.noradId);
  await collection.updateMany({ groups: group, noradId: { $nin: ids } } as any, { $pull: { groups: group } } as any);
  if (members.length > 0) {
    await collection.bulkWrite(members.map((m) => upsertOp(m, fetchedAt, group)), { ordered: false });
  }
}

/**
 * Write a CelesTrak GROUP=active download (plus optional group/extra data)
 * into tle_catalog. Used by the server refresh and by the local seed script.
 */
export async function storeTleCatalog(input: {
  activeText: string;
  activeBytes: number;
  groups?: Record<string, string>;
  extras?: string[];
  status?: string;
}): Promise<{ count: number }> {
  const parsed = parseTleText(input.activeText);
  if (parsed.length < 1000) {
    throw new Error(`GROUP=active parsed to only ${parsed.length} TLEs; not storing`);
  }
  const fetchedAt = new Date();
  const collection = await catalogCollection();

  await collection.bulkWrite(parsed.map((t) => upsertOp(t, fetchedAt)), { ordered: false });

  // Starlink membership comes from names in the active catalog (no extra 1.7 MB download)
  await applyGroup(collection, 'starlink', parsed.filter((t) => t.name.toUpperCase().startsWith('STARLINK')), fetchedAt);

  for (const [group, text] of Object.entries(input.groups ?? {})) {
    await applyGroup(collection, group, parseTleText(text), fetchedAt);
  }
  for (const text of input.extras ?? []) {
    const tles = parseTleText(text);
    if (tles.length > 0) await collection.bulkWrite(tles.map((t) => upsertOp(t, fetchedAt)), { ordered: false });
  }

  const count = await collection.countDocuments();
  const meta = await getCollection<TleCatalogMeta>(META_COLLECTION);
  await meta.updateOne(
    { _id: META_ID },
    {
      $set: {
        lastSuccessAt: fetchedAt,
        lastStatus: input.status ?? 'ok',
        count,
        activeBytes: input.activeBytes,
      },
    },
    { upsert: true }
  );
  return { count };
}

/** Atomically claim the right to call CelesTrak (at most once per 2 hours). */
async function claimRefresh(force: boolean): Promise<boolean> {
  const meta = await getCollection<TleCatalogMeta>(META_COLLECTION);
  const now = new Date();
  const cutoff = new Date(now.getTime() - TLE_REFRESH_INTERVAL_MS);
  try {
    const filter: any = force
      ? { _id: META_ID }
      : { _id: META_ID, $or: [{ lastAttemptAt: { $lt: cutoff } }, { lastAttemptAt: { $exists: false } }] };
    // Matches (window expired) or inserts the first meta doc. If the doc exists
    // but the window has not expired, the upsert collides on _id (E11000).
    await meta.updateOne(filter, { $set: { lastAttemptAt: now } }, { upsert: true });
    return true;
  } catch (error: any) {
    if (error?.code === 11000) return false; // another instance holds the current window
    throw error;
  }
}

/**
 * Refresh tle_catalog from CelesTrak if the last attempt was more than 2 hours
 * ago. Failures are logged and leave the stored catalog untouched.
 */
export async function refreshTleCatalogIfStale(options: { force?: boolean } = {}): Promise<string> {
  if (!(await claimRefresh(!!options.force))) return 'skipped (refreshed within 2h)';

  const meta = await getCollection<TleCatalogMeta>(META_COLLECTION);
  const active = await fetchCelesTrak('GROUP=active&FORMAT=tle');
  if (!active.ok) {
    const status = `CelesTrak GROUP=active HTTP ${active.status}, ${active.bytes} bytes`;
    console.warn(`[TLE] Refresh failed; serving last good catalog. ${status}`);
    await meta.updateOne({ _id: META_ID }, { $set: { lastStatus: status } });
    return status;
  }

  const groups: Record<string, string> = {};
  for (const group of TAGGED_GROUPS) {
    const res = await fetchCelesTrak(`GROUP=${encodeURIComponent(group)}&FORMAT=tle`);
    if (res.ok && parseTleText(res.text).length > 0) groups[group] = res.text;
  }

  const activeIds = new Set(parseTleText(active.text).map((t) => t.noradId));
  const extras: string[] = [];
  for (const id of EXTRA_CATNR_IDS.filter((i) => !activeIds.has(i))) {
    const res = await fetchCelesTrak(`CATNR=${id}&FORMAT=tle`);
    if (res.ok) extras.push(res.text);
  }

  try {
    const { count } = await storeTleCatalog({ activeText: active.text, activeBytes: active.bytes, groups, extras });
    return `ok (${count} TLEs)`;
  } catch (error: any) {
    const status = `store failed: ${error?.message || error}`;
    console.error(`[TLE] ${status}`);
    await meta.updateOne({ _id: META_ID }, { $set: { lastStatus: status } });
    return status;
  }
}

export interface TleCatalog {
  byId: Map<string, TleRecord>;
  fetchedAt: Date | null;
  lastStatus: string | null;
}

// Per-instance copy of the catalog, reloaded when a newer refresh is recorded
let memoryCatalog: { stamp: number; catalog: TleCatalog } | null = null;

/**
 * Load the whole TLE catalog (refreshing from CelesTrak first if due).
 * fetchedAt is when the stored copy was last refreshed successfully.
 */
export async function loadTleCatalog(): Promise<TleCatalog> {
  try {
    await refreshTleCatalogIfStale();
  } catch (error) {
    console.error('[TLE] Refresh check failed; serving stored catalog:', error);
  }

  const meta = await (await getCollection<TleCatalogMeta>(META_COLLECTION)).findOne({ _id: META_ID });
  const fetchedAt = meta?.lastSuccessAt ?? null;
  const lastStatus = meta?.lastStatus ?? null;
  const stamp = fetchedAt ? new Date(fetchedAt).getTime() : 0;

  if (memoryCatalog && stamp !== 0 && memoryCatalog.stamp === stamp) {
    return { ...memoryCatalog.catalog, lastStatus };
  }

  const collection = await catalogCollection();
  const docs = await collection.find({}, { projection: { _id: 0 } }).toArray();
  const byId = new Map<string, TleRecord>();
  for (const d of docs) byId.set(d.noradId, d as TleRecord);

  const catalog: TleCatalog = { byId, fetchedAt, lastStatus };
  if (stamp !== 0) memoryCatalog = { stamp, catalog };
  return catalog;
}
