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
import SelectDropdown from "../../components/common/SelectDropdown";
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

  // Mobile filter card: Leave Type + Status start collapsed so the search
  // box doesn't get pushed below a full screen of filter chrome — same
  // pattern as AttendanceHistory.jsx.
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  // Count of non-default filters set — drives the small badge next to
  // "Filters" on the mobile filter card.
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (leaveType !== "All") n += 1;
    if (statusFilter !== "All") n += 1;
    if (search.trim()) n += 1;
    return n;
  }, [leaveType, statusFilter, search]);

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
              title="Back to My Leaves"
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-2.5 sm:px-3.5 py-2 rounded-lg"
            >
              <ChevronLeft size={15} />{" "}
              <span className="hidden sm:inline">Back to My Leaves</span>
            </Link>
          </div>
        }
      />

      {/* ---------- Filter bar: mobile-only redesign ----------
          Search + a Filter toggle + Export all live on one compact row.
          Leave Type and Status (set-once-and-forget filters) stay
          collapsed behind the Filter toggle instead of always being
          expanded — same pattern as AttendanceHistory.jsx. Both still
          filter live the moment they're changed, collapsed or not (see
          the `filtered` useMemo). sm: and up renders the original desktop
          bar unchanged, right below. */}
      <div className="sm:hidden bg-white rounded-2xl border border-slate-200 shadow-sm p-3 mb-6">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-transparent focus-within:bg-white focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-200 rounded-lg px-3 py-2.5 transition-colors min-w-0">
            <Search size={15} className="text-slate-400 shrink-0" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by reason or leave type..."
              className="text-sm text-slate-700 outline-none w-full bg-transparent min-w-0"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                aria-label="Clear search"
                className="shrink-0 text-slate-300 hover:text-slate-500"
              >
                <XCircle size={15} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            aria-label="Toggle filters"
            className={`relative flex items-center justify-center w-10 h-10 shrink-0 rounded-lg border transition-colors ${
              filtersOpen
                ? "border-orange-400 bg-orange-50 text-orange-600"
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Filter size={15} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 text-[10px] font-medium text-white bg-orange-500 rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            aria-label="Export"
            className="flex items-center justify-center w-10 h-10 shrink-0 text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg transition-colors"
          >
            <Download size={15} />
          </button>
        </div>

        {filtersOpen && (
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2.5">
            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Leave Type
              </label>
              <SelectDropdown
                value={leaveType}
                onChange={(v) => {
                  setLeaveType(v);
                  setPage(1);
                }}
                options={leaveTypeOptions.map((t) => ({
                  value: t,
                  label: t === "All" ? "All Types" : t,
                }))}
              />
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Status
              </label>
              <SelectDropdown
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
                options={[
                  { value: "All", label: "All" },
                  { value: "Approved", label: "Approved" },
                  { value: "Pending", label: "Pending" },
                  { value: "Rejected", label: "Rejected" },
                ]}
              />
            </div>
          </div>
        )}
      </div>

      {/* ---------- Filter bar: original desktop layout, untouched ---------- */}
      <div className="hidden sm:flex bg-white rounded-xl border border-slate-200 p-4 mb-6 flex-wrap items-end gap-3">
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

      {/* ---------- Records: mobile-only card list ----------
          The 7-column table is unreadable once squeezed onto a phone —
          this renders the same pageRows as a stacked list of cards
          instead. Desktop/tablet (sm and up) keeps the original table,
          untouched, right below. */}
      <div className="sm:hidden space-y-3">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200 p-4"
            >
              <div className="h-4 bg-slate-100 rounded animate-pulse w-2/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-1/3" />
            </div>
          ))}

        {!loading && pageRows.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-10 text-center text-slate-400 text-sm">
            No leave records found.
          </div>
        )}

        {!loading &&
          pageRows.map((r) => {
            const db = formatDateBlock(r.start_date);
            const st = statusStyle(r.status);
            const StIcon = st.icon;
            const lt = leaveTypeStyle(r.leave_types?.leave_name);
            const LtIcon = lt.icon;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() =>
                  window.alert(r.reason || "No additional details.")
                }
                className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 active:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-11 shrink-0 text-center bg-slate-50 rounded-lg py-1">
                      <div className="text-[10px] font-semibold text-orange-500">
                        {db.month}
                      </div>
                      <div className="text-sm font-bold text-slate-700 leading-tight">
                        {db.day}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">
                        {formatDateRange(r.start_date, r.end_date)}
                      </div>
                      <div className="text-xs text-slate-400">
                        {db.weekday} · {r.total_days}{" "}
                        {r.total_days === 1 ? "Day" : "Days"}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}
                  >
                    <StIcon size={12} /> {r.status || "—"}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${lt.bg}`}
                  >
                    <LtIcon size={12} className={lt.text} />
                  </div>
                  <span className="text-sm text-slate-600 truncate">
                    {r.leave_types?.leave_name || "Leave"}
                  </span>
                </div>

                {r.reason && (
                  <p className="text-xs text-slate-500 line-clamp-2 mb-2">
                    {r.reason}
                  </p>
                )}

                <p className="text-[11px] text-slate-400">
                  Applied on {formatShort(r.applied_date)}
                </p>
              </button>
            );
          })}

        {/* ---------- Pagination: mobile-only, simplified ---------- */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 text-xs font-medium text-slate-600 border border-slate-200 disabled:opacity-40 rounded-lg px-3 py-2"
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <span className="text-xs text-slate-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 text-xs font-medium text-slate-600 border border-slate-200 disabled:opacity-40 rounded-lg px-3 py-2"
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* ---------- Table: original desktop/tablet layout, untouched ---------- */}
      <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-hidden">
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

        {/* ---------- Pagination: desktop/tablet, untouched ---------- */}
        <div className="hidden sm:flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100">
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
