// import {
//   AlertTriangle,
//   Building2,
//   Clock3,
//   LogIn,
//   LogOut,
//   MapPin,
//   Megaphone,
//   ShieldCheck,
//   UserCheck,
//   Users,
// } from "lucide-react";
// import { useEffect, useState } from "react";
// import { Link } from "react-router-dom";
// import AttendanceTrendChart from "../../components/common/AttendanceTrendChart";
// import BirthdaysCard, {
//   OnLeaveTodayCard,
// } from "../../components/common/CelebrationsStrip";
// import CheckInOutCard from "../../components/common/CheckInOutCard";

// import PageHeader from "../../components/common/PageHeader";
// import QuoteOfDayCard from "../../components/common/Quoteofdaycard ";
// import StatCard from "../../components/common/StatCard";
// import TopPerformersCard from "../../components/common/TopPerformanceCard";
// import { apiClient } from "../../services/apiClient";
// import { parseServerDate } from "../../utils/date";
// import { geocodeQueue, placeKey } from "../../utils/Geocode";

// // -----------------------------------------------------------------------
// // A note on scope: the reference mockup (Server Status / Storage Usage /
// // Backup Status / License Usage) is a generic admin-panel template — this
// // codebase has no storage, backup, or license-management feature, so
// // those cards would just be fake numbers. Everything below instead comes
// // from real endpoints: GET /dashboard (company-wide counts — the same
// // data Super Admin's dashboard uses), GET /audit-logs (recent activity),
// // and GET /announcements/active. "System health"-style panels can be
// // added for real once there's an actual metric backing them.
// // -----------------------------------------------------------------------

// // Mirrors distanceMeters/nearestLocationName in CheckInOutCard.jsx — used
// // here to turn raw check-in lat/long from audit logs into a real location
// // name instead of showing coordinates in Recent Activity.
// function distanceMeters(lat1, lon1, lat2, lon2) {
//   const R = 6371000;
//   const toRad = (d) => (d * Math.PI) / 180;
//   const dLat = toRad(lat2 - lat1);
//   const dLon = toRad(lon2 - lon1);
//   const a =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
//   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// }

// function resolveLocationName(lat, lon, locations) {
//   if (lat == null || lon == null || !locations || locations.length === 0) {
//     return null;
//   }
//   let best = null;
//   for (const loc of locations) {
//     if (loc.latitude == null || loc.longitude == null) continue;
//     const d = distanceMeters(lat, lon, loc.latitude, loc.longitude);
//     if (!best || d < best.distance) best = { loc, distance: d };
//   }
//   return best ? best.loc.location_name : null;
// }

// // "Xh Ym" for a minutes count — mirrors formatDuration in CheckInOutCard.jsx,
// // used to make check-out audit messages ("Checked out — 91 min worked...")
// // read as "Checked out — 1h 31m worked..." in Recent Activity.
// function formatMinutes(totalMinutes) {
//   const total = Math.max(0, Math.round(totalMinutes));
//   const h = Math.floor(total / 60);
//   const m = total % 60;
//   if (h === 0) return `${m}m`;
//   if (m === 0) return `${h}h`;
//   return `${h}h ${m}m`;
// }

// // audit_logs.description is a stringified JSON blob for system-generated
// // entries (e.g. ATTENDANCE · CHECK_IN) but a plain string for others
// // (e.g. AUTH · LOGIN: "Login: someone@akrobat.com"). This turns either
// // shape into { name, action, time, lat, lon, kind } for display.
// function parseLogEntry(log, locations = []) {
//   const employeeName = log.employees?.full_name || null;

//   let details = null;
//   if (typeof log.description === "string") {
//     try {
//       details = JSON.parse(log.description);
//     } catch {
//       details = null;
//     }
//   } else if (log.description && typeof log.description === "object") {
//     details = log.description;
//   }

//   const changes = details?.changes || {};

//   // Every field in `changes` comes from record_audit_log's diff (see
//   // app/core/audit.py -> _diff), which stores {old, new} pairs, not the
//   // raw value. Unwrap to .new here so downstream code (formatTime,
//   // placeKey's lat.toFixed, etc.) always gets a plain string/number
//   // instead of an object — that mismatch was the "lat.toFixed is not a
//   // function" crash that took down the whole Recent Activity panel.
//   function diffValue(v) {
//     if (v && typeof v === "object" && "new" in v) return v.new;
//     return v;
//   }

//   const name =
//     employeeName ||
//     diffValue(changes.employee_id) ||
//     details?.target_employee_id ||
//     "System";

//   let action =
//     details?.message ||
//     (typeof log.description === "string" ? log.description : null) ||
//     `${log.module} · ${log.action}`;

//   // Backend writes several messages as a raw "N min <word>" — "Checked out
//   // — 91 min worked", "Checked in — 87 min late", "Departed site — 105 min
//   // on site". Swap every such count for "1h 31m" etc. so Recent Activity
//   // never shows a bare minute count, however the sentence around it reads.
//   // (The backend now writes these pre-formatted for entries logged after
//   // the fix — this regex is what makes older rows, already saved with the
//   // raw "N min" text, display correctly too, without needing a data
//   // migration.)
//   action = action.replace(/(\d+)\s*min\b/gi, (_, n) =>
//     formatMinutes(Number(n)),
//   );

//   // Backend used to write raw location UUIDs into "Arrived at site
//   // <uuid>" (fixed to use the name going forward — see arrive_at_site in
//   // app/attendance/services.py) — but older rows still have the UUID
//   // baked into the description. Swap it for the matching site's name
//   // here so those old rows read correctly too. `locations` may not be
//   // loaded yet on first render; in that case the UUID is left as-is
//   // rather than silently dropped.
//   const uuidMatch = action.match(/^Arrived at site ([0-9a-f-]{36})$/i);
//   if (uuidMatch) {
//     const site = locations.find((loc) => loc.id === uuidMatch[1]);
//     if (site) action = `Arrived at site ${site.location_name}`;
//   }

//   const time =
//     diffValue(changes.check_in_time) ||
//     diffValue(changes.check_out_time) ||
//     log.created_at ||
//     null;

