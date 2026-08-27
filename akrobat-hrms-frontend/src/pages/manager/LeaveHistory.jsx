import {
  Baby,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Clock3,
  Download,
  HeartHandshake,
  HeartPulse,
  Info,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Umbrella,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import { useAttendanceLiveUpdates } from "../../hooks/Useattendanceliveupdates ";
import { apiClient } from "../../services/apiClient";

// ---------------------------------------------------------------------
// Backend contract: GET /leaves/team (see app/leaves/routes.py + services.py)
// -> { success: true, data: [ {
//      id, employee_id, leave_type_id, start_date, end_date, total_days,
//      reason, status, applied_date,
//      employees: { full_name, employee_id },
//      leave_types: { leave_name }
//    }, ... ] }
// Already scoped server-side to this manager's direct + indirect reports.
// There's no separate "team roster" endpoint, so the left-hand employee
// list is derived from this same response — grouped client-side.
//
// READ-ONLY: only Super Admin can approve/reject leave, so this page just
// surfaces history — no Approve/Reject actions.
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
  "HOSPITALISATION LEAVE": {
    icon: HeartPulse,
    text: "text-red-500",
    bg: "bg-red-50",
  },
  "REPLACEMENT LEAVE": {
    icon: RefreshCcw,
    text: "text-teal-500",
    bg: "bg-teal-50",
  },
  "CHILDREN LEAVE": { icon: Baby, text: "text-pink-500", bg: "bg-pink-50" },
  "COMPASSIONATE LEAVE": {
    icon: HeartHandshake,
    text: "text-purple-500",
    bg: "bg-purple-50",
  },
  "NATIONAL SERVICE LEAVE": {
    icon: ShieldCheck,
    text: "text-green-600",
    bg: "bg-green-50",
  },
  "PATERNITY LEAVE": { icon: Baby, text: "text-blue-500", bg: "bg-blue-50" },
  "MATERNITY LEAVE": { icon: Baby, text: "text-pink-500", bg: "bg-pink-50" },
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
  Approved: {
    text: "text-blue-600",
    bg: "bg-blue-50",
    dot: "bg-blue-500",
    icon: CheckCircle2,
  },
  Pending: {
    text: "text-orange-600",
    bg: "bg-orange-50",
    dot: "bg-orange-500",
    icon: Clock,
  },
  Rejected: {
    text: "text-orange-500",
    bg: "bg-orange-50",
    dot: "bg-slate-300",
    icon: XCircle,
  },
};

function statusStyle(status) {
  return (
    STATUS_STYLES[status] || {
      text: "text-slate-500",
      bg: "bg-slate-100",
      dot: "bg-slate-300",
      icon: Clock,
    }
  );
}

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const opts = { month: "short", day: "numeric", year: "numeric" };
  if (start === end) return s.toLocaleDateString([], opts);
  const sameMonth =
    s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const startLabel = sameMonth
    ? s.toLocaleDateString([], { month: "short", day: "numeric" })
    : s.toLocaleDateString([], opts);
  return `${startLabel} \u2013 ${e.toLocaleDateString([], opts)}`;
}

