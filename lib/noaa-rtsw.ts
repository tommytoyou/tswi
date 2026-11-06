/**
 * Helpers for NOAA SWPC Real-Time Solar Wind (RTSW) feeds:
 *   https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json
 *   https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json
 *
 * Each feed interleaves records from several spacecraft (SOLAR1, ACE, IMAP).
 * Exactly one source is flagged `active` per minute, but other sources report
 * at slightly different seconds (IMAP at :02), so records are grouped by minute.
 */

export interface RtswRecord {
  time_tag: string;
  active: boolean;
  source: string;
  [key: string]: unknown;
}

/**
 * Parse a NOAA time tag as UTC. NOAA omits the zone ("2026-11-06T04:52:00"),
 * which `new Date()` would otherwise interpret as server-local time.
 */
export function parseNoaaTime(tag: string): Date {
  const iso = tag.trim().replace(' ', 'T');
  return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
}

/**
 * Pick one record per minute.
 *
 * Preference: the `active` record if it has data in any of `valueFields`;
 * otherwise the first record in that minute that has data (its `source` is
 * kept so the substitution is traceable). Minutes with no data are dropped.
 *
 * Returns records sorted oldest first, each paired with its minute timestamp.
 */
export function selectRtswByMinute<T extends RtswRecord>(
  records: T[],
  valueFields: string[]
): Array<{ ts: Date; record: T }> {
  const hasData = (r: T) => valueFields.some((f) => typeof r[f] === 'number' && Number.isFinite(r[f]));
  const byMinute = new Map<number, T[]>();

  for (const r of records) {
    if (!r || typeof r.time_tag !== 'string') continue;
    const t = parseNoaaTime(r.time_tag);
    if (isNaN(t.getTime())) continue;
    t.setUTCSeconds(0, 0);
    const key = t.getTime();
    const bucket = byMinute.get(key);
    if (bucket) bucket.push(r);
    else byMinute.set(key, [r]);
  }

  const selected: Array<{ ts: Date; record: T }> = [];
  for (const [minute, group] of byMinute) {
    const active = group.find((r) => r.active === true);
    const chosen = active && hasData(active) ? active : group.find(hasData);
    if (chosen) selected.push({ ts: new Date(minute), record: chosen });
  }

  selected.sort((a, b) => a.ts.getTime() - b.ts.getTime());
  return selected;
}

/** Number or null; never NaN, never a string. */
export function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
