import {
  AlertTriangle,
  Calendar,
  Clock,
  Download,
  TrendingUp,
  UserX,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import DatePicker from "../../components/layout/DatePicker";
import { apiClient } from "../../services/apiClient";
import {
  parseLocalISODate,
  parseServerDate,
  toLocalISODate,
} from "../../utils/date";
import { unwrap } from "../../utils/unwrap";

// ---------------------------------------------------------------------
// Manager -> Attendance -> Attendance Reports
//
// Per-employee attendance summary, for a manager-chosen date range,
// scoped to exactly this manager's direct + indirect reports — backed
// by GET /attendance/team/report (app/attendance/services.py
// get_team_attendance_report), a new endpoint added alongside this page
// because nothing existing fit: GET /attendance/team only ever returns
// a single day, and GET /attendance/analytics is a company-wide number
// gated behind VIEW_ALL_ATTENDANCE, which MANAGER doesn't hold (see
// sql/002_role_permissions_seed.sql).
//
// "Working day" in that summary is Mon-Fri in the selected range —
// shift-aware calendars exist per employee but resolving them per
// person per day for a whole team/range is out of scope for this
// summary; see the docstring on get_team_attendance_report for detail.
//
// Row click -> day-by-day breakdown for that one employee, via
// GET /attendance/employee/{employee_id} (now permitted for a manager
// viewing their own report's record — previously that endpoint only
// allowed viewing your own attendance or required VIEW_ALL_ATTENDANCE;
// app/attendance/services.py get_employee_attendance now also allows
// the caller's direct/indirect manager via is_manager_of()).
// ---------------------------------------------------------------------

function isoToday() {
  return toLocalISODate();
}

function firstOfMonth() {
  const d = new Date();
  return toLocalISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

function formatDate(value) {
  if (!value) return "—";
  const d = parseLocalISODate(value);
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
  });
}

