// ---------------------------------------------------------------------
// Response-shape normalizer.
//
// Most of the backend wraps responses via app/core/responses.py's
// success_response(): { success, message, data }. But a handful of
// older, not-yet-refactored modules (departments, designations, shifts)
// return the raw Supabase row(s) directly. Calling code that assumes
// `res.data` breaks on those; calling code that assumes the raw shape
// breaks once a module gets migrated to success_response. This helper
// normalizes both into "just give me the payload".
// ---------------------------------------------------------------------

export function unwrap(res) {
  if (Array.isArray(res)) return res;

  if (res && typeof res === "object" && "success" in res && "data" in res) {
    return res.data;
  }

  return res;
}
