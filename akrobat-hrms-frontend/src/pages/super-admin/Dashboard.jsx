import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  Clock,
  LayoutGrid,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Megaphone,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Users2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import AttendanceTrendChart from "../../components/common/AttendanceTrendChart";
import BirthdaysCard, {
  OnLeaveTodayCard,
} from "../../components/common/CelebrationsStrip";

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

// An announcement is "expired" once today is past its end_date. The
// Announcements panel keeps showing these (greyed out) instead of hiding
// them the moment /announcements/active would stop returning them, so
// Super Admin can still find/edit/delete something that already ended.
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

export default function SuperAdminDashboard() {
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
  const [trendRange, setTrendRange] = useState("today");

  const [deptDistribution, setDeptDistribution] = useState([]);
  const [deptLoading, setDeptLoading] = useState(true);

  const [locations, setLocations] = useState([]);

  // Reverse-geocoded "City, State, Country" per unique check-in/out
  // coordinate in Recent Activity, keyed by placeKey(lat, lon) — see
  // reverseGeocode() above. Populated lazily once logs load.
  const [placeCache, setPlaceCache] = useState({});

  // ---------------------------------------------------------------------
  // Mobile-only layout state (below lg). Which Command Center bento tile
  // has its bottom sheet open — desktop/tablet (lg and up) keeps the
  // original always-visible two-column layout untouched; this only
  // drives the lg:hidden layout below.
  // ---------------------------------------------------------------------
  const [openSheet, setOpenSheet] = useState(null);

  // Which segmented tab (Overview / Activity / Team) is active, and
  // which stat carousel card is centered — same mobile pattern as the
  // HR Admin dashboard (see the `lg:hidden` block below).
  const [mobileTab, setMobileTab] = useState("overview");
  const [statPage, setStatPage] = useState(0);

  // (Overview tab now stacks Attendance Trend + Top Performers directly,
  // no toggle needed between them — see the "overview" tab render below.)

  // Whether the "+" quick-create popup (Create Site / Create User /
  // Create Announcement) is open — mobile-only, lives next to the
  // scrollable quick-actions row.
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  // Live day/date/time shown in the header banner. Ticks every second
  // off the browser clock (no backend call needed) so the banner never
  // shows a stale timestamp on a dashboard left open for a while.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const headerDateLabel = now.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const headerTimeLabel = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // "Create User" quick action (top-right, before the Quote of the Day
  // card) opens UserFormModal in place instead of navigating to
  // /super-admin/users. The modal needs the same reference data
  // Users.jsx loads (departments/designations/shifts/roles + the full
  // user list, for the "Reporting Manager" dropdown) — fetched lazily
  // on first open rather than on every dashboard visit, since most
  // visits never touch this action.
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

  // Create / Edit / Delete Announcement — Super Admin only (this button
  // and the hover edit/delete controls intentionally don't exist on the
  // HR Admin / Manager / Employee dashboards, which only read
  // /announcements/active read-only). Whatever's created/edited/deleted
  // here shows up for every role automatically since they all hit that
  // same endpoint — no per-role wiring needed beyond keeping these
  // controls out of their dashboards.
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announceForm, setAnnounceForm] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
  });
  const [announceSaving, setAnnounceSaving] = useState(false);
  const [announceError, setAnnounceError] = useState(null);
  // null => create mode; an announcement id => editing that announcement.
  const [editingAnnounceId, setEditingAnnounceId] = useState(null);
  // id currently mid-delete, so its row can show a spinner/disabled state
  // instead of letting a double-click fire two DELETE requests.
  const [deletingAnnounceId, setDeletingAnnounceId] = useState(null);

  function openAnnounce() {
    // Default start_date to today so the common case (announcement starts
    // now) doesn't force an extra click — end_date is left blank since it
    // depends on the announcement.
    const today = new Date().toISOString().slice(0, 10);
    setEditingAnnounceId(null);
    setAnnounceForm({
      title: "",
      description: "",
      start_date: today,
      end_date: "",
    });
    setAnnounceError(null);
    setAnnounceOpen(true);
  }

  function openEditAnnounce(a) {
    setEditingAnnounceId(a.id);
    setAnnounceForm({
      title: a.title || "",
      description: a.description || "",
      // start_date/end_date come back as "YYYY-MM-DD" from the API, which
      // is exactly what <input type="date"> expects.
      start_date: a.start_date || "",
      end_date: a.end_date || "",
    });
    setAnnounceError(null);
    setAnnounceOpen(true);
  }

  function refreshAnnouncements() {
    // Same reasoning as the mount-effect fetch above: fetch every
    // announcement (not just /active) so expired ones stay visible here,
    // greyed out, instead of vanishing the moment their end_date passes.
    return apiClient
      .get("/announcements/")
      .then((res) => setAnnouncements(res?.data || []));
  }

  function submitAnnounce(e) {
    e.preventDefault();
    if (!announceForm.title.trim()) {
      setAnnounceError("Title is required.");
      return;
    }
    // Backend requires both start_date and end_date (see 422 on POST
    // /announcements/ — "Field required" for both), so validate here
    // before hitting the API.
    if (!announceForm.start_date) {
      setAnnounceError("Start date is required.");
      return;
    }
    if (!announceForm.end_date) {
      setAnnounceError("End date is required.");
      return;
    }
    if (announceForm.end_date < announceForm.start_date) {
      setAnnounceError("End date cannot be before start date.");
      return;
    }
    setAnnounceSaving(true);
    setAnnounceError(null);

    const payload = {
      title: announceForm.title.trim(),
      // Backend's description field is required (non-optional str, see
      // CreateAnnouncementRequest in app/announcements/schemas.py) — a
      // blank field here used to send `undefined`, which JSON.stringify
      // drops from the request body entirely, causing a 422 "Field
      // required" for description. Always send a string, even empty.
      description: announceForm.description.trim(),
      start_date: announceForm.start_date,
      end_date: announceForm.end_date,
    };

    const request = editingAnnounceId
      ? apiClient.put(`/announcements/${editingAnnounceId}`, payload)
      : apiClient.post("/announcements/", payload);

    request
      .then(() => {
        setAnnounceOpen(false);
        setEditingAnnounceId(null);
        // Re-fetch rather than optimistically prepending/patching in place
        // — /announcements/active may apply its own filtering/ordering
        // (e.g. active-date windows), so this keeps the panel consistent
        // with what other roles will see.
        return refreshAnnouncements();
      })
      .catch((err) => {
        setAnnounceError(
          err.message ||
            (editingAnnounceId
              ? "Could not update the announcement."
              : "Could not create the announcement."),
        );
      })
      .finally(() => setAnnounceSaving(false));
  }

  function deleteAnnounceItem(a) {
    if (deletingAnnounceId) return;
    if (!window.confirm(`Delete the announcement "${a.title}"?`)) return;

    setDeletingAnnounceId(a.id);
    apiClient
      .delete(`/announcements/${a.id}`)
      .then(() => refreshAnnouncements())
      .catch((err) => {
        window.alert(err.message || "Could not delete the announcement.");
      })
      .finally(() => setDeletingAnnounceId(null));
  }

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

    // Super Admin sees every announcement here, not just currently-active
    // ones (see /announcements/active filtering in get_active_announcements)
    // — expired ones are rendered greyed-out below instead of disappearing,
    // so admins can still find/edit/delete something that already ended.
    apiClient
      .get("/announcements/")
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

  // Cards for the mobile KPI bento grid (see the `lg:hidden` block below)
  // — same four numbers as the desktop stat row, just a bolder
  // gradient-tile treatment instead of the flat StatCard look.
  const statItems = [
    {
      key: "total",
      icon: Users,
      label: "Total Employees",
      value: stats?.total_employees,
      cardBg: "bg-orange-50",
      iconBg: "bg-orange-500",
    },
    {
      key: "present",
      icon: UserCheck,
      label: "Present Today",
      value: stats?.present_today,
      cardBg: "bg-emerald-50",
      iconBg: "bg-emerald-500",
    },
    {
      key: "late",
      icon: AlertTriangle,
      label: "Late Today",
      value: stats?.late_today,
      cardBg: "bg-violet-50",
      iconBg: "bg-violet-500",
    },
    {
      key: "depts",
      icon: Building2,
      label: "Departments",
      value: stats?.total_departments,
      cardBg: "bg-slate-100",
      iconBg: "bg-slate-800",
    },
  ];

  // Tiles for the mobile "Command Center" bento grid. Each tile opens
  // the matching bottom sheet on tap instead of a plain stacked card or
  // an accordion — reuses the exact same components/data as desktop,
  // just a different entry interaction.
  const activeAnnouncementCount = announcements.filter(
    (a) => !isAnnouncementExpired(a),
  ).length;
  const commandTiles = [
    {
      key: "announcements",
      label: "Announcements",
      icon: Megaphone,
      bg: "bg-orange-50",
      iconFg: "text-orange-700",
      labelFg: "text-orange-900",
      previewFg: "text-orange-700",
      preview:
        announcements.length === 0
          ? "No announcements yet"
          : announcements[0].title,
      badge: activeAnnouncementCount || null,
    },
  ];

  // Tracks which stat card is centered so the dot indicator below the
  // carousel stays in sync while swiping.
  function handleStatScroll(e) {
    const el = e.currentTarget;
    const card = el.firstChild;
    if (!card) return;
    const cardWidth = card.offsetWidth + 10; // gap-2.5 = 10px
    const idx = Math.round(el.scrollLeft / cardWidth);
    setStatPage(Math.max(0, Math.min(statItems.length - 1, idx)));
  }

  const sheetTitles = {
    activity: "Recent Activity",
    onleave: "On Leave Today",
    announcements: "Announcements",
    birthdays: "Upcoming Birthdays",
  };

  return (
    <div className="overflow-x-hidden">
      {/* Hides the scrollbar visually on the horizontal stat-card row and
          the recent-activity panel, while keeping them scrollable. */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ---------- Desktop/tablet header (lg and up) — back to the
          original plain PageHeader. The dark-navy banner treatment
          is mobile-only now (see below); desktop keeps its original
          look, unchanged. ---------- */}
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
              <QuoteOfDayCard compact />
            </div>
          }
        />
      </div>

      {/* ---------- Mobile header (below lg) ----------
          Same dark-navy banner treatment as desktop, scaled down —
          this is what's in the "System Dashboard" screenshot: a solid
          navy card with the Shield badge, "SUPER ADMIN" eyebrow, title
          and quick actions, instead of sitting directly on the white
          page background like HR Admin's mobile header does. ---------- */}
      <div className="lg:hidden mb-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B1830] via-[#0F2242] to-[#16305A] px-4 pt-4 pb-4 mb-3 shadow-lg shadow-[#0B1830]/20">
          <div className="pointer-events-none absolute -top-14 -right-10 w-40 h-40 rounded-full bg-orange-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/4 w-48 h-48 rounded-full bg-sky-500/10 blur-3xl" />

          <div className="relative flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                <ShieldCheck size={17} className="text-orange-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider">
                  Super Admin
                </p>
                <h1 className="text-xl font-bold text-white leading-tight truncate">
                  System Dashboard
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={openAddUser}
                title="Create User"
                aria-label="Create User"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-orange-500 text-white flex items-center justify-center transition-colors shrink-0 border border-white/10"
              >
                <UserPlus size={15} />
              </button>
              <button
                type="button"
                onClick={() => setAddSiteOpen(true)}
                title="Create Site"
                aria-label="Create Site"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-orange-500 text-white flex items-center justify-center transition-colors shrink-0 border border-white/10"
              >
                <Building2 size={15} />
              </button>
            </div>
          </div>
          <div className="relative flex items-center justify-between gap-2 mt-2">
            <p className="text-xs text-slate-300/80"></p>
            <div className="flex items-center gap-1.5 shrink-0">
              <Clock size={12} className="text-orange-400 shrink-0" />
              <p className="text-[11px] font-medium text-slate-200 whitespace-nowrap tabular-nums">
                {headerDateLabel} · {headerTimeLabel}
              </p>
            </div>
          </div>
        </div>
        <QuoteOfDayCard compact />
      </div>

      {/* =================================================================
          MOBILE-ONLY DASHBOARD (below lg)
          Same pattern as the HR Admin dashboard: a swipeable stat
          carousel, a segmented Overview / Activity / Team switcher, and
          the "+" quick-create FAB pinned bottom-right — built from the
          exact same data/components used on desktop, just presented
          the same way HR Admin's mobile dashboard is.
      ================================================================= */}
      <div className="lg:hidden">
        {/* ---------- Stat carousel: compact light-orange cards, ~2.3 visible at a time ---------- */}
        <div
          onScroll={handleStatScroll}
          className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 pb-1 mb-2"
        >
          {statItems.map(({ key, icon: Icon, label, value }) => (
            <div
              key={key}
              className="snap-start shrink-0 w-[42%] rounded-xl bg-orange-50 border border-orange-100 p-3 flex flex-col gap-2 h-[76px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-orange-700/80 truncate">
                  {label}
                </span>
                <div className="w-6 h-6 rounded-full bg-[#16305A] text-white flex items-center justify-center shrink-0">
                  <Icon size={12} />
                </div>
              </div>
              <p className="text-xl font-bold leading-none text-slate-800">
                {statsLoading ? (
                  <span className="inline-block w-8 h-5 bg-orange-100 rounded animate-pulse" />
                ) : (
                  (value ?? "—")
                )}
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {statItems.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === statPage ? "w-4 bg-orange-500" : "w-1.5 bg-slate-200"
              }`}
            />
          ))}
        </div>

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
                  ? "bg-[#16305A] text-orange-400 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* ---------- Overview tab ----------
            Attendance Trend chart, then the Top Performers card
            stacked directly below it (same pattern HR Admin uses) —
            previously this was a Trend/Top 5 toggle showing one panel
            at a time, and Top Performers was also duplicated as its
            own tile under the Team tab. Now there's a single place to
            see it, right under the attendance chart, full-width. ---------- */}
        {mobileTab === "overview" && (
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-2 px-0.5">
              <span className="h-1.5 w-4 rounded-full bg-orange-500" />
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                System Insights
              </h2>
            </div>

            <AttendanceTrendChart
              trend={trend}
              loading={trendLoading}
              range={trendRange}
              onRangeChange={setTrendRange}
            />

            <div className="h-80">
              <TopPerformersCard />
            </div>

            {/* ---------- Today: On Leave + Birthdays ----------
                Moved below Top Performers, and switched from a fixed
                2-up grid to a horizontally swipeable strip (same swipe
                pattern as the KPI cards up top) with a shorter card
                height — a compact "swipe for more" row instead of a
                tall block competing with the chart/Top Performers for
                space at the top of the tab. ---------- */}
            <div className="flex items-center gap-2 px-0.5">
              <span className="h-1.5 w-4 rounded-full bg-[#16305A]" />
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Today
              </h2>
            </div>
            <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4">
              <div className="snap-start shrink-0 w-[86%] h-48">
                <OnLeaveTodayCard />
              </div>
              <div className="snap-start shrink-0 w-[86%] h-48">
                <BirthdaysCard />
              </div>
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
                to="/super-admin/security/audit-logs"
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

        {/* ---------- Team tab: Announcements management ----------
            On Leave Today and Birthdays used to live here too, as tap
            tiles behind a bottom sheet — they now render as real,
            always-visible cards on the Overview tab instead (see
            above), since "who's out" / "who's celebrating" is info
            people should see at a glance, not have to tap into. Only
            Announcements stays as a tap-through tile here, since
            creating/editing/deleting needs the extra room a sheet
            gives it. ---------- */}
        {mobileTab === "team" && (
          <div
            className={`grid gap-3 mb-6 ${commandTiles.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
          >
            {commandTiles.map(
              ({
                key,
                label,
                icon: Icon,
                bg,
                iconFg,
                labelFg,
                previewFg,
                preview,
                badge,
              }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOpenSheet(key)}
                  className={`text-left rounded-2xl ${bg} p-4 active:scale-[0.97] transition-transform`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <span
                      className={`w-9 h-9 rounded-xl bg-white flex items-center justify-center ${iconFg}`}
                    >
                      <Icon size={17} />
                    </span>
                    {badge ? (
                      <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {badge}
                      </span>
                    ) : null}
                  </div>
                  <p className={`text-xs font-semibold ${labelFg}`}>{label}</p>
                  <p className={`text-[11px] mt-0.5 line-clamp-1 ${previewFg}`}>
                    {preview}
                  </p>
                </button>
              ),
            )}
          </div>
        )}

        {/* ---------- Floating "+" (bottom-right) + speed-dial bubbles ----------
            Rendered through a portal straight onto document.body (see
            createPortal below) so it's genuinely pinned to the real
            viewport corner — nesting it inside the page's own DOM was
            letting it drift and land on top of card content instead of
            staying put as the page scrolled. Tapping "+" no longer opens
            a solid white list — each create-action pops up as its own
            separate, semi-transparent round bubble with a label next to
            it, stacked above the button.

            Hidden entirely whenever any modal/bottom-sheet is already
            open (Add User, Create Site, Announcement, or a command-tile
            sheet) — it used to sit at z-[999], above every modal's
            z-50 overlay, so it kept floating on top of whatever popup
            was open and could be tapped right through it. Unmounting it
            here removes both the visual overlap and the ability to
            accidentally trigger a second popup while one is already up. */}
        {typeof document !== "undefined" &&
          !addUserOpen &&
          !addSiteOpen &&
          !announceOpen &&
          !openSheet &&
          createPortal(
            <div className="fixed bottom-6 right-5 z-[999] flex flex-col items-end gap-2.5 lg:hidden">
              <button
                type="button"
                onClick={() => {
                  setQuickMenuOpen(false);
                  setAddSiteOpen(true);
                }}
                title="Create Site"
                aria-label="Create Site"
                className={`flex items-center gap-2 transition-all duration-150 ${
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
                className={`flex items-center gap-2 transition-all duration-150 delay-75 ${
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

              <button
                type="button"
                onClick={() => {
                  setQuickMenuOpen(false);
                  openAnnounce();
                }}
                title="Create Announcement"
                aria-label="Create Announcement"
                className={`flex items-center gap-2 transition-all duration-150 delay-100 ${
                  quickMenuOpen
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-2 pointer-events-none"
                }`}
              >
                <span className="text-xs font-medium text-white bg-orange-600/95 px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                  Announcement
                </span>
                <span className="w-11 h-11 rounded-full bg-orange-500 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform shrink-0">
                  <Megaphone size={17} />
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
      </div>
      {/* ================= END MOBILE-ONLY DASHBOARD ================= */}

      {/* ---------- Bottom sheet (mobile only) ----------
          Slides up over the page for whichever Command Center tile was
          tapped. Reuses the exact same components/data as the desktop
          columns further down, just presented one panel at a time in an
          overlay instead of stacked inline. ---------- */}
      {openSheet && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex items-end justify-center"
          onClick={() => setOpenSheet(null)}
        >
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-white rounded-t-2xl shadow-xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mt-3" />
            <div className="flex items-center justify-between px-5 pt-3 pb-2">
              <h3 className="font-semibold text-slate-800">
                {sheetTitles[openSheet]}
              </h3>
              <div className="flex items-center gap-2">
                {openSheet === "announcements" && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenSheet(null);
                      openAnnounce();
                    }}
                    title="Create announcement"
                    aria-label="Create announcement"
                    className="w-7 h-7 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0"
                  >
                    <Plus size={14} />
                  </button>
                )}
                <button
                  onClick={() => setOpenSheet(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="px-5 pb-6 overflow-y-auto no-scrollbar">
              {openSheet === "activity" && (
                <>
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
                    <p className="text-sm text-slate-400">
                      No recent activity.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
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
                          <li
                            key={log.id}
                            className="py-2 flex items-start gap-2.5"
                          >
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
                  <Link
                    to="/super-admin/security/audit-logs"
                    onClick={() => setOpenSheet(null)}
                    className="mt-3 flex items-center justify-center gap-1 text-xs font-medium text-orange-500"
                  >
                    View Audit Logs <ArrowRight size={12} />
                  </Link>
                </>
              )}

              {openSheet === "onleave" && (
                <div className="h-72">
                  <OnLeaveTodayCard />
                </div>
              )}

              {openSheet === "announcements" &&
                (announcements.length === 0 ? (
                  <p className="text-sm text-slate-400">
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
                      .map((a) => {
                        const expired = isAnnouncementExpired(a);
                        return (
                          <div
                            key={a.id}
                            className={
                              "group relative rounded-lg p-2.5 pr-14 border " +
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
                                (expired ? "text-slate-400" : "text-slate-500")
                              }
                            >
                              {a.description}
                            </p>
                            <div className="absolute top-2 right-2 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenSheet(null);
                                  openEditAnnounce(a);
                                }}
                                title="Edit announcement"
                                aria-label="Edit announcement"
                                className="w-6 h-6 rounded-md bg-white border border-orange-200 text-orange-500 flex items-center justify-center shrink-0"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteAnnounceItem(a)}
                                disabled={deletingAnnounceId === a.id}
                                title="Delete announcement"
                                aria-label="Delete announcement"
                                className="w-6 h-6 rounded-md bg-white border border-red-200 text-red-500 flex items-center justify-center shrink-0 disabled:opacity-50"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ))}

              {openSheet === "birthdays" && (
                <div className="h-72">
                  <BirthdaysCard />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Top row: stat cards (full width, desktop/tablet only —
          mobile gets its own gradient KPI carousel above) ---------- */}
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

      {/* ---------- Two-column body (desktop/tablet only — mobile gets its
          own Overview / Activity / Team tabs above) ----------
          Left:  Check-in/out -> Recent Activity -> Attendance Trend (+ Dept
                 Distribution, same "chart" grouping)
          Right: On Leave Today -> Announcements -> Upcoming Birthdays ->
                 Top Performance
      ---------------------------------------------------------------- */}
      <div className="hidden lg:grid lg:grid-cols-[65%_1fr] gap-4 sm:gap-6 items-start min-w-0">
        {/* ================= Left column (65%) ================= */}
        <div className="flex flex-col gap-4 sm:gap-6 min-w-0">
          {/* ---------- Check-in/out (HR Admin is a person too) ---------- */}
          {/* <CheckInOutCard onActivityChange={loadLogs} /> */}

          {/* ---------- Recent audit activity: fixed height, hidden scrollbar ---------- */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 flex flex-col h-[300px] sm:h-[360px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <ShieldCheck size={17} className="text-orange-500" /> Recent
                Activity
              </h3>
              <Link
                to="/super-admin/security/audit-logs"
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Megaphone size={17} className="text-orange-500" />{" "}
                Announcements
              </h3>
              {/* Create — Super Admin only; this dashboard file is
                  Super Admin only, so no extra role check is needed here. */}
              <button
                onClick={openAnnounce}
                title="Create announcement"
                aria-label="Create announcement"
                className="w-7 h-7 rounded-full bg-orange-50 hover:bg-orange-500 text-orange-500 hover:text-white flex items-center justify-center transition-colors shrink-0"
              >
                <Plus size={14} />
              </button>
            </div>
            {announcements.length === 0 ? (
              <p className="text-sm text-slate-400">No announcements yet.</p>
            ) : (
              <div className="space-y-2 overflow-y-auto no-scrollbar flex-1">
                {/* Active announcements first, then expired ones (most
                    recently ended first) — expired stay visible, just
                    styled differently, instead of disappearing. */}
                {[...announcements]
                  .sort((a, b) => {
                    const aExpired = isAnnouncementExpired(a);
                    const bExpired = isAnnouncementExpired(b);
                    if (aExpired !== bExpired) return aExpired ? 1 : -1;
                    return (b.end_date || "").localeCompare(a.end_date || "");
                  })
                  .map((a) => {
                    const expired = isAnnouncementExpired(a);
                    return (
                      <div
                        key={a.id}
                        className={
                          "group relative rounded-lg p-2.5 pr-16 border " +
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

                        {/* Edit / Delete — only appear on hover, Super Admin
                            only (this whole dashboard file is Super Admin
                            only). */}
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => openEditAnnounce(a)}
                            title="Edit announcement"
                            aria-label="Edit announcement"
                            className="w-6 h-6 rounded-md bg-white border border-orange-200 text-orange-500 hover:bg-orange-500 hover:text-white flex items-center justify-center transition-colors shrink-0"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAnnounceItem(a)}
                            disabled={deletingAnnounceId === a.id}
                            title="Delete announcement"
                            aria-label="Delete announcement"
                            className="w-6 h-6 rounded-md bg-white border border-red-200 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
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

      {/* ---------- Create / Edit Announcement modal (Super Admin only) ---------- */}
      {announceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {editingAnnounceId
                    ? "Edit Announcement"
                    : "Create Announcement"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visible to every role on their dashboard.
                </p>
              </div>
              <button
                onClick={() => {
                  setAnnounceOpen(false);
                  setEditingAnnounceId(null);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitAnnounce} className="px-6 py-5 space-y-4">
              {announceError && (
                <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-100 text-orange-600 text-sm px-3 py-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{announceError}</span>
                </div>
              )}

              <label className="block">
                <span className="text-xs font-medium text-slate-600 mb-1 block">
                  Title <span className="text-orange-500">*</span>
                </span>
                <input
                  autoFocus
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
                  value={announceForm.title}
                  onChange={(e) =>
                    setAnnounceForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="Office closed on Aug 15"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-600 mb-1 block">
                  Description
                </span>
                <textarea
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 resize-none"
                  value={announceForm.description}
                  onChange={(e) =>
                    setAnnounceForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Details for this announcement..."
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600 mb-1 block">
                    Start date <span className="text-orange-500">*</span>
                  </span>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
                    value={announceForm.start_date}
                    onChange={(e) =>
                      setAnnounceForm((f) => ({
                        ...f,
                        start_date: e.target.value,
                      }))
                    }
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-600 mb-1 block">
                    End date <span className="text-orange-500">*</span>
                  </span>
                  <input
                    type="date"
                    min={announceForm.start_date || undefined}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
                    value={announceForm.end_date}
                    onChange={(e) =>
                      setAnnounceForm((f) => ({
                        ...f,
                        end_date: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAnnounceOpen(false);
                    setEditingAnnounceId(null);
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={announceSaving}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  {announceSaving
                    ? editingAnnounceId
                      ? "Saving…"
                      : "Publishing…"
                    : editingAnnounceId
                      ? "Save changes"
                      : "Publish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