//   const rawLat =
//     diffValue(changes.check_in_latitude) ??
//     diffValue(changes.check_out_latitude) ??
//     null;
//   const rawLon =
//     diffValue(changes.check_in_longitude) ??
//     diffValue(changes.check_out_longitude) ??
//     null;

//   // Coerce to real numbers — Supabase/Postgres numeric columns can come
//   // back as strings, and placeKey/distanceMeters below need actual
//   // numbers (lat.toFixed etc.), not strings or leftover diff objects.
//   const lat = rawLat != null && rawLat !== "" ? Number(rawLat) : null;
//   const lon = rawLon != null && rawLon !== "" ? Number(rawLon) : null;

//   // What kind of entry this is, purely for choosing an icon/color.
//   let kind = "other";
//   const actionUpper = (log.action || "").toUpperCase();
//   if (actionUpper.includes("CHECK_IN")) kind = "checkin";
//   else if (actionUpper.includes("CHECK_OUT")) kind = "checkout";
//   else if (actionUpper.includes("LOGIN")) kind = "login";
//   else if (actionUpper.includes("LOGOUT")) kind = "logout";

//   return { name, action, time, lat, lon, kind };
// }

// function formatTime(value) {
//   if (!value) return "";
//   const d = parseServerDate(value);
//   if (!d || Number.isNaN(d.getTime())) return "";
//   return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
// }

// // Colored-circle icon per activity type: check-in = light green,
// // check-out = dark blue, login = blue, logout = orange.
// function LogIcon({ kind }) {
//   const map = {
//     checkin: { Icon: LogIn, bg: "bg-blue-100", fg: "text-blue-500" },
//     checkout: { Icon: LogOut, bg: "bg-[#0B1830]/10", fg: "text-[#0B1830]" },
//     login: { Icon: LogIn, bg: "bg-blue-100", fg: "text-blue-500" },
//     logout: { Icon: LogOut, bg: "bg-orange-100", fg: "text-orange-500" },
//     other: { Icon: ShieldCheck, bg: "bg-slate-100", fg: "text-slate-400" },
//   };
//   const { Icon, bg, fg } = map[kind] || map.other;
//   return (
//     <div
//       className={`w-8 h-8 rounded-full ${bg} ${fg} flex items-center justify-center shrink-0`}
//     >
//       <Icon size={14} />
//     </div>
//   );
// }

// // Quick Actions, shown as a row of small circular icon buttons next to the
// // "System Dashboard" title (top-right of the page header) instead of the
// // old full-width card at the bottom of the page.

// function QuickActionCircle({ to, label, icon: Icon }) {
//   return (
//     <Link
//       to={to}
//       title={label}
//       aria-label={label}
//       className="group relative w-9 h-9 rounded-full bg-orange-50 hover:bg-orange-500 text-orange-500 hover:text-white flex items-center justify-center transition-colors shrink-0"
//     >
//       <Icon size={16} />
//       {/* Tooltip on hover */}
//       <span className="pointer-events-none absolute top-full mt-2 whitespace-nowrap rounded-md bg-slate-800 text-white text-[11px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
//         {label}
//       </span>
//     </Link>
//   );
// }

// // Reverse-geocoding for Recent Activity now comes from the shared
// // utils/Geocode.jsx helper (imported above) instead of a local,
// // Nominatim-only copy. For Singapore coordinates that helper calls our
// // backend's OneMap proxy first (see app/locations/routes.py ->
// // GET /locations/reverse-geocode), which returns the exact building
// // name, block number, road name, and postal code instead of Nominatim's
// // coarser neighbourhood-level result (e.g. "Kampong Ubi, Singapore").
// // Non-Singapore coordinates fall back to Nominatim automatically, same
// // as before — no behavior change outside Singapore.

// export default function HrAdminDashboard() {
//   const [stats, setStats] = useState(null);
//   const [statsLoading, setStatsLoading] = useState(true);

//   const [logs, setLogs] = useState([]);
//   const [logsLoading, setLogsLoading] = useState(true);
//   const [logsError, setLogsError] = useState(null);

//   const [announcements, setAnnouncements] = useState([]);

//   const [trend, setTrend] = useState(null);
//   const [trendLoading, setTrendLoading] = useState(true);
//   // "today" -> days=1, "week" -> days=7, "month" -> days=30 — all within
//   // the backend's allowed range (Query(..., ge=1, le=30), see
//   // app/dashboard/routes.py).
//   const [trendRange, setTrendRange] = useState("week");

//   const [deptDistribution, setDeptDistribution] = useState([]);
//   const [deptLoading, setDeptLoading] = useState(true);

//   const [locations, setLocations] = useState([]);

//   // Reverse-geocoded "City, State, Country" per unique check-in/out
//   // coordinate in Recent Activity, keyed by placeKey(lat, lon) — see
//   // reverseGeocode() above. Populated lazily once logs load.
//   const [placeCache, setPlaceCache] = useState({});

//   // Pulled out of the mount effect so it can also be called right after a
//   // check-in/out/break action (via CheckInOutCard's onActivityChange) —
//   // otherwise Recent Activity only ever reflected whatever was on the page
//   // at initial load, so a fresh check-out wouldn't show up until a full
//   // page refresh.
//   function loadLogs() {
//     setLogsLoading(true);
//     setLogsError(null);
//     // Bumped from 6 -> 25: the panel is a fixed-height scroll area (see
//     // the JSX below), so it can hold far more than 6 rows — 6 barely
//     // filled it. "View Audit Logs" still covers everything beyond this.
//     return apiClient
//       .get("/audit-logs/?page=1&limit=25")
//       .then((res) => {
//         const records = res.data?.records || [];
//         setLogs(records);

