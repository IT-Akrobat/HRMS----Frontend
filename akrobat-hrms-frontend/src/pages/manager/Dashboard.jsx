import {
  Activity,
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  LogIn,
  LogOut,
  MapPin,
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
      });
    }
    if (row.check_out_time) {
      events.push({
        key: `${row.id}-out`,
        name,
        kind: "checkout",
        action: "Checked out",
        time: row.check_out_time,
      });
    }
  }
  return events.sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
  );
}

export default function ManagerDashboard() {
  const { user } = useAuth();

  const [teamAttendance, setTeamAttendance] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  const [teamLeaves, setTeamLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(true);

  function loadTeamLeaves() {
    setLeavesLoading(true);
    apiClient
      .get("/leaves/team")
      .then((res) =>
        setTeamLeaves((res.data || []).filter((l) => l.status === "Pending")),
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

  useEffect(() => {
    loadTeamAttendance();
    loadTeamLeaves();
  }, []);

  const presentCount = teamAttendance.filter(
    (a) => a.status === "Present",
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
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
          value={teamLeaves.length}
        />
      </div>

      {/* ---------- Two-column body ----------
          Left (65%):  Check-in/out -> Team Recent Activity
          Right (35%): Pending Leave Requests -> Team Attendance (Today)
                       -> On Leave Today -> Upcoming Birthdays. Every card
                       below is a fixed height with its own hidden-
                       scrollbar overflow so extra items scroll inside the
                       card instead of growing the row.
      ---------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-[65%_1fr] gap-6 items-start min-w-0">
        {/* ================= Left column (65%) ================= */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* ---------- Check-in/out (a Manager is a person too) ---------- */}
          <CheckInOutCard onActivityChange={loadTeamAttendance} />

          {/* ---------- Team Recent Activity: fixed height, hidden scrollbar ---------- */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col h-[360px]">
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
                {teamActivity.map((entry) => (
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
                      </div>
                      {entry.time && (
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {formatTime(entry.time)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ================= Right column (35%) =================
            Fixed height + its own vertical scroll, so this column never
            grows taller than the viewport / left column — it scrolls
            independently instead of pushing the page down. */}
        <div className="flex flex-col gap-6 min-w-0 lg:h-[calc(100vh-6rem)] lg:sticky lg:top-4 lg:overflow-y-auto lg:pr-1 no-scrollbar">
          {/* ---------- Pending team leave requests (view-only) ---------- */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 h-72 flex flex-col">
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
                    <span className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-orange-50 text-orange-600">
                      Pending
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ---------- Team attendance snapshot ---------- */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 h-72 flex flex-col">
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
              <div className="overflow-y-auto overflow-x-auto no-scrollbar flex-1 min-w-0">
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
            )}
          </div>

          {/* ---------- On Leave Today ---------- */}
          <div className="h-72">
            <OnLeaveTodayCard />
          </div>

          {/* ---------- Upcoming Birthdays ---------- */}
          <div className="h-72">
            <BirthdaysCard />
          </div>
        </div>
      </div>
    </div>
  );
}
