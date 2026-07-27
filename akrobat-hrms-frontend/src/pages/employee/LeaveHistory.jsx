import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Clock3,
  Download,
  Eye,
  Filter,
  Info,
  Search,
  ShieldAlert,
  Umbrella,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/common/PageHeader";
import { apiClient } from "../../services/apiClient";

// ---------------------------------------------------------------------
// Backend contract: GET /leaves/my (see app/leaves/routes.py + services.py)
// -> { success: true, data: [ {
//      id, employee_id, leave_type_id, start_date, end_date, total_days,
//      reason, status, applied_date,
//      employees: { full_name, employee_id },
//      leave_types: { leave_name }
//    }, ... ] }
// There is no separate GET /leaves/balance endpoint yet, so this page only
// deals with history/records — balances live on the Apply Leave page,
// computed client-side from this same data.
// ---------------------------------------------------------------------

const LEAVE_TYPE_STYLES = {
  "CASUAL LEAVE": { icon: Umbrella, text: "text-blue-500", bg: "bg-blue-50" },
  "SICK LEAVE": { icon: ShieldAlert, text: "text-blue-500", bg: "bg-blue-50" },
  "ANNUAL LEAVE": {
    icon: CalendarDays,
    text: "text-orange-500",
    bg: "bg-orange-50",
  },
  "EMERGENCY LEAVE": {
    icon: Clock3,
    text: "text-orange-500",
    bg: "bg-orange-50",
  },
  "UNPAID LEAVE": { icon: Info, text: "text-slate-500", bg: "bg-slate-100" },
};

function leaveTypeStyle(name) {
  return (
    LEAVE_TYPE_STYLES[(name || "").toUpperCase()] || {
      icon: CalendarDays,
      text: "text-slate-500",
      bg: "bg-slate-100",
    }
  );
}

const STATUS_STYLES = {
  Approved: { text: "text-blue-600", bg: "bg-blue-50", icon: CheckCircle2 },
  Pending: { text: "text-orange-600", bg: "bg-orange-50", icon: Clock },
  Rejected: { text: "text-orange-500", bg: "bg-orange-50", icon: XCircle },
};

function statusStyle(status) {
  return (
    STATUS_STYLES[status] || {
      text: "text-slate-500",
      bg: "bg-slate-100",
      icon: Clock,
    }
  );
}

function formatDateBlock(dateStr) {
  const d = new Date(dateStr);
  return {
    month: d.toLocaleDateString([], { month: "short" }).toUpperCase(),
    day: d.toLocaleDateString([], { day: "2-digit" }),
    weekday: d.toLocaleDateString([], { weekday: "short" }),
  };
}