//         // Geocode every unique coordinate pair in this batch, once, rather
//         // than per-render — throttled to Nominatim's 1 req/sec limit.
//         const uniqueCoords = new Map();
//         for (const log of records) {
//           const entry = parseLogEntry(log, locations);
//           if (entry.lat == null || entry.lon == null) continue;
//           const key = placeKey(entry.lat, entry.lon);
//           if (!key || uniqueCoords.has(key)) continue;
//           uniqueCoords.set(key, { key, lat: entry.lat, lon: entry.lon });
//         }
//         geocodeQueue(Array.from(uniqueCoords.values()), (key, label) => {
//           setPlaceCache((prev) => ({ ...prev, [key]: label }));
//         });
//       })
//       .catch((err) => {
//         // Previously this just set logs to [] — which looks IDENTICAL to
//         // "there's genuinely no activity yet" in the UI, so a real 401 /
//         // permission / network failure was invisible. Now the panel shows
//         // the actual reason instead of a misleading empty state.
//         setLogs([]);
//         setLogsError(err.message || "Could not load recent activity.");
//       })
//       .finally(() => setLogsLoading(false));
//   }

//   useEffect(() => {
//     // GET /dashboard is the one endpoint in this backend that returns its
//     // model directly (no {success, data} envelope) — see app/dashboard/routes.py.
//     apiClient
//       .get("/dashboard/")
//       .then(setStats)
//       .catch(() => setStats(null))
//       .finally(() => setStatsLoading(false));

//     loadLogs();

//     apiClient
//       .get("/announcements/active")
//       .then((res) => setAnnouncements(res.data || []))
//       .catch(() => setAnnouncements([]));

//     apiClient
//       .get("/dashboard/department-distribution")
//       .then((res) => setDeptDistribution(res.departments || []))
//       .catch(() => setDeptDistribution([]))
//       .finally(() => setDeptLoading(false));

//     // Needed to turn raw check-in coordinates in Recent Activity into a
//     // location name instead of showing lat/long numbers.
//     apiClient
//       .get("/locations/")
//       .then((res) => setLocations(res.data || []))
//       .catch(() => setLocations([]));
//   }, []);

//   // Separate effect (rather than folded into the mount effect above) so
//   // toggling the Week/Month control on the Attendance Trend chart just
//   // refetches this one endpoint instead of everything on the page.
//   useEffect(() => {
//     setTrendLoading(true);
//     const days = trendRange === "month" ? 30 : trendRange === "today" ? 1 : 7;
//     apiClient
//       .get(`/dashboard/attendance-trend?days=${days}`)
//       .then((res) => setTrend(res))
//       .catch(() => setTrend(null))
//       .finally(() => setTrendLoading(false));
//   }, [trendRange]);

//   return (
//     <div className="overflow-x-hidden">
//       {/* Hides the scrollbar visually on the horizontal stat-card row and
//           the recent-activity panel, while keeping them scrollable. */}
//       <style>{`
//         .no-scrollbar::-webkit-scrollbar { display: none; }
//         .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
//       `}</style>

//       <PageHeader
//         title="System Dashboard"
//         subtitle="Overview of your system and activity"
//         actions={
//           <div className="flex items-center gap-3">
//             <QuoteOfDayCard compact />
//           </div>
//         }
//       />

//       {/* ---------- Top row: stat cards (full width) ---------- */}
//       <div className="flex gap-4 mb-6 items-stretch">
//         <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1 w-full">
//           <div className="min-w-[170px] w-[170px] shrink-0">
//             <StatCard
//               icon={Users}
//               label="Total Employees"
//               color="orange"
//               loading={statsLoading}
//               value={stats?.total_employees ?? "—"}
//             />
//           </div>
//           <div className="min-w-[170px] w-[170px] shrink-0">
//             <StatCard
//               icon={UserCheck}
//               label="Present Today"
//               color="green"
//               loading={statsLoading}
//               value={stats?.present_today ?? "—"}
//             />
//           </div>

//           <div className="min-w-[170px] w-[170px] shrink-0">
//             <StatCard
//               icon={AlertTriangle}
//               label="Late Today"
//               color="purple"
//               loading={statsLoading}
//               value={stats?.late_today ?? "—"}
//             />
//           </div>
//           <div className="min-w-[170px] w-[170px] shrink-0">
//             <StatCard
//               icon={Building2}
//               label="Departments"
//               color="slate"
//               loading={statsLoading}
//               value={stats?.total_departments ?? "—"}
//             />
//           </div>
//           <div className="min-w-[170px] w-[170px] shrink-0">
//             <StatCard
//               icon={MapPin}
//               label="Locations"
//               color="slate"
//               loading={statsLoading}
//               value={stats?.total_locations ?? "—"}
//             />
//           </div>
//           <div className="min-w-[170px] w-[170px] shrink-0">
//             <StatCard
//               icon={Clock3}
//               label="Shifts"
//               color="slate"
//               loading={statsLoading}
//               value={stats?.total_shifts ?? "—"}
//             />
//           </div>
//         </div>
//       </div>

//       {/* ---------- Two-column body ----------
//           Left:  Check-in/out -> Recent Activity -> Attendance Trend (+ Dept
//                  Distribution, same "chart" grouping)
//           Right: On Leave Today -> Announcements -> Upcoming Birthdays ->
//                  Top Performance
//       ---------------------------------------------------------------- */}
//       <div className="grid grid-cols-1 lg:grid-cols-[65%_1fr] gap-6 items-start min-w-0">
//         {/* ================= Left column (65%) ================= */}
//         <div className="flex flex-col gap-6 min-w-0">
//           {/* ---------- Check-in/out (HR Admin is a person too) ---------- */}
//           <CheckInOutCard onActivityChange={loadLogs} />

//           {/* ---------- Recent audit activity: fixed height, hidden scrollbar ---------- */}
//           <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col h-[360px]">
//             <div className="flex items-center justify-between mb-3">
//               <h3 className="font-semibold text-slate-800 flex items-center gap-2">
//                 <ShieldCheck size={17} className="text-orange-500" /> Recent
//                 Activity
//               </h3>
//               {/* No "View Audit Logs" link here — that page lives under
//                   /super-admin/security/audit-logs and hr-admin has no
//                   equivalent route (see routes/hrAdminRoutes.jsx), so
//                   linking there would 404 for HR Admins. */}
//             </div>

