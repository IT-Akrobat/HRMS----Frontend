import {
  Activity,
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  LogIn,
  LogOut,
  MapPin,
  Megaphone,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BirthdaysCard, {
  OnLeaveTodayCard,
} from "../../components/common/CelebrationsStrip";
import CheckInOutCard from "../../components/common/CheckInOutCard";
import PageHeader from "../../components/common/PageHeader";
import QuoteOfDayCard from "../../components/common/Quoteofdaycard ";
import StatCard from "../../components/common/StatCard";

import { useAuth } from "../../context/AuthContext";
import { useAttendanceLiveUpdates } from "../../hooks/Useattendanceliveupdates ";
import { apiClient } from "../../services/apiClient";
import { parseServerDate } from "../../utils/date";

// This one page serves MANAGER, OPERATIONS MANAGER, and INSPECTION MANAGER
// (and TEAM LEADER, until it gets its own area) — see normalizeRole() in
// src/config/roles.js. GET /attendance/team and GET /leaves/team are both
// already scoped server-side to "this caller's direct + indirect reports"
// (see get_all_report_ids in the backend), so no extra role branching is
// needed here — the data returned is naturally different per manager.
//
// READ-ONLY: company policy is that only SUPER ADMIN can approve/reject
// leave (PUT /leaves/{id} is gated to SUPER ADMIN at the route level), so
// the Pending Leave Requests widget just surfaces pending count — no
// Approve/Reject actions.

// An announcement is "expired" once today is past its end_date. The
// Announcements panel keeps showing these (greyed out) instead of hiding
// them the moment /announcements/active would stop returning them.
function isAnnouncementExpired(a) {
  if (!a?.end_date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return a.end_date < today;
}

// Small circular icon button shown next to the quote in the header —
// mirrors QuickActionCircle on the Super Admin / HR Admin dashboards.
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

function formatTime(value) {
  if (!value) return "";
  const d = parseServerDate(value);
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

// Mirrors distanceMeters/resolveLocationName in the HR Admin / Super Admin
// dashboards — matches a raw check-in/out coordinate against the company's
// registered locations so Team Recent Activity can show *where* each event
// happened, not just when.
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

// Pending -> orange, anything else (namely Expired, once a leave's dates
// pass without a decision) -> greyed out, same treatment Super Admin's
// Leave Requests screen gives non-active statuses.
function leaveBadgeStyle(status) {
  if (status === "Pending") {
    return "bg-orange-50 text-orange-600";
  }
  return "bg-slate-100 text-slate-500";
}

// Colored-circle icon per activity type — mirrors the LogIcon used on the
// Super Admin / HR Admin Recent Activity panels, trimmed to the two kinds
// team attendance rows can actually produce.
function LogIcon({ kind }) {
  const map = {
    checkin: { Icon: LogIn, bg: "bg-blue-100", fg: "text-blue-500" },
    checkout: { Icon: LogOut, bg: "bg-[#0B1830]/10", fg: "text-[#0B1830]" },
  };
  const { Icon, bg, fg } = map[kind] || map.checkin;
  return (
    <div
      className={`w-8 h-8 rounded-full ${bg} ${fg} flex items-center justify-center shrink-0`}
    >
      <Icon size={14} />
    </div>
  );
}

// Turns today's team attendance rows into a flat, most-recent-first feed
// of check-in / check-out events — there's no team-scoped audit-log
// endpoint a Manager can call (GET /audit-logs requires VIEW_AUDIT_LOGS),
// but GET /attendance/team is already fetched for the table below, so
// this reuses the same data instead of a separate request.
function buildTeamActivity(teamAttendance) {
  const events = [];
  for (const row of teamAttendance) {
    const name = row.employees?.full_name || "Unknown";
    if (row.check_in_time) {
      events.push({
        key: `${row.id}-in`,
        name,
        kind: "checkin",
        action: "Checked in",
        time: row.check_in_time,
        lat: row.check_in_latitude ?? null,
        lon: row.check_in_longitude ?? null,
      });
    }
    if (row.check_out_time) {
      events.push({
        key: `${row.id}-out`,
        name,
        kind: "checkout",
        action: "Checked out",
        time: row.check_out_time,
        lat: row.check_out_latitude ?? null,
        lon: row.check_out_longitude ?? null,
      });
    }
  }
  return events.sort((a, b) => {
    const aTime = parseServerDate(a.time)?.getTime() ?? 0;
    const bTime = parseServerDate(b.time)?.getTime() ?? 0;
    return bTime - aTime;
  });
}

export default function ManagerDashboard() {
  const { user } = useAuth();

  const [teamAttendance, setTeamAttendance] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  const [teamLeaves, setTeamLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(true);

  // Which team work-list tab is active in the mobile-only segmented
  // switcher below (Activity / Attendance / Requests). Desktop/tablet
  // (lg and up) keeps the original always-visible stacked cards
  // untouched — this only drives the lg:hidden layout.
  const [mobileTab, setMobileTab] = useState("activity");

  // Needed to turn raw check-in/out coordinates in Team Recent Activity
  // into a real location name instead of showing nothing.
  const [locations, setLocations] = useState([]);

  // Company-wide announcements (created by Super Admin) — every role's
  // dashboard reads the same GET /announcements/active endpoint so a new
  // announcement shows up everywhere automatically. This panel was
  // missing here, unlike the Employee/HR Admin/Super Admin dashboards.
  const [announcements, setAnnouncements] = useState([]);

  function loadTeamLeaves() {
    setLeavesLoading(true);
    apiClient
      .get("/leaves/team")
      .then((res) =>
        setTeamLeaves(
          (res.data || []).filter(
            (l) => l.status === "Pending" || l.status === "Expired",
          ),
        ),
      )
      .catch(() => setTeamLeaves([]))
      .finally(() => setLeavesLoading(false));
  }

  function loadTeamAttendance() {
    setAttendanceLoading(true);
    apiClient
      .get("/attendance/team")
      .then((res) => setTeamAttendance(res.data || []))
      .catch(() => setTeamAttendance([]))
      .finally(() => setAttendanceLoading(false));
  }

  function loadAnnouncements() {
    apiClient
      // Fetch every announcement (not just /active) so expired ones stay
      // visible here, greyed out, instead of vanishing the moment their
      // end_date passes — matches Employee/Super Admin's panel.
      .get("/announcements/")
      .then((res) => setAnnouncements(res.data || []))
      .catch(() => setAnnouncements([]));
  }

  // Refetches the instant anyone on this manager's team checks in/out,
  // starts/ends a break, applies for/has their leave decided on, or a
  // company-wide announcement changes — instead of only reflecting
  // whatever was true when this page first loaded or the manager last
  // hit refresh.
  useAttendanceLiveUpdates(() => {
    loadTeamAttendance();
    loadTeamLeaves();
    loadAnnouncements();
  });

  useEffect(() => {
    loadTeamAttendance();
    loadTeamLeaves();
    loadAnnouncements();

    apiClient
      .get("/locations/")
      .then((res) => setLocations(res.data || []))
      .catch(() => setLocations([]));
  }, []);

  const presentCount = teamAttendance.filter(
    (a) => a.status === "Present",
  ).length;

  // teamLeaves now also carries Expired requests (greyed out, see
  // leaveBadgeStyle) alongside Pending ones — the numeric counters
  // above/below should still reflect Pending only.
  const pendingLeaveCount = teamLeaves.filter(
    (l) => l.status === "Pending",
  ).length;

  const teamActivity = buildTeamActivity(teamAttendance).slice(0, 25);

  return (
    <div className="overflow-x-hidden">
      {/* Hides the scrollbar visually on fixed-height scroll panels below,
          while keeping them scrollable. */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ---------- Desktop/tablet header (lg and up) — unchanged ---------- */}
      <div className="hidden lg:block">
        <PageHeader
          title={`Good Morning, ${user?.name?.split(" ")[0] || "Manager"}`}
          subtitle="Here's how your team is doing today"
          actions={
            <div className="flex items-center gap-3">
              <QuickActionCircle
                to="/manager/team/locations?new=1"
                label="New Site"
                icon={MapPin}
              />
              <QuoteOfDayCard compact />
            </div>
          }
        />
      </div>

      {/* ---------- Mobile header (below lg) ----------
          Greeting + New Site action on the same row (right-aligned),
          subtitle below, then Quote of the Day full-width. */}
      <div className="lg:hidden mb-4">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">
            Good Morning, {user?.name?.split(" ")[0] || "Manager"}
          </h1>
          <QuickActionCircle
            to="/manager/team/locations?new=1"
            label="New Site"
            icon={MapPin}
          />
        </div>
        <p className="text-sm text-slate-500 mb-3">
          Here's how your team is doing today
        </p>

        <QuoteOfDayCard compact />
      </div>

      {/* ---------- Desktop/tablet stat grid (lg and up) — unchanged ---------- */}
      <div className="hidden lg:grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <StatCard
          icon={Users}
          label="Team Size"
          color="orange"
          loading={attendanceLoading}
          value={teamAttendance.length || "—"}
        />
        <StatCard
          icon={UserCheck}
          label="Present Today"
          color="green"
          loading={attendanceLoading}
          value={presentCount}
        />
        <StatCard
          icon={CalendarClock}
          label="Pending Requests"
          color="blue"
          loading={leavesLoading}
          value={pendingLeaveCount}
        />
      </div>

      {/* Mobile stat strip removed on purpose — manager asked for it off
          the mobile screen; the same numbers still live in the segmented
          tab badges and the desktop grid below (unaffected). */}

      {/* ---------- Two-column body ----------
          Left (65%):  Check-in/out -> Team Recent Activity
          Right (35%): Pending Leave Requests -> Team Attendance (Today)
                       -> On Leave Today -> Announcements -> Upcoming
                       Birthdays. Every card below is a fixed height with
                       its own hidden-scrollbar overflow so extra items
                       scroll inside the card instead of growing the row.
      ---------------------------------------------------------------- */}
      <div className="hidden lg:grid lg:grid-cols-[65%_1fr] gap-4 sm:gap-6 items-start min-w-0">
        {/* ================= Left column (65%) ================= */}
        <div className="flex flex-col gap-4 sm:gap-6 min-w-0">
          {/* ---------- Check-in/out (a Manager is a person too) ---------- */}
          <CheckInOutCard onActivityChange={loadTeamAttendance} />

          {/* ---------- Team Recent Activity: fixed height, hidden scrollbar ---------- */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 flex flex-col h-[300px] sm:h-[360px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Activity size={17} className="text-orange-500" /> Team Recent
                Activity
              </h3>
              <Link
                to="/manager/team/members"
                className="text-xs text-orange-600 font-medium flex items-center gap-1"
              >
                View Team <ArrowRight size={12} />
              </Link>
            </div>

            {attendanceLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-10 bg-slate-100 rounded animate-pulse"
                  />
                ))}
              </div>
            ) : teamActivity.length === 0 ? (
              <p className="text-sm text-slate-400">
                No team check-in/check-out activity yet today.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-y-auto no-scrollbar flex-1">
                {teamActivity.map((entry) => {
                  const matchedOffice = resolveLocationName(
                    entry.lat,
                    entry.lon,
                    locations,
                  );
                  // Matched company office -> raw coordinates, so a
                  // check-in from outside every registered office (e.g. a
                  // different city/country) still shows something.
                  const locationName =
                    matchedOffice ||
                    (entry.lat != null && entry.lon != null
                      ? `${Number(entry.lat).toFixed(4)}, ${Number(
                          entry.lon,
                        ).toFixed(4)}`
                      : null);
                  return (
                    <li
                      key={entry.key}
                      className="py-2.5 px-2.5 -mx-2.5 mb-1.5 rounded-lg bg-slate-50 lg:bg-transparent lg:mx-0 lg:mb-0 lg:px-0 lg:rounded-none flex items-start gap-2.5"
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
          </div>
        </div>

        {/* ================= Right column (35%) =================
            Fixed height + its own vertical scroll, so this column never
            grows taller than the viewport / left column — it scrolls
            independently instead of pushing the page down. */}
        <div className="flex flex-col gap-4 sm:gap-6 min-w-0 lg:h-[calc(100vh-6rem)] lg:sticky lg:top-4 lg:overflow-y-auto lg:pr-1 no-scrollbar">
          {/* ---------- Pending team leave requests (view-only) ---------- */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 h-60 sm:h-72 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <ClipboardCheck size={17} className="text-orange-500" /> Pending
                Leave Requests
              </h3>
              <Link
                to="/manager/leave/pending"
                className="text-xs text-orange-600 font-medium flex items-center gap-1"
              >
                View All <ArrowRight size={12} />
              </Link>
            </div>

            {leavesLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-12 bg-slate-100 rounded animate-pulse"
                  />
                ))}
              </div>
            ) : teamLeaves.length === 0 ? (
              <p className="text-sm text-slate-400">
                No pending leave requests from your team.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-y-auto no-scrollbar flex-1">
                {teamLeaves.map((leave) => (
                  <li
                    key={leave.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {leave.employees?.full_name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {leave.leave_types?.leave_name} · {leave.from_date} →{" "}
                        {leave.to_date}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${leaveBadgeStyle(
                        leave.status,
                      )}`}
                    >
                      {leave.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ---------- Team attendance snapshot ---------- */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 h-60 sm:h-72 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">
                Team Attendance — Today
              </h3>
              <Link
                to="/manager/team/members"
                className="text-xs text-orange-600 font-medium flex items-center gap-1"
              >
                View Team <ArrowRight size={12} />
              </Link>
            </div>

            {attendanceLoading ? (
              <div className="h-24 bg-slate-100 rounded animate-pulse" />
            ) : teamAttendance.length === 0 ? (
              <p className="text-sm text-slate-400">
                No attendance records for your team today.
              </p>
            ) : (
              <>
                {/* ---------- Desktop/tablet table (lg and up) — unchanged ---------- */}
                <div className="hidden lg:block overflow-y-auto overflow-x-auto no-scrollbar flex-1 min-w-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                        <th className="pb-2 font-medium">Employee</th>
                        <th className="pb-2 font-medium">In</th>
                        <th className="pb-2 font-medium">Out</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {teamAttendance.map((row) => (
                        <tr key={row.id}>
                          <td className="py-2 text-slate-700 truncate max-w-[120px]">
                            {row.employees?.full_name || "—"}
                          </td>
                          <td className="py-2 text-slate-500 whitespace-nowrap">
                            {row.check_in_time
                              ? parseServerDate(
                                  row.check_in_time,
                                )?.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td className="py-2 text-slate-500 whitespace-nowrap">
                            {row.check_out_time
                              ? parseServerDate(
                                  row.check_out_time,
                                )?.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td className="py-2">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                                row.status === "Present"
                                  ? "bg-blue-50 text-blue-600"
                                  : "bg-orange-50 text-orange-500"
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ---------- Mobile card list (below lg) ----------
                    A scrolling table doesn't work well on a phone — each
                    employee gets a compact row card instead, with In/Out
                    stacked and the status badge up top where a thumb can
                    scan it at a glance. */}
                <ul className="lg:hidden divide-y divide-slate-100 overflow-y-auto no-scrollbar flex-1 -mr-1 pr-1">
                  {teamAttendance.map((row) => (
                    <li
                      key={row.id}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {row.employees?.full_name || "—"}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          In{" "}
                          {row.check_in_time
                            ? parseServerDate(
                                row.check_in_time,
                              )?.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                          {"  ·  "}
                          Out{" "}
                          {row.check_out_time
                            ? parseServerDate(
                                row.check_out_time,
                              )?.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
                          row.status === "Present"
                            ? "bg-blue-50 text-blue-600"
                            : "bg-orange-50 text-orange-500"
                        }`}
                      >
                        {row.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

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
              <p className="text-sm text-slate-400">No active announcements.</p>
            ) : (
              <div className="space-y-2 overflow-y-auto no-scrollbar flex-1">
                {/* Active announcements first, then expired ones (most
                    recently ended first) — expired stay visible, just
                    greyed out, instead of disappearing. */}
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
        </div>
      </div>
      {/* ================= END desktop/tablet body ================= */}

      {/* =================================================================
          MOBILE-ONLY DASHBOARD BODY (below lg)
          A different pattern from the desktop two-column layout on
          purpose: Check-in up top, then the three team work-lists
          (Activity / Attendance / Requests) live behind a segmented tab
          switcher instead of three separate stacked full-height cards —
          a manager only looks at one of these at a time, so only one is
          on screen. The lighter glance content (On Leave, Announcements,
          Birthdays) is a swipeable card carousel instead of a bento grid
          + bottom sheet. Same data/components as desktop; only the
          interaction changes.
      ================================================================= */}
      <div className="lg:hidden">
        {/* ---------- Check-in/out (a Manager is a person too) ----------
            Deliberately NOT the plain white bordered card used on desktop
            and on the Employee dashboard — a slim gradient-bordered shell
            plus the new `ultraCompact` layout on CheckInOutCard itself
            (single row, no side timeline) keeps this short. The shared
            component's default rendering (desktop/Employee mobile) is
            unaffected — `ultraCompact` is opt-in. */}
        <div className="mb-5 rounded-2xl bg-gradient-to-br from-[#0B1830] via-[#132445] to-orange-500/90 p-[3px] shadow-lg shadow-slate-900/10 [&>div]:rounded-[13px]">
          <CheckInOutCard ultraCompact onActivityChange={loadTeamAttendance} />
        </div>

        {/* ---------- Segmented tabs: Activity / Attendance / Requests / On Leave ---------- */}
        <div className="flex items-center gap-2 mb-2 px-0.5">
          <span className="h-1.5 w-4 rounded-full bg-orange-500" />
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Your Team
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-1.5 bg-slate-100 rounded-xl p-1 mb-3">
          {[
            { key: "activity", label: "Activity", icon: Activity },
            // { key: "attendance", label: "Attendance", icon: UserCheck },
            {
              key: "requests",
              label: "Requests",
              icon: ClipboardCheck,
              badge: pendingLeaveCount || null,
            },
            // { key: "onleave", label: "On Leave", icon: PlaneTakeoff },
          ].map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMobileTab(key)}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-medium transition-colors ${
                mobileTab === key
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              <Icon size={14} />
              {label}
              {badge ? (
                <span className="absolute top-1 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[9px] font-semibold flex items-center justify-center">
                  {badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* ---------- Active tab panel ----------
            "On Leave" reuses OnLeaveTodayCard directly (it already brings
            its own card chrome/heading), so the wrapper drops its own
            border/padding for that one tab to avoid a card-in-a-card. */}
        <div
          className={
            mobileTab === "onleave"
              ? "h-[22rem] flex flex-col mb-6"
              : "bg-white rounded-xl border border-slate-200 p-3.5 h-[22rem] flex flex-col mb-6"
          }
        >
          {mobileTab === "onleave" && <OnLeaveTodayCard />}
          {mobileTab === "activity" && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <Activity size={15} className="text-orange-500" /> Team Recent
                  Activity
                </h3>
                <Link
                  to="/manager/team/members"
                  className="text-xs text-orange-600 font-medium flex items-center gap-1 shrink-0"
                >
                  View Team <ArrowRight size={12} />
                </Link>
              </div>

              {attendanceLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-10 bg-slate-100 rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : teamActivity.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No team check-in/check-out activity yet today.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 overflow-y-auto no-scrollbar flex-1">
                  {teamActivity.map((entry) => {
                    const matchedOffice = resolveLocationName(
                      entry.lat,
                      entry.lon,
                      locations,
                    );
                    const locationName =
                      matchedOffice ||
                      (entry.lat != null && entry.lon != null
                        ? `${Number(entry.lat).toFixed(4)}, ${Number(
                            entry.lon,
                          ).toFixed(4)}`
                        : null);
                    return (
                      <li
                        key={entry.key}
                        className="py-2.5 flex items-start gap-2.5"
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
            </>
          )}

          {mobileTab === "attendance" && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800 text-sm">
                  Team Attendance — Today
                </h3>
                <Link
                  to="/manager/team/members"
                  className="text-xs text-orange-600 font-medium flex items-center gap-1 shrink-0"
                >
                  View Team <ArrowRight size={12} />
                </Link>
              </div>

              {attendanceLoading ? (
                <div className="h-24 bg-slate-100 rounded animate-pulse" />
              ) : teamAttendance.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No attendance records for your team today.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 overflow-y-auto no-scrollbar flex-1">
                  {teamAttendance.map((row) => (
                    <li
                      key={row.id}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {row.employees?.full_name || "—"}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          In{" "}
                          {row.check_in_time
                            ? parseServerDate(
                                row.check_in_time,
                              )?.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                          {"  ·  "}
                          Out{" "}
                          {row.check_out_time
                            ? parseServerDate(
                                row.check_out_time,
                              )?.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
                          row.status === "Present"
                            ? "bg-blue-50 text-blue-600"
                            : "bg-orange-50 text-orange-500"
                        }`}
                      >
                        {row.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {mobileTab === "requests" && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800 text-sm">
                  Pending Leave Requests
                </h3>
                <Link
                  to="/manager/leave/pending"
                  className="text-xs text-orange-600 font-medium flex items-center gap-1 shrink-0"
                >
                  View All <ArrowRight size={12} />
                </Link>
              </div>

              {leavesLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-12 bg-slate-100 rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : teamLeaves.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No pending leave requests from your team.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 overflow-y-auto no-scrollbar flex-1">
                  {teamLeaves.map((leave) => (
                    <li
                      key={leave.id}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {leave.employees?.full_name}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {leave.leave_types?.leave_name} · {leave.from_date} →{" "}
                          {leave.to_date}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${leaveBadgeStyle(
                          leave.status,
                        )}`}
                      >
                        {leave.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* ---------- Team Pulse: swipeable card carousel ----------
            On Leave Today / Announcements / Upcoming Birthdays, one
            full-width card per swipe. Who's on leave is also reachable
            from the "On Leave" tab above — this is the quick-glance copy. */}
        <div className="flex items-center gap-2 mb-2 px-0.5">
          <span className="h-1.5 w-4 rounded-full bg-orange-500" />
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Team Pulse
          </h2>
        </div>

        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1 -mx-4 px-4">
          <div className="snap-start shrink-0 w-[86%]">
            <div className="h-64">
              <OnLeaveTodayCard />
            </div>
          </div>

          <div className="snap-start shrink-0 w-[86%]">
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 h-64 flex flex-col">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-3 text-sm">
                <Megaphone size={16} className="text-orange-500" />{" "}
                Announcements
              </h3>
              {announcements.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No active announcements.
                </p>
              ) : (
                <div className="space-y-2 overflow-y-auto no-scrollbar flex-1">
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
          </div>

          <div className="snap-start shrink-0 w-[86%]">
            <div className="h-64">
              <BirthdaysCard />
            </div>
          </div>
        </div>
      </div>
      {/* ================= END mobile-only dashboard body ================= */}
    </div>
  );
}
