import {
  AlertTriangle,
  Calendar,
  Clock,
  Download,
  TrendingUp,
  UserX,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
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

  return (
    <Modal
      open={!!employee}
      onClose={onClose}
      title={employee?.full_name}
      subtitle={`Daily attendance · ${formatDate(fromDate)} – ${formatDate(toDate)}`}
      width="max-w-lg"
    >
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
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
                  ? parseServerDate(r.check_in_time)?.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "--:--"}{" "}
                –{" "}
                {r.check_out_time
                  ? parseServerDate(r.check_out_time)?.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "--:--"}
              </span>
              <span className="text-slate-400">
                {formatMinutes(r.working_minutes)}
              </span>
              {r.late_minutes > 0 && (
                <span className="text-orange-500">+{r.late_minutes}m late</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
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
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            From
          </label>
          <input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            To
          </label>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            max={isoToday()}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
          />
        </div>
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

      <EmployeeDrilldown
        employee={selected}
        fromDate={fromDate}
        toDate={toDate}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
