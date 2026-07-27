import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import { Crosshair, Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Leaflet's default marker icon paths break under bundlers like Vite
// because the CSS references relative image paths that don't survive the
// build — without this, pins render as broken image icons.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Default map center when nothing else is known yet. Most of Akrobat's
// sites are in Singapore, and this is also the fallback used when the
// browser can't/won't share the user's location.
const SINGAPORE_CENTER = { lat: 1.3521, lng: 103.8198 };

/**
 * Map + search + "use my location" picker for a single lat/lng point.
 *
 * Props:
 *  - latitude, longitude: current value (numbers or null/undefined)
 *  - onChange(lat, lng): called whenever the pin moves (search pick, map
 *    click, drag, or geolocation)
 *  - onAddressResolved(address): optional, called with a reverse-geocoded
 *    address string when available, so the caller can auto-fill an
 *    Address field without the user retyping it
 */
export default function LocationMapPicker({
  latitude,
  longitude,
  onChange,
  onAddressResolved,
}) {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const searchAbortRef = useRef(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const hasInitialPoint =
    typeof latitude === "number" && typeof longitude === "number";

  // ---- init map (once) ----------------------------------------------
  useEffect(() => {
    if (mapRef.current) return;

    const start = hasInitialPoint
      ? { lat: latitude, lng: longitude }
      : SINGAPORE_CENTER;

    const map = L.map(mapElRef.current, {
      center: [start.lat, start.lng],
      zoom: hasInitialPoint ? 16 : 12,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const marker = L.marker([start.lat, start.lng], { draggable: true }).addTo(
      map,
    );

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      onChange?.(pos.lat, pos.lng);
      reverseGeocode(pos.lat, pos.lng);
    });

    map.on("click", (e) => {
      marker.setLatLng(e.latlng);
      onChange?.(e.latlng.lat, e.latlng.lng);
      reverseGeocode(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    // If nothing was pre-set (Add New Site), try to auto-detect the
    // browser's current location on first open — e.g. opening this from
    // Singapore centers/pins the map there automatically. Falls back to
    // the Singapore default silently if permission is denied or
    // unavailable.
    if (!hasInitialPoint) {
      locateMe(true);
    }

    // Vite/HMR + modal mount timing can leave Leaflet with a stale
    // container size; nudge it once after mount.
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- keep marker/map in sync if parent value changes externally ----
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (typeof latitude !== "number" || typeof longitude !== "number") return;
    const current = markerRef.current.getLatLng();
    if (
      Math.abs(current.lat - latitude) > 1e-9 ||
      Math.abs(current.lng - longitude) > 1e-9
    ) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapRef.current.setView([latitude, longitude], mapRef.current.getZoom());
    }
  }, [latitude, longitude]);

  function moveTo(lat, lng, zoom = 17) {
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([lat, lng]);
    mapRef.current.setView([lat, lng], zoom);
    onChange?.(lat, lng);
  }

  // ---- search (OpenStreetMap Nominatim) -------------------------------
  useEffect(() => {
    if (!query.trim() || query.trim().length < 3) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => runSearch(query.trim()), 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function runSearch(q) {
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(
        q,
      )}`;
      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setShowResults(true);
    } catch (err) {
      if (err.name !== "AbortError") setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function pickResult(r) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    moveTo(lat, lng);
    setQuery(r.display_name);
    setShowResults(false);
    onAddressResolved?.(r.display_name);
  }

  async function reverseGeocode(lat, lng) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data?.display_name) {
        setQuery(data.display_name);
        onAddressResolved?.(data.display_name);
      }
    } catch {
      // Non-critical — the lat/lng is already set even if the address
      // lookup fails, so the user can still type the address manually.
    }
  }

  // ---- "use my current location" / auto-detect ------------------------
  function locateMe(silent = false) {
    if (!navigator.geolocation) {
      if (!silent)
        setLocateError("Geolocation isn't supported by this browser.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        moveTo(pos.coords.latitude, pos.coords.longitude, 16);
        reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocating(false);
        // Silent auto-detect on open just keeps the Singapore default —
        // only surface an error when the user explicitly clicked the
        // "Use my current location" button.
        if (!silent) {
          setLocateError(
            "Couldn't detect your location. Please allow location access or pick a point on the map.",
          );
        }
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Search for an address or place..."
          className="w-full rounded-lg border border-slate-200 pl-9 pr-16 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searching && (
            <Loader2 size={14} className="animate-spin text-slate-400" />
          )}
          {query && !searching && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {showResults && results.length > 0 && (
          <div className="absolute z-[1000] mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-56 overflow-y-auto">
            {results.map((r) => (
              <button
                type="button"
                key={r.place_id}
                onClick={() => pickResult(r)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50 border-b border-slate-50 last:border-b-0"
              >
                <MapPin size={13} className="mt-0.5 shrink-0 text-orange-500" />
                <span className="truncate">{r.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <div
          ref={mapElRef}
          className="w-full h-64 rounded-lg border border-slate-200 overflow-hidden z-0"
        />
        <button
          type="button"
          onClick={() => locateMe(false)}
          disabled={locating}
          title="Use my current location"
          className="absolute bottom-3 right-3 z-[1000] w-9 h-9 rounded-lg bg-white shadow-md border border-slate-200 flex items-center justify-center text-slate-600 hover:text-orange-500 hover:border-orange-200 disabled:opacity-60"
        >
          {locating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Crosshair size={16} />
          )}
        </button>
      </div>

      {locateError && <p className="text-xs text-orange-500">{locateError}</p>}

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>
          Lat:{" "}
          <span className="font-medium text-slate-700">
            {typeof latitude === "number" ? latitude.toFixed(6) : "—"}
          </span>
        </span>
        <span>
          Lng:{" "}
          <span className="font-medium text-slate-700">
            {typeof longitude === "number" ? longitude.toFixed(6) : "—"}
          </span>
        </span>
        <span className="text-slate-400">
          Search, click the map, or drag the pin to set the exact spot.
        </span>
      </div>
    </div>
  );
}
