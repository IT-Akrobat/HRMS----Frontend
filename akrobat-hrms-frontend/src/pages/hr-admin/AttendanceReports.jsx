import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Avatar from "../../components/common/Avatar";
import PageHeader from "../../components/common/PageHeader";
import SelectDropdown from "../../components/common/SelectDropdown";
import DatePicker from "../../components/layout/DatePicker";
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

// Records/rows-per-page for every view (Daily log / By employee /
// By department) below the summary cards — keeps the list a fixed,
// predictable height instead of growing unbounded with the date range.
const PAGE_SIZE = 20;

// Excel auto-detects the raw ISO date string ("2026-08-03") and
// re-parses it as a date/number, which is what was producing the
// "########" column-too-narrow display. Formatting it as a readable
// label and prefixing with a tab character forces Excel to keep it
// as plain text instead of reinterpreting it.
function formatDateForExport(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return (
    "\t" +
    d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  );
}

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
  const lines = [];
  let prevStatus = null;
  rows.forEach((r, idx) => {
    // Blank separator line whenever the status changes (e.g. Absent
    // -> Late -> Present), so each state is visually grouped instead
    // of running straight into the next in the exported file.
    if (idx > 0 && r.status !== prevStatus) {
      lines.push("");
    }
    prevStatus = r.status;

    lines.push(
      [
        r.full_name || "",
        r.employee_code || "",
        r.department || "",
        formatDateForExport(r.date),
        r.check_in_time ? formatTime(r.check_in_time) : "",
        r.check_out_time ? formatTime(r.check_out_time) : "",
        r.working_hours ?? 0,
        r.status || "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
  });
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
  // Mobile-only popup for the "Needs attention" list (see tab row).
  const [showNeedsAttention, setShowNeedsAttention] = useState(false);

  const [report, setReport] = useState({ employees: [], daily_records: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

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

  // Any filter/search/tab change invalidates whatever page we were on
  // (e.g. page 3 of "By employee" can easily not exist anymore once a
  // department filter is applied) — always land back on page 1 instead
  // of showing an empty page.
  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, departmentId, employeeId, status, search, view]);

  const hasActiveFilters =
    !!search ||
    !!departmentId ||
    !!employeeId ||
    !!status ||
    fromDate !== firstOfMonthISO() ||
    toDate !== todayISO();

  function clearFilters() {
    setSearch("");
    setFromDate(firstOfMonthISO());
    setToDate(todayISO());
    setDepartmentId("");
    setEmployeeId("");
    setStatus("");
  }

  // Clicking a department row in "By department" drills into "By
  // employee", pre-filtered to that department — so "which employees in
  // this dept" is one click away instead of re-picking it from the
  // dropdown. Falls back to just switching tabs (no filter applied) if
  // the row's department name is "Unassigned" or otherwise has no
  // matching `departments` row to filter by.
  function selectDepartment(deptName) {
    const match = departments.find(
      (d) =>
        (d.department_name || "").toLowerCase() ===
        (deptName || "").toLowerCase(),
    );
    setDepartmentId(match ? match.id : "");
    setEmployeeId("");
    setView("employee");
  }

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

  // ---------------- Pagination (8 records/rows per page, per view) ----------------
  const totalDailyPages = Math.max(
    1,
    Math.ceil(searchedRecords.length / PAGE_SIZE),
  );
  const pagedDailyRecords = useMemo(
    () => searchedRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [searchedRecords, page],
  );
  const pagedGroupedByDepartment = useMemo(() => {
    const groups = {};
    pagedDailyRecords.forEach((r) => {
      const key = r.department || "Unassigned";
      groups[key] = groups[key] || [];
      groups[key].push(r);
    });
    return groups;
  }, [pagedDailyRecords]);

  const totalEmployeePages = Math.max(
    1,
    Math.ceil(searchedEmployeeSummaries.length / PAGE_SIZE),
  );
  const pagedEmployeeSummaries = useMemo(
    () =>
      searchedEmployeeSummaries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [searchedEmployeeSummaries, page],
  );

  // One row per department (aggregated from the employee summaries) —
  // computed here rather than inside DepartmentSummaryTable so the
  // resulting row list can be paginated the same way as the other two
  // views instead of always rendering every department at once.
  const departmentSummaries = useMemo(() => {
    const groups = {};
    searchedEmployeeSummaries.forEach((e) => {
      const key = e.department || "Unassigned";
      groups[key] = groups[key] || {
        dept: key,
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
    return Object.values(groups);
  }, [searchedEmployeeSummaries]);
  const totalDepartmentPages = Math.max(
    1,
    Math.ceil(departmentSummaries.length / PAGE_SIZE),
  );
  const pagedDepartmentSummaries = useMemo(
    () => departmentSummaries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [departmentSummaries, page],
  );

  const activeTotalPages =
    view === "daily"
      ? totalDailyPages
      : view === "employee"
        ? totalEmployeePages
        : totalDepartmentPages;

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
          <>
            {/* Mobile: search moves up onto the title line itself instead
                of its own row further down. Desktop (sm and up):
                unchanged — hidden here since the search box still lives
                in the filter bar exactly as before. */}
            <div className="relative sm:hidden">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee"
                className="pl-7 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg w-28"
              />
            </div>
            {/* Mobile: "Export all" moves down to the date-range line as
                an icon-only button, so the labelled button is hidden
                here. Desktop: unchanged. */}
            <button
              onClick={exportAll}
              className="hidden sm:flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              <Download size={16} />
              Export all
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Row 1: Search box. Mobile: hidden here — it now sits on the
            title line instead (see PageHeader actions above). Desktop:
            sm:contents drops this wrapper so the search box flows
            exactly as before, unchanged. */}
        <div className="hidden sm:contents">
          <div className="relative w-full sm:w-auto">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee"
              className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-full sm:w-48"
            />
          </div>
        </div>

        {/* Row 2 (mobile): From/To date range together, right under the
            search box, near the top of the screen. Desktop: sm:contents
            drops this wrapper so the two date inputs flow exactly as
            before. */}
        <div className="flex items-center gap-2 w-full sm:contents">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-0 sm:flex-initial sm:w-auto">
            <DatePicker
              value={fromDate}
              max={toDate}
              placeholder="From"
              onChange={(iso) => setFromDate(iso)}
            />
            <span className="text-slate-300">→</span>
            <DatePicker
              value={toDate}
              min={fromDate}
              max={todayISO()}
              placeholder="To"
              onChange={(iso) => setToDate(iso)}
            />
          </div>
          {/* Mobile: icon-only "Export all", moved here from the title
              line so it sits with the date range. Desktop: hidden — the
              labelled button in the title line is used instead,
              unchanged. */}
          <button
            onClick={exportAll}
            className="sm:hidden flex items-center justify-center p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 shrink-0"
            aria-label="Export all"
          >
            <Download size={16} />
          </button>
        </div>

        {/* Row 3 (mobile): department, status, and clear together on one
            line. Desktop: sm:contents drops this wrapper so department and
            the existing status+clear pair flow exactly as before. */}
        <div className="flex items-center gap-2 w-full sm:contents">
          <SelectDropdown
            value={departmentId}
            onChange={setDepartmentId}
            placeholder="All departments"
            options={[
              { value: "", label: "All departments" },
              ...departments.map((d) => ({
                value: d.id,
                label: d.department_name,
              })),
            ]}
            className="flex-1 min-w-0 sm:flex-initial sm:w-auto"
          />

          {/* Kept together (flex-nowrap) so "All statuses" and "Clear
              filters" always stay on the same line instead of the pair
              splitting across two rows when the bar wraps. */}
          <div className="flex flex-nowrap items-center gap-2 shrink-0 sm:shrink">
            <SelectDropdown
              value={status}
              onChange={setStatus}
              placeholder="All statuses"
              options={[
                { value: "", label: "All statuses" },
                { value: "Present", label: "Present" },
                { value: "Late", label: "Late" },
                { value: "Absent", label: "Absent" },
                { value: "On Leave", label: "On leave" },
                { value: "Half Day", label: "Half day" },
              ]}
              className="flex-1 min-w-0 sm:flex-initial sm:w-auto"
            />
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="flex items-center gap-1 text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent shrink-0"
            >
              <X size={14} />
              <span className="hidden sm:inline">Clear filters</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mb-5">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
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
        {/* Mobile: "Needs attention" indicator at the end of the tab row —
            tapping it opens the same content in a popup instead of it
            sitting inline below. Desktop (sm and up): hidden, since the
            block below is shown inline instead, unchanged. */}
        {needsAttention.length > 0 && (
          <button
            type="button"
            onClick={() => setShowNeedsAttention(true)}
            className="sm:hidden relative flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 text-amber-600 hover:bg-slate-50 shrink-0"
            aria-label={`Needs attention (${needsAttention.length})`}
          >
            <AlertTriangle size={16} />
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] leading-4 text-center">
              {needsAttention.length}
            </span>
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3 mb-5">
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0">
          <StatCard
            icon={<CheckCircle2 size={14} />}
            iconColor="text-green-700"
            label="Present"
            value={summary.present}
            sub={`${summary.presentPct}% of workdays`}
            subColor="text-green-700"
            divider
            className="min-w-[136px] shrink-0 snap-start sm:min-w-0 sm:shrink sm:snap-none"
          />
          <StatCard
            icon={<XCircle size={14} />}
            iconColor="text-red-700"
            label="Absent"
            value={summary.absent}
            sub={`${summary.absentPct}% of workdays`}
            subColor="text-red-700"
            divider
            className="min-w-[136px] shrink-0 snap-start sm:min-w-0 sm:shrink sm:snap-none"
          />
          <StatCard
            icon={<Clock size={14} />}
            iconColor="text-amber-700"
            label="Late"
            value={summary.late}
            sub={`${summary.latePct}% of workdays`}
            subColor="text-amber-700"
            divider
            className="min-w-[136px] shrink-0 snap-start sm:min-w-0 sm:shrink sm:snap-none"
          />
          <StatCard
            icon={<Calendar size={14} />}
            iconColor="text-blue-700"
            label="On leave"
            value={summary.leave}
            sub={`${summary.leavePct}% of workdays`}
            subColor="text-blue-700"
            divider
            className="min-w-[136px] shrink-0 snap-start sm:min-w-0 sm:shrink sm:snap-none"
          />
          {/* Mobile: "Avg hours/day" joins this scrollable card row
              instead of sitting in its own box below. Desktop (sm and
              up): hidden here — the box below is used instead,
              unchanged. */}
          <StatCard
            icon={<BarChart3 size={14} />}
            iconColor="text-orange-700"
            label="Avg hours/day"
            value={summary.avgHours}
            sub=""
            subColor=""
            className="min-w-[136px] shrink-0 snap-start sm:hidden"
          />
        </div>

        {/* Mobile: hidden — its content (avg hours/day) now lives in the
            card row above. Desktop (sm and up): unchanged. */}
        <div className="hidden sm:flex bg-slate-50 rounded-lg p-4 items-center justify-between">
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

      {/* Mobile: hidden — same content is reachable via the popup
          triggered from the icon on the tab row above. Desktop (sm and
          up): unchanged, still shown inline. */}
      {needsAttention.length > 0 && (
        <div className="hidden sm:block bg-slate-50 rounded-lg p-4 mb-5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
            <AlertTriangle size={13} />
            Needs attention
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {needsAttention.map((e) => {
              return (
                <div
                  key={e.employee_id}
                  className="flex items-center gap-2 text-sm"
                >
                  <Avatar
                    name={e.full_name}
                    photo={e.profile_photo}
                    size="w-5 h-5"
                    textSize="text-[10px]"
                  />
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

      {/* Mobile-only popup: same "Needs attention" content as the inline
          desktop block above, opened from the icon on the tab row.
          sm:hidden is a safety net in case the viewport grows past
          mobile while this is open — desktop never triggers it. */}
      {showNeedsAttention && (
        <div className="sm:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 pb-3">
          <div className="w-full max-w-md bg-white rounded-xl p-4 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <AlertTriangle size={14} className="text-amber-600" />
                Needs attention
              </div>
              <button
                type="button"
                onClick={() => setShowNeedsAttention(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {needsAttention.map((e) => (
                <div
                  key={e.employee_id}
                  className="flex items-center gap-2 text-sm"
                >
                  <Avatar
                    name={e.full_name}
                    photo={e.profile_photo}
                    size="w-6 h-6"
                    textSize="text-[10px]"
                  />
                  <span className="text-slate-700">{e.full_name}</span>
                  <span className="text-xs text-slate-400 ml-auto">
                    {e.absent_days > 0 && `${e.absent_days} absent`}
                    {e.absent_days > 0 && e.late_days > 0 && " · "}
                    {e.late_days > 0 && `${e.late_days} late`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500 py-10 text-center">
          Loading attendance report…
        </div>
      ) : (
        <>
          <div className="max-h-[560px] overflow-y-auto pr-1">
            {view === "daily" ? (
              searchedRecords.length === 0 ? (
                <EmptyState />
              ) : (
                Object.entries(pagedGroupedByDepartment).map(
                  ([deptName, records]) => (
                    <DepartmentGroup
                      key={deptName}
                      deptName={deptName}
                      records={records}
                      onExportEmployee={exportEmployee}
                    />
                  ),
                )
              )
            ) : view === "employee" ? (
              <EmployeeSummaryTable
                employees={pagedEmployeeSummaries}
                onExportEmployee={(emp) =>
                  exportEmployee(
                    searchedRecords.filter(
                      (r) => r.employee_id === emp.employee_id,
                    ),
                    emp.full_name,
                  )
                }
              />
            ) : (
              <DepartmentSummaryTable
                rows={pagedDepartmentSummaries}
                onSelectDepartment={selectDepartment}
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
          <Pagination
            page={page}
            totalPages={activeTotalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  iconColor,
  label,
  value,
  sub,
  subColor,
  divider,
  className = "",
}) {
  return (
    <div className={`relative bg-slate-50 rounded-lg p-3.5 ${className}`}>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <span className={iconColor}>{icon}</span>
        {label}
      </div>
      <div className="text-xl font-semibold text-slate-800 mt-1.5">{value}</div>
      <div className={`text-[11px] mt-0.5 ${subColor}`}>{sub}</div>
      {divider && (
        // Vertical separator between this card and the next one (used
        // between Present/Absent) so the two are visually distinct at a
        // glance instead of blending into one continuous row of cards.
        // Hidden on mobile, where cards scroll horizontally with a real
        // gap between them already, so the line has nothing to sit against.
        <div className="hidden sm:block absolute top-2 bottom-2 -right-[7px] w-px bg-slate-300" />
      )}
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

// Under each employee we only ever show their two most recent check-ins,
// regardless of how wide the selected date range is — keeps each profile
// block short and focused on "what's happening lately" instead of listing
// out every day in the range.
const RECENT_DAYS_PER_EMPLOYEE = 2;

function DepartmentGroup({ deptName, records, onExportEmployee }) {
  const byEmployee = useMemo(() => {
    const groups = {};
    records.forEach((r) => {
      const key = r.employee_id;
      groups[key] = groups[key] || {
        name: r.full_name,
        code: r.employee_code,
        photo: r.profile_photo,
        rows: [],
      };
      groups[key].rows.push(r);
    });
    // Sort each employee's rows by date (ascending). `rows` keeps the full
    // set (used for the "Download" export), while `displayRows` is trimmed
    // to just the most recent RECENT_DAYS_PER_EMPLOYEE entries for the
    // on-screen table.
    Object.values(groups).forEach((emp) => {
      emp.rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      emp.displayRows = emp.rows.slice(-RECENT_DAYS_PER_EMPLOYEE);
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
        return (
          <div key={emp.code || emp.name}>
            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Avatar
                  name={emp.name}
                  photo={emp.photo}
                  size="w-7 h-7"
                  textSize="text-[11px]"
                />
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
                {emp.displayRows.map((r) => (
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
            return (
              <tr key={e.employee_id} className="border-t border-slate-50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={e.full_name}
                      photo={e.profile_photo}
                      size="w-7 h-7"
                      textSize="text-[11px]"
                    />
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

function DepartmentSummaryTable({
  rows,
  onSelectDepartment,
  onExportDepartment,
}) {
  if (rows.length === 0) return <EmptyState />;

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
          {rows.map((totals) => (
            <tr key={totals.dept} className="border-t border-slate-50">
              <td className="px-4 py-2.5">
                {/* Click through to "By employee", pre-filtered to this
                    department — see selectDepartment() in the parent. */}
                <button
                  onClick={() => onSelectDepartment(totals.dept)}
                  className="font-medium text-slate-700 hover:text-orange-600 hover:underline text-left"
                >
                  {totals.dept}
                </button>
              </td>
              <td className="px-4 py-2.5">{totals.count}</td>
              <td className="px-4 py-2.5 text-green-700">{totals.present}</td>
              <td className="px-4 py-2.5 text-red-700">{totals.absent}</td>
              <td className="px-4 py-2.5 text-amber-700">{totals.late}</td>
              <td className="px-4 py-2.5 text-blue-700">{totals.leave}</td>
              <td className="px-4 py-2.5 text-right">
                <button
                  onClick={() => onExportDepartment(totals.dept)}
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

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-1 py-3">
      <span className="text-xs text-slate-500">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="text-xs font-medium px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="text-xs font-medium px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          Next
        </button>
      </div>
    </div>
  );
}
