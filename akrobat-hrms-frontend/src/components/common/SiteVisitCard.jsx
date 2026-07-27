// import {
//   AlertTriangle,
//   Building2,
//   Clock,
//   LogIn,
//   LogOut,
//   MapPin,
//   Route,
// } from "lucide-react";
// import { useEffect, useState } from "react";
// import { apiClient } from "../../services/apiClient";
// import { unwrap } from "../../utils/unwrap";

// // ---------------------------------------------------------------------
// // For staff who visit several sites in one working day (Inspection
// // Planners, Construction Workers doing site inspections, etc.) — the
// // day's total working hours / late / overtime still come from the
// // normal Check In / Check Out card above this one; this is the
// // breakdown of *where inside that day* the time went, backed by
// // app/attendance/services.py's arrive_at_site / depart_site (new
// // `attendance_site_visits` table — see
// // sql/014_designation_shifts_and_site_visits.sql).
// //
// // Flow: tap "Arrived" when you get to a site. If you were still logged
// // in at a previous site, that one is auto-closed (arriving somewhere
// // new implies leaving the last place) — so visiting 3 sites in a day is
// // just "Arrived" x3, no separate "Departed" in between needed. Tap
// // "Departed" explicitly for the last site of the day, or just Check Out
// // for the day and it closes automatically as a safety net.
// // ---------------------------------------------------------------------

// function formatTime(iso) {
//   if (!iso) return "--:--";
//   return new Date(iso).toLocaleTimeString([], {
//     hour: "2-digit",
//     minute: "2-digit",
//   });
// }

// function formatDuration(minutes) {
//   if (minutes == null) return "in progress";
//   const total = Math.max(0, Math.round(minutes));
//   const h = Math.floor(total / 60);
//   const m = total % 60;
//   if (h === 0) return `${m}m`;
//   if (m === 0) return `${h}h`;
//   return `${h}h ${m}m`;
// }

// export default function SiteVisitCard({
//   checkedIn,
//   checkedOut,
//   onActivityChange,
// } = {}) {
//   const [locations, setLocations] = useState([]);
//   const [selectedLocation, setSelectedLocation] = useState("");
//   const [summary, setSummary] = useState(null); // { visits, site_count, total_minutes_by_site, estimated_travel_minutes }
//   const [loading, setLoading] = useState(true);
//   const [busy, setBusy] = useState(false);
//   const [error, setError] = useState(null);
//   const [coords, setCoords] = useState(null);

//   function load() {
//     setLoading(true);
//     apiClient
//       .get("/attendance/site-visit/today")
//       .then((res) => setSummary(res?.data ?? null))
//       .catch((err) => setError(err.message))
//       .finally(() => setLoading(false));
//   }

//   useEffect(() => {
//     load();

//     apiClient
//       .get("/locations/")
//       .then((res) => setLocations(unwrap(res) || []))
//       .catch(() => setLocations([]));

//     if (navigator.geolocation) {
//       navigator.geolocation.getCurrentPosition(
//         (pos) =>
//           setCoords({
//             latitude: pos.coords.latitude,
//             longitude: pos.coords.longitude,
//           }),
//         () => setCoords(null),
//         { enableHighAccuracy: true, timeout: 10000 },
//       );
//     }
//   }, []);

//   // Reload whenever the day's check-in state changes elsewhere (e.g. the
//   // employee just checked out for the day, which auto-closes any open visit).
//   useEffect(() => {
//     load();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [checkedIn, checkedOut]);

//   async function arrive() {
//     if (!selectedLocation) {
//       setError("Pick a site before logging your arrival.");
//       return;
//     }
//     setBusy(true);
//     setError(null);
//     try {
//       await apiClient.post("/attendance/site-visit/arrive", {
//         location_id: selectedLocation,
//         latitude: coords?.latitude,
//         longitude: coords?.longitude,
//       });
//       load();
//       onActivityChange?.();
//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setBusy(false);
//     }
//   }

//   async function depart() {
//     setBusy(true);
//     setError(null);
//     try {
//       await apiClient.post("/attendance/site-visit/depart", {
//         latitude: coords?.latitude,
//         longitude: coords?.longitude,
//       });
//       load();
//       onActivityChange?.();
//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setBusy(false);
//     }
//   }

