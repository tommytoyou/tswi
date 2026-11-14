import { getCollection, getDb } from '@/lib/db';
import { CELESTRAK_USER_AGENT } from '@/lib/tle-catalog';

/**
 * CelesTrak SATCAT (https://celestrak.org/pub/satcat.csv) stored in MongoDB
 * (collection satcat). Downloaded at most once per day as a single file; the
 * new copy is written to a staging collection and renamed over satcat, so
 * readers always see a complete catalog. On failure the last copy is kept.
 */

export interface SatcatRecord {
  noradId: string;
  name: string;
  objectType: string | null;
  opsStatus: string | null;
  owner: string | null;
  launchDate: string | null;
  /** YYYY-MM-DD, or null if still in orbit */
  decayDate: string | null;
  fetchedAt: Date;
}

interface SatcatMeta {
  _id: string;
  lastAttemptAt?: Date;
  lastSuccessAt?: Date;
  lastStatus?: string;
  count?: number;
}

const SATCAT_URL = 'https://celestrak.org/pub/satcat.csv';
const COLLECTION = 'satcat';
const STAGING = 'satcat_staging';
const META_COLLECTION = 'tle_catalog_meta';
const META_ID = 'satcat';
export const SATCAT_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Split one CSV line, honouring double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseSatcatCsv(text: string, fetchedAt: Date): SatcatRecord[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  const iId = col('NORAD_CAT_ID');
  if (iId < 0) return [];
  const iName = col('OBJECT_NAME'), iType = col('OBJECT_TYPE'), iOps = col('OPS_STATUS_CODE');
  const iOwner = col('OWNER'), iLaunch = col('LAUNCH_DATE'), iDecay = col('DECAY_DATE');
  const val = (f: string[], i: number) => (i >= 0 && f[i] && f[i].trim() !== '' ? f[i].trim() : null);

  const records: SatcatRecord[] = [];
  for (const line of lines.slice(1)) {
    const f = splitCsvLine(line);
    const id = parseInt(f[iId], 10);
    if (!Number.isFinite(id)) continue;
    records.push({
      noradId: String(id),
      name: val(f, iName) ?? '',
      objectType: val(f, iType),
      opsStatus: val(f, iOps),
      owner: val(f, iOwner),
      launchDate: val(f, iLaunch),
      decayDate: val(f, iDecay),
      fetchedAt,
    });
  }
  return records;
}

async function claimRefresh(force: boolean): Promise<boolean> {
  const meta = await getCollection<SatcatMeta>(META_COLLECTION);
  const now = new Date();
  const cutoff = new Date(now.getTime() - SATCAT_REFRESH_INTERVAL_MS);
  const filter: any = force
    ? { _id: META_ID }
    : { _id: META_ID, $or: [{ lastAttemptAt: { $lt: cutoff } }, { lastAttemptAt: { $exists: false } }] };
  try {
    await meta.updateOne(filter, { $set: { lastAttemptAt: now } }, { upsert: true });
    return true;
  } catch (error: any) {
    if (error?.code === 11000) return false; // attempted within the last day
    throw error;
  }
}

/** Download SATCAT if the last attempt was more than a day ago. */
export async function refreshSatcatIfStale(options: { force?: boolean } = {}): Promise<string> {
  if (!(await claimRefresh(!!options.force))) return 'skipped (refreshed within 24h)';
  const meta = await getCollection<SatcatMeta>(META_COLLECTION);

  let status: string;
  try {
    const response = await fetch(SATCAT_URL, { cache: 'no-store', headers: { 'User-Agent': CELESTRAK_USER_AGENT } });
    const text = await response.text();
    const bytes = Buffer.byteLength(text);
    console.log(`[SATCAT] CelesTrak satcat.csv -> HTTP ${response.status}, ${bytes} bytes`);
    if (!response.ok) throw new Error(`HTTP ${response.status}, ${bytes} bytes`);

    const fetchedAt = new Date();
    const records = parseSatcatCsv(text, fetchedAt);
    if (records.length < 10000) throw new Error(`parsed only ${records.length} rows`);

    const db = await getDb();
    await db.collection(STAGING).drop().catch(() => undefined);
    const staging = db.collection<SatcatRecord>(STAGING);
    for (let i = 0; i < records.length; i += 10000) {
      await staging.insertMany(records.slice(i, i + 10000), { ordered: false });
    }
    await staging.createIndex({ noradId: 1 }, { unique: true });
    await staging.rename(COLLECTION, { dropTarget: true });

    await meta.updateOne(
      { _id: META_ID },
      { $set: { lastSuccessAt: fetchedAt, lastStatus: 'ok', count: records.length } }
    );
    satcatMemory = null;
    return `ok (${records.length} rows)`;
  } catch (error: any) {
    status = `SATCAT refresh failed: ${error?.message || error}`;
    console.warn(`[SATCAT] ${status}; keeping last copy`);
    await meta.updateOne({ _id: META_ID }, { $set: { lastStatus: status } });
    return status;
  }
}

export interface DecayLookup {
  /** noradId -> decay date (YYYY-MM-DD) for decayed objects only */
  decayed: Map<string, string>;
  /** all NORAD IDs present in SATCAT */
  known: Set<string>;
  fetchedAt: Date | null;
  lastStatus: string | null;
}

let satcatMemory: { stamp: number; lookup: DecayLookup } | null = null;

/**
 * Decay dates from the stored SATCAT (refreshing it first if due). Returns
 * empty maps if SATCAT has never been stored, so callers hide nothing.
 */
export async function loadDecayLookup(): Promise<DecayLookup> {
  try {
    await refreshSatcatIfStale();
  } catch (error) {
    console.error('[SATCAT] Refresh check failed; using stored copy:', error);
  }

  const meta = await (await getCollection<SatcatMeta>(META_COLLECTION)).findOne({ _id: META_ID });
  const fetchedAt = meta?.lastSuccessAt ?? null;
  const lastStatus = meta?.lastStatus ?? null;
  const stamp = fetchedAt ? new Date(fetchedAt).getTime() : 0;
  if (satcatMemory && stamp !== 0 && satcatMemory.stamp === stamp) {
    return { ...satcatMemory.lookup, lastStatus };
  }

  const docs = await (await getCollection<SatcatRecord>(COLLECTION))
    .find({}, { projection: { _id: 0, noradId: 1, decayDate: 1 } })
    .toArray();
  const decayed = new Map<string, string>();
  const known = new Set<string>();
  for (const d of docs) {
    known.add(d.noradId);
    if (d.decayDate) decayed.set(d.noradId, d.decayDate);
  }
  const lookup: DecayLookup = { decayed, known, fetchedAt, lastStatus };
  if (stamp !== 0) satcatMemory = { stamp, lookup };
  return lookup;
}
