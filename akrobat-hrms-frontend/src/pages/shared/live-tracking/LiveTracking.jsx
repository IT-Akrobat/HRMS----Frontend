import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import {
  AlertTriangle,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import PageHeader from "../../../components/common/PageHeader";
import DatePicker from "../../../components/layout/DatePicker";
import { useAttendanceLiveUpdates } from "../../../hooks/Useattendanceliveupdates";
import { useIsDesktop } from "../../../hooks/useBasePath";
import { apiClient } from "../../../services/apiClient";
import { parseServerDate } from "../../../utils/date";

// ---------------------------------------------------------------------
// SHARED Live Site Tracking screen — used by both Super Admin (as a
// Dashboard tab on web / sidebar page on mobile) and HR Admin (sidebar
// page). The endpoints are gated server-side on VIEW_ALL_ATTENDANCE, which
// both roles hold. There are no role-specific paths in here, so one
// component serves both.
//
// Two tabs:
//  - "Today": GET /attendance/org/site-visits (get_org_site_visits_today)
//    — only field employees who have actually logged a site visit
//    today. Anyone not checked in, or checked in but not yet arrived at
//    a site, is left off this list.
//  - "History": GET /attendance/org/site-visits/history
//    (get_org_site_visits_history) — everyone's past visits (defaults
//    to the trailing 30 days, excluding today), one row per
//    employee/day, with a date range filter.
// Both gated on VIEW_ALL_ATTENDANCE. Reuses the arrival/departure points
// from the existing Arrive/Depart Site flow, plus a live 1-minute
// presence ping while a visit is open (POST /attendance/site-visit/ping,
// fired by components/common/SiteVisitCard.jsx) — that ping is what
// flags an employee as "Out of range" here the moment they're more than
// 500m from their site (see ALERT_RADIUS_M in app/attendance/services.py).
//
// The Today tab polls every 30s while open for a "live" feel — the
// underlying position itself refreshes roughly every 60s on the
// employee's device, so this poll just catches up to that. History does
// not poll — it's a static lookback with a "Refresh" button.
// ---------------------------------------------------------------------

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const SINGAPORE_CENTER = { lat: 1.3521, lng: 103.8198 };
const POLL_MS = 30000;

const STATUS_META = {
  on_site: {
    label: "On Site",
    dot: "bg-green-500",
    badge: "bg-green-50 text-green-700 border-green-200",
  },
  checked_in_no_site: {
    label: "Checked In",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  checked_out: {
    label: "Checked Out",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
  },
  not_checked_in: {
    label: "Not Checked In",
    dot: "bg-slate-300",
    badge: "bg-slate-50 text-slate-400 border-slate-200",
  },
};

function timeOnly(iso) {
  if (!iso) return "--";
  try {
    const d = parseServerDate(iso);
    if (!d) return "--";
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "--";
  }
}

// "2m ago" / "just now" for a last-ping timestamp — used to show how
// fresh the live position is, since a stale ping (phone died, app
// closed, no signal) is worth surfacing differently from a fresh one.
function timeAgo(iso) {
  if (!iso) return null;
  const d = parseServerDate(iso);
  if (!d) return null;
  const minutes = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1m ago";
  return `${minutes}m ago`;
}

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// ==========================================================================
// Trail map — plots each of today's site visits (arrival + departure
// points) in chronological order, connected by a line, for one employee.
// ==========================================================================

function TrailMapModal({ row, onClose }) {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  // Keyed by visit id -> { arrival: marker|null, departure: marker|null }.
  // Populated once when the markers are first drawn, then used to jump
  // the map to a specific visit when its row in the list is clicked.
  const markersByVisitRef = useRef({});
  const [activeVisitId, setActiveVisitId] = useState(null);

  const points = useMemo(() => {
    const pts = [];
    (row.trail || []).forEach((visit) => {
      if (
        typeof visit.arrival_latitude === "number" &&
        typeof visit.arrival_longitude === "number"
      ) {
        pts.push({
          lat: visit.arrival_latitude,
          lng: visit.arrival_longitude,
          label: `Arrived — ${visit.locations?.location_name || "Site"}`,
          time: visit.arrival_time,
          kind: "arrival",
          visitId: visit.id,
        });
      }
      if (
        typeof visit.departure_latitude === "number" &&
        typeof visit.departure_longitude === "number"
      ) {
        pts.push({
          lat: visit.departure_latitude,
          lng: visit.departure_longitude,
          label: `Departed — ${visit.locations?.location_name || "Site"}`,
          time: visit.departure_time,
          kind: "departure",
          visitId: visit.id,
        });
      }
    });
    return pts;
  }, [row]);

  useEffect(() => {
    if (mapRef.current) return;

    const start = points.length
      ? points[points.length - 1]
      : row.current_latitude && row.current_longitude
        ? { lat: row.current_latitude, lng: row.current_longitude }
        : SINGAPORE_CENTER;

    const map = L.map(mapElRef.current, {
      center: [start.lat, start.lng],
      zoom: points.length ? 14 : 11,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;

    if (points.length) {
      const latlngs = points.map((p) => [p.lat, p.lng]);

      L.polyline(latlngs, {
        color: "#f97316",
        weight: 3,
        opacity: 0.7,
        dashArray: "6 6",
      }).addTo(layer);

      points.forEach((p, i) => {
        const isLast = i === points.length - 1;
        const marker = L.circleMarker([p.lat, p.lng], {
          radius: isLast ? 9 : 6,
          color: isLast ? "#16a34a" : "#f97316",
          fillColor: isLast ? "#22c55e" : "#fb923c",
          fillOpacity: 0.9,
          weight: 2,
        }).addTo(layer);
        marker.bindTooltip(`${p.label}<br/>${timeOnly(p.time)}`, {
          direction: "top",
        });

        if (p.visitId) {
          markersByVisitRef.current[p.visitId] =
            markersByVisitRef.current[p.visitId] || {};
          markersByVisitRef.current[p.visitId][p.kind] = marker;
        }
      });

      // Live ping position — separate from the arrival/departure points
      // above, since it can drift from where they arrived if they've
      // wandered off (that's the whole point of the 1-min presence
      // check). Only plotted while genuinely on site right now.
      let liveLatLng = null;
      if (
        row.live_status === "on_site" &&
        typeof row.current_latitude === "number" &&
        typeof row.current_longitude === "number"
      ) {
        liveLatLng = [row.current_latitude, row.current_longitude];
        const liveColor = row.is_outside_radius ? "#dc2626" : "#2563eb";
        const liveMarker = L.circleMarker(liveLatLng, {
          radius: 10,
          color: liveColor,
          fillColor: liveColor,
          fillOpacity: 0.35,
          weight: 3,
        }).addTo(layer);
        const distanceLabel = row.last_ping_distance_m
          ? `${Math.round(row.last_ping_distance_m)}m from site`
          : "";
        liveMarker.bindTooltip(
          `Live position${row.is_outside_radius ? " — OUT OF RANGE" : ""}<br/>${distanceLabel}`,
          { direction: "top" },
        );
        markersByVisitRef.current.__live = liveMarker;
        latlngs.push(liveLatLng);
      }

      map.fitBounds(L.latLngBounds(latlngs), {
        padding: [40, 40],
        maxZoom: 16,
      });
    } else {
      L.marker([start.lat, start.lng])
        .addTo(layer)
        .bindTooltip("No location data yet today");
    }

    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When a row in the list below is clicked, jump the map to that
  // visit's marker — prefer its departure point (where they left from),
  // falling back to the arrival point if there's no departure yet (i.e.
  // "on site now"), and to the live position marker as a last resort.
  useEffect(() => {
    if (!activeVisitId || !mapRef.current) return;
    const markers = markersByVisitRef.current[activeVisitId];
    const marker =
      markers?.departure ||
      markers?.arrival ||
      markersByVisitRef.current.__live;
    if (!marker) return;

    const latlng = marker.getLatLng();
    mapRef.current.flyTo(latlng, Math.max(mapRef.current.getZoom(), 16), {
      duration: 0.6,
    });
    marker.openTooltip();
  }, [activeVisitId]);

  const meta = STATUS_META[row.live_status] || STATUS_META.not_checked_in;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 sm:p-4">
      {/* Mobile: full-width sheet sliding up from the bottom, rounded top
          corners only, near-full-height. Desktop (sm+): unchanged centered
          dialog — every mobile-only class below is undone by an sm: class
          that restores the original look exactly. */}
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[94vh] sm:max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0">
          <span className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>

        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 truncate">
              {row.employee?.full_name || "Employee"} — Today's Trail
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${meta.badge}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
              {row.current_site?.location_name && (
                <span>· Currently at {row.current_site.location_name}</span>
              )}
              {row.live_status === "on_site" && row.is_outside_radius && (
                <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
                  <AlertTriangle size={12} />
                  Out of range
                  {row.last_ping_distance_m
                    ? ` (${Math.round(row.last_ping_distance_m)}m from site)`
                    : ""}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-4 overflow-y-auto flex-1">
          <div
            ref={mapElRef}
            className="w-full h-[44vh] sm:h-[380px] rounded-xl border border-slate-200"
          />

          {points.length === 0 && (
            <p className="text-xs text-slate-400 mt-3">
              No arrival/departure coordinates recorded yet today — the trail
              fills in as they log site visits.
            </p>
          )}

          {row.trail?.length > 0 && (
            <div className="mt-4 space-y-2">
              {row.trail.map((visit) => (
                <button
                  key={visit.id}
                  type="button"
                  onClick={() => setActiveVisitId(visit.id)}
                  className={`w-full flex items-center justify-between text-sm rounded-lg px-3 py-2.5 sm:py-2 border text-left transition-colors ${
                    activeVisitId === visit.id
                      ? "bg-orange-50 border-orange-200"
                      : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2 text-slate-700 min-w-0">
                    <MapPin size={14} className="text-orange-500 shrink-0" />
                    <span className="font-medium truncate">
                      {visit.locations?.location_name || "Unknown Site"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 shrink-0 pl-2">
                    {timeOnly(visit.arrival_time)} →{" "}
                    {visit.departure_time
                      ? timeOnly(visit.departure_time)
                      : "on site now"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// TODAY TAB — only employees who have actually visited a site today
// (GET /attendance/org/site-visits, already filtered server-side).
// ==========================================================================
// WEB-ONLY pieces for the Today tab (lg and up): presence text + a live
// overview map of everyone's last known position.
// ==========================================================================

function PresenceText({ row }) {
  if (row.live_status !== "on_site")
    return <span className="text-slate-300">Not on a site</span>;
  if (row.is_outside_radius)
    return (
      <span
        className="inline-flex items-center gap-1 text-orange-600 font-medium"
        title={
          row.last_ping_distance_m
            ? `${Math.round(row.last_ping_distance_m)}m from site`
            : undefined
        }
      >
        <AlertTriangle size={12} /> Out of range
        {row.last_ping_at && (
          <span className="text-slate-400 font-normal">
            · {timeAgo(row.last_ping_at)}
          </span>
        )}
      </span>
    );
  if (row.last_ping_at)
    return (
      <span className="text-emerald-600">
        In range · {timeAgo(row.last_ping_at)}
      </span>
    );
  return <span className="text-slate-400">No live ping yet</span>;
}

function markerColor(row) {
  if (row.live_status === "on_site")
    return row.is_outside_radius ? "#f97316" : "#16a34a";
  if (row.live_status === "checked_in_no_site") return "#f59e0b";
  return "#94a3b8";
}

function LiveOverviewMap({ rows, focusId, fitKey, onSelect }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const markersRef = useRef({});
  const fittedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (mapRef.current) return undefined;
    const map = L.map(elRef.current, {
      center: [SINGAPORE_CENTER.lat, SINGAPORE_CENTER.lng],
      zoom: 11,
    });
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(elRef.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // A new filter/search should re-frame the map once.
  useEffect(() => {
    fittedRef.current = false;
  }, [fitKey]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markersRef.current = {};
    const pts = [];
    rows.forEach((row) => {
      const lat = row.current_latitude;
      const lng = row.current_longitude;
      if (typeof lat !== "number" || typeof lng !== "number") return;
      const isFocus = row.employee_id === focusId;
      const marker = L.circleMarker([lat, lng], {
        radius: isFocus ? 12 : 9,
        color: isFocus ? "#0f172a" : "#ffffff",
        weight: isFocus ? 3 : 2,
        fillColor: markerColor(row),
        fillOpacity: 1,
      }).addTo(layer);
      marker.bindTooltip(
        `${row.employee?.full_name || "Employee"}${
          row.current_site?.location_name
            ? ` · ${row.current_site.location_name}`
            : ""
        }`,
      );
      marker.on("click", () => onSelectRef.current(row.employee_id));
      markersRef.current[row.employee_id] = marker;
      pts.push([lat, lng]);
    });
    if (pts.length && !fittedRef.current) {
      map.fitBounds(pts, { padding: [48, 48], maxZoom: 16 });
      fittedRef.current = true;
    }
  }, [rows, focusId]);

  useEffect(() => {
    if (focusId == null) return;
    const map = mapRef.current;
    const marker = markersRef.current[focusId];
    if (!map || !marker) return;
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15), {
      duration: 0.6,
    });
    marker.openTooltip();
  }, [focusId]);

  return <div ref={elRef} className="h-full w-full" />;
}

// ==========================================================================

// forwardRef so the parent tab bar can trigger a refresh on mobile, where
// the standalone Refresh button below is hidden and replaced by an
// icon button docked at the right end of the Today/History tab row.
const TodayTab = forwardRef(function TodayTab(_props, ref) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  // Web-only view state
  const isDesktop = useIsDesktop();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | on_site | out | other
  const [focusId, setFocusId] = useState(null);

  function load(silent = false) {
    if (!silent) setLoading(true);
    setLoadError(null);
    return apiClient
      .get("/attendance/org/site-visits")
      .then((res) => {
        setRows(res.data || []);
        setLastUpdated(new Date());
      })
      .catch((err) => {
        setLoadError(err.message || "Could not load live tracking data.");
      })
      .finally(() => setLoading(false));
  }

  useImperativeHandle(ref, () => ({
    refresh: () => load(),
  }));

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // On top of the POLL_MS safety-net poll above, refetch immediately the
  // moment anyone checks in/out or starts/ends a break — same
  // /ws/dashboard feed the dashboards use — so a new arrival/departure
  // shows up right away instead of waiting up to POLL_MS.
  useAttendanceLiveUpdates(() => load(true));

  const onSiteCount = rows.filter((r) => r.live_status === "on_site").length;
  const outOfRangeCount = rows.filter(
    (r) => r.live_status === "on_site" && r.is_outside_radius,
  ).length;

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const isOn = r.live_status === "on_site";
      const isOut = isOn && r.is_outside_radius;
      if (statusFilter === "on_site" && !isOn) return false;
      if (statusFilter === "out" && !isOut) return false;
      if (statusFilter === "other" && isOn) return false;
      if (!q) return true;
      return [
        r.employee?.full_name,
        r.employee?.departments?.department_name,
        r.current_site?.location_name,
      ].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [rows, query, statusFilter]);

  // ======================= WEB layout (lg and up) =======================
  // Stat cards (click to filter) + search, then staff list on the left and
  // a live map of everyone's position on the right. Mobile/tablet keep the
  // original layout below, unchanged.
  if (isDesktop) {
    const statCards = [
      {
        key: "all",
        label: "Field staff",
        value: rows.length,
        icon: <Users size={18} />,
        tone: "bg-slate-100 text-slate-600",
      },
      {
        key: "on_site",
        label: "On site now",
        value: onSiteCount,
        icon: <MapPin size={18} />,
        tone: "bg-green-50 text-green-600",
      },
      {
        key: "out",
        label: "Out of range",
        value: outOfRangeCount,
        icon: <AlertTriangle size={18} />,
        tone: "bg-orange-50 text-orange-600",
      },
      {
        key: "other",
        label: "Not on a site",
        value: rows.length - onSiteCount,
        icon: <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />,
        tone: "bg-slate-100 text-slate-500",
      },
    ];
    const withLocation = filteredRows.filter(
      (r) =>
        typeof r.current_latitude === "number" &&
        typeof r.current_longitude === "number",
    ).length;

    return (
      <div>
        <div className="grid grid-cols-4 gap-3 mb-3">
          {statCards.map((c) => {
            const active = statusFilter === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setStatusFilter(active ? "all" : c.key)}
                className={`text-left rounded-xl border bg-white px-4 py-3 flex items-center gap-3 transition-all hover:shadow-sm ${
                  active
                    ? "border-orange-400 ring-2 ring-orange-100"
                    : "border-slate-200"
                }`}
              >
                <span
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${c.tone}`}
                >
                  {c.icon}
                </span>
                <span>
                  <span className="block text-2xl font-bold leading-none text-slate-800">
                    {c.value}
                  </span>
                  <span className="block text-xs text-slate-500 mt-1">
                    {c.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="relative w-80">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, department or site..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
            />
          </div>
          {lastUpdated && (
            <span className="flex items-center gap-2 text-xs text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              Live · updated {lastUpdated.toLocaleTimeString()} · refreshes
              every 30s
            </span>
          )}
        </div>

        {loadError && (
          <div className="flex items-center gap-2 text-orange-600 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 text-sm mb-3">
            <AlertTriangle size={16} />
            {loadError}
          </div>
        )}

        {loading && !rows.length ? (
          <div className="bg-white border border-slate-200 rounded-xl flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
            <Loader2 size={16} className="animate-spin" />
            Loading live tracking...
          </div>
        ) : !rows.length ? (
          <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-sm text-slate-400">
            No one has visited a site today yet.
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(340px,420px)_minmax(0,1fr)] gap-3 items-start">
            {/* ---- Left: staff list ---- */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="max-h-[620px] overflow-y-auto divide-y divide-slate-100">
                {filteredRows.length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-slate-400">
                    No staff match.
                  </div>
                ) : (
                  filteredRows.map((row) => {
                    const meta =
                      STATUS_META[row.live_status] ||
                      STATUS_META.not_checked_in;
                    const focused = focusId === row.employee_id;
                    return (
                      <div
                        key={row.employee_id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setFocusId(row.employee_id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setFocusId(row.employee_id);
                        }}
                        className={`px-4 py-3 cursor-pointer border-l-4 transition-colors ${
                          focused
                            ? "border-orange-500 bg-orange-50/60"
                            : "border-transparent hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {row.employee?.profile_photo ? (
                            <img
                              src={row.employee.profile_photo}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-semibold shrink-0">
                              {initials(row.employee?.full_name)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-medium text-slate-800 truncate">
                                  {row.employee?.full_name || "—"}
                                </div>
                                <div className="text-xs text-slate-400 truncate">
                                  {row.employee?.departments?.department_name ||
                                    ""}
                                </div>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium shrink-0 ${meta.badge}`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}
                                />
                                {meta.label}
                              </span>
                            </div>
                            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600">
                              <MapPin
                                size={12}
                                className="text-slate-400 shrink-0"
                              />
                              <span className="truncate">
                                {row.current_site?.location_name ||
                                  "No site yet"}
                              </span>
                              {row.current_site_since && (
                                <span className="text-slate-400 shrink-0">
                                  · since {timeOnly(row.current_site_since)}
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                              <PresenceText row={row} />
                              <span className="flex items-center gap-3 shrink-0">
                                <span className="text-slate-400">
                                  {row.sites_visited_today} site
                                  {row.sites_visited_today === 1 ? "" : "s"}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelected(row);
                                  }}
                                  className="text-orange-600 hover:text-orange-700 font-medium inline-flex items-center gap-1"
                                >
                                  View Trail
                                </button>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ---- Right: live map ---- */}
            <div className="isolate sticky top-4 h-[620px] rounded-xl overflow-hidden border border-slate-200 bg-white">
              <LiveOverviewMap
                rows={filteredRows}
                focusId={focusId}
                fitKey={`${statusFilter}|${query}`}
                onSelect={setFocusId}
              />
              <div className="absolute top-3 left-3 z-[400] rounded-lg bg-white/95 shadow px-2.5 py-1 text-xs text-slate-600">
                {withLocation} of {filteredRows.length} with a live location
              </div>
              <div className="absolute bottom-3 left-3 z-[400] rounded-lg bg-white/95 shadow px-3 py-2 text-xs text-slate-600 flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-600" />
                  On site
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  Out of range
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  Other
                </span>
              </div>
            </div>
          </div>
        )}

        {selected && (
          <TrailMapModal row={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Desktop only — mobile gets an icon-only Refresh docked at the
          right end of the Today/History tab row (see LiveTracking below). */}
      <div className="hidden sm:flex justify-end mb-3">
        <button
          onClick={() => load()}
          className="px-3 py-2 sm:px-3.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* MOBILE (below sm): compact tiles, same size as the Departments page.
          sm and up keep the original summary strip below. */}
      <div className="sm:hidden mb-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              icon: Users,
              label: "Field staff",
              value: rows.length,
              tone: "bg-slate-100 text-slate-600",
            },
            {
              icon: MapPin,
              label: "On site",
              value: onSiteCount,
              tone: "bg-green-50 text-green-600",
            },
            {
              icon: AlertTriangle,
              label: "Out of range",
              value: outOfRangeCount,
              tone: "bg-orange-50 text-orange-600",
            },
          ].map(({ icon: Icon, label, value, tone }) => (
            <div
              key={label}
              className="bg-white rounded-lg border border-slate-200 px-2.5 py-2 flex items-center gap-2.5 min-w-0"
            >
              <div
                className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${tone}`}
              >
                <Icon size={14} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-500 truncate leading-tight">
                  {label}
                </div>
                <div className="text-base font-bold text-slate-800 leading-tight">
                  {value}
                </div>
              </div>
            </div>
          ))}
        </div>
        {lastUpdated && (
          <div className="mt-1.5 text-[11px] text-slate-400">
            Updated {lastUpdated.toLocaleTimeString()} · refreshes every 30s
          </div>
        )}
      </div>

      <div className="hidden sm:flex bg-white border border-slate-200 rounded-xl p-3 mb-3 sm:flex-row sm:items-center sm:justify-between gap-1.5 text-sm">
        <div className="flex items-center gap-2 text-slate-600 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <span className="font-medium">{onSiteCount}</span> on site right now ·{" "}
          <span className="font-medium">{rows.length}</span> field employees
          total
          {outOfRangeCount > 0 && (
            <span className="flex items-center gap-1 text-orange-600 font-medium">
              <AlertTriangle size={13} />
              {outOfRangeCount} out of range
            </span>
          )}
        </div>
        {lastUpdated && (
          <span className="text-xs text-slate-400">
            Updated {lastUpdated.toLocaleTimeString()} · refreshes every 30s
          </span>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loadError && (
          <div className="flex items-center gap-2 text-orange-600 bg-orange-50 border-b border-orange-100 px-4 py-3 text-sm">
            <AlertTriangle size={16} />
            {loadError}
          </div>
        )}

        {loading && !rows.length ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
            <Loader2 size={16} className="animate-spin" />
            Loading live tracking...
          </div>
        ) : !rows.length ? (
          <div className="py-16 text-center text-sm text-slate-400">
            No one has visited a site today yet.
          </div>
        ) : (
          <>
            {/* ---- Mobile card list (below sm) ---- */}
            <div className="sm:hidden max-h-[560px] overflow-y-auto divide-y divide-slate-50">
              {rows.map((row) => {
                const meta =
                  STATUS_META[row.live_status] || STATUS_META.not_checked_in;
                return (
                  <button
                    key={row.employee_id}
                    type="button"
                    onClick={() => setSelected(row)}
                    className="w-full text-left px-4 py-3 active:bg-slate-50"
                  >
                    <div className="flex items-start gap-3">
                      {row.employee?.profile_photo ? (
                        <img
                          src={row.employee.profile_photo}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-semibold shrink-0">
                          {initials(row.employee?.full_name)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-slate-700 truncate">
                              {row.employee?.full_name || "—"}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              {row.employee?.departments?.department_name || ""}
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium shrink-0 ${meta.badge}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}
                            />
                            {meta.label}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
                          <div className="truncate">
                            <span className="text-slate-400">Site: </span>
                            {row.current_site?.location_name || "—"}
                          </div>
                          <div className="truncate">
                            <span className="text-slate-400">Since: </span>
                            {timeOnly(row.current_site_since)}
                          </div>
                          <div className="truncate col-span-2">
                            <span className="text-slate-400">Presence: </span>
                            {row.live_status !== "on_site" ? (
                              "—"
                            ) : row.is_outside_radius ? (
                              <span className="text-orange-600 font-medium inline-flex items-center gap-1">
                                <AlertTriangle size={11} /> Out of range
                                {row.last_ping_at &&
                                  ` · ${timeAgo(row.last_ping_at)}`}
                              </span>
                            ) : row.last_ping_at ? (
                              `In range · ${timeAgo(row.last_ping_at)}`
                            ) : (
                              "No live ping yet"
                            )}
                          </div>
                          <div className="truncate col-span-2">
                            <span className="text-slate-400">
                              Sites visited today:{" "}
                            </span>
                            {row.sites_visited_today}
                          </div>
                        </div>

                        <div className="mt-2 text-orange-600 text-xs font-medium inline-flex items-center gap-1">
                          <MapPin size={13} />
                          View Trail
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ---- Desktop table (sm and up) ---- */}
            <div className="hidden sm:block max-h-[560px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Current Site</th>
                    <th className="px-4 py-3 font-medium">Since</th>
                    <th className="px-4 py-3 font-medium">Presence</th>
                    <th className="px-4 py-3 font-medium">
                      Sites Visited Today
                    </th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const meta =
                      STATUS_META[row.live_status] ||
                      STATUS_META.not_checked_in;
                    return (
                      <tr
                        key={row.employee_id}
                        className="border-b border-slate-50 hover:bg-slate-50/60"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {row.employee?.profile_photo ? (
                              <img
                                src={row.employee.profile_photo}
                                alt=""
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-semibold">
                                {initials(row.employee?.full_name)}
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-slate-700">
                                {row.employee?.full_name || "—"}
                              </div>
                              <div className="text-xs text-slate-400">
                                {row.employee?.departments?.department_name ||
                                  ""}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${meta.badge}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}
                            />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.current_site?.location_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {timeOnly(row.current_site_since)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {row.live_status !== "on_site" ? (
                            <span className="text-slate-300">—</span>
                          ) : row.is_outside_radius ? (
                            <span
                              className="inline-flex items-center gap-1 text-orange-600 font-medium"
                              title={
                                row.last_ping_distance_m
                                  ? `${Math.round(row.last_ping_distance_m)}m from site`
                                  : undefined
                              }
                            >
                              <AlertTriangle size={12} /> Out of range
                              {row.last_ping_at && (
                                <span className="text-slate-400 font-normal">
                                  · {timeAgo(row.last_ping_at)}
                                </span>
                              )}
                            </span>
                          ) : row.last_ping_at ? (
                            <span className="text-slate-500">
                              In range · {timeAgo(row.last_ping_at)}
                            </span>
                          ) : (
                            <span className="text-slate-300">
                              No live ping yet
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.sites_visited_today}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelected(row)}
                            className="text-orange-600 hover:text-orange-700 text-xs font-medium inline-flex items-center gap-1"
                          >
                            <MapPin size={13} />
                            View Trail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {selected && (
        <TrailMapModal row={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
});

// ==========================================================================
// HISTORY TAB — past site visits, one row per employee/day
// (GET /attendance/org/site-visits/history), separate from today's list.
// ==========================================================================

function dateOnly(d) {
  return d.toISOString().slice(0, 10);
}

function formatDay(iso) {
  if (!iso) return "—";
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function HistoryTab() {
  const today = useMemo(() => new Date(), []);
  const defaultTo = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return dateOnly(d);
  }, [today]);
  const defaultFrom = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    return dateOnly(d);
  }, [today]);

  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState(null);

  function load() {
    setLoading(true);
    setLoadError(null);
    const params = new URLSearchParams();
    if (fromDate) params.set("from_date", fromDate);
    if (toDate) params.set("to_date", toDate);
    return apiClient
      .get(`/attendance/org/site-visits/history?${params.toString()}`)
      .then((res) => {
        setRows(res.data || []);
      })
      .catch((err) => {
        setLoadError(err.message || "Could not load site visit history.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-3 flex flex-wrap items-end gap-3 text-sm">
        {/* Same shared calendar component the Attendance/Reports screens
            use (components/layout/DatePicker.jsx) instead of a bare
            native <input type="date"> -- the native control's popup is
            positioned/sized by the OS, which on mobile can render
            oddly clipped or floating away from the field. `overlay`
            fixes the popover to the viewport (computed off the
            trigger's own position) so it always opens right below the
            field and never gets clipped by this card or the page
            scroll, matching the "Month" picker on Reports.jsx. */}
        <DatePicker
          label="From"
          overlay
          value={fromDate}
          max={toDate}
          onChange={(iso) => setFromDate(iso)}
          className="flex-1 min-w-0 sm:flex-none sm:w-auto"
        />
        <DatePicker
          label="To"
          overlay
          value={toDate}
          min={fromDate}
          max={defaultTo}
          onChange={(iso) => setToDate(iso)}
          className="flex-1 min-w-0 sm:flex-none sm:w-auto"
        />
        {/* Mobile: Refresh sits at the right end of the From/To line (the
            dates stretch to fill), and the hint text drops to its own row
            below. sm and up: same flow as before — unchanged. */}
        <button
          onClick={() => load()}
          className="h-10 w-10 justify-center sm:h-auto sm:w-auto sm:px-3.5 sm:py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Apply / Refresh</span>
        </button>
        <div className="text-xs text-slate-400 order-last w-full sm:w-auto sm:order-none sm:ml-auto">
          <span className="sm:hidden">Showing past visits only.</span>
          <span className="hidden sm:inline">
            Showing past visits only — today's activity is on the "Today" tab.
          </span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loadError && (
          <div className="flex items-center gap-2 text-orange-600 bg-orange-50 border-b border-orange-100 px-4 py-3 text-sm">
            <AlertTriangle size={16} />
            {loadError}
          </div>
        )}

        {loading && !rows.length ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
            <Loader2 size={16} className="animate-spin" />
            Loading history...
          </div>
        ) : !rows.length ? (
          <div className="py-16 text-center text-sm text-slate-400">
            No site visits recorded in this date range.
          </div>
        ) : (
          <>
            {/* ---- Mobile card list (below sm) ---- */}
            <div className="sm:hidden max-h-[560px] overflow-y-auto divide-y divide-slate-50">
              {rows.map((row, idx) => (
                <button
                  key={`${row.employee_id}-${row.attendance_date}-${idx}`}
                  type="button"
                  onClick={() => setSelected(row)}
                  className="w-full text-left px-4 py-3 active:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    {row.employee?.profile_photo ? (
                      <img
                        src={row.employee.profile_photo}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-semibold shrink-0">
                        {initials(row.employee?.full_name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-700 truncate">
                        {row.employee?.full_name || "—"}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {row.employee?.departments?.department_name || ""}
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
                        <div className="truncate">
                          <span className="text-slate-400">Date: </span>
                          {formatDay(row.attendance_date)}
                        </div>
                        <div className="truncate">
                          <span className="text-slate-400">Sites: </span>
                          {row.site_count}
                        </div>
                        <div className="truncate col-span-2">
                          <span className="text-slate-400">Time on site: </span>
                          {row.total_minutes
                            ? `${Math.floor(row.total_minutes / 60)}h ${row.total_minutes % 60}m`
                            : "—"}
                        </div>
                      </div>

                      <div className="mt-2 text-orange-600 text-xs font-medium inline-flex items-center gap-1">
                        <MapPin size={13} />
                        View Trail
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* ---- Desktop table (sm and up) ---- */}
            <div className="hidden sm:block max-h-[560px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Sites Visited</th>
                    <th className="px-4 py-3 font-medium">Time on Site</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr
                      key={`${row.employee_id}-${row.attendance_date}-${idx}`}
                      className="border-b border-slate-50 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {row.employee?.profile_photo ? (
                            <img
                              src={row.employee.profile_photo}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-semibold">
                              {initials(row.employee?.full_name)}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-slate-700">
                              {row.employee?.full_name || "—"}
                            </div>
                            <div className="text-xs text-slate-400">
                              {row.employee?.departments?.department_name || ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDay(row.attendance_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.site_count}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {row.total_minutes
                          ? `${Math.floor(row.total_minutes / 60)}h ${row.total_minutes % 60}m`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelected(row)}
                          className="text-orange-600 hover:text-orange-700 text-xs font-medium inline-flex items-center gap-1"
                        >
                          <MapPin size={13} />
                          View Trail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {selected && (
        <TrailMapModal
          row={{
            employee: selected.employee,
            live_status: "checked_out",
            trail: selected.visits,
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// ==========================================================================
// Top-level page — Today / History tabs
// ==========================================================================

export default function LiveTracking() {
  const [tab, setTab] = useState("today");
  const todayRef = useRef(null);
  const [mobileRefreshing, setMobileRefreshing] = useState(false);

  async function handleMobileRefresh() {
    setMobileRefreshing(true);
    try {
      await todayRef.current?.refresh();
    } finally {
      setMobileRefreshing(false);
    }
  }

  return (
    <div>
      {/* WEB (lg and up): title on the left, Today/History switch at the
          right end of the same line. Mobile keeps its original header +
          underline tabs below, unchanged. */}
      <div className="hidden lg:flex items-center justify-between gap-3 mb-6">
        <h1 className="min-w-0 text-2xl font-bold text-slate-800">
          Live Site Tracking
        </h1>
        <div className="flex shrink-0 items-center gap-3">
          {tab === "today" && (
            <button
              type="button"
              onClick={handleMobileRefresh}
              className="h-10 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium flex items-center gap-1.5"
            >
              <RefreshCw
                size={14}
                className={mobileRefreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
          )}
          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            {[
              { key: "today", label: "Today" },
              { key: "history", label: "History" },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  tab === t.key
                    ? "bg-white text-orange-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <PageHeader title="Live Site Tracking" />
      </div>

      <div className="lg:hidden flex items-center justify-between gap-2 mb-4 border-b border-slate-200">
        <div className="flex items-center gap-1">
          {[
            { key: "today", label: "Today" },
            { key: "history", label: "History" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Mobile only — icon-only Refresh docked at the right end of the
            Today/History tab row. The Today tab's own standalone Refresh
            button (desktop-only, see TodayTab) is hidden below sm so this
            is the only Refresh control on mobile. */}
        {tab === "today" && (
          <button
            type="button"
            onClick={handleMobileRefresh}
            aria-label="Refresh"
            className="sm:hidden shrink-0 mb-1.5 w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 active:bg-slate-50"
          >
            <RefreshCw
              size={14}
              className={mobileRefreshing ? "animate-spin" : ""}
            />
          </button>
        )}
      </div>

      {tab === "today" ? <TodayTab ref={todayRef} /> : <HistoryTab />}
    </div>
  );
}
