import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import { AlertTriangle, Loader2, MapPin, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import { apiClient } from "../../services/apiClient";
import { parseServerDate } from "../../utils/date";

// ---------------------------------------------------------------------
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {row.employee?.full_name || "Employee"} — Today's Trail
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
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
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto">
          <div
            ref={mapElRef}
            className="w-full h-[380px] rounded-xl border border-slate-200"
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
                  className={`w-full flex items-center justify-between text-sm rounded-lg px-3 py-2 border text-left transition-colors ${
                    activeVisitId === visit.id
                      ? "bg-orange-50 border-orange-200"
                      : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2 text-slate-700">
                    <MapPin size={14} className="text-orange-500" />
                    <span className="font-medium">
                      {visit.locations?.location_name || "Unknown Site"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
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

function TodayTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

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

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const onSiteCount = rows.filter((r) => r.live_status === "on_site").length;
  const outOfRangeCount = rows.filter(
    (r) => r.live_status === "on_site" && r.is_outside_radius,
  ).length;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => load()}
          className="px-3 py-2 sm:px-3.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-sm">
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
}

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
        <div>
          <label className="block text-xs text-slate-500 mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 w-[140px] sm:w-auto"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">To</label>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            max={defaultTo}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 w-[140px] sm:w-auto"
          />
        </div>
        <button
          onClick={() => load()}
          className="px-3 py-2 sm:px-3.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Apply / Refresh
        </button>
        <div className="w-full sm:w-auto sm:ml-auto text-xs text-slate-400">
          Showing past visits only — today's activity is on the "Today" tab.
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

  return (
    <div>
      <PageHeader
        title="Live Site Tracking"
        subtitle="Field staff (Inspection/Operation) who've visited a site — today, live, or their past history."
      />

      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
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

      {tab === "today" ? <TodayTab /> : <HistoryTab />}
    </div>
  );
}
