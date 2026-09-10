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

// NEW: backend proxy for OneMap Singapore and Mappls India (see
// app/locations/routes.py -> GET /locations/reverse-geocode). Only
// called for coordinates inside those two countries' bounding boxes —
// everywhere else keeps using Nominatim below, unchanged.
import { apiClient } from "../services/apiClient";

const memoryCache = new Map();
// Bumped from v1 to v2 — v1 entries may contain non-English addresses
// cached before accept-language=en was added below, so this invalidates
// every old cached entry across all users' browsers in one shot.
const STORAGE_KEY = "akrobat_geocode_cache_v3"; // bumped: v2 entries were cached before the isEnglishText filter below existed

// Singapore's bounding box (rough, with a little padding). Points
// outside this box skip the OneMap call entirely.
const SG_LAT_MIN = 1.15,
  SG_LAT_MAX = 1.48;
const SG_LON_MIN = 103.59,
  SG_LON_MAX = 104.05;

function isInSingapore(lat, lon) {
  return (
    lat >= SG_LAT_MIN &&
    lat <= SG_LAT_MAX &&
    lon >= SG_LON_MIN &&
    lon <= SG_LON_MAX
  );
}

// India's bounding box (rough, generous padding — covers the mainland
// plus the Andaman & Nicobar and Lakshadweep islands). Mirrors
// IN_LAT_MIN/MAX in app/locations/mappls_service.py. Points outside
// this box skip the Mappls call entirely and go straight to Nominatim
// — e.g. Singapore (handled above) and everywhere else keep working
// exactly as before.
const IN_LAT_MIN = 6.5,
  IN_LAT_MAX = 37.6;
const IN_LON_MIN = 68.0,
  IN_LON_MAX = 97.5;

function isInIndia(lat, lon) {
  return (
    lat >= IN_LAT_MIN &&
    lat <= IN_LAT_MAX &&
    lon >= IN_LON_MIN &&
    lon <= IN_LON_MAX
  );
}

// Tries our backend proxy (OneMap for Singapore, Mappls for India) for
// a coordinate in either country. Returns a formatted address string,
// or null if it's in neither country, the provider has no result, or
// the call fails for any reason — in every "null" case the caller
// falls back to Nominatim below.
async function reverseGeocodeLocalProvider(lat, lon) {
  if (!isInSingapore(lat, lon) && !isInIndia(lat, lon)) return null;

  try {
    const res = await apiClient.get(
      `/locations/reverse-geocode?lat=${lat}&lon=${lon}`,
    );
    return res?.data?.address || null;
  } catch {
    return null;
  }
}

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

// Detects text in a non-Latin script (Chinese, Tamil, Devanagari, Thai,
// Arabic, Korean, Japanese, Cyrillic, etc). accept-language=en only
// translates fields where Nominatim actually has an English name on
// record — plenty of smaller streets/areas in Singapore and Tamil Nadu
// only have a name in the local script in OSM, with no English
// alternative to translate to, so accept-language alone can't stop
// them from coming through. This is the hard backstop: any address
// part matching one of these scripts gets dropped entirely rather than
// ever shown to the user.
const NON_LATIN_SCRIPT_RE =
  /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0900-\u0d7f\u0e00-\u0e7f\u0600-\u06ff\u0400-\u04ff]/;

function isEnglishText(str) {
  return typeof str === "string" && !NON_LATIN_SCRIPT_RE.test(str);
}

// Builds a "Building Name, B.No X, Area, City, State, Country" string from
// Nominatim's address breakdown, skipping parts that aren't present and
// collapsing consecutive duplicates (e.g. area === city for smaller
// towns).
//
// `featureName` is Nominatim's top-level `name` field for the resolved
// feature (passed in separately from `addr` below) — at high zoom this is
// often the actual named building/POI (e.g. "Rajkamal Apartments") and is
// frequently more reliable than the `building`/`house_name` address tag,
// which is sometimes missing or has junk/placeholder text on it. When
// present and it isn't just a repeat of the road/area name, it's
// preferred as the building name.
function formatAddress(addr, featureName) {
  if (!addr) return null;

  // Building name + number, when Nominatim has them (mainly for sites
  // that sit inside a named building/complex — most residential/street
  // check-ins won't have either, and that's fine, they just get dropped
  // below). "building" is the named-building tag; "house_name" is its
  // fallback on some records; "house_number" is the street number, shown
  // as "B.No X" to match how site addresses are written elsewhere in the
  // app (see OrganizationLocations.jsx).
  const tagBuildingName = addr.building || addr.house_name || null;
  const buildingName =
    featureName &&
    featureName !== addr.road &&
    featureName !== addr.neighbourhood &&
    featureName !== addr.suburb
      ? featureName
      : tagBuildingName;
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

  const country = addr.country || null;

  const parts = [building, area, city, state, country]
    .filter(Boolean)
    // Hard backstop: drop any part that isn't Latin-script text, even
    // though accept-language=en was requested above — see
    // NON_LATIN_SCRIPT_RE comment.
    .filter(isEnglishText)
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

  // NEW: for Singapore/India coordinates, try our backend proxy
  // (OneMap / Mappls) first — both give exact building name/block/street
  // detail that Nominatim often lacks. Any other country (e.g. most of
  // the rest of the world) skips this and falls through to the existing
  // Nominatim call below, unchanged.
  const localProviderResult = await reverseGeocodeLocalProvider(lat, lon);
  if (localProviderResult) {
    memoryCache.set(key, localProviderResult);
    storageCache[key] = localProviderResult;
    saveStorageCache(storageCache);
    return localProviderResult;
  }

  try {
    // zoom=18 asks Nominatim for building-level resolution (16 is street
    // level and was rounding to the nearest street/area instead of the
    // actual building); namedetails=1 surfaces the resolved feature's own
    // name (see `featureName` in formatAddress above) as an extra,
    // usually more reliable, source for the building name.
    //
    // accept-language=en is pinned explicitly here — without it, Nominatim
    // falls back to whatever Accept-Language header the visiting browser
    // sends, which depends on the user's phone/browser system language
    // rather than anything in our app. That was returning Chinese address
    // text for users with a Chinese-language device (common in Singapore),
    // which could then get the whole page auto-translated by the browser.
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&namedetails=1&accept-language=en`,
      { headers: { Accept: "application/json", "Accept-Language": "en" } },
    );
    if (!res.ok) throw new Error("reverse geocode failed");
    const data = await res.json();
    // Prefer the explicit English name tag if OSM has one; only fall
    // back to the feature's raw "name" (which may be in the local
    // script, e.g. a Tamil-only street name) if it's already Latin-script
    // text — formatAddress's isEnglishText filter is the final backstop
    // either way.
    const rawFeatureName = data.namedetails?.["name:en"] || data.name;
    const featureName =
      rawFeatureName && isEnglishText(rawFeatureName) ? rawFeatureName : null;
    const formatted =
      formatAddress(data.address, featureName) ||
      (isEnglishText(data.display_name) ? data.display_name : null);

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