function formatMinutes(mins) {
  const total = Math.max(0, Math.round(Number(mins) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function pctColor(pct) {
  if (pct >= 90) return "text-green-600 bg-green-50";
  if (pct >= 75) return "text-blue-600 bg-blue-50";
  return "text-orange-600 bg-orange-50";
}

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function Avatar({ person, className }) {
  return person?.profile_photo ? (
    <img
      src={person.profile_photo}
      alt={person.full_name}
      className={`${className} object-cover shrink-0`}
    />
  ) : (
    <div
      className={`${className} bg-orange-50 text-orange-600 flex items-center justify-center font-semibold shrink-0`}
    >
      {initials(person?.full_name)}
    </div>
  );
}

function toCSV(report) {
  const header = [
    "Employee ID",
    "Name",
    "Department",
    "Designation",
    "Working Days",
    "Present",
    "Half Day",
    "Leave",
    "Absent",
    "Late Days",
    "Attendance %",
    "Total Working Hours",
    "Overtime Hours",
  ];
  const rows = report.employees.map((e) => [
    e.employee_code,
    e.full_name,
    e.department || "",
    e.designation || "",
    e.working_days,
    e.present_days,
    e.half_days,
    e.leave_days,
    e.absent_days,
    e.late_days,
    e.attendance_percentage,
    (e.total_working_minutes / 60).toFixed(1),
    (e.total_overtime_minutes / 60).toFixed(1),
  ]);
  return [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function downloadCSV(report) {
  const csv = toCSV(report);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance-report-${report.from_date}-to-${report.to_date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function EmployeeDrilldown({ employee, fromDate, toDate, onClose }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!employee) return;
    setLoading(true);
    setError(null);
    apiClient
      .get(`/attendance/employee/${employee.employee_id}?page=1&limit=200`)
      .then((res) => {
        const payload = unwrap(res);
        const all = payload?.records || [];
        const inRange = all.filter(
          (r) => r.attendance_date >= fromDate && r.attendance_date <= toDate,
        );
        setRecords(inRange);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [employee, fromDate, toDate]);

  useEffect(() => {
    if (!employee) return;
    const raf = requestAnimationFrame(() => setShow(true));
    return () => {
      cancelAnimationFrame(raf);
      setShow(false);
    };
  }, [employee]);

  useEffect(() => {
    if (!employee) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [employee, onClose]);

  if (!employee) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/50 transition-opacity duration-200 ${
          show ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        className={`absolute inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl flex flex-col transition-transform duration-200 ease-out ${
          show ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar person={employee} className="w-12 h-12 rounded-full" />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-800 truncate">
                {employee?.full_name}
              </h2>
              <p className="text-xs text-slate-500">
                Daily attendance · {formatDate(fromDate)} – {formatDate(toDate)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 bg-slate-100 rounded animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <div className="text-sm text-orange-500 flex items-center gap-2">
              <AlertTriangle size={14} /> {error}
            </div>
          ) : records.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              No check-in activity recorded in this range.
            </p>
          ) : (
            <div className="space-y-1.5">
              {records.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2"
                >
                  <span className="font-medium text-slate-600 w-24 shrink-0">
                    {formatDate(r.attendance_date)}
                  </span>
                  <span
                    className={`shrink-0 font-medium px-2 py-0.5 rounded-full ${
                      r.status === "Half Day"
                        ? "text-orange-600 bg-orange-50"
                        : "text-green-600 bg-green-50"
                    }`}
                  >
                    {r.status}
                  </span>
                  <span className="text-slate-500">
                    {r.check_in_time
                      ? parseServerDate(r.check_in_time)?.toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )
                      : "--:--"}{" "}
                    –{" "}
                    {r.check_out_time
                      ? parseServerDate(r.check_out_time)?.toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )
                      : "--:--"}
                  </span>
                  <span className="text-slate-400">
                    {formatMinutes(r.working_minutes)}
                  </span>
                  {r.late_minutes > 0 && (
                    <span className="text-orange-500">
                      +{r.late_minutes}m late
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Mobile-only presentation piece below (StatChip) and the `lg:hidden`
// block in the return statement further down. Nothing above this
// line, and none of the desktop JSX in the `hidden lg:block` block,
// is changed — same state, same `load()`, same derived `totals` feed
// both layouts; only the markup below switches on the `lg` (1024px)
// breakpoint, the same one Sidebar/Header already use. EmployeeDrilldown
// is rendered once, outside both blocks, so it works the same way
// regardless of which layout triggered it (see bottom of this file).
// ---------------------------------------------------------------------

// Compact stat card that scrolls horizontally on mobile instead of
// sitting in the desktop's 4-column grid.
function StatChip({ icon: Icon, label, value }) {
  return (
    <div className="shrink-0 min-w-[132px] bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1.5">
        <Icon size={13} />
        {label}
      </div>
      <div className="text-lg font-bold text-slate-800">{value}</div>
    </div>
  );
}

export default function ManagerAttendanceReports() {
  const [fromDate, setFromDate] = useState(firstOfMonth());
  const [toDate, setToDate] = useState(isoToday());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    apiClient
      .get(`/attendance/team/report?from_date=${fromDate}&to_date=${toDate}`)
      .then((res) => setReport(unwrap(res)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const employees = report?.employees || [];

  const totals = useMemo(() => {
    if (employees.length === 0) {
      return { avgPct: 0, present: 0, absent: 0, late: 0 };
    }
    const present = employees.reduce(
      (s, e) => s + e.present_days + e.half_days,
      0,
    );
    const absent = employees.reduce((s, e) => s + e.absent_days, 0);
    const late = employees.reduce((s, e) => s + e.late_days, 0);
    const avgPct =
      employees.reduce((s, e) => s + (e.attendance_percentage || 0), 0) /
      employees.length;
    return { avgPct: Math.round(avgPct * 10) / 10, present, absent, late };
  }, [employees]);

  return (
    <div>
      {/* =================== DESKTOP (unchanged) =================== */}
      <div className="hidden lg:block">
        <PageHeader
          title="Attendance Reports"
          subtitle="Attendance summary for your direct and indirect reports over a date range."
          actions={
            report &&
            employees.length > 0 && (
              <button
                onClick={() => downloadCSV(report)}
                className="flex items-center gap-1.5 border border-slate-200 text-slate-700 text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-slate-50"
              >
                <Download size={14} /> Export CSV
              </button>
            )
          }
        />

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <DatePicker
            label="From"
            value={fromDate}
            max={toDate}
            onChange={(iso) => setFromDate(iso)}
          />
          <DatePicker
            label="To"
            value={toDate}
            min={fromDate}
            max={isoToday()}
            onChange={(iso) => setToDate(iso)}
          />
          <button
            onClick={load}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            Apply
          </button>
          {report && (
            <span className="text-xs text-slate-400 sm:ml-auto">
              {report.working_days} working day
              {report.working_days !== 1 ? "s" : ""} in range (Mon–Fri)
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={Users}
            label="Team Size"
            value={employees.length}
            loading={loading}
          />
          <StatCard
            icon={TrendingUp}
            label="Avg. Attendance"
            value={`${totals.avgPct}%`}
            color="blue"
            loading={loading}
          />
          <StatCard
            icon={UserX}
            label="Total Absences"
            value={totals.absent}
            color="red"
            loading={loading}
          />
          <StatCard
            icon={Clock}
            label="Late Instances"
            value={totals.late}
            color="slate"
            loading={loading}
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 bg-slate-100 rounded animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-orange-500 flex items-center gap-2">
              <AlertTriangle size={14} /> {error}
            </div>
          ) : employees.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
              <Calendar size={22} className="text-slate-300" />
              No one reports to you yet, so there's no attendance to summarize.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3 text-center">Present</th>
                    <th className="px-4 py-3 text-center">Half Day</th>
                    <th className="px-4 py-3 text-center">Leave</th>
                    <th className="px-4 py-3 text-center">Absent</th>
                    <th className="px-4 py-3 text-center">Late</th>
                    <th className="px-4 py-3 text-center">Attendance %</th>
                    <th className="px-4 py-3 text-right">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr
                      key={e.employee_id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 cursor-pointer"
                      onClick={() => setSelected(e)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            person={e}
                            className="w-8 h-8 rounded-full text-xs"
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-slate-800 truncate">
                              {e.full_name}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              {e.department || "—"} · {e.designation || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {e.present_days}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {e.half_days}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {e.leave_days}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={
                            e.absent_days > 0
                              ? "text-orange-600 font-medium"
                              : "text-slate-400"
                          }
                        >
                          {e.absent_days}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={
                            e.late_days > 0
                              ? "text-orange-500 font-medium"
                              : "text-slate-400"
                          }
                        >
                          {e.late_days}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${pctColor(e.attendance_percentage)}`}
                        >
                          {e.attendance_percentage}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs">
                        {(e.total_working_minutes / 60).toFixed(1)}h
                        {e.total_overtime_minutes > 0 && (
                          <span className="text-blue-500">
                            {" "}
                            (+{(e.total_overtime_minutes / 60).toFixed(1)}h OT)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {/* ================== /DESKTOP (unchanged) ================== */}

      {/* ===================== MOBILE ===================== */}
      <div className="lg:hidden pb-6">
        <div className="sticky top-0 z-10 bg-[#F7F5EF] pt-1 pb-3 -mx-4 px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-800 truncate">
                Attendance Reports
              </h1>
              <p className="text-xs text-slate-500 truncate">
                {report
                  ? `${report.working_days} working day${report.working_days !== 1 ? "s" : ""} in range (Mon–Fri)`
                  : "Summary for your direct and indirect reports."}
              </p>
            </div>
            {report && employees.length > 0 && (
              <button
                onClick={() => downloadCSV(report)}
                className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 text-slate-600 active:bg-slate-50"
                aria-label="Export CSV"
              >
                <Download size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 min-w-0 border border-slate-200 rounded-lg bg-white px-3 py-2">
              <DatePicker
                value={fromDate}
                max={toDate}
                onChange={(iso) => setFromDate(iso)}
                className="w-full"
              />
            </div>
            <div className="flex-1 min-w-0 border border-slate-200 rounded-lg bg-white px-3 py-2">
              <DatePicker
                value={toDate}
                min={fromDate}
                max={isoToday()}
                onChange={(iso) => setToDate(iso)}
                className="w-full"
              />
            </div>
            <button
              onClick={load}
              className="shrink-0 bg-orange-500 active:bg-orange-600 text-white text-sm font-medium px-3.5 py-2 rounded-lg"
            >
              Go
            </button>
          </div>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 mb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <StatChip
            icon={Users}
            label="Team Size"
            value={loading ? "—" : employees.length}
          />
          <StatChip
            icon={TrendingUp}
            label="Avg. Attendance"
            value={loading ? "—" : `${totals.avgPct}%`}
          />
          <StatChip
            icon={UserX}
            label="Total Absences"
            value={loading ? "—" : totals.absent}
          />
          <StatChip
            icon={Clock}
            label="Late Instances"
            value={loading ? "—" : totals.late}
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-24 bg-slate-100 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="text-sm text-orange-500 flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-3">
            <AlertTriangle size={14} className="shrink-0" /> {error}
          </div>
        ) : employees.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
            <Calendar size={22} className="text-slate-300" />
            No one reports to you yet, so there's no attendance to summarize.
          </div>
        ) : (
          <div className="space-y-2">
            {employees.map((e) => (
              <button
                key={e.employee_id}
                type="button"
                onClick={() => setSelected(e)}
                className="w-full text-left bg-white border border-slate-200 rounded-xl p-3.5 active:bg-slate-50"
              >
                <div className="flex items-start gap-3">
                  <Avatar person={e} className="w-9 h-9 rounded-full text-xs" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {e.full_name}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {e.department || "—"} · {e.designation || "—"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${pctColor(e.attendance_percentage)}`}
                      >
                        {e.attendance_percentage}%
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 mt-3 text-center">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          {e.present_days}
                        </p>
                        <p className="text-[10px] text-slate-400">Present</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          {e.leave_days}
                        </p>
                        <p className="text-[10px] text-slate-400">Leave</p>
                      </div>
                      <div>
                        <p
                          className={`text-sm font-semibold ${
                            e.absent_days > 0
                              ? "text-orange-600"
                              : "text-slate-700"
                          }`}
                        >
                          {e.absent_days}
                        </p>
                        <p className="text-[10px] text-slate-400">Absent</p>
                      </div>
                      <div>
                        <p
                          className={`text-sm font-semibold ${
                            e.late_days > 0
                              ? "text-orange-500"
                              : "text-slate-700"
                          }`}
                        >
                          {e.late_days}
                        </p>
                        <p className="text-[10px] text-slate-400">Late</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-50 text-xs text-slate-500">
                      <span>
                        {(e.total_working_minutes / 60).toFixed(1)}h worked
                      </span>
                      {e.total_overtime_minutes > 0 && (
                        <span className="text-blue-500 font-medium">
                          +{(e.total_overtime_minutes / 60).toFixed(1)}h OT
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {/* ==================== /MOBILE ==================== */}

      {/* Shared drilldown — one instance handles taps from either the
          desktop table rows or the mobile cards above. */}
      <EmployeeDrilldown
        employee={selected}
        fromDate={fromDate}
        toDate={toDate}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
