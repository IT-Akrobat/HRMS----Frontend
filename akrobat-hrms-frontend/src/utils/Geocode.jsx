// ---------------------------------------------------------------------
// Reverse geocoding helper
// ---------------------------------------------------------------------
// Turns a raw GPS fix (lat/lon) into a human-readable place like
// "Building Name, B.No 12, Area, City, State" — used so Recent Activity
// (dashboard) and Audit Logs can show a real place instead of just
// coordinates.
//
// Uses OpenStreetMap's free Nominatim API — no API key required. Results
// are cached (in-memory for the tab's lifetime, and in localStorage
// across sessions) keyed by coordinates rounded to ~11m precision, so the
// same spot is never looked up twice and repeated renders don't refire
// requests. Nominatim's usage policy caps unauthenticated use at ~1
// request/second, so callers that resolve many coordinates at once
// (e.g. a list of audit-log entries) should stagger their calls — see
// `geocodeQueue` below.

const memoryCache = new Map();
const STORAGE_KEY = "akrobat_geocode_cache_v1";

// Rounds to ~100m precision so nearby check-ins/logouts from the same
// spot share one cache entry/lookup instead of firing a fresh
// reverse-geocode call for every single log row.
export function placeKey(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
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

// Builds a "Building Name, B.No X, Area, City, State" string from
// Nominatim's address breakdown, skipping parts that aren't present and
// collapsing consecutive duplicates (e.g. area === city for smaller
// towns).
function formatAddress(addr) {
  if (!addr) return null;

  // Building name + number, when Nominatim has them (mainly for sites
  // that sit inside a named building/complex — most residential/street
  // check-ins won't have either, and that's fine, they just get dropped
  // below). "building" is the named-building tag; "house_name" is its
  // fallback on some records; "house_number" is the street number, shown
  // as "B.No X" to match how site addresses are written elsewhere in the
  // app (see OrganizationLocations.jsx).
  const buildingName = addr.building || addr.house_name || null;
  const buildingNo = addr.house_number ? `B.No ${addr.house_number}` : null;
  const building =
    buildingName && buildingNo
      ? `${buildingName}, ${buildingNo}`
      : buildingName || buildingNo || null;

  // Finest-grained name Nominatim has for this point, tried in
  // descending order of granularity.
  const area =
    addr.neighbourhood ||
    addr.suburb ||
    addr.quarter ||
    addr.city_district ||
    addr.borough ||
    addr.hamlet ||
    null;

  const city =
    addr.city || addr.town || addr.village || addr.municipality || null;

  // State / province — Nominatim calls this "state" for most countries;
  // "state_district" is its fallback on some records (e.g. parts of
  // South/Southeast Asia where Nominatim splits state into districts).
  const state = addr.state || addr.state_district || null;

  const parts = [building, area, city, state]
    .filter(Boolean)
    // Drop consecutive duplicates.
    .filter((p, i, arr) => p !== arr[i - 1]);

  return parts.length ? parts.join(", ") : null;
}

// Resolves a single lat/lon to a formatted place string (or null on
// failure / no result). Safe to call repeatedly — cached after the first
// successful lookup for a given (rounded) coordinate.
export async function reverseGeocode(lat, lon) {
  if (lat == null || lon == null) return null;
  const key = placeKey(lat, lon);
  if (!key) return null;

  if (memoryCache.has(key)) return memoryCache.get(key);

  const storageCache = loadStorageCache();
  if (storageCache[key] !== undefined) {
    memoryCache.set(key, storageCache[key]);
    return storageCache[key];
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`,
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

// Resolves several { key, lat, lon } coordinate pairs one at a time,
// calling `onResolved(key, label)` as each one completes. Nominatim's
// usage policy caps requests at 1/sec, so this stays sequential with a
// delay between calls — cached entries resolve instantly, no delay.
export async function geocodeQueue(coordsList, onResolved) {
  const seen = new Set();
  for (const { key, lat, lon } of coordsList) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const label = await reverseGeocode(lat, lon);
    if (label) onResolved(key, label);
    await new Promise((r) => setTimeout(r, 1100));
  }
}
