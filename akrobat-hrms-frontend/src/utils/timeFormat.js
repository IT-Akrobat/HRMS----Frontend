// ---------------------------------------------------------------------
// Time-format preference (Settings > Preferences > Time format).
//
// Settings saves "12h" | "24h". Before this helper nothing read it, and
// most screens used toLocaleTimeString([], ...) which follows the browser
// locale (24h on many PCs/phones). Use these helpers for every time shown
// on screen:
//
//   is12h()               -> boolean, pass as `hour12` to Intl/toLocale*
//   formatClock("14:05")  -> "2:05 PM" (or "14:05" when 24h is chosen)
//
// The choice is mirrored into one global localStorage key so it can be read
// outside React. Settings writes it on load and on save.
// ---------------------------------------------------------------------

export const TIME_FORMAT_KEY = "akrobat_time_format";

export function getTimeFormat() {
  try {
    const direct = localStorage.getItem(TIME_FORMAT_KEY);
    if (direct === "12h" || direct === "24h") return direct;
    // Fallback for people who saved preferences before this key existed.
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("akrobat_settings_")) continue;
      const tf = JSON.parse(localStorage.getItem(k) || "{}")?.preferences
        ?.time_format;
      if (tf === "12h" || tf === "24h") return tf;
    }
  } catch {
    // ignore storage / JSON errors
  }
  return "24h"; // same default as Settings
}

export function setTimeFormat(value) {
  try {
    localStorage.setItem(TIME_FORMAT_KEY, value === "12h" ? "12h" : "24h");
  } catch {
    // ignore
  }
}

export const is12h = () => getTimeFormat() === "12h";

// "14:05" / "14:05:30" -> "2:05 PM" (12h) or "14:05" (24h). Anything that
// is not a clock string is returned untouched ("--", "", null...).
export function formatClock(value) {
  if (!value || typeof value !== "string") return value;
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return value;
  const h = Number(m[1]);
  const mins = m[2];
  if (!is12h()) return `${String(h).padStart(2, "0")}:${mins}`;
  return `${h % 12 || 12}:${mins} ${h >= 12 ? "PM" : "AM"}`;
}