//             {logsLoading ? (
//               <div className="space-y-2">
//                 {[1, 2, 3].map((i) => (
//                   <div
//                     key={i}
//                     className="h-10 bg-slate-100 rounded animate-pulse"
//                   />
//                 ))}
//               </div>
//             ) : logsError ? (
//               <div className="text-sm text-orange-500">
//                 Couldn't load recent activity: {logsError}
//               </div>
//             ) : logs.length === 0 ? (
//               <p className="text-sm text-slate-400">No recent activity.</p>
//             ) : (
//               <ul className="divide-y divide-slate-100 overflow-y-auto no-scrollbar flex-1">
//                 {logs.map((log) => {
//                   const entry = parseLogEntry(log, locations);
//                   // Prefer the reverse-geocoded "City, State, Country"
//                   // (matches what Today's Attendance shows); fall back to
//                   // the matched company office name if geocoding hasn't
//                   // resolved yet.
//                   const geocoded =
//                     entry.lat != null && entry.lon != null
//                       ? placeCache[placeKey(entry.lat, entry.lon)]
//                       : null;
//                   const matchedOffice = resolveLocationName(
//                     entry.lat,
//                     entry.lon,
//                     locations,
//                   );
//                   // Priority: reverse-geocoded "City, State, Country" ->
//                   // matched company office name -> raw coordinates (so a
//                   // check-in from outside every registered office, or one
//                   // whose geocode hasn't resolved yet, still shows
//                   // *something* instead of the location silently vanishing.
//                   const locationName =
//                     geocoded ||
//                     matchedOffice ||
//                     (entry.lat != null && entry.lon != null
//                       ? `${entry.lat.toFixed(4)}, ${entry.lon.toFixed(4)}`
//                       : null);
//                   return (
//                     <li key={log.id} className="py-2 flex items-start gap-2.5">
//                       <LogIcon kind={entry.kind} />
//                       <div className="min-w-0 flex-1 flex items-start justify-between gap-3">
//                         <div className="min-w-0">
//                           <p className="text-sm font-medium text-slate-800 truncate">
//                             {entry.name}
//                           </p>
//                           <p className="text-xs text-slate-500 truncate">
//                             {entry.action}
//                           </p>
//                           {locationName && (
//                             <p className="text-[11px] text-slate-400 flex items-center gap-0.5 truncate">
//                               <MapPin size={9} className="shrink-0" />{" "}
//                               {locationName}
//                             </p>
//                           )}
//                         </div>
//                         {entry.time && (
//                           <span className="text-xs text-slate-400 whitespace-nowrap">
//                             {formatTime(entry.time)}
//                           </span>
//                         )}
//                       </div>
//                     </li>
//                   );
//                 })}
//               </ul>
//             )}
//           </div>

//           {/* ---------- Attendance Trend chart ---------- */}
//           <AttendanceTrendChart
//             trend={trend}
//             loading={trendLoading}
//             range={trendRange}
//             onRangeChange={setTrendRange}
//           />

//           {/* ---------- Department Distribution chart ---------- */}
//           {/* <DepartmentDistributionChart
//             departments={deptDistribution}
//             loading={deptLoading}
//           /> */}
//         </div>

//         {/* ================= Right column (35%) =================
//             Fixed height + its own vertical scroll, so this column never
//             grows taller than the viewport / left column — it scrolls
//             independently instead of pushing the page down. */}
//         <div className="flex flex-col gap-6 min-w-0 lg:h-[calc(100vh-6rem)] lg:sticky lg:top-4 lg:overflow-y-auto lg:pr-1 no-scrollbar">
//           {/* ---------- On Leave Today ---------- */}
//           <div className="h-72">
//             <OnLeaveTodayCard />
//           </div>

//           {/* ---------- Announcements ---------- */}
//           <div className="bg-white rounded-xl border border-slate-200 p-5 h-72 flex flex-col">
//             <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-3">
//               <Megaphone size={17} className="text-orange-500" /> Announcements
//             </h3>
//             {announcements.length === 0 ? (
//               <p className="text-sm text-slate-400">No active announcements.</p>
//             ) : (
//               <div className="space-y-2 overflow-y-auto no-scrollbar flex-1">
//                 {announcements.slice(0, 3).map((a) => (
//                   <div
//                     key={a.id}
//                     className="bg-orange-50 border border-orange-100 rounded-lg p-2.5"
//                   >
//                     <p className="text-sm font-medium text-slate-800 truncate">
//                       {a.title}
//                     </p>
//                     <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
//                       {a.description}
//                     </p>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>

//           {/* ---------- Upcoming Birthdays ---------- */}
//           <div className="h-72">
//             <BirthdaysCard />
//           </div>

//           {/* ---------- Top Performance ---------- */}
//           <div className="h-72">
//             <TopPerformersCard />
//           </div>
//         </div>
//       </div>

