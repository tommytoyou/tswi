/**
 * Format a timestamp in UTC (date-fns `format` always uses the browser's
 * local zone, which mislabels times shown with a "UTC" suffix).
 *
 * Supported tokens: yyyy, MMM, MM, dd, d, HH, mm, ss. Any other characters are
 * copied as-is; text in single quotes is copied literally.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

export function formatUTC(date: Date | number | string, pattern: string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '--';

  const tokens: Record<string, () => string> = {
    yyyy: () => String(d.getUTCFullYear()),
    MMM: () => MONTHS[d.getUTCMonth()],
    MM: () => pad(d.getUTCMonth() + 1),
    dd: () => pad(d.getUTCDate()),
    d: () => String(d.getUTCDate()),
    HH: () => pad(d.getUTCHours()),
    mm: () => pad(d.getUTCMinutes()),
    ss: () => pad(d.getUTCSeconds()),
  };

  return pattern.replace(/'[^']*'|yyyy|MMM|MM|dd|d|HH|mm|ss/g, (m) =>
    m.startsWith("'") ? m.slice(1, -1) : tokens[m]()
  );
}