//   const visits = summary?.visits || [];
//   const openVisit = visits.find((v) => !v.departure_time);
//   const totalsBySite = summary?.total_minutes_by_site || {};

//   if (!checkedIn || checkedOut) {
//     // Only relevant during the working day — before check-in there's
//     // nothing to log yet, and after check-out the day's visits are
//     // already closed (see the safety-net close in check_out()).
//     return null;
//   }

//   return (
//     <div className="bg-white rounded-xl border border-slate-200 p-5">
//       <div className="flex items-center justify-between mb-4">
//         <h3 className="flex items-center gap-2 font-semibold text-slate-800">
//           <Route size={16} className="text-orange-500" /> Site Visits Today
//         </h3>
//         {openVisit && (
//           <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
//             <MapPin size={12} /> On site
//           </span>
//         )}
//       </div>

//       <p className="text-xs text-slate-400 mb-3">
//         Visiting more than one site today? Log each arrival — moving to a new
//         site automatically closes the time on the last one.
//       </p>

//       {loading ? (
//         <div className="h-20 bg-slate-100 rounded animate-pulse" />
//       ) : (
//         <>
//           {error && (
//             <div className="mb-3 text-xs text-orange-500 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
//               {error}
//             </div>
//           )}

//           <div className="flex gap-2 mb-4">
//             <select
//               className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
//               value={selectedLocation}
//               onChange={(e) => setSelectedLocation(e.target.value)}
//             >
//               <option value="">Select site…</option>
//               {locations.map((loc) => (
//                 <option key={loc.id} value={loc.id}>
//                   {loc.location_name}
//                 </option>
//               ))}
//             </select>
//             <button
//               onClick={arrive}
//               disabled={busy || !selectedLocation}
//               className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium px-3.5 py-2 rounded-lg whitespace-nowrap"
//             >
//               <LogIn size={14} /> Arrived
//             </button>
//             {openVisit && (
//               <button
//                 onClick={depart}
//                 disabled={busy}
//                 className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-medium px-3.5 py-2 rounded-lg whitespace-nowrap"
//               >
//                 <LogOut size={14} /> Departed
//               </button>
//             )}
//           </div>

//           {visits.length === 0 && (
//             <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-3">
//               <AlertTriangle size={13} /> No site logged yet today.
//             </div>
//           )}

//           {visits.length > 0 && (
//             <div className="space-y-2 mb-3">
//               {visits.map((v) => (
//                 <div
//                   key={v.id}
//                   className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2.5"
//                 >
//                   <div className="flex items-center gap-2 min-w-0">
//                     <Building2 size={13} className="text-slate-400 shrink-0" />
//                     <div className="min-w-0">
//                       <div className="font-medium text-slate-700 truncate">
//                         {v.locations?.location_name || "Unknown site"}
//                       </div>
//                       <div className="text-slate-400">
//                         {formatTime(v.arrival_time)} –{" "}
//                         {v.departure_time
//                           ? formatTime(v.departure_time)
//                           : "now"}
//                       </div>
//                     </div>
//                   </div>
//                   <div className="flex items-center gap-1 text-slate-600 font-medium shrink-0">
//                     <Clock size={12} />
//                     {formatDuration(v.duration_minutes)}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}

//           {Object.keys(totalsBySite).length > 0 && (
//             <div className="pt-3 border-t border-slate-100">
//               <div className="text-[10px] font-medium text-slate-400 mb-2">
//                 TOTAL TIME PER SITE TODAY
//               </div>
//               <div className="space-y-1.5">
//                 {Object.entries(totalsBySite).map(([name, minutes]) => (
//                   <div
//                     key={name}
//                     className="flex items-center justify-between text-xs"
//                   >
//                     <span className="text-slate-600">{name}</span>
//                     <span className="font-medium text-slate-800">
//                       {formatDuration(minutes)}
//                     </span>
//                   </div>
//                 ))}
//                 {summary?.estimated_travel_minutes > 0 && (
//                   <div className="flex items-center justify-between text-xs pt-1.5 mt-1.5 border-t border-slate-100">
//                     <span className="text-slate-400">
//                       Estimated travel between sites
//                     </span>
//                     <span className="font-medium text-slate-500">
//                       {formatDuration(summary.estimated_travel_minutes)}
//                     </span>
//                   </div>
//                 )}
//               </div>
//             </div>
//           )}
//         </>
//       )}
//     </div>
//   );
// }
import {
  AlertTriangle,
  Building2,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  Route,
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiClient } from "../../services/apiClient";
import { unwrap } from "../../utils/unwrap";

