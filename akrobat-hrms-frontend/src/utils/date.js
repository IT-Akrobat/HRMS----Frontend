// ---------------------------------------------------------------------
// Local-date ISO helpers.
//
// `date.toISOString().slice(0, 10)` (used all over this codebase) looks
// harmless but is wrong for date-only values: toISOString() first
// converts the Date to UTC. For anyone in a timezone ahead of UTC (e.g.
// IST, UTC+5:30), local midnight becomes the *previous* day once
// shifted to UTC — so picking the 13th sends/shows "...-12" instead of
// "...-13". Use toLocalISODate() instead, which reads the Date's local
// year/month/day directly and never touches UTC.
// ---------------------------------------------------------------------

export function toLocalISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Parses a "YYYY-MM-DD" string as a local-midnight Date (rather than
// `new Date("YYYY-MM-DD")`, which the spec treats as UTC midnight and
// which shifts back a day once rendered in a timezone ahead of UTC).
export function parseLocalISODate(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------
// Parses a full timestamp coming back from the API (e.g. notifications
// created_at, audit log timestamps, login activity). Every such column
// in the DB is Postgres `timestamp` (no timezone), and Supabase stores
// it in UTC but serializes it as a bare string with no trailing "Z" or
// offset, e.g. "2026-07-21T05:45:00.123456". Per the JS spec, a
// date-time string with no timezone designator is parsed as *local*
// time, not UTC — so `new Date(dateStr)` silently shifts every one of
// these by the browser's UTC offset (~5.5h for IST). That's why a
// notification sent 15 minutes ago could show up as "4h ago": the
// diff against Date.now() (true UTC) picks up the offset.
//
// Always use this (not a bare `new Date(...)`) for any created_at /
// _time / _at value from the API before doing Date math or "time ago"
// formatting.
export function parseServerDate(value) {
  if (!value) return null;
  const hasTimezone = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  const d = new Date(hasTimezone ? value : `${value}Z`);
  return isNaN(d.getTime()) ? null : d;
}