//       {/* ---------- Floating round "Add Employee" button ---------- */}
//       {/* <Link
//         to="/hr-admin/employees/add"
//         title="Add Employee"
//         className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg flex items-center justify-center transition-colors z-50"
//       >
//         <Plus size={24} />
//       </Link> */}
//     </div>
//   );
// }
import {
  AlertTriangle,
  Building2,
  Clock3,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Megaphone,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AttendanceTrendChart from "../../components/common/AttendanceTrendChart";
import BirthdaysCard, {
  OnLeaveTodayCard,
} from "../../components/common/CelebrationsStrip";
import CheckInOutCard from "../../components/common/CheckInOutCard";

import PageHeader from "../../components/common/PageHeader";
import QuoteOfDayCard from "../../components/common/Quoteofdaycard ";
import StatCard from "../../components/common/StatCard";
import TopPerformersCard from "../../components/common/TopPerformanceCard";
import UserFormModal from "../../components/common/UserformModal ";
import { useAttendanceLiveUpdates } from "../../hooks/Useattendanceliveupdates ";
import { apiClient } from "../../services/apiClient";
import { parseServerDate } from "../../utils/date";
import { geocodeQueue, placeKey } from "../../utils/Geocode";
import { LocationFormModal } from "../shared/OrganizationLocations";

// -----------------------------------------------------------------------
// A note on scope: the reference mockup (Server Status / Storage Usage /
// Backup Status / License Usage) is a generic admin-panel template — this
// codebase has no storage, backup, or license-management feature, so
// those cards would just be fake numbers. Everything below instead comes
// from real endpoints: GET /dashboard (company-wide counts — the same
// data Super Admin's dashboard uses), GET /audit-logs (recent activity),
// and GET /announcements/active. "System health"-style panels can be
// added for real once there's an actual metric backing them.
// -----------------------------------------------------------------------

// Mirrors distanceMeters/nearestLocationName in CheckInOutCard.jsx — used
// here to turn raw check-in lat/long from audit logs into a real location
// name instead of showing coordinates in Recent Activity.
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function resolveLocationName(lat, lon, locations) {
  if (lat == null || lon == null || !locations || locations.length === 0) {
    return null;
  }
  let best = null;
  for (const loc of locations) {
    if (loc.latitude == null || loc.longitude == null) continue;
    const d = distanceMeters(lat, lon, loc.latitude, loc.longitude);
    if (!best || d < best.distance) best = { loc, distance: d };
  }
  return best ? best.loc.location_name : null;
}

// "Xh Ym" for a minutes count — mirrors formatDuration in CheckInOutCard.jsx,
// used to make check-out audit messages ("Checked out — 91 min worked...")
// read as "Checked out — 1h 31m worked..." in Recent Activity.
function formatMinutes(totalMinutes) {
  const total = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// audit_logs.description is a stringified JSON blob for system-generated
// entries (e.g. ATTENDANCE · CHECK_IN) but a plain string for others
// (e.g. AUTH · LOGIN: "Login: someone@akrobat.com"). This turns either
// shape into { name, action, time, lat, lon, kind } for display.
function parseLogEntry(log, locations = []) {
  const employeeName = log.employees?.full_name || null;

  let details = null;
  if (typeof log.description === "string") {
    try {
      details = JSON.parse(log.description);
    } catch {
      details = null;
    }
  } else if (log.description && typeof log.description === "object") {
    details = log.description;
  }

  const changes = details?.changes || {};

  // Every field in `changes` comes from record_audit_log's diff (see
  // app/core/audit.py -> _diff), which stores {old, new} pairs, not the
  // raw value. Unwrap to .new here so downstream code (formatTime,
  // placeKey's lat.toFixed, etc.) always gets a plain string/number
  // instead of an object — that mismatch was the "lat.toFixed is not a
  // function" crash that took down the whole Recent Activity panel.
  function diffValue(v) {
    if (v && typeof v === "object" && "new" in v) return v.new;
    return v;
  }

  const name =
    employeeName ||
    diffValue(changes.employee_id) ||
    details?.target_employee_id ||
    "System";

  let action =
    details?.message ||
    (typeof log.description === "string" ? log.description : null) ||
    `${log.module} · ${log.action}`;

  // Backend writes several messages as a raw "N min <word>" — "Checked out
  // — 91 min worked", "Checked in — 87 min late", "Departed site — 105 min
  // on site". Swap every such count for "1h 31m" etc. so Recent Activity
  // never shows a bare minute count, however the sentence around it reads.
  // (The backend now writes these pre-formatted for entries logged after
  // the fix — this regex is what makes older rows, already saved with the
  // raw "N min" text, display correctly too, without needing a data
  // migration.)
  action = action.replace(/(\d+)\s*min\b/gi, (_, n) =>
    formatMinutes(Number(n)),
  );

  // Backend used to write raw location UUIDs into "Arrived at site
  // <uuid>" (fixed to use the name going forward — see arrive_at_site in
  // app/attendance/services.py) — but older rows still have the UUID
  // baked into the description. Swap it for the matching site's name
  // here so those old rows read correctly too. `locations` may not be
  // loaded yet on first render; in that case the UUID is left as-is
  // rather than silently dropped.
  const uuidMatch = action.match(/^Arrived at site ([0-9a-f-]{36})$/i);
  if (uuidMatch) {
    const site = locations.find((loc) => loc.id === uuidMatch[1]);
    if (site) action = `Arrived at site ${site.location_name}`;
  }

  const time =
    diffValue(changes.check_in_time) ||
    diffValue(changes.check_out_time) ||
    log.created_at ||
    null;

  const rawLat =
    diffValue(changes.check_in_latitude) ??
    diffValue(changes.check_out_latitude) ??
    null;
  const rawLon =
    diffValue(changes.check_in_longitude) ??
    diffValue(changes.check_out_longitude) ??
    null;

  // Coerce to real numbers — Supabase/Postgres numeric columns can come
  // back as strings, and placeKey/distanceMeters below need actual
  // numbers (lat.toFixed etc.), not strings or leftover diff objects.
  const lat = rawLat != null && rawLat !== "" ? Number(rawLat) : null;
  const lon = rawLon != null && rawLon !== "" ? Number(rawLon) : null;

  // What kind of entry this is, purely for choosing an icon/color.
  let kind = "other";
  const actionUpper = (log.action || "").toUpperCase();
  if (actionUpper.includes("CHECK_IN")) kind = "checkin";
  else if (actionUpper.includes("CHECK_OUT")) kind = "checkout";
  else if (actionUpper.includes("LOGIN")) kind = "login";
  else if (actionUpper.includes("LOGOUT")) kind = "logout";

  return { name, action, time, lat, lon, kind };
}

function formatTime(value) {
  if (!value) return "";
  const d = parseServerDate(value);
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

// Colored-circle icon per activity type: check-in = light green,
// check-out = dark blue, login = blue, logout = orange.
function LogIcon({ kind }) {
  const map = {
    checkin: { Icon: LogIn, bg: "bg-blue-100", fg: "text-blue-500" },
    checkout: { Icon: LogOut, bg: "bg-[#0B1830]/10", fg: "text-[#0B1830]" },
    login: { Icon: LogIn, bg: "bg-blue-100", fg: "text-blue-500" },
    logout: { Icon: LogOut, bg: "bg-orange-100", fg: "text-orange-500" },
    other: { Icon: ShieldCheck, bg: "bg-slate-100", fg: "text-slate-400" },
  };
  const { Icon, bg, fg } = map[kind] || map.other;
  return (
    <div
      className={`w-8 h-8 rounded-full ${bg} ${fg} flex items-center justify-center shrink-0`}
    >
      <Icon size={14} />
    </div>
  );
}

// Quick Actions, shown as a row of small circular icon buttons next to the
// "System Dashboard" title (top-right of the page header) instead of the
// old full-width card at the bottom of the page.

function QuickActionCircle({ to, label, icon: Icon }) {
  return (
    <Link
      to={to}
      title={label}
      aria-label={label}
      className="group relative w-9 h-9 rounded-full bg-orange-50 hover:bg-orange-500 text-orange-500 hover:text-white flex items-center justify-center transition-colors shrink-0"
    >
      <Icon size={16} />
      {/* Tooltip on hover */}
      <span className="pointer-events-none absolute top-full mt-2 whitespace-nowrap rounded-md bg-slate-800 text-white text-[11px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {label}
      </span>
    </Link>
  );
}

// Reverse-geocoding for Recent Activity now comes from the shared
// utils/Geocode.jsx helper (imported above) instead of a local,
// Nominatim-only copy. For Singapore coordinates that helper calls our
// backend's OneMap proxy first (see app/locations/routes.py ->
// GET /locations/reverse-geocode), which returns the exact building
// name, block number, road name, and postal code instead of Nominatim's
// coarser neighbourhood-level result (e.g. "Kampong Ubi, Singapore").
// Non-Singapore coordinates fall back to Nominatim automatically, same
// as before — no behavior change outside Singapore.

export default function HrAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState(null);

  const [announcements, setAnnouncements] = useState([]);

  const [trend, setTrend] = useState(null);
  const [trendLoading, setTrendLoading] = useState(true);
  // "today" -> days=1, "week" -> days=7, "month" -> days=30 — all within
  // the backend's allowed range (Query(..., ge=1, le=30), see
  // app/dashboard/routes.py).
  const [trendRange, setTrendRange] = useState("week");

  const [deptDistribution, setDeptDistribution] = useState([]);
  const [deptLoading, setDeptLoading] = useState(true);

  const [locations, setLocations] = useState([]);

  // Reverse-geocoded "City, State, Country" per unique check-in/out
  // coordinate in Recent Activity, keyed by placeKey(lat, lon) — see
  // reverseGeocode() above. Populated lazily once logs load.
  const [placeCache, setPlaceCache] = useState({});

  // "Create User" quick action (top-right, before the Quote of the Day
  // card) opens UserFormModal in place instead of navigating to
  // /hr-admin/users. The modal needs the same reference data Users.jsx
  // loads (departments/designations/shifts/roles + the full user list,
  // for the "Reporting Manager" dropdown) — fetched lazily on first
  // open rather than on every dashboard visit, since most visits never
  // touch this action.
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addUserRefData, setAddUserRefData] = useState(null);
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState(null);

  function openAddUser() {
    setAddUserOpen(true);
    if (addUserRefData || addUserLoading) return; // already loaded/loading
    setAddUserLoading(true);
    setAddUserError(null);
    Promise.all([
      apiClient.get("/departments/").catch(() => []),
      apiClient.get("/designations/").catch(() => []),
      apiClient.get("/shifts/").catch(() => []),
      apiClient.get("/roles/").catch(() => ({ data: [] })),
    ])
      .then(([departmentsRes, designationsRes, shiftsRes, rolesRes]) => {
        const roles = rolesRes?.data || [];
        // Same technique Users.jsx uses to build the full account list:
        // there's no single "every user, every role" endpoint, so fetch
        // /employees/?role_id=<id> once per role and union the results —
        // only needed here for the "Reporting Manager" dropdown.
        return Promise.all(
          roles.map((role) =>
            apiClient
              .get(`/employees/?role_id=${role.id}`)
              .then((res) =>
                (res.data || []).map((emp) => ({
                  ...emp,
                  role_id: role.id,
                  role_name: role.role_name,
                })),
              )
              .catch(() => []),
          ),
        ).then((perRole) => {
          setAddUserRefData({
            departments: departmentsRes || [],
            designations: designationsRes || [],
            shifts: shiftsRes || [],
            roles,
            users: perRole.flat(),
          });
        });
      })
      .catch((err) => {
        setAddUserError(err.message || "Could not load form data.");
      })
      .finally(() => setAddUserLoading(false));
  }

  // "Create Site" quick action opens the exact same LocationFormModal
  // used on the Organization Locations page (see
  // pages/shared/OrganizationLocations.jsx) — no reference data to
  // preload, so this can just toggle straight open.
  const [addSiteOpen, setAddSiteOpen] = useState(false);

  // Pulled out of the mount effect so it can also be called right after a
  // check-in/out/break action (via CheckInOutCard's onActivityChange) —
  // otherwise Recent Activity only ever reflected whatever was on the page
  // at initial load, so a fresh check-out wouldn't show up until a full
  // page refresh.
  function loadLogs() {
    setLogsLoading(true);
    setLogsError(null);
    // Bumped from 6 -> 25: the panel is a fixed-height scroll area (see
    // the JSX below), so it can hold far more than 6 rows — 6 barely
    // filled it. "View Audit Logs" still covers everything beyond this.
    return apiClient
      .get("/audit-logs/?page=1&limit=25")
      .then((res) => {
        const records = res.data?.records || [];
        setLogs(records);

        // Geocode every unique coordinate pair in this batch, once, rather
        // than per-render — throttled to Nominatim's 1 req/sec limit.
        const uniqueCoords = new Map();
        for (const log of records) {
          const entry = parseLogEntry(log, locations);
          if (entry.lat == null || entry.lon == null) continue;
          const key = placeKey(entry.lat, entry.lon);
          if (!key || uniqueCoords.has(key)) continue;
          uniqueCoords.set(key, { key, lat: entry.lat, lon: entry.lon });
        }
        geocodeQueue(Array.from(uniqueCoords.values()), (key, label) => {
          setPlaceCache((prev) => ({ ...prev, [key]: label }));
        });
      })
      .catch((err) => {
        // Previously this just set logs to [] — which looks IDENTICAL to
        // "there's genuinely no activity yet" in the UI, so a real 401 /
        // permission / network failure was invisible. Now the panel shows
        // the actual reason instead of a misleading empty state.
        setLogs([]);
        setLogsError(err.message || "Could not load recent activity.");
      })
      .finally(() => setLogsLoading(false));
  }

  // Also pulled to component scope (see loadLogs above) so
  // useAttendanceLiveUpdates can refetch it on a push event too.
  function loadStats() {
    // GET /dashboard is the one endpoint in this backend that returns its
    // model directly (no {success, data} envelope) — see app/dashboard/routes.py.
    apiClient
      .get("/dashboard/")
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }

  // Refetches stats + Recent Activity the instant any employee checks
  // in/out or starts/ends a break, anywhere in the company — not just
  // from this admin's own actions.
  useAttendanceLiveUpdates(() => {
    loadStats();
    loadLogs();
  });

  useEffect(() => {
    loadStats();
    loadLogs();

    apiClient
      .get("/announcements/active")
      .then((res) => setAnnouncements(res.data || []))
      .catch(() => setAnnouncements([]));

    apiClient
      .get("/dashboard/department-distribution")
      .then((res) => setDeptDistribution(res.departments || []))
      .catch(() => setDeptDistribution([]))
      .finally(() => setDeptLoading(false));

    // Needed to turn raw check-in coordinates in Recent Activity into a
    // location name instead of showing lat/long numbers.
    apiClient
      .get("/locations/")
      .then((res) => setLocations(res.data || []))
      .catch(() => setLocations([]));
  }, []);

  // Separate effect (rather than folded into the mount effect above) so
  // toggling the Week/Month control on the Attendance Trend chart just
  // refetches this one endpoint instead of everything on the page.
  useEffect(() => {
    setTrendLoading(true);
    const days = trendRange === "month" ? 30 : trendRange === "today" ? 1 : 7;
    apiClient
      .get(`/dashboard/attendance-trend?days=${days}`)
      .then((res) => setTrend(res))
      .catch(() => setTrend(null))
      .finally(() => setTrendLoading(false));
  }, [trendRange]);

  return (
    <div className="overflow-x-hidden">
      {/* Hides the scrollbar visually on the horizontal stat-card row and
          the recent-activity panel, while keeping them scrollable. */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <PageHeader
        title="System Dashboard"
        subtitle="Overview of your system and activity"
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openAddUser}
              title="Create User"
              aria-label="Create User"
              className="group relative w-9 h-9 rounded-full bg-orange-50 hover:bg-orange-500 text-orange-500 hover:text-white flex items-center justify-center transition-colors shrink-0"
            >
              <UserPlus size={16} />
              <span className="pointer-events-none absolute top-full mt-2 whitespace-nowrap rounded-md bg-slate-800 text-white text-[11px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                Create User
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAddSiteOpen(true)}
              title="Create Site"
              aria-label="Create Site"
              className="group relative w-9 h-9 rounded-full bg-orange-50 hover:bg-orange-500 text-orange-500 hover:text-white flex items-center justify-center transition-colors shrink-0"
            >
              <Building2 size={16} />
              <span className="pointer-events-none absolute top-full mt-2 whitespace-nowrap rounded-md bg-slate-800 text-white text-[11px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                Create Site
              </span>
            </button>
            <QuoteOfDayCard compact />
          </div>
        }
      />

      {/* ---------- Top row: stat cards (full width) ---------- */}
      <div className="flex gap-4 mb-6 items-stretch">
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1 w-full">
          <div className="min-w-[170px] w-[170px] shrink-0">
            <StatCard
              icon={Users}
              label="Total Employees"
              color="orange"
              loading={statsLoading}
              value={stats?.total_employees ?? "—"}
            />
          </div>
          <div className="min-w-[170px] w-[170px] shrink-0">
            <StatCard
              icon={UserCheck}
              label="Present Today"
              color="green"
              loading={statsLoading}
              value={stats?.present_today ?? "—"}
            />
          </div>

          <div className="min-w-[170px] w-[170px] shrink-0">
            <StatCard
              icon={AlertTriangle}
              label="Late Today"
              color="purple"
              loading={statsLoading}
              value={stats?.late_today ?? "—"}
            />
          </div>
          <div className="min-w-[170px] w-[170px] shrink-0">
            <StatCard
              icon={Building2}
              label="Departments"
              color="slate"
              loading={statsLoading}
              value={stats?.total_departments ?? "—"}
            />
          </div>
          <div className="min-w-[170px] w-[170px] shrink-0">
            <StatCard
              icon={MapPin}
              label="Locations"
              color="slate"
              loading={statsLoading}
              value={stats?.total_locations ?? "—"}
            />
          </div>
          <div className="min-w-[170px] w-[170px] shrink-0">
            <StatCard
              icon={Clock3}
              label="Shifts"
              color="slate"
              loading={statsLoading}
              value={stats?.total_shifts ?? "—"}
            />
          </div>
        </div>
      </div>

      {/* ---------- Two-column body ----------
          Left:  Check-in/out -> Recent Activity -> Attendance Trend (+ Dept
                 Distribution, same "chart" grouping)
          Right: On Leave Today -> Announcements -> Upcoming Birthdays ->
                 Top Performance
      ---------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-[65%_1fr] gap-6 items-start min-w-0">
        {/* ================= Left column (65%) ================= */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* ---------- Check-in/out (HR Admin is a person too) ---------- */}
          <CheckInOutCard onActivityChange={loadLogs} />

          {/* ---------- Recent audit activity: fixed height, hidden scrollbar ---------- */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col h-[360px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <ShieldCheck size={17} className="text-orange-500" /> Recent
                Activity
              </h3>
              {/* No "View Audit Logs" link here — that page lives under
                  /super-admin/security/audit-logs and hr-admin has no
                  equivalent route (see routes/hrAdminRoutes.jsx), so
                  linking there would 404 for HR Admins. */}
            </div>

            {logsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-10 bg-slate-100 rounded animate-pulse"
                  />
                ))}
              </div>
            ) : logsError ? (
              <div className="text-sm text-orange-500">
                Couldn't load recent activity: {logsError}
              </div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-slate-400">No recent activity.</p>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-y-auto no-scrollbar flex-1">
                {logs.map((log) => {
                  const entry = parseLogEntry(log, locations);
                  // Prefer the reverse-geocoded "City, State, Country"
                  // (matches what Today's Attendance shows); fall back to
                  // the matched company office name if geocoding hasn't
                  // resolved yet.
                  const geocoded =
                    entry.lat != null && entry.lon != null
                      ? placeCache[placeKey(entry.lat, entry.lon)]
                      : null;
                  const matchedOffice = resolveLocationName(
                    entry.lat,
                    entry.lon,
                    locations,
                  );
                  // Priority: reverse-geocoded "City, State, Country" ->
                  // matched company office name -> raw coordinates (so a
                  // check-in from outside every registered office, or one
                  // whose geocode hasn't resolved yet, still shows
                  // *something* instead of the location silently vanishing.
                  const locationName =
                    geocoded ||
                    matchedOffice ||
                    (entry.lat != null && entry.lon != null
                      ? `${entry.lat.toFixed(4)}, ${entry.lon.toFixed(4)}`
                      : null);
                  return (
                    <li key={log.id} className="py-2 flex items-start gap-2.5">
                      <LogIcon kind={entry.kind} />
                      <div className="min-w-0 flex-1 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {entry.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {entry.action}
                          </p>
                          {locationName && (
                            <p className="text-[11px] text-slate-400 flex items-center gap-0.5 truncate">
                              <MapPin size={9} className="shrink-0" />{" "}
                              {locationName}
                            </p>
                          )}
                        </div>
                        {entry.time && (
                          <span className="text-xs text-slate-400 whitespace-nowrap">
                            {formatTime(entry.time)}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ---------- Attendance Trend chart ---------- */}
          <AttendanceTrendChart
            trend={trend}
            loading={trendLoading}
            range={trendRange}
            onRangeChange={setTrendRange}
          />

          {/* ---------- Department Distribution chart ---------- */}
          {/* <DepartmentDistributionChart
            departments={deptDistribution}
            loading={deptLoading}
          /> */}
        </div>

        {/* ================= Right column (35%) =================
            Fixed height + its own vertical scroll, so this column never
            grows taller than the viewport / left column — it scrolls
            independently instead of pushing the page down. */}
        <div className="flex flex-col gap-6 min-w-0 lg:h-[calc(100vh-6rem)] lg:sticky lg:top-4 lg:overflow-y-auto lg:pr-1 no-scrollbar">
          {/* ---------- On Leave Today ---------- */}
          <div className="h-72">
            <OnLeaveTodayCard />
          </div>

          {/* ---------- Announcements ---------- */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 h-72 flex flex-col">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-3">
              <Megaphone size={17} className="text-orange-500" /> Announcements
            </h3>
            {announcements.length === 0 ? (
              <p className="text-sm text-slate-400">No active announcements.</p>
            ) : (
              <div className="space-y-2 overflow-y-auto no-scrollbar flex-1">
                {announcements.slice(0, 3).map((a) => (
                  <div
                    key={a.id}
                    className="bg-orange-50 border border-orange-100 rounded-lg p-2.5"
                  >
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {a.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                      {a.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---------- Upcoming Birthdays ---------- */}
          <div className="h-72">
            <BirthdaysCard />
          </div>

          {/* ---------- Top Performance ---------- */}
          <div className="h-72">
            <TopPerformersCard />
          </div>
        </div>
      </div>

      {/* ---------- Floating round "Add Employee" button ---------- */}
      {/* <Link
        to="/hr-admin/employees/add"
        title="Add Employee"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg flex items-center justify-center transition-colors z-50"
      >
        <Plus size={24} />
      </Link> */}

      {/* ---------- Create User modal (opened from the "Create User"
          quick action above). Shows a loading/error overlay first,
          matching Users.jsx's own gating, and only mounts UserFormModal
          once addUserRefData is ready. ---------- */}
      {addUserOpen && (!addUserRefData || addUserLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl text-center">
            {addUserError ? (
              <>
                <p className="text-sm text-orange-600 mb-4">{addUserError}</p>
                <button
                  onClick={() => setAddUserOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <Loader2
                  size={22}
                  className="animate-spin text-orange-500 mx-auto mb-3"
                />
                <p className="text-sm text-slate-500">Loading form…</p>
              </>
            )}
          </div>
        </div>
      )}
      {addUserOpen && addUserRefData && !addUserLoading && !addUserError && (
        <UserFormModal
          mode="add"
          refData={addUserRefData}
          onClose={() => setAddUserOpen(false)}
          onSaved={() => {
            setAddUserOpen(false);
            // Previously this only closed the modal, so "Total Employees"
            // and the department distribution card kept showing stale
            // numbers until a full page refresh. Re-pull both, and drop
            // the cached refData so the next time this modal opens it
            // re-fetches departments/designations/roles/users fresh
            // (picking up the just-created user as a possible Reporting
            // Manager, and any org-data changes made elsewhere).
            loadStats();
            apiClient
              .get("/dashboard/department-distribution")
              .then((res) => setDeptDistribution(res.departments || []))
              .catch(() => {});
            setAddUserRefData(null);
          }}
        />
      )}

      {/* ---------- Create Site modal (opened from the "Create Site"
          quick action above) — same form as Organization Locations. ---------- */}
      {addSiteOpen && (
        <LocationFormModal
          mode="add"
          onClose={() => setAddSiteOpen(false)}
          onSaved={() => {
            setAddSiteOpen(false);
            // Same staleness issue as Create User above: refresh the
            // "Locations" stat and the locations list immediately instead
            // of waiting for a manual page refresh.
            loadStats();
            apiClient
              .get("/locations/")
              .then((res) => setLocations(res.data || []))
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}