// ---------------------------------------------------------------------
// For staff who visit several sites in one working day (Inspection
// Planners, Construction Workers doing site inspections, etc.) — the
// day's total working hours / late / overtime still come from the
// normal Check In / Check Out card above this one; this is the
// breakdown of *where inside that day* the time went, backed by
// app/attendance/services.py's arrive_at_site / depart_site (new
// `attendance_site_visits` table — see
// sql/014_designation_shifts_and_site_visits.sql).
//
// Flow: tap "Arrived" when you get to a site. If you were still logged
// in at a previous site, that one is auto-closed (arriving somewhere
// new implies leaving the last place) — so visiting 3 sites in a day is
// just "Arrived" x3, no separate "Departed" in between needed. Tap
// "Departed" explicitly for the last site of the day, or just Check Out
// for the day and it closes automatically as a safety net.
// ---------------------------------------------------------------------

function formatTime(iso) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(minutes) {
  if (minutes == null) return "in progress";
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// "23m so far" for a visit still open, "1h 20m" for one that's closed.
// The backend now returns `live_minutes` on any open visit (see
// _effective_visit_minutes in app/attendance/services.py) so we don't
// recompute clock math client-side — just label it correctly instead
// of always showing a static "in progress" with no number.
function formatVisitDuration(v) {
  const inProgress = !v.departure_time;
  const minutes = inProgress ? v.live_minutes : v.duration_minutes;
  return inProgress
    ? `${formatDuration(minutes)} so far`
    : formatDuration(minutes);
}

export default function SiteVisitCard({
  checkedIn,
  checkedOut,
  onActivityChange,
} = {}) {
  // Manager-assigned sites (see app/site_assignments) — the "Arrived"
  // list is ALWAYS restricted to just these, matching the
  // _enforce_assigned_site guard on POST /attendance/site-visit/arrive,
  // which now rejects the call outright when nothing is assigned. We no
  // longer fall back to every company location when assignedSites is
  // empty — that fallback was the bug: a brand-new Inspection/Operation
  // employee with zero assignments was shown (and could "arrive" at)
  // every site in the company. assignedSitesLoaded just avoids showing
  // the "no sites assigned" empty state for a flash before the request
  // even returns.
  const [assignedSites, setAssignedSites] = useState([]);
  const [assignedSitesLoaded, setAssignedSitesLoaded] = useState(false);
  const siteOptions = assignedSitesLoaded ? assignedSites : [];
  const [summary, setSummary] = useState(null); // { visits, site_count, total_minutes_by_site, estimated_travel_minutes }
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [coords, setCoords] = useState(null);

  // Auto-dismiss any error banner (e.g. "You are 491m from awfis, outside
  // the allowed 100m radius.") after 3s, so it doesn't sit on screen
  // forever — the person can just retry (move closer / re-detect / pick a
  // different site) without having to manually clear the message first.
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(id);
  }, [error]);

  function load() {
    setLoading(true);
    apiClient
      .get("/attendance/site-visit/today")
      .then((res) => setSummary(res?.data ?? null))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();

    apiClient
      .get("/site-assignments/my")
      .then((res) =>
        setAssignedSites(
          (unwrap(res) || []).map((a) => a.locations).filter(Boolean),
        ),
      )
      .catch(() => setAssignedSites([]))
      .finally(() => setAssignedSitesLoaded(true));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        () => setCoords(null),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }
  }, []);

  // Reload whenever the day's check-in state changes elsewhere (e.g. the
  // employee just checked out for the day, which auto-closes any open visit).
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedIn, checkedOut]);

  // While there's an open site visit, the "so far" duration and the
  // per-site total are only true "as of the last load" — refresh every
  // 60s so they keep ticking without the person having to reload the
  // whole page to see it move off "0m".
  const hasOpenVisit = (summary?.visits || []).some((v) => !v.departure_time);
  useEffect(() => {
    if (!hasOpenVisit) return;
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOpenVisit]);

  async function arrive(locationId) {
    if (!locationId) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post("/attendance/site-visit/arrive", {
        location_id: locationId,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });
      load();
      onActivityChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function depart() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post("/attendance/site-visit/depart", {
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });
      load();
      onActivityChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const visits = summary?.visits || [];
  const openVisit = visits.find((v) => !v.departure_time);
  const totalsBySite = summary?.total_minutes_by_site || {};

  if (!checkedIn || checkedOut) {
    // Only relevant during the working day — before check-in there's
    // nothing to log yet, and after check-out the day's visits are
    // already closed (see the safety-net close in check_out()).
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 h-[420px] flex flex-col">
      {/* Hides the scrollbar visually while keeping the panel scrollable —
          mirrors the .no-scrollbar helper used on the dashboard pages. */}
      <style>{`
        .site-visit-no-scrollbar::-webkit-scrollbar { display: none; }
        .site-visit-no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 font-semibold text-slate-800">
          <Route size={16} className="text-orange-500" /> Site Visits Today
        </h3>
        {openVisit && (
          <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
            <MapPin size={12} /> On site
          </span>
        )}
      </div>

      <p className="text-xs text-slate-400 mb-3">
        Visiting more than one site today? Log each arrival — moving to a new
        site automatically closes the time on the last one.
      </p>

      {assignedSites.length > 0 && (
        <p className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2 mb-3">
          Only showing sites your manager assigned you to.
        </p>
      )}

      {loading ? (
        <div className="h-20 bg-slate-100 rounded animate-pulse" />
      ) : (
        <div className="site-visit-no-scrollbar overflow-y-auto flex-1 pr-0.5">
          {error && (
            <div className="mb-3 text-xs text-orange-500 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {siteOptions.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-3 mb-4">
              <AlertTriangle size={13} /> No sites assigned yet — ask your
              manager to assign you a site.
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {siteOptions.map((site) => {
                const isOpenHere = openVisit?.location_id === site.id;
                const lastAtSite = [...visits]
                  .reverse()
                  .find((v) => v.location_id === site.id);

                return (
                  <div
                    key={site.id}
                    className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 border ${
                      isOpenHere
                        ? "bg-blue-50/60 border-blue-100"
                        : "bg-slate-50 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2
                        size={13}
                        className="text-slate-400 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-700 truncate">
                          {site.location_name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {isOpenHere
                            ? `${formatTime(openVisit.arrival_time)} – now · ${formatVisitDuration(openVisit)}`
                            : lastAtSite
                              ? `Last visit ${formatTime(lastAtSite.arrival_time)}–${formatTime(lastAtSite.departure_time)} · ${formatVisitDuration(lastAtSite)}`
                              : "Not visited yet today"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => arrive(site.id)}
                        disabled={busy || isOpenHere}
                        className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                      >
                        <LogIn size={12} /> Arrived
                      </button>
                      <button
                        onClick={depart}
                        disabled={busy || !isOpenHere}
                        className="flex items-center gap-1 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                      >
                        <LogOut size={12} /> Departed
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {visits.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-3">
              <AlertTriangle size={13} /> No site logged yet today.
            </div>
          )}

          {visits.length > 0 && (
            <div className="space-y-2 mb-3">
              {visits.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 size={13} className="text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-700 truncate">
                        {v.locations?.location_name || "Unknown site"}
                      </div>
                      <div className="text-slate-400">
                        {formatTime(v.arrival_time)} –{" "}
                        {v.departure_time
                          ? formatTime(v.departure_time)
                          : "now"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-slate-600 font-medium shrink-0">
                    <Clock size={12} />
                    {formatVisitDuration(v)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {Object.keys(totalsBySite).length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <div className="text-[10px] font-medium text-slate-400 mb-2">
                TOTAL TIME PER SITE TODAY
              </div>
              <div className="space-y-1.5">
                {Object.entries(totalsBySite).map(([name, minutes]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-600">{name}</span>
                    <span className="font-medium text-slate-800">
                      {formatDuration(minutes)}
                    </span>
                  </div>
                ))}
                {summary?.estimated_travel_minutes > 0 && (
                  <div className="flex items-center justify-between text-xs pt-1.5 mt-1.5 border-t border-slate-100">
                    <span className="text-slate-400">
                      Estimated travel between sites
                    </span>
                    <span className="font-medium text-slate-500">
                      {formatDuration(summary.estimated_travel_minutes)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