function formatShort(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString([], {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatDateRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth =
    s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const startLabel = s.toLocaleDateString([], { day: "2-digit" });
  const endLabel = sameMonth
    ? e.toLocaleDateString([], { day: "2-digit" })
    : e.toLocaleDateString([], { day: "2-digit", month: "short" });
  return start === end ? startLabel : `${startLabel} - ${endLabel}`;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function LeaveHistory() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ---------- filters ----------
  const [leaveType, setLeaveType] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  // ---------- pagination ----------
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ---------- summary panel: slides in from the right, same pattern as
  // the "Attendance summary" panel on AttendanceHistory.jsx ----------
  const [statsOpen, setStatsOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get("/leaves/my")
      .then((res) => setRows(res.data || []))
      .catch((err) => {
        setRows([]);
        setError(err.message || "Unable to load leave history.");
      })
      .finally(() => setLoading(false));
  }, []);

  const leaveTypeOptions = useMemo(() => {
    const names = new Set(
      rows.map((r) => r.leave_types?.leave_name).filter(Boolean),
    );
    return ["All", ...Array.from(names)];
  }, [rows]);

  const filtered = useMemo(() => {
    return rows
      .filter(
        (r) => leaveType === "All" || r.leave_types?.leave_name === leaveType,
      )
      .filter((r) => statusFilter === "All" || r.status === statusFilter)
      .filter((r) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
          r.reason?.toLowerCase().includes(q) ||
          r.leave_types?.leave_name?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.applied_date < b.applied_date ? 1 : -1));
  }, [rows, leaveType, statusFilter, search]);

  const stats = useMemo(() => {
    const s = {
      total: filtered.length,
      approved: 0,
      pending: 0,
      rejected: 0,
      daysTaken: 0,
    };
    filtered.forEach((r) => {
      if (r.status === "Approved") s.approved += 1;
      if (r.status === "Pending") s.pending += 1;
      if (r.status === "Rejected") s.rejected += 1;
      if (r.status === "Approved") s.daysTaken += r.total_days || 0;
    });
    return s;
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  function exportCsv() {
    const header = [
      "Leave Date",
      "Leave Type",
      "Duration (Days)",
      "Reason",
      "Status",
      "Applied On",
    ];
    const body = filtered.map((r) => [
      `${r.start_date} to ${r.end_date}`,
      r.leave_types?.leave_name || "",
      r.total_days,
      r.reason,
      r.status,
      r.applied_date,
    ]);
    const csv = [header, ...body]
      .map((row) =>
        row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leave-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Leave History"
        subtitle="View your leave history and past records."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatsOpen(true)}
              aria-label="View leave summary"
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            >
              <Info size={16} />
            </button>
            <Link
              to="/employee/leave/apply"
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-lg"
            >
              <ChevronLeft size={15} /> Back to My Leaves
            </Link>
          </div>
        }
      />

      {/* ---------- Filter bar ---------- */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Leave Type
          </label>
          <select
            value={leaveType}
            onChange={(e) => {
              setLeaveType(e.target.value);
              setPage(1);
            }}
            className="text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2 outline-none"
          >
            {leaveTypeOptions.map((t) => (
              <option key={t} value={t}>
                {t === "All" ? "All Leave Types" : t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2 outline-none"
          >
            <option>All</option>
            <option>Approved</option>
            <option>Pending</option>
            <option>Rejected</option>
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Search by reason
          </label>
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
            <Search size={15} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by reason..."
              className="text-sm text-slate-700 outline-none w-full bg-transparent"
            />
          </div>
        </div>

        <button
          onClick={() => setPage(1)}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-lg"
        >
          <Filter size={14} /> Filter
        </button>

        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-3.5 py-2 rounded-lg"
        >
          <Download size={14} /> Export
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-orange-500 bg-orange-50 border border-orange-100 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* ---------- Table ---------- */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="px-5 py-3 font-medium">Leave Date</th>
                <th className="px-5 py-3 font-medium">Leave Type</th>
                <th className="px-5 py-3 font-medium">Duration</th>
                <th className="px-5 py-3 font-medium">Reason</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Applied On</th>
                <th className="px-5 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td colSpan={7} className="px-5 py-4">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))}

              {!loading && pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-slate-400"
                  >
                    No leave records found.
                  </td>
                </tr>
              )}

              {!loading &&
                pageRows.map((r) => {
                  const db = formatDateBlock(r.start_date);
                  const st = statusStyle(r.status);
                  const StIcon = st.icon;
                  const lt = leaveTypeStyle(r.leave_types?.leave_name);
                  const LtIcon = lt.icon;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-11 text-center bg-slate-50 rounded-lg py-1">
                            <div className="text-[10px] font-semibold text-orange-500">
                              {db.month}
                            </div>
                            <div className="text-sm font-bold text-slate-700 leading-tight">
                              {db.day}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-700 font-medium">
                              {formatDateRange(r.start_date, r.end_date)}
                            </div>
                            <div className="text-xs text-slate-400">
                              {db.weekday}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center ${lt.bg}`}
                          >
                            <LtIcon size={14} className={lt.text} />
                          </div>
                          <span className="text-slate-600">
                            {r.leave_types?.leave_name || "Leave"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {r.total_days} {r.total_days === 1 ? "Day" : "Days"}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 max-w-[220px] truncate">
                        {r.reason || "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}
                        >
                          <StIcon size={12} /> {r.status || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">
                        {formatShort(r.applied_date)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() =>
                            window.alert(r.reason || "No additional details.")
                          }
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* ---------- Pagination ---------- */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100">
          <div className="text-xs text-slate-400">
            {filtered.length === 0
              ? "Showing 0 records"
              : `Showing ${(page - 1) * pageSize + 1} to ${Math.min(
                  page * pageSize,
                  filtered.length,
                )} of ${filtered.length} records`}
          </div>
          <div className="flex items-center gap-3">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-slate-600"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40"
              >
                <ChevronsLeft size={13} />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="w-7 h-7 flex items-center justify-center rounded-md bg-orange-500 text-white text-xs font-medium">
                {page}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40"
              >
                <ChevronRight size={13} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40"
              >
                <ChevronsRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Summary panel: slides in from the right when the info
          button next to "Back to My Leaves" is clicked — same pattern as
          the "Attendance summary" panel on AttendanceHistory.jsx. ---------- */}
      <div
        className={`fixed inset-0 z-50 ${
          statsOpen ? "" : "pointer-events-none"
        }`}
      >
        <div
          onClick={() => setStatsOpen(false)}
          className={`absolute inset-0 bg-slate-900/30 transition-opacity duration-200 ${
            statsOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute right-0 top-0 h-full w-full max-w-xs bg-white border-l border-slate-200 shadow-xl p-5 overflow-y-auto transition-transform duration-200 ${
            statsOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-slate-800">Leave summary</h3>
            <button
              onClick={() => setStatsOpen(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <XCircle size={18} />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-500">Approved Requests</span>
              <span className="text-sm font-semibold text-slate-800">
                {stats.approved}{" "}
                <span className="text-xs font-normal text-slate-400">
                  (
                  {stats.total
                    ? Math.round((stats.approved / stats.total) * 100)
                    : 0}
                  %)
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-500">Pending Requests</span>
              <span className="text-sm font-semibold text-slate-800">
                {stats.pending}{" "}
                <span className="text-xs font-normal text-slate-400">
                  (
                  {stats.total
                    ? Math.round((stats.pending / stats.total) * 100)
                    : 0}
                  %)
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-500">Rejected Requests</span>
              <span className="text-sm font-semibold text-slate-800">
                {stats.rejected}{" "}
                <span className="text-xs font-normal text-slate-400">
                  (
                  {stats.total
                    ? Math.round((stats.rejected / stats.total) * 100)
                    : 0}
                  %)
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-500">
                Total Days Taken (Approved)
              </span>
              <span className="text-sm font-semibold text-slate-800">
                {stats.daysTaken} {stats.daysTaken === 1 ? "day" : "days"}
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-500">Total Requests</span>
              <span className="text-sm font-semibold text-slate-800">
                {stats.total}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
