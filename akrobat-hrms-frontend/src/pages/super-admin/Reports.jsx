import {
  AlertTriangle,
  Briefcase,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FolderKanban,
  Loader2,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { reportsService } from "../../services/ReportService";

// ---------------------------------------------------------------------
// Wired to the real backend: GET /reports/dashboard (counts) and
// GET /reports/{employees,attendance,leaves,payroll,projects} (row data),
// see app/reports/{routes,services}.py. Each report is fetched lazily,
// the first time its tab is opened, and cached in `reportData` so
// switching tabs back and forth doesn't refire the request.
// ---------------------------------------------------------------------

const PAGE_SIZE = 8;

const TABS = [
  { key: "employees", label: "Employees", icon: Users, color: "orange" },
  { key: "attendance", label: "Attendance", icon: Clock3, color: "blue" },
  {
    key: "leaves",
    label: "Leave Requests",
    icon: CalendarClock,
    color: "purple",
  },
  { key: "payroll", label: "Payroll", icon: Wallet, color: "green" },
  { key: "projects", label: "Projects", icon: FolderKanban, color: "slate" },
];

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatMinutes(mins) {
  const total = Math.max(0, Math.round(Number(mins) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatCurrency(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-orange-100 text-orange-600",
  "bg-blue-100 text-blue-600",
  "bg-blue-100 text-blue-600",
];
function avatarColor(seed) {
  if (!seed) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = (hash + seed.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

function StatusPill({ value }) {
  const v = (value || "").toLowerCase();
  const styles =
    v.includes("present") ||
    v.includes("approved") ||
    v.includes("paid") ||
    v.includes("active") ||
    v.includes("completed")
      ? "bg-blue-50 text-blue-600"
      : v.includes("pending") || v.includes("planning")
        ? "bg-orange-50 text-orange-600"
        : v.includes("reject") ||
            v.includes("absent") ||
            v.includes("cancel") ||
            v.includes("failed")
          ? "bg-orange-50 text-orange-500"
          : "bg-slate-100 text-slate-500";
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${styles}`}
    >
      {value || "—"}
    </span>
  );
}

function EmployeeCell({ name, empId }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarColor(name)}`}
      >
        {initials(name)}
      </div>
      <div className="min-w-0">
        <div className="font-medium text-slate-800 truncate">{name || "—"}</div>
        {empId && (
          <div className="text-xs text-slate-500 truncate">{empId}</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Column definitions per report — { header, render(row), searchable(row) }
// ---------------------------------------------------------------------
const COLUMNS = {
  employees: [
    {
      header: "Employee",
      render: (r) => <EmployeeCell name={r.full_name} empId={r.email} />,
    },
    { header: "Employee ID", render: (r) => r.employee_id || "—" },
    {
      header: "Department",
      render: (r) => r.departments?.department_name || "—",
    },
    {
      header: "Designation",
      render: (r) => r.designations?.designation_name || "—",
    },
    {
      header: "Status",
      render: (r) => <StatusPill value={r.employment_status} />,
    },
    { header: "Joined", render: (r) => formatDate(r.joining_date) },
    { header: "Tenure", render: (r) => r.tenure?.label || "—" },
  ],
  attendance: [
    {
      header: "Employee",
      render: (r) => (
        <EmployeeCell
          name={r.employees?.full_name}
          empId={r.employees?.employee_id}
        />
      ),
    },
    { header: "Date", render: (r) => formatDate(r.attendance_date) },
    { header: "Check-in", render: (r) => formatTime(r.check_in_time) },
    { header: "Check-out", render: (r) => formatTime(r.check_out_time) },
    {
      header: "Working Hours",
      render: (r) => formatMinutes(r.working_minutes),
    },
    { header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  leaves: [
    {
      header: "Employee",
      render: (r) => (
        <EmployeeCell
          name={r.employees?.full_name}
          empId={r.employees?.employee_id}
        />
      ),
    },
    {
      header: "Period",
      render: (r) => `${formatDate(r.start_date)} – ${formatDate(r.end_date)}`,
    },
    { header: "Days", render: (r) => r.total_days ?? "—" },
    {
      header: "Reason",
      render: (r) => (
        <span className="line-clamp-1 max-w-[220px] block">
          {r.reason || "—"}
        </span>
      ),
    },
    { header: "Status", render: (r) => <StatusPill value={r.status} /> },
    { header: "Applied", render: (r) => formatDate(r.applied_date) },
  ],
  payroll: [
    {
      header: "Employee",
      render: (r) => (
        <EmployeeCell
          name={r.employees?.full_name}
          empId={r.employees?.employee_id}
        />
      ),
    },
    {
      header: "Period",
      render: (r) =>
        `${String(r.payroll_month).padStart(2, "0")}/${r.payroll_year}`,
    },
    { header: "Basic Salary", render: (r) => formatCurrency(r.basic_salary) },
    {
      header: "Net Salary",
      render: (r) => (
        <span className="font-semibold text-slate-800">
          {formatCurrency(r.net_salary)}
        </span>
      ),
    },
    {
      header: "Payment Status",
      render: (r) => <StatusPill value={r.payment_status} />,
    },
    { header: "Payment Date", render: (r) => formatDate(r.payment_date) },
  ],
  projects: [
    {
      header: "Project",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium text-slate-800 truncate">
            {r.project_name}
          </div>
          {r.project_code && (
            <div className="text-xs text-slate-500 truncate">
              {r.project_code}
            </div>
          )}
        </div>
      ),
    },
    { header: "Client", render: (r) => r.client_name || "—" },
    { header: "Status", render: (r) => <StatusPill value={r.status} /> },
    {
      header: "Progress",
      render: (r) => (
        <div className="flex items-center gap-2 min-w-[110px]">
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-400"
              style={{
                width: `${Math.min(100, Math.max(0, r.progress_percentage || 0))}%`,
              }}
            />
          </div>
          <span className="text-xs text-slate-500 w-8 text-right">
            {r.progress_percentage ?? 0}%
          </span>
        </div>
      ),
    },
    {
      header: "Timeline",
      render: (r) => `${formatDate(r.start_date)} – ${formatDate(r.end_date)}`,
    },
  ],
};

// Which raw fields to search across per report (flattened to a string).
function searchText(tabKey, row) {
  switch (tabKey) {
    case "employees":
      return [
        row.full_name,
        row.email,
        row.employee_id,
        row.departments?.department_name,
        row.designations?.designation_name,
        row.phone,
        row.gender,
        row.marital_status,
        row.nationality,
        row.blood_group,
        row.religion,
        row.address,
      ].join(" ");
    case "attendance":
      return [
        row.employees?.full_name,
        row.employees?.employee_id,
        row.status,
        row.attendance_date,
      ].join(" ");
    case "leaves":
      return [
        row.employees?.full_name,
        row.employees?.employee_id,
        row.status,
        row.reason,
      ].join(" ");
    case "payroll":
      return [
        row.employees?.full_name,
        row.employees?.employee_id,
        row.payment_status,
      ].join(" ");
    case "projects":
      return [
        row.project_name,
        row.project_code,
        row.client_name,
        row.status,
      ].join(" ");
    default:
      return "";
  }
}

function employeeLabel(name, empId) {
  if (!name) return "";
  return empId ? `${name} (${empId})` : name;
}

function toCsv(tabKey, rows) {
  const cols = COLUMNS[tabKey];
  // Mirrors each tab's COLUMNS render() output as plain text, so the CSV
  // always matches what's on screen (formatted dates/times/durations/
  // currency) instead of raw DB fields — one value per header, in order.
  const flatteners = {
    employees: (r) => [
      employeeLabel(r.full_name, r.email),
      r.employee_id || "",
      r.departments?.department_name || "",
      r.designations?.designation_name || "",
      r.employment_status || "",
      formatDate(r.joining_date),
      r.tenure?.label || "",
    ],
    attendance: (r) => [
      employeeLabel(r.employees?.full_name, r.employees?.employee_id),
      formatDate(r.attendance_date),
      formatTime(r.check_in_time),
      formatTime(r.check_out_time),
      formatMinutes(r.working_minutes),
      r.status || "",
    ],
    leaves: (r) => [
      employeeLabel(r.employees?.full_name, r.employees?.employee_id),
      `${formatDate(r.start_date)} - ${formatDate(r.end_date)}`,
      r.total_days ?? "",
      r.reason || "",
      r.status || "",
      formatDate(r.applied_date),
    ],
    payroll: (r) => [
      employeeLabel(r.employees?.full_name, r.employees?.employee_id),
      `${String(r.payroll_month).padStart(2, "0")}/${r.payroll_year}`,
      formatCurrency(r.basic_salary),
      formatCurrency(r.net_salary),
      r.payment_status || "",
      formatDate(r.payment_date),
    ],
    projects: (r) => [
      r.project_code
        ? `${r.project_name} (${r.project_code})`
        : r.project_name || "",
      r.client_name || "",
      r.status || "",
      `${r.progress_percentage ?? 0}%`,
      `${formatDate(r.start_date)} - ${formatDate(r.end_date)}`,
    ],
  };
  const headers = cols.map((c) => c.header);
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    const vals = flatteners[tabKey](r).map(
      (v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`,
    );
    lines.push(vals.join(","));
  });
  return lines.join("\n");
}

// Full-detail Employees export (Employees tab "Export" button) — every
// employee, one row each, with tenure ("how long worked") and every
// personal-profile field (address/religion/DOB/etc — see
// sql/017_employee_personal_details.sql) alongside the job details
// already shown on screen. This is deliberately NOT the same columns as
// the on-screen table (COLUMNS.employees) — the table stays compact,
// the export is the "everything" version.
const EMPLOYEES_EXPORT_HEADER = [
  "Employee Name",
  "Employee ID",
  "Email",
  "Phone",
  "Department",
  "Designation",
  "Reports To",
  "Employment Status",
  "Joining Date",
  "Tenure (How Long Worked)",
  "Date of Birth",
  "Gender",
  "Marital Status",
  "Nationality",
  "Blood Group",
  "Religion",
  "Address",
  "Distinct Sites Worked",
  "Total Site Visit Hours",
  "Total Days Recorded",
  "Present Days",
  "Absent Days",
  "Total Working Hours",
  "Total Break Hours",
  "Total Overtime Hours",
];

function employeesExportRow(r) {
  const summary = r.attendance_summary || {};
  return [
    r.full_name || "",
    r.employee_id || "",
    r.email || "",
    r.phone || "",
    r.departments?.department_name || "",
    r.designations?.designation_name || "",
    r.manager
      ? `${r.manager.full_name || ""}${r.manager.employee_id ? ` (${r.manager.employee_id})` : ""}`
      : "",
    r.employment_status || "",
    formatDate(r.joining_date),
    r.tenure?.label || "",
    formatDate(r.date_of_birth),
    r.gender || "",
    r.marital_status || "",
    r.nationality || "",
    r.blood_group || "",
    r.religion || "",
    r.address || "",
    r.distinct_site_count ?? 0,
    ((r.total_site_visit_minutes || 0) / 60).toFixed(1),
    summary.total_days_recorded ?? 0,
    summary.present_days ?? 0,
    summary.absent_days ?? 0,
    ((summary.total_working_minutes || 0) / 60).toFixed(1),
    ((summary.total_break_minutes || 0) / 60).toFixed(1),
    ((summary.total_overtime_minutes || 0) / 60).toFixed(1),
  ];
}

function downloadEmployeesExcel(rows) {
  const sheet = XLSX.utils.aoa_to_sheet([
    EMPLOYEES_EXPORT_HEADER,
    ...rows.map(employeesExportRow),
  ]);
  sheet["!cols"] = EMPLOYEES_EXPORT_HEADER.map((h) => ({
    wch: Math.max(14, Math.min(28, h.length + 4)),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Employees");
  XLSX.writeFile(
    workbook,
    `employees-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

// Full-detail Attendance export (Attendance tab "Export" button) —
// every record currently in view (respects search), one row each.
const ATTENDANCE_EXPORT_HEADER = [
  "Employee Name",
  "Employee ID",
  "Date",
  "Check-in",
  "Check-out",
  "Working Hours",
  "Break",
  "Overtime",
  "Late (min)",
  "Status",
];

function attendanceExportRow(r) {
  return [
    r.employees?.full_name || "",
    r.employees?.employee_id || "",
    formatDate(r.attendance_date),
    formatTime(r.check_in_time),
    formatTime(r.check_out_time),
    formatMinutes(r.working_minutes),
    formatMinutes(r.break_minutes),
    formatMinutes(r.overtime_minutes),
    r.late_minutes || 0,
    r.status || "",
  ];
}

function downloadAttendanceExcel(rows) {
  const sheet = XLSX.utils.aoa_to_sheet([
    ATTENDANCE_EXPORT_HEADER,
    ...rows.map(attendanceExportRow),
  ]);
  sheet["!cols"] = [
    { wch: 20 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Attendance");
  XLSX.writeFile(
    workbook,
    `attendance-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

// Type-to-search employee picker — replaces the plain <select> on the
// Attendance tab's "download this employee's monthly attendance"
// control. Same options/value/onChange shape as a native select would
// use (options: employeeOptions from GET /reports/employees, value:
// the chosen employee's id, onChange: (id) => void), just searchable —
// useful once the roster is more than a handful of names to scroll.
function EmployeeSearchSelect({ options, value, onChange, placeholder }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = options.find((e) => e.id === value);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((e) =>
      employeeLabel(e.full_name, e.employee_id).toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={
            open
              ? query
              : selected
                ? employeeLabel(selected.full_name, selected.employee_id)
                : ""
          }
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onChange("");
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          placeholder={placeholder || "Search employee..."}
          className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400">
              No employees found.
            </div>
          ) : (
            filtered.map((e) => (
              <button
                type="button"
                key={e.id}
                onClick={() => {
                  onChange(e.id);
                  setQuery("");
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50 ${
                  e.id === value
                    ? "bg-orange-50 text-orange-600 font-medium"
                    : "text-slate-700"
                }`}
              >
                {employeeLabel(e.full_name, e.employee_id)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState("employees");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [reportData, setReportData] = useState({});
  const [loadingTabs, setLoadingTabs] = useState({});
  const [errorTabs, setErrorTabs] = useState({});

  // Per-row "download full report" (Employees tab) — tracks which
  // employee_id is currently being fetched/built so only that row's
  // button shows a spinner.
  const [downloadingEmployeeId, setDownloadingEmployeeId] = useState(null);

  // "Download this employee's monthly attendance" (Attendance tab) —
  // needs the full employee list (for the picker) independent of
  // whichever tab happens to be open, so it's fetched once on mount
  // rather than reusing reportData.employees (which only exists once
  // the Employees tab has actually been opened).
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [monthlyEmployeeId, setMonthlyEmployeeId] = useState("");
  const [monthlyMonth, setMonthlyMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [monthlyDownloading, setMonthlyDownloading] = useState(false);
  const [monthlyError, setMonthlyError] = useState(null);

  useEffect(() => {
    reportsService
      .employees()
      .then((res) => setEmployeeOptions(res?.data ?? []))
      .catch(() => setEmployeeOptions([]));
  }, []);

  // KPI strip — one summarized count call.
  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    reportsService
      .dashboard()
      .then((res) => {
        if (!cancelled) setStats(res?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Lazily load each tab's rows the first time it's opened.
  useEffect(() => {
    if (reportData[activeTab] || loadingTabs[activeTab]) return;
    setLoadingTabs((prev) => ({ ...prev, [activeTab]: true }));
    setErrorTabs((prev) => ({ ...prev, [activeTab]: null }));
    reportsService[activeTab]()
      .then((res) => {
        setReportData((prev) => ({ ...prev, [activeTab]: res?.data ?? [] }));
      })
      .catch((err) => {
        setErrorTabs((prev) => ({
          ...prev,
          [activeTab]: err.message || "Couldn't load this report.",
        }));
      })
      .finally(() => {
        setLoadingTabs((prev) => ({ ...prev, [activeTab]: false }));
      });
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(1);
  }, [activeTab, search]);

  const rows = reportData[activeTab] || [];
  const loading = !!loadingTabs[activeTab];
  const error = errorTabs[activeTab];

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      searchText(activeTab, r).toLowerCase().includes(q),
    );
  }, [rows, search, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const columns = COLUMNS[activeTab];

  function handleExport() {
    if (activeTab === "employees") {
      downloadEmployeesExcel(filtered);
      return;
    }
    if (activeTab === "attendance") {
      downloadAttendanceExcel(filtered);
      return;
    }
    const csv = toCsv(activeTab, filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTab}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // One employee's full report as a 2-sheet .xlsx: profile + lifetime
  // attendance totals, and a breakdown of every site they've logged a
  // visit to (see GET /reports/employees/{id}/full).
  function downloadEmployeeFullReport(row) {
    setDownloadingEmployeeId(row.id);
    reportsService
      .employeeFull(row.id)
      .then((res) => {
        const data = res?.data;
        if (!data) return;
        const summary = data.attendance_summary || {};

        const profileRows = [
          ["Employee Name", data.full_name || ""],
          ["Employee ID", data.employee_id || ""],
          ["Email", data.email || ""],
          ["Phone", data.phone || "—"],
          ["Department", data.departments?.department_name || "—"],
          ["Designation", data.designations?.designation_name || "—"],
          [
            "Reports To",
            data.manager_name
              ? `${data.manager_name}${data.manager_employee_code ? ` (${data.manager_employee_code})` : ""}`
              : "—",
          ],
          ["Employment Status", data.employment_status || "—"],
          ["Joining Date", formatDate(data.joining_date)],
          ["Tenure (How Long Worked)", data.tenure?.label || "—"],
          [],
          ["Date of Birth", formatDate(data.date_of_birth)],
          ["Gender", data.gender || "—"],
          ["Marital Status", data.marital_status || "—"],
          ["Nationality", data.nationality || "—"],
          ["Blood Group", data.blood_group || "—"],
          ["Religion", data.religion || "—"],
          ["Address", data.address || "—"],
          [],
          ["Distinct Sites Worked", data.distinct_site_count ?? 0],
          [
            "Total Site Visit Hours",
            ((data.total_site_visit_minutes || 0) / 60).toFixed(1),
          ],
          ["Total Days Recorded", summary.total_days_recorded ?? 0],
          ["Present Days", summary.present_days ?? 0],
          ["Absent Days", summary.absent_days ?? 0],
          [
            "Total Working Hours",
            ((summary.total_working_minutes || 0) / 60).toFixed(1),
          ],
          [
            "Total Break Hours",
            ((summary.total_break_minutes || 0) / 60).toFixed(1),
          ],
          [
            "Total Overtime Hours",
            ((summary.total_overtime_minutes || 0) / 60).toFixed(1),
          ],
        ];
        const profileSheet = XLSX.utils.aoa_to_sheet(profileRows);
        profileSheet["!cols"] = [{ wch: 22 }, { wch: 32 }];

        const sitesRows = (data.sites_worked || []).map((s) => [
          s.location_name,
          s.visit_count,
          (s.total_minutes / 60).toFixed(1),
        ]);
        const sitesSheet = XLSX.utils.aoa_to_sheet([
          ["Site", "Visits", "Total Hours"],
          ...sitesRows,
        ]);
        sitesSheet["!cols"] = [{ wch: 24 }, { wch: 10 }, { wch: 12 }];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, profileSheet, "Profile");
        XLSX.utils.book_append_sheet(workbook, sitesSheet, "Sites Worked");
        const nameSlug = (data.full_name || "").replace(/[^a-z0-9]+/gi, "-");
        XLSX.writeFile(
          workbook,
          `employee-report-${data.employee_id || row.id}${nameSlug ? `-${nameSlug}` : ""}.xlsx`,
        );
      })
      .catch((err) =>
        alert(err.message || "Couldn't download this employee's report."),
      )
      .finally(() => setDownloadingEmployeeId(null));
  }

  // One employee's attendance for one calendar month as a single-sheet
  // .xlsx: every day's record, plus a totals row (working/break/overtime
  // hours, late minutes, present/half/absent day counts).
  function downloadMonthlyAttendance() {
    if (!monthlyEmployeeId || !monthlyMonth) {
      setMonthlyError("Pick an employee and a month first.");
      return;
    }
    setMonthlyDownloading(true);
    setMonthlyError(null);
    reportsService
      .employeeMonthlyAttendance(monthlyEmployeeId, monthlyMonth)
      .then((res) => {
        const data = res?.data;
        if (!data) return;
        const summary = data.summary || {};

        const header = [
          "Date",
          "Check In",
          "Check Out",
          "Working Hours",
          "Break",
          "Overtime",
          "Late (min)",
          "Status",
        ];
        const rows = (data.records || []).map((r) => [
          formatDate(r.attendance_date),
          formatTime(r.check_in_time),
          formatTime(r.check_out_time),
          formatMinutes(r.working_minutes),
          formatMinutes(r.break_minutes),
          formatMinutes(r.overtime_minutes),
          r.late_minutes || 0,
          r.status || "",
        ]);
        const totalsRow = [
          "TOTAL",
          "",
          "",
          formatMinutes(summary.total_working_minutes),
          formatMinutes(summary.total_break_minutes),
          formatMinutes(summary.total_overtime_minutes),
          summary.total_late_minutes || 0,
          `${summary.present_days || 0} present / ${summary.half_days || 0} half / ${summary.absent_days || 0} absent`,
        ];

        const sheet = XLSX.utils.aoa_to_sheet([header, ...rows, [], totalsRow]);
        sheet["!cols"] = [
          { wch: 12 },
          { wch: 10 },
          { wch: 10 },
          { wch: 14 },
          { wch: 10 },
          { wch: 10 },
          { wch: 10 },
          { wch: 30 },
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, "Monthly Attendance");

        const label = employeeLabel(
          data.employee?.full_name,
          data.employee?.employee_id,
        ).replace(/[^a-z0-9]+/gi, "-");
        XLSX.writeFile(
          workbook,
          `attendance-${label || monthlyEmployeeId}-${monthlyMonth}.xlsx`,
        );
      })
      .catch((err) =>
        setMonthlyError(err.message || "Couldn't download attendance."),
      )
      .finally(() => setMonthlyDownloading(false));
  }

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Company-wide data across employees, attendance, leave, payroll and projects."
      />

      {/* ---------- KPI strip ---------- */}
      <div className="flex gap-4 mb-6 overflow-x-auto no-scrollbar pb-1">
        <div className="min-w-[170px] w-[170px] shrink-0">
          <StatCard
            icon={Users}
            label="Employees"
            color="orange"
            loading={statsLoading}
            value={stats?.employees ?? "—"}
          />
        </div>
        <div className="min-w-[170px] w-[170px] shrink-0">
          <StatCard
            icon={Clock3}
            label="Attendance Records"
            color="blue"
            loading={statsLoading}
            value={stats?.attendance ?? "—"}
          />
        </div>
        <div className="min-w-[170px] w-[170px] shrink-0">
          <StatCard
            icon={CalendarClock}
            label="Leave Requests"
            color="purple"
            loading={statsLoading}
            value={stats?.leaves ?? "—"}
          />
        </div>
        <div className="min-w-[170px] w-[170px] shrink-0">
          <StatCard
            icon={Wallet}
            label="Payroll Records"
            color="green"
            loading={statsLoading}
            value={stats?.payroll ?? "—"}
          />
        </div>
        <div className="min-w-[170px] w-[170px] shrink-0">
          <StatCard
            icon={Briefcase}
            label="Projects"
            color="slate"
            loading={statsLoading}
            value={stats?.projects ?? "—"}
          />
        </div>
      </div>

      {/* ---------- Report card: tabs + search/export + table ---------- */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Segmented tab control */}
        <div className="flex items-center gap-1 p-2 border-b border-slate-100 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Download one employee's monthly attendance — Attendance tab only */}
        {activeTab === "attendance" && (
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 p-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Employee
              </label>
              <EmployeeSearchSelect
                options={employeeOptions}
                value={monthlyEmployeeId}
                onChange={setMonthlyEmployeeId}
                placeholder="Search employee by name or ID..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Month
              </label>
              <input
                type="month"
                value={monthlyMonth}
                onChange={(e) => setMonthlyMonth(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
              />
            </div>
            <button
              onClick={downloadMonthlyAttendance}
              disabled={monthlyDownloading || !monthlyEmployeeId}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {monthlyDownloading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              Download Monthly Attendance
            </button>
            {monthlyError && (
              <span className="text-xs text-orange-600 flex items-center gap-1">
                <AlertTriangle size={13} /> {monthlyError}
              </span>
            )}
          </div>
        )}

        {/* Search + export — shown for every tab, including Employees */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border-b border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${TABS.find((t) => t.key === activeTab)?.label.toLowerCase()}...`}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
            />
          </div>
          <div className="flex items-center gap-3 sm:ml-auto">
            {!loading && !error && (
              <span className="text-xs text-slate-400">
                {filtered.length} {filtered.length === 1 ? "record" : "records"}
              </span>
            )}
            <button
              onClick={handleExport}
              disabled={loading || !!error || filtered.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={14} />
              {activeTab === "employees" || activeTab === "attendance"
                ? "Export Excel"
                : "Export CSV"}
            </button>
          </div>
        </div>

        {/* Table */}
        {error ? (
          <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-4 py-3 text-sm">
            <AlertTriangle size={16} />
            {error}
          </div>
        ) : (
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                  {columns.map((c) => (
                    <th
                      key={c.header}
                      className="px-4 py-3 font-medium whitespace-nowrap"
                    >
                      {c.header}
                    </th>
                  ))}
                  {activeTab === "employees" && (
                    <th className="px-4 py-3 font-medium whitespace-nowrap text-right">
                      Report
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td
                        colSpan={
                          columns.length + (activeTab === "employees" ? 1 : 0)
                        }
                        className="px-4 py-4"
                      >
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : pageItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={
                        columns.length + (activeTab === "employees" ? 1 : 0)
                      }
                      className="px-4 py-12 text-center text-slate-400 text-sm"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((row, i) => (
                    <tr
                      key={row.id || i}
                      className="border-b border-slate-50 hover:bg-slate-50/60"
                    >
                      {columns.map((c) => (
                        <td key={c.header} className="px-4 py-3 text-slate-600">
                          {c.render(row)}
                        </td>
                      ))}
                      {activeTab === "employees" && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => downloadEmployeeFullReport(row)}
                            disabled={downloadingEmployeeId === row.id}
                            title="Download full report"
                            className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {downloadingEmployeeId === row.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Download size={13} />
                            )}
                            Report
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="w-7 h-7 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 flex items-center justify-center"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2">
                {page} / {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="w-7 h-7 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 flex items-center justify-center"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
            <Loader2 size={13} className="animate-spin" /> Loading{" "}
            {TABS.find((t) => t.key === activeTab)?.label.toLowerCase()}...
          </div>
        )}
      </div>
    </div>
  );
}
