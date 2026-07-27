// ---------------------------------------------------------------------
// Reverse geocoding helper
// ---------------------------------------------------------------------
// Turns a raw GPS fix (lat/lon) into a human-readable place name like
// "Guindy, Chennai, Tamil Nadu, India" — used so Check In/Check Out and
// Recent Activity can show a real place (with city, district/county,
// state, country) instead of just coordinates or only the matched office
// name.
//
// Uses OpenStreetMap's free Nominatim API — no API key required. Results
// are cached (in-memory for the tab's lifetime, and in localStorage
// across sessions) keyed by coordinates rounded to ~11m precision, so the
// same spot is never looked up twice and repeated renders don't refire
// requests. Nominatim's usage policy caps unauthenticated use at ~1
// request/second, so callers that resolve many coordinates at once
// (e.g. a list of audit-log entries) should stagger their calls — see
// `reverseGeocodeMany` below.

const memoryCache = new Map();
const STORAGE_KEY = "akrobat_geocode_cache_v1";

function roundKey(lat, lon) {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

function loadStorageCache() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveStorageCache(cache) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore quota / privacy-mode errors — caching is a nice-to-have.
  }
}

// Builds a "City, County, State, Country" style string from Nominatim's
// address breakdown, skipping parts that aren't present and collapsing
// consecutive duplicates (e.g. city === county for some cities).
function formatAddress(address) {
  if (!address) return null;
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.suburb ||
    address.municipality;
  const county = address.county || address.state_district;
  const state = address.state;
  const country = address.country;

  const parts = [city, county, state, country].filter(Boolean);
  const deduped = parts.filter((p, i) => p !== parts[i - 1]);
  return deduped.length > 0 ? deduped.join(", ") : null;
}

// Resolves a single lat/lon to a formatted address string (or null on
// failure / no result). Safe to call repeatedly — cached after the first
// successful lookup for a given (rounded) coordinate.
export async function reverseGeocode(lat, lon) {
  if (lat == null || lon == null) return null;
  const key = roundKey(lat, lon);

  if (memoryCache.has(key)) return memoryCache.get(key);

  const storageCache = loadStorageCache();
  if (storageCache[key] !== undefined) {
    memoryCache.set(key, storageCache[key]);
    return storageCache[key];
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) throw new Error("reverse geocode failed");
    const data = await res.json();
    const formatted = formatAddress(data.address) || data.display_name || null;

    memoryCache.set(key, formatted);
    storageCache[key] = formatted;
    saveStorageCache(storageCache);
    return formatted;
  } catch {
    return null;
  }
}

// Resolves several coordinate pairs, calling `onResolve(key, address)` as
// each one completes. Requests are staggered ~1/second (cached entries
// resolve instantly, no delay) to stay within Nominatim's fair-use limits
// when a list (e.g. Recent Activity) has several different locations.
export function reverseGeocodeMany(pairs, onResolve) {
  let delay = 0;
  const seen = new Set();
  pairs.forEach(({ key, lat, lon }) => {
    if (seen.has(key)) return;
    seen.add(key);

    const cached =
      memoryCache.get(key) ??
      (loadStorageCache()[key] !== undefined
        ? loadStorageCache()[key]
        : undefined);

    if (cached !== undefined) {
      onResolve(key, cached);
      return;
    }

    setTimeout(() => {
      reverseGeocode(lat, lon).then((address) => onResolve(key, address));
    }, delay);
    delay += 1100;
  });
}
