import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  Cake,
  ChevronDown,
  LayoutGrid,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Megaphone,
  PlaneTakeoff,
  Plus,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  Users2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import AttendanceTrendChart from "../../components/common/AttendanceTrendChart";
import BirthdaysCard, {
  OnLeaveTodayCard,
} from "../../components/common/CelebrationsStrip";
import CheckInOutCard from "../../components/common/CheckInOutCard";
import OutdoorCheckinAccessModal from "../../components/common/Outdoorcheckinaccessmodal ";
import PageHeader from "../../components/common/PageHeader";
import QuoteOfDayCard from "../../components/common/Quoteofdaycard";
import StatCard from "../../components/common/StatCard";
import TopPerformersCard from "../../components/common/TopPerformanceCard";
import UserFormModal from "../../components/common/UserformModal";
import { useAuth } from "../../context/AuthContext";
import { useAttendanceLiveUpdates } from "../../hooks/Useattendanceliveupdates";
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

// An announcement is "expired" once today is past its end_date. Kept
// visible (greyed out) instead of disappearing, same as Super Admin's
// dashboard.
function isAnnouncementExpired(a) {
  if (!a?.end_date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return a.end_date < today;
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
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] || "there";

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
  // "Outdoor Check-in Access" quick action opens in-place too, same
  // pattern as Create User / Create Site above.
  const [outdoorAccessOpen, setOutdoorAccessOpen] = useState(false);

  // Whether the mobile-only "+" quick-create popup (Create User /
  // Create Site / Outdoor Check-in Access) is open — same floating
  // speed-dial pattern as the Super Admin dashboard, replacing the
  // three separate circle buttons that used to sit in the mobile
  // header row here.
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  // ---------------------------------------------------------------------
  // Mobile-only layout state (below lg). The mobile view below is a
  // deliberately different pattern from both the desktop grid on this
  // page AND the bento-grid/bottom-sheet pattern on the Employee
  // dashboard: a segmented Overview / Activity / Team switcher, with
  // Team content shown as inline accordion cards (one open at a time)
  // instead of a bottom sheet. Same data/components as desktop
  // throughout — only the mobile presentation differs. (The stat-card
  // carousel that used to sit above this was removed on mobile.)
  // ---------------------------------------------------------------------
  const [mobileTab, setMobileTab] = useState("overview");
  const [mobileTeamOpen, setMobileTeamOpen] = useState("onleave");

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

  function loadAnnouncements() {
    // All announcements, not just /active — same as Super Admin's
    // dashboard — so expired ones still show here (greyed out) instead
    // of just vanishing. Falls back to /active if this HR Admin's role
    // isn't permitted the full list.
    apiClient
      .get("/announcements/")
      .then((res) => setAnnouncements(res.data || []))
      .catch(() =>
        apiClient
          .get("/announcements/active")
          .then((res) => setAnnouncements(res.data || []))
          .catch(() => setAnnouncements([])),
      );
  }

  // Refetches stats + Recent Activity + Announcements the instant any
  // employee checks in/out or starts/ends a break, applies for/has a
  // leave decided on, or an announcement changes, anywhere in the
  // company — not just from this admin's own actions.
  useAttendanceLiveUpdates(() => {
    loadStats();
    loadLogs();
    loadAnnouncements();
  });

  useEffect(() => {
    loadStats();
    loadLogs();
    loadAnnouncements();

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

      {/* ---------- Desktop/tablet header (lg and up) — unchanged ---------- */}
      <div className="hidden lg:block">
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
              <button
                type="button"
                onClick={() => setOutdoorAccessOpen(true)}
                title="Outdoor Check-in Access"
                aria-label="Outdoor Check-in Access"
                className="group relative w-9 h-9 rounded-full bg-orange-50 hover:bg-orange-500 text-orange-500 hover:text-white flex items-center justify-center transition-colors shrink-0"
              >
                <MapPin size={16} />
                <span className="pointer-events-none absolute top-full mt-2 whitespace-nowrap rounded-md bg-slate-800 text-white text-[11px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  Outdoor Check-in Access
                </span>
              </button>
              <QuoteOfDayCard compact />
            </div>
          }
        />
      </div>

      {/* ---------- Mobile header (below lg) ----------
          Title + subtitle, then the Quote of the Day card (compact
          variant, full-width on mobile). The three quick-action
          circles that used to sit inline here (Create User / Create
          Site / Outdoor Check-in Access) now live in the floating "+"
          speed-dial (bottom-right, see below) — same pattern as the
          Super Admin dashboard — instead of crowding the title row. */}
      <div className="lg:hidden mb-4">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">
          Hi, {firstName} 👋
        </h1>

        <QuoteOfDayCard compact />
      </div>

      {/* =================================================================
          MOBILE-ONLY DASHBOARD (below lg)
          Deliberately a different pattern from both the desktop grid
          below AND the bento-grid/bottom-sheet pattern on the Employee
          dashboard: a swipeable stat carousel, a pill quick-action dock,
          a segmented Overview / Activity / Team switcher, and
          single-open accordion cards for the secondary content — built
          from the exact same data/components used on desktop, just
          presented differently.
      ================================================================= */}
      <div className="lg:hidden">
        {/* ---------- Segmented tab switcher ---------- */}
        <div className="grid grid-cols-3 gap-1 bg-slate-100 rounded-full p-1 mb-4">
          {[
            { key: "overview", label: "Overview", icon: LayoutGrid },
            { key: "activity", label: "Activity", icon: Activity },
            { key: "team", label: "Team", icon: Users2 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMobileTab(key)}
              className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-colors ${
                mobileTab === key
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* ---------- Overview tab ---------- */}
        {mobileTab === "overview" && (
          <div className="flex flex-col gap-4 mb-6">
            {/* ---------- Check-in/out ----------
                Same treatment as the Manager dashboard's mobile
                check-in: a slim gradient-bordered shell plus the
                `ultraCompact` layout on CheckInOutCard itself (single
                row, no side timeline) instead of the plain white
                `compact` card. Desktop (below) is unaffected. */}
            <div className="rounded-2xl bg-gradient-to-br from-[#0B1830] via-[#132445] to-orange-500/90 p-[3px] shadow-lg shadow-slate-900/10 [&>div]:rounded-[13px]">
              <CheckInOutCard ultraCompact onActivityChange={loadLogs} />
            </div>
            <AttendanceTrendChart
              trend={trend}
              loading={trendLoading}
              range={trendRange}
              onRangeChange={setTrendRange}
            />
            <div className="h-72">
              <TopPerformersCard />
            </div>
          </div>
        )}

        {/* ---------- Activity tab: same Recent Activity feed as desktop,
            just its own fixed-height scroll area under the tab. ---------- */}
        {mobileTab === "activity" && (
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col h-[420px] mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <ShieldCheck size={17} className="text-orange-500" /> Recent
                Activity
              </h3>
              <Link
                to="/hr-admin/security/audit-logs"
                className="text-xs font-medium text-orange-500 flex items-center gap-1 shrink-0"
              >
                View All <ArrowRight size={12} />
              </Link>
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
                  const geocoded =
                    entry.lat != null && entry.lon != null
                      ? placeCache[placeKey(entry.lat, entry.lon)]
                      : null;
                  const matchedOffice = resolveLocationName(
                    entry.lat,
                    entry.lon,
                    locations,
                  );
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
        )}

        {/* ---------- Team tab: single-open accordion cards — a different
            mobile pattern than the Employee dashboard's bento grid +
            bottom sheet, though it borrows the same "same components,
            different entry point" idea. ---------- */}
        {mobileTab === "team" && (
          <div className="flex flex-col gap-2.5 mb-6">
            {[
              {
                key: "onleave",
                label: "On Leave Today",
                icon: PlaneTakeoff,
                accent: "text-violet-500 bg-violet-50",
                render: () => <OnLeaveTodayCard />,
              },
              {
                key: "announcements",
                label: "Announcements",
                icon: Megaphone,
                accent: "text-orange-500 bg-orange-50",
                badge:
                  announcements.filter((a) => !isAnnouncementExpired(a))
                    .length || null,
                render: () =>
                  announcements.length === 0 ? (
                    <p className="text-sm text-slate-400 px-0.5">
                      No announcements yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {[...announcements]
                        .sort((a, b) => {
                          const aExpired = isAnnouncementExpired(a);
                          const bExpired = isAnnouncementExpired(b);
                          if (aExpired !== bExpired) return aExpired ? 1 : -1;
                          return (b.end_date || "").localeCompare(
                            a.end_date || "",
                          );
                        })
                        .slice(0, 4)
                        .map((a) => {
                          const expired = isAnnouncementExpired(a);
                          return (
                            <div
                              key={a.id}
                              className={
                                "rounded-lg p-2.5 border " +
                                (expired
                                  ? "bg-slate-50 border-slate-200 opacity-60"
                                  : "bg-orange-50 border-orange-100")
                              }
                            >
                              <div className="flex items-center gap-1.5">
                                <p
                                  className={
                                    "text-sm font-medium truncate " +
                                    (expired
                                      ? "text-slate-500"
                                      : "text-slate-800")
                                  }
                                >
                                  {a.title}
                                </p>
                                {expired && (
                                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-400 bg-slate-200 rounded px-1.5 py-0.5">
                                    Expired
                                  </span>
                                )}
                              </div>
                              <p
                                className={
                                  "text-xs mt-0.5 " +
                                  (expired
                                    ? "text-slate-400"
                                    : "text-slate-500")
                                }
                              >
                                {a.description}
                              </p>
                            </div>
                          );
                        })}
                    </div>
                  ),
              },
              {
                key: "birthdays",
                label: "Upcoming Birthdays",
                icon: Cake,
                accent: "text-pink-500 bg-pink-50",
                render: () => <BirthdaysCard />,
              },
            ].map(({ key, label, icon: Icon, accent, badge, render }) => {
              const isOpen = mobileTeamOpen === key;
              return (
                <div
                  key={key}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setMobileTeamOpen(isOpen ? null : key)}
                    className="w-full flex items-center gap-2.5 p-3.5"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accent}`}
                    >
                      <Icon size={15} />
                    </div>
                    <span className="flex-1 text-left text-sm font-semibold text-slate-700">
                      {label}
                    </span>
                    {badge ? (
                      <span className="rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold px-1.5 py-0.5">
                        {badge}
                      </span>
                    ) : null}
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-3.5 pb-3.5 h-64 overflow-y-auto no-scrollbar">
                      {render()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- Floating "+" (bottom-right) + speed-dial bubbles ----------
          Same pattern as the Super Admin dashboard's quick-create FAB:
          rendered through a portal straight onto document.body so it
          stays pinned to the real viewport corner instead of drifting
          with page content, each action pops up as its own
          semi-transparent round bubble with a label, stacked above the
          button. Hidden whenever any of its own modals are already
          open so it can't float on top of / be tapped through them. */}
      {typeof document !== "undefined" &&
        !addUserOpen &&
        !addSiteOpen &&
        !outdoorAccessOpen &&
        createPortal(
          <div className="fixed bottom-6 right-5 z-[999] flex flex-col items-end gap-2.5 lg:hidden">
            <button
              type="button"
              onClick={() => {
                setQuickMenuOpen(false);
                setOutdoorAccessOpen(true);
              }}
              title="Outdoor Check-in Access"
              aria-label="Outdoor Check-in Access"
              className={`flex items-center gap-2 transition-all duration-150 ${
                quickMenuOpen
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2 pointer-events-none"
              }`}
            >
              <span className="text-xs font-medium text-white bg-[#0B1830]/95 px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                Outdoor Check-in Access
              </span>
              <span className="w-11 h-11 rounded-full bg-[#0B1830]/95 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform shrink-0">
                <MapPin size={17} />
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickMenuOpen(false);
                setAddSiteOpen(true);
              }}
              title="Create Site"
              aria-label="Create Site"
              className={`flex items-center gap-2 transition-all duration-150 delay-75 ${
                quickMenuOpen
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2 pointer-events-none"
              }`}
            >
              <span className="text-xs font-medium text-white bg-[#0B1830]/95 px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                Create Site
              </span>
              <span className="w-11 h-11 rounded-full bg-[#0B1830]/95 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform shrink-0">
                <Building2 size={17} />
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickMenuOpen(false);
                openAddUser();
              }}
              title="Create User"
              aria-label="Create User"
              className={`flex items-center gap-2 transition-all duration-150 delay-100 ${
                quickMenuOpen
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2 pointer-events-none"
              }`}
            >
              <span className="text-xs font-medium text-white bg-[#0B1830]/95 px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                Create User
              </span>
              <span className="w-11 h-11 rounded-full bg-[#0B1830]/95 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform shrink-0">
                <UserPlus size={17} />
              </span>
            </button>

            {/* Backdrop — tapping anywhere outside the bubbles closes them. */}
            {quickMenuOpen && (
              <div
                className="fixed inset-0 -z-10"
                onClick={() => setQuickMenuOpen(false)}
              />
            )}

            <button
              type="button"
              onClick={() => setQuickMenuOpen((v) => !v)}
              title="Quick create"
              aria-label="Quick create"
              aria-expanded={quickMenuOpen}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors shrink-0 ${
                quickMenuOpen
                  ? "bg-orange-600 text-white"
                  : "bg-orange-500 text-white"
              }`}
            >
              <Plus
                size={22}
                className={`transition-transform ${quickMenuOpen ? "rotate-45" : ""}`}
              />
            </button>
          </div>,
          document.body,
        )}
      {/* ================= END MOBILE-ONLY DASHBOARD ================= */}

      {/* ---------- Top row: stat cards (full width, desktop/tablet only —
          mobile gets its own swipeable carousel below) ---------- */}
      <div className="hidden lg:flex gap-3 sm:gap-4 mb-4 sm:mb-6 items-stretch">
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
          {/* <div className="min-w-[170px] w-[170px] shrink-0">
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
          </div> */}
        </div>
      </div>

      {/* ---------- Two-column body ----------
          Left:  Check-in/out -> Recent Activity -> Attendance Trend (+ Dept
                 Distribution, same "chart" grouping)
          Right: On Leave Today -> Announcements -> Upcoming Birthdays ->
                 Top Performance
      ---------------------------------------------------------------- */}
      <div className="hidden lg:grid lg:grid-cols-[65%_1fr] gap-4 sm:gap-6 items-start min-w-0">
        {/* ================= Left column (65%) ================= */}
        <div className="flex flex-col gap-4 sm:gap-6 min-w-0">
          {/* ---------- Check-in/out (HR Admin is a person too) ---------- */}
          <CheckInOutCard onActivityChange={loadLogs} />

          {/* ---------- Recent audit activity: fixed height, hidden scrollbar ---------- */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 flex flex-col h-[300px] sm:h-[360px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <ShieldCheck size={17} className="text-orange-500" /> Recent
                Activity
              </h3>
              <Link
                to="/hr-admin/security/audit-logs"
                className="text-xs font-medium text-orange-500 hover:text-orange-600 flex items-center gap-1 shrink-0"
              >
                View Audit Logs <ArrowRight size={12} />
              </Link>
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
        <div className="flex flex-col gap-4 sm:gap-6 min-w-0 lg:h-[calc(100vh-6rem)] lg:sticky lg:top-4 lg:overflow-y-auto lg:pr-1 no-scrollbar">
          {/* ---------- On Leave Today ---------- */}
          <div className="h-60 sm:h-72">
            <OnLeaveTodayCard />
          </div>

          {/* ---------- Announcements ---------- */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 h-60 sm:h-72 flex flex-col">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-3">
              <Megaphone size={17} className="text-orange-500" /> Announcements
            </h3>
            {announcements.length === 0 ? (
              <p className="text-sm text-slate-400">No announcements yet.</p>
            ) : (
              <div className="space-y-2 overflow-y-auto no-scrollbar flex-1">
                {/* Active first, then expired (most recently ended first) —
                    expired stay visible, just greyed out. */}
                {[...announcements]
                  .sort((a, b) => {
                    const aExpired = isAnnouncementExpired(a);
                    const bExpired = isAnnouncementExpired(b);
                    if (aExpired !== bExpired) return aExpired ? 1 : -1;
                    return (b.end_date || "").localeCompare(a.end_date || "");
                  })
                  .slice(0, 3)
                  .map((a) => {
                    const expired = isAnnouncementExpired(a);
                    return (
                      <div
                        key={a.id}
                        className={
                          "rounded-lg p-2.5 border " +
                          (expired
                            ? "bg-slate-50 border-slate-200 opacity-60"
                            : "bg-orange-50 border-orange-100")
                        }
                      >
                        <div className="flex items-center gap-1.5">
                          <p
                            className={
                              "text-sm font-medium truncate " +
                              (expired ? "text-slate-500" : "text-slate-800")
                            }
                          >
                            {a.title}
                          </p>
                          {expired && (
                            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-400 bg-slate-200 rounded px-1.5 py-0.5">
                              Expired
                            </span>
                          )}
                        </div>
                        <p
                          className={
                            "text-xs mt-0.5 line-clamp-2 " +
                            (expired ? "text-slate-400" : "text-slate-500")
                          }
                        >
                          {a.description}
                        </p>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* ---------- Upcoming Birthdays ---------- */}
          <div className="h-60 sm:h-72">
            <BirthdaysCard />
          </div>

          {/* ---------- Top Performance ---------- */}
          <div className="h-60 sm:h-72">
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

      <OutdoorCheckinAccessModal
        open={outdoorAccessOpen}
        onClose={() => setOutdoorAccessOpen(false)}
      />
    </div>
  );
}
