import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Search,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import { apiClient } from "../../services/apiClient";

function asList(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

function firstOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(iso) {
  if (!iso) return "--";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function formatTime(iso) {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

const AVATAR_COLORS = [
  { bg: "bg-amber-100", text: "text-amber-800" },
  { bg: "bg-orange-100", text: "text-orange-800" },
  { bg: "bg-rose-100", text: "text-rose-800" },
  { bg: "bg-teal-100", text: "text-teal-800" },
  { bg: "bg-blue-100", text: "text-blue-800" },
  { bg: "bg-purple-100", text: "text-purple-800" },
];
function avatarColor(name) {
  const sum = (name || "?").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

const STATUS_STYLES = {
  Present: "bg-green-50 text-green-700",
  Late: "bg-amber-50 text-amber-700",
  Absent: "bg-red-50 text-red-700",
  "On Leave": "bg-blue-50 text-blue-700",
  "Half Day": "bg-purple-50 text-purple-700",
};

function downloadCsv(rows, filename) {
  const headers = [
    "Employee",
    "Employee ID",
    "Department",
    "Date",
    "Check In",
    "Check Out",
    "Hours",
    "Status",
  ];
  const lines = rows.map((r) =>
    [
      r.full_name || "",
      r.employee_code || "",
      r.department || "",
      r.date || "",
      r.check_in_time ? formatTime(r.check_in_time) : "",
      r.check_out_time ? formatTime(r.check_out_time) : "",
      r.working_hours ?? 0,
      r.status || "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function AttendanceReports() {
  const [fromDate, setFromDate] = useState(firstOfMonthISO());
  const [toDate, setToDate] = useState(todayISO());
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departmentId, setDepartmentId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("daily");

  const [report, setReport] = useState({ employees: [], daily_records: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient
      .get("/departments/")
      .then((res) => setDepartments(asList(res)))
      .catch(() => setDepartments([]));
    apiClient
      .get("/employees/")
      .then((res) => setEmployees(asList(res)))
      .catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      from_date: fromDate,
      to_date: toDate,
    });
    if (departmentId) params.set("department_id", departmentId);
    if (employeeId) params.set("employee_id", employeeId);
    if (status) params.set("status", status);

    apiClient
      .get(`/attendance/org/report?${params.toString()}`)
      .then((res) =>
        setReport({
          employees: res?.data?.employees || [],
          daily_records: res?.data?.daily_records || [],
        }),
      )
      .catch((err) => {
        setReport({ employees: [], daily_records: [] });
        setError(err.message || "Could not load the attendance report.");
      })
      .finally(() => setLoading(false));
  }, [fromDate, toDate, departmentId, employeeId, status]);

  const searchedRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return report.daily_records;
    return report.daily_records.filter(
      (r) =>
        r.full_name?.toLowerCase().includes(q) ||
        r.employee_code?.toLowerCase().includes(q),
    );
  }, [report.daily_records, search]);

  const searchedEmployeeIds = useMemo(
    () => new Set(searchedRecords.map((r) => r.employee_id)),
    [searchedRecords],
  );
  const searchedEmployeeSummaries = useMemo(
    () =>
      report.employees.filter((e) => searchedEmployeeIds.has(e.employee_id)),
    [report.employees, searchedEmployeeIds],
  );

  const summary = useMemo(() => {
    const totals = searchedEmployeeSummaries.reduce(
      (acc, e) => {
        acc.present += e.present_days || 0;
        acc.absent += e.absent_days || 0;
        acc.late += e.late_days || 0;
        acc.leave += e.leave_days || 0;
        acc.minutes += e.total_working_minutes || 0;
        acc.workingDays += e.working_days || 0;
        return acc;
      },
      { present: 0, absent: 0, late: 0, leave: 0, minutes: 0, workingDays: 0 },
    );
    const attendedDays = totals.present + totals.late;
    const avgHours =
      attendedDays > 0
        ? (totals.minutes / 60 / attendedDays).toFixed(1)
        : "0.0";
    const pct = (n) =>
      totals.workingDays ? Math.round((n / totals.workingDays) * 100) : 0;
    return {
      ...totals,
      avgHours,
      presentPct: pct(totals.present),
      absentPct: pct(totals.absent),
      latePct: pct(totals.late),
      leavePct: pct(totals.leave),
    };
  }, [searchedEmployeeSummaries]);

  const sparkline = useMemo(() => {
    const byDate = {};
    searchedRecords.forEach((r) => {
      if (!r.working_hours) return;
      byDate[r.date] = byDate[r.date] || [];
      byDate[r.date].push(r.working_hours);
    });
    const dates = Object.keys(byDate).sort().slice(-7);
    return dates.map((d) => {
      const vals = byDate[d];
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    });
  }, [searchedRecords]);

  const needsAttention = useMemo(() => {
    return [...searchedEmployeeSummaries]
      .map((e) => ({
        ...e,
        issue_count: (e.absent_days || 0) + (e.late_days || 0),
      }))
      .filter((e) => e.issue_count > 0)
      .sort((a, b) => b.issue_count - a.issue_count)
      .slice(0, 4);
  }, [searchedEmployeeSummaries]);

  const groupedByDepartment = useMemo(() => {
    const groups = {};
    searchedRecords.forEach((r) => {
      const key = r.department || "Unassigned";
      groups[key] = groups[key] || [];
      groups[key].push(r);
    });
    return groups;
  }, [searchedRecords]);

  function exportAll() {
    downloadCsv(searchedRecords, `attendance_${fromDate}_to_${toDate}.csv`);
  }

  function exportEmployee(employeeRecords, employeeName) {
    const safeName = (employeeName || "employee").replace(/\s+/g, "_");
    downloadCsv(
      employeeRecords,
      `attendance_${safeName}_${fromDate}_to_${toDate}.csv`,
    );
  }

  const TABS = [
    { key: "daily", label: "Daily log" },
    { key: "employee", label: "By employee" },
    { key: "department", label: "By department" },
  ];

  return (
    <div>
      <PageHeader
        title="Attendance reports"
        subtitle={`${formatDateLabel(fromDate)} – ${formatDateLabel(toDate)}`}
        actions={
          <button
            onClick={exportAll}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            <Download size={16} />
            Export all
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee"
            className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-48"
          />
        </div>
        <input
          type="date"
          value={fromDate}
          max={toDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
        />
        <input
          type="date"
          value={toDate}
          min={fromDate}
          max={todayISO()}
          onChange={(e) => setToDate(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
        />
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.department_name}
            </option>
          ))}
        </select>
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
        >
          <option value="">All employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
        >
          <option value="">All statuses</option>
          <option value="Present">Present</option>
          <option value="Late">Late</option>
          <option value="Absent">Absent</option>
          <option value="On Leave">On leave</option>
          <option value="Half Day">Half day</option>
        </select>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`text-sm px-3.5 py-1.5 rounded-md transition-colors ${
              view === t.key
                ? "bg-white font-medium text-slate-800 shadow-sm"
                : "text-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3 mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<CheckCircle2 size={14} />}
            iconColor="text-green-700"
            label="Present"
            value={summary.present}
            sub={`${summary.presentPct}% of workdays`}
            subColor="text-green-700"
          />
          <StatCard
            icon={<XCircle size={14} />}
            iconColor="text-red-700"
            label="Absent"
            value={summary.absent}
            sub={`${summary.absentPct}% of workdays`}
            subColor="text-red-700"
          />
          <StatCard
            icon={<Clock size={14} />}
            iconColor="text-amber-700"
            label="Late"
            value={summary.late}
            sub={`${summary.latePct}% of workdays`}
            subColor="text-amber-700"
          />
          <StatCard
            icon={<Calendar size={14} />}
            iconColor="text-blue-700"
            label="On leave"
            value={summary.leave}
            sub={`${summary.leavePct}% of workdays`}
            subColor="text-blue-700"
          />
        </div>

        <div className="bg-slate-50 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-end gap-1 h-10">
            {sparkline.length === 0 ? (
              <span className="text-xs text-slate-400">No data yet</span>
            ) : (
              sparkline.map((v, i) => (
                <div
                  key={i}
                  className="w-1.5 rounded-sm bg-orange-300"
                  style={{ height: `${Math.max(8, Math.min(40, v * 4))}px` }}
                />
              ))
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Avg hours/day</div>
            <div className="text-2xl font-semibold text-slate-800">
              {summary.avgHours}
            </div>
          </div>
        </div>
      </div>

      {needsAttention.length > 0 && (
        <div className="bg-slate-50 rounded-lg p-4 mb-5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
            <AlertTriangle size={13} />
            Needs attention
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {needsAttention.map((e) => {
              const color = avatarColor(e.full_name);
              return (
                <div
                  key={e.employee_id}
                  className="flex items-center gap-2 text-sm"
                >
                  <div
                    className={`w-5 h-5 rounded-full ${color.bg} ${color.text} text-[10px] font-medium flex items-center justify-center`}
                  >
                    {initials(e.full_name)}
                  </div>
                  <span className="text-slate-700">{e.full_name}</span>
                  <span className="text-xs text-slate-400">
                    {e.absent_days > 0 && `${e.absent_days} absent`}
                    {e.absent_days > 0 && e.late_days > 0 && " · "}
                    {e.late_days > 0 && `${e.late_days} late`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500 py-10 text-center">
          Loading attendance report…
        </div>
      ) : view === "daily" ? (
        searchedRecords.length === 0 ? (
          <EmptyState />
        ) : (
          Object.entries(groupedByDepartment).map(([deptName, records]) => (
            <DepartmentGroup
              key={deptName}
              deptName={deptName}
              records={records}
              onExportEmployee={exportEmployee}
            />
          ))
        )
      ) : view === "employee" ? (
        <EmployeeSummaryTable
          employees={searchedEmployeeSummaries}
          onExportEmployee={(emp) =>
            exportEmployee(
              searchedRecords.filter((r) => r.employee_id === emp.employee_id),
              emp.full_name,
            )
          }
        />
      ) : (
        <DepartmentSummaryTable
          employees={searchedEmployeeSummaries}
          onExportDepartment={(deptName) =>
            downloadCsv(
              searchedRecords.filter(
                (r) => (r.department || "Unassigned") === deptName,
              ),
              `attendance_${deptName.replace(/\s+/g, "_")}_${fromDate}_to_${toDate}.csv`,
            )
          }
        />
      )}
    </div>
  );
}

function StatCard({ icon, iconColor, label, value, sub, subColor }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3.5">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <span className={iconColor}>{icon}</span>
        {label}
      </div>
      <div className="text-xl font-semibold text-slate-800 mt-1.5">{value}</div>
      <div className={`text-[11px] mt-0.5 ${subColor}`}>{sub}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-sm text-slate-500 py-10 text-center bg-white rounded-xl border border-slate-100">
      No attendance records for this range and filters.
    </div>
  );
}

function DepartmentGroup({ deptName, records, onExportEmployee }) {
  const byEmployee = useMemo(() => {
    const groups = {};
    records.forEach((r) => {
      const key = r.employee_id;
      groups[key] = groups[key] || {
        name: r.full_name,
        code: r.employee_code,
        rows: [],
      };
      groups[key].rows.push(r);
    });
    return groups;
  }, [records]);

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden mb-4">
      <div className="px-4 py-3 text-xs font-medium text-slate-500 bg-slate-50">
        {deptName} · {Object.keys(byEmployee).length} employee
        {Object.keys(byEmployee).length !== 1 ? "s" : ""}
      </div>

      {Object.values(byEmployee).map((emp) => {
        const color = avatarColor(emp.name);
        return (
          <div key={emp.code || emp.name}>
            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full ${color.bg} ${color.text} text-[11px] font-medium flex items-center justify-center`}
                >
                  {initials(emp.name)}
                </div>
                <span className="text-sm font-medium text-slate-700">
                  {emp.name}
                </span>
                <span className="text-xs text-slate-400">{emp.code}</span>
              </div>
              <button
                onClick={() => onExportEmployee(emp.rows, emp.name)}
                className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium"
              >
                <Download size={13} />
                Download
              </button>
            </div>

            <table className="w-full text-sm">
              <tbody>
                {emp.rows.map((r) => (
                  <tr key={r.date} className="border-t border-slate-50">
                    <td className="px-4 py-2 text-slate-500 w-24">
                      {formatDateLabel(r.date)}
                    </td>
                    <td className="px-4 py-2">
                      {formatTime(r.check_in_time)} →{" "}
                      {formatTime(r.check_out_time)}
                    </td>
                    <td className="px-4 py-2 w-16">{r.working_hours}h</td>
                    <td className="px-4 py-2 text-right w-28">
                      <span
                        className={`text-xs px-2 py-1 rounded-md ${
                          STATUS_STYLES[r.status] ||
                          "bg-slate-50 text-slate-600"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function EmployeeSummaryTable({ employees, onExportEmployee }) {
  if (employees.length === 0) return <EmptyState />;
  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs text-slate-500">
            <th className="px-4 py-2.5 font-medium">Employee</th>
            <th className="px-4 py-2.5 font-medium">Present</th>
            <th className="px-4 py-2.5 font-medium">Absent</th>
            <th className="px-4 py-2.5 font-medium">Late</th>
            <th className="px-4 py-2.5 font-medium">Leave</th>
            <th className="px-4 py-2.5 font-medium">Attendance %</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => {
            const color = avatarColor(e.full_name);
            return (
              <tr key={e.employee_id} className="border-t border-slate-50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full ${color.bg} ${color.text} text-[11px] font-medium flex items-center justify-center`}
                    >
                      {initials(e.full_name)}
                    </div>
                    <div>
                      <div className="font-medium text-slate-700">
                        {e.full_name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {e.employee_code}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-green-700">{e.present_days}</td>
                <td className="px-4 py-2.5 text-red-700">{e.absent_days}</td>
                <td className="px-4 py-2.5 text-amber-700">{e.late_days}</td>
                <td className="px-4 py-2.5 text-blue-700">{e.leave_days}</td>
                <td className="px-4 py-2.5">{e.attendance_percentage}%</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => onExportEmployee(e)}
                    className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium ml-auto"
                  >
                    <Download size={13} />
                    Download
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DepartmentSummaryTable({ employees, onExportDepartment }) {
  const byDept = useMemo(() => {
    const groups = {};
    employees.forEach((e) => {
      const key = e.department || "Unassigned";
      groups[key] = groups[key] || {
        present: 0,
        absent: 0,
        late: 0,
        leave: 0,
        count: 0,
      };
      groups[key].present += e.present_days || 0;
      groups[key].absent += e.absent_days || 0;
      groups[key].late += e.late_days || 0;
      groups[key].leave += e.leave_days || 0;
      groups[key].count += 1;
    });
    return groups;
  }, [employees]);

  const entries = Object.entries(byDept);
  if (entries.length === 0) return <EmptyState />;

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs text-slate-500">
            <th className="px-4 py-2.5 font-medium">Department</th>
            <th className="px-4 py-2.5 font-medium">Employees</th>
            <th className="px-4 py-2.5 font-medium">Present</th>
            <th className="px-4 py-2.5 font-medium">Absent</th>
            <th className="px-4 py-2.5 font-medium">Late</th>
            <th className="px-4 py-2.5 font-medium">Leave</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([dept, totals]) => (
            <tr key={dept} className="border-t border-slate-50">
              <td className="px-4 py-2.5 font-medium text-slate-700">{dept}</td>
              <td className="px-4 py-2.5">{totals.count}</td>
              <td className="px-4 py-2.5 text-green-700">{totals.present}</td>
              <td className="px-4 py-2.5 text-red-700">{totals.absent}</td>
              <td className="px-4 py-2.5 text-amber-700">{totals.late}</td>
              <td className="px-4 py-2.5 text-blue-700">{totals.leave}</td>
              <td className="px-4 py-2.5 text-right">
                <button
                  onClick={() => onExportDepartment(dept)}
                  className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium ml-auto"
                >
                  <Download size={13} />
                  Download
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
