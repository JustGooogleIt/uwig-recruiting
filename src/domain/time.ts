// Time helpers. Exact moments are stored as UTC ISO strings and displayed in the member's
// time zone. Date-only values ('YYYY-MM-DD') are never shifted by time zone.
import type { DateOnly, ISODateTime } from './types';

export const DEFAULT_TZ = 'America/Los_Angeles';
const DAY = 86400000;

const keyFmtCache: Record<string, Intl.DateTimeFormat> = {};
function keyFmt(tz: string) {
  return (keyFmtCache[tz] ||= new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }));
}

/** Calendar date of an instant in a time zone. */
export function dateKey(iso: ISODateTime | number, tz: string): DateOnly {
  return keyFmt(tz).format(new Date(iso));
}
export function todayKey(tz: string): DateOnly { return dateKey(Date.now(), tz); }

export function addDays(d: DateOnly, n: number): DateOnly {
  const t = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) + n * DAY;
  return new Date(t).toISOString().slice(0, 10);
}
export function diffDays(a: DateOnly, b: DateOnly): number {
  const ta = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const tb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((ta - tb) / DAY);
}
/** Monday of the week containing d. */
export function weekStart(d: DateOnly): DateOnly {
  const dow = new Date(d + 'T00:00:00Z').getUTCDay(); // 0 Sun
  return addDays(d, -((dow + 6) % 7));
}

function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => +(parts.find(p => p.type === t)!.value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second'));
  return asUtc - utcMs;
}
/** Convert a wall-clock date and time in tz to a UTC ISO string. */
export function zonedToISO(d: DateOnly, time: string, tz: string): ISODateTime {
  const [h, m] = (time || '12:00').split(':').map(Number);
  const guess = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), h, m);
  let off = tzOffsetMs(guess, tz);
  let utc = guess - off;
  off = tzOffsetMs(utc, tz);
  utc = guess - off;
  return new Date(utc).toISOString();
}
export function timeKey(iso: ISODateTime, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

export function fmtDate(d?: DateOnly, opts: { year?: boolean } = {}): string {
  if (!d) return '—';
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', ...(opts.year ? { year: 'numeric' } : {}) });
}
export function fmtDateTime(iso: ISODateTime | undefined, tz: string, dateOnly = false): string {
  if (!iso) return '—';
  if (dateOnly) return fmtDate(dateKey(iso, tz));
  return new Date(iso).toLocaleString('en-US', { timeZone: tz, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function fmtWeekday(d: DateOnly): string {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
}
export function relDay(d: DateOnly, today: DateOnly): string {
  const n = diffDays(d, today);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n < 0) return `${-n} days ago`;
  if (n < 7) return `In ${n} days`;
  return fmtDate(d);
}
export function tzLabel(tz: string): string {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date());
    return p.find(x => x.type === 'timeZoneName')?.value || tz;
  } catch { return tz; }
}