function formatApplied(dateStr) {
  if (!dateStr) return "\u2014";
  return `Applied ${new Date(dateStr).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

const STATUS_TABS = ["All", "Approved", "Pending", "Rejected"];

function exportCsv(rows) {
  const header = [
    "Employee",
    "Employee ID",
    "Leave Type",
    "Start Date",
    "End Date",
    "Duration (Days)",
    "Reason",
    "Status",
    "Applied On",
  ];
  const body = rows.map((r) => [
    r.employees?.full_name || "",
    r.employees?.employee_id || "",
    r.leave_types?.leave_name || "",
    r.start_date,
    r.end_date,
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
  a.download = "team-leave-history.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function LeaveHistory() {
  const [leaves, setLeaves] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [rosterSearch, setRosterSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [statusTab, setStatusTab] = useState("All");
  const [year, setYear] = useState("All");
  // Mobile-only (< lg): which panel is showing. Desktop always shows both
  // side by side via lg:block overrides below, so this has no effect there.
  const [mobileView, setMobileView] = useState("roster"); // "roster" | "detail"

  function loadLeaves() {
    apiClient
      .get("/leaves/team")
      .then((res) => setLeaves(res?.data || []))
      .catch((err) => {
        setLeaves([]);
        setError(err.message || "Unable to load team leave history.");
      });
  }

  useEffect(loadLeaves, []);

  // Refetches the instant a team member applies for leave or has one
  // approved/rejected, instead of waiting for a manual refresh.
  useAttendanceLiveUpdates(loadLeaves);

  // ---------- Group by employee for the left roster ----------
  const roster = useMemo(() => {
    if (!leaves) return [];
    const byEmployee = new Map();
    for (const l of leaves) {
      const empId = l.employee_id;
      if (!byEmployee.has(empId)) {
        byEmployee.set(empId, {
          employeeId: empId,
          name: l.employees?.full_name || "Unknown",
          code: l.employees?.employee_id || "",
          pending: 0,
          total: 0,
        });
      }
      const entry = byEmployee.get(empId);
      entry.total += 1;
      if (l.status === "Pending") entry.pending += 1;
    }
    return Array.from(byEmployee.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [leaves]);

  const filteredRoster = useMemo(() => {
    if (!rosterSearch.trim()) return roster;
    const q = rosterSearch.trim().toLowerCase();
    return roster.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
    );
  }, [roster, rosterSearch]);

  // Auto-select the first employee once data loads (or if the current
  // selection disappears after a search/filter).
  useEffect(() => {
    if (!roster.length) return;
    if (!roster.some((p) => p.employeeId === selectedEmployeeId)) {
      setSelectedEmployeeId(roster[0].employeeId);
    }
  }, [roster, selectedEmployeeId]);

  const selectedEmployee = roster.find(
    (p) => p.employeeId === selectedEmployeeId,
  );

  const years = useMemo(() => {
    if (!leaves) return [];
    const set = new Set(
      leaves.map((l) => new Date(l.start_date).getFullYear()),
    );
    return Array.from(set).sort((a, b) => b - a);
  }, [leaves]);

  const employeeLeaves = useMemo(() => {
    if (!leaves || !selectedEmployeeId) return [];
    let list = leaves.filter((l) => l.employee_id === selectedEmployeeId);
    if (statusTab !== "All") list = list.filter((l) => l.status === statusTab);
    if (year !== "All") {
      list = list.filter(
        (l) => String(new Date(l.start_date).getFullYear()) === String(year),
      );
    }
    return [...list].sort(
      (a, b) => new Date(b.start_date) - new Date(a.start_date),
    );
  }, [leaves, selectedEmployeeId, statusTab, year]);

  const employeeStats = useMemo(() => {
    if (!leaves || !selectedEmployeeId)
      return { total: 0, approved: 0, pending: 0, rejected: 0 };
    const all = leaves.filter((l) => l.employee_id === selectedEmployeeId);
    return {
      total: all.length,
      approved: all.filter((l) => l.status === "Approved").length,
      pending: all.filter((l) => l.status === "Pending").length,
      rejected: all.filter((l) => l.status === "Rejected").length,
    };
  }, [leaves, selectedEmployeeId]);

  return (
    <div>
      <PageHeader
        title="Team Leave History"
        subtitle="Browse leave history by team member. Approval is handled by Super Admin — this is a read-only history view."
        actions={
          <button
            onClick={() => exportCsv(leaves || [])}
            disabled={!leaves?.length}
            className="flex items-center gap-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-3.5 py-2 rounded-lg"
          >
            <Download size={14} /> Export
          </button>
        }
      />

      {error && (
        <div className="mb-4 text-sm text-orange-500 bg-orange-50 border border-orange-100 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
        {/* ================= Left: roster ================= */}
        <div
          className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${
            mobileView === "detail" ? "hidden lg:block" : ""
          }`}
        >
          <div className="p-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search team member..."
                className="text-sm text-slate-700 outline-none w-full bg-transparent"
              />
            </div>
          </div>

          <div className="max-h-[420px] lg:max-h-[620px] overflow-y-auto">
            {leaves === null ? (
              <div className="p-3.5 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-12 bg-slate-100 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : filteredRoster.length === 0 ? (
              <div className="p-6 text-center">
                <Users size={20} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No team members found.</p>
              </div>
            ) : (
              filteredRoster.map((p) => {
                const active = p.employeeId === selectedEmployeeId;
                return (
                  <button
                    key={p.employeeId}
                    onClick={() => {
                      setSelectedEmployeeId(p.employeeId);
                      setMobileView("detail");
                    }}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-3 border-b border-slate-50 last:border-0 text-left transition-colors ${
                      active
                        ? "bg-orange-50 border-l-4 border-l-orange-500 pl-3"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full text-xs font-semibold flex items-center justify-center shrink-0 ${
                        active
                          ? "bg-orange-500 text-white"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {initials(p.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {p.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {p.code}
                      </p>
                    </div>
                    {p.pending > 0 && (
                      <span className="shrink-0 text-[11px] font-semibold text-orange-600 bg-orange-100 rounded-full px-2 py-0.5">
                        {p.pending} pending
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ================= Right: employee detail ================= */}
        <div
          className={`bg-white rounded-xl border border-slate-200 ${
            mobileView === "roster" ? "hidden lg:block" : ""
          }`}
        >
          {/* Mobile-only back button — desktop always shows both panels */}
          <button
            onClick={() => setMobileView("roster")}
            className="lg:hidden w-full flex items-center gap-1.5 text-sm font-medium text-slate-600 px-5 py-3 border-b border-slate-100"
          >
            <ChevronLeft size={16} /> Back to team
          </button>

          {leaves === null ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-slate-100 rounded animate-pulse"
                />
              ))}
            </div>
          ) : !selectedEmployee ? (
            <div className="h-72 flex flex-col items-center justify-center text-center px-6">
              <Users size={22} className="text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600">
                No leave records for your team yet.
              </p>
            </div>
          ) : (
            <>
              {/* Employee header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-orange-500 text-white text-sm font-semibold flex items-center justify-center shrink-0">
                    {initials(selectedEmployee.name)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {selectedEmployee.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {selectedEmployee.code}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 sm:flex sm:items-center sm:gap-5 w-full sm:w-auto">
                  <div className="text-center sm:text-right">
                    <p className="text-base font-bold text-slate-800">
                      {employeeStats.total}
                    </p>
                    <p className="text-[11px] text-slate-400">Total</p>
                  </div>
                  <div className="text-center sm:text-right">
                    <p className="text-base font-bold text-blue-600">
                      {employeeStats.approved}
                    </p>
                    <p className="text-[11px] text-slate-400">Approved</p>
                  </div>
                  <div className="text-center sm:text-right">
                    <p className="text-base font-bold text-orange-600">
                      {employeeStats.pending}
                    </p>
                    <p className="text-[11px] text-slate-400">Pending</p>
                  </div>
                  <div className="text-center sm:text-right">
                    <p className="text-base font-bold text-orange-500">
                      {employeeStats.rejected}
                    </p>
                    <p className="text-[11px] text-slate-400">Rejected</p>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-slate-100">
                {STATUS_TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setStatusTab(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      statusTab === t
                        ? "bg-orange-500 border-orange-500 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
                {years.length > 0 && (
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="ml-auto text-xs text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none"
                  >
                    <option value="All">All years</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Timeline */}
              <div className="px-5 py-5">
                {employeeLeaves.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center text-center">
                    <CalendarDays size={20} className="text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400">
                      No records match this filter.
                    </p>
                  </div>
                ) : (
                  <ul>
                    {employeeLeaves.map((leave, idx) => {
                      const lt = leaveTypeStyle(leave.leave_types?.leave_name);
                      const LtIcon = lt.icon;
                      const st = statusStyle(leave.status);
                      const StIcon = st.icon;
                      const isLast = idx === employeeLeaves.length - 1;

                      return (
                        <li key={leave.id} className="flex gap-4">
                          {/* Rail */}
                          <div className="flex flex-col items-center w-5 shrink-0">
                            <span
                              className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${st.dot}`}
                            />
                            {!isLast && (
                              <span className="w-px flex-1 bg-slate-200 my-1" />
                            )}
                          </div>

                          {/* Body */}
                          <div
                            className={`min-w-0 flex-1 ${isLast ? "" : "pb-5"}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${lt.bg} ${lt.text}`}
                                >
                                  <LtIcon size={13} />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-800">
                                    {leave.leave_types?.leave_name || "Leave"}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {formatRange(
                                      leave.start_date,
                                      leave.end_date,
                                    )}{" "}
                                    · {leave.total_days}{" "}
                                    {leave.total_days === 1 ? "day" : "days"}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}
                              >
                                <StIcon size={11} />
                                {leave.status}
                              </span>
                            </div>
                            {leave.reason && (
                              <p className="text-xs text-slate-500 mt-1 ml-9">
                                {leave.reason}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-300 mt-0.5 ml-9">
                              {formatApplied(leave.applied_date)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
