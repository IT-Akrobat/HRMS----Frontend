import {
  Baby,
  CalendarDays,
  CheckCircle2,
  Clock,
  Clock3,
  HeartHandshake,
  HeartPulse,
  Info,
  MessageSquareText,
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
import StatCard from "../../components/common/StatCard";
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
//
// READ-ONLY: company policy is that only SUPER ADMIN can approve/reject
// leave (PUT /leaves/{id} is gated to SUPER ADMIN at the route level), so
// this screen just surfaces status — there are no Approve/Reject actions
// here anymore.
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

function formatShort(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

const TABS = [
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "All", label: "All" },
];

export default function LeavePending() {
  const [leaves, setLeaves] = useState(null); // null = loading
  const [tab, setTab] = useState("Pending");
  const [search, setSearch] = useState("");

  function load() {
    apiClient
      .get("/leaves/team")
      .then((res) => setLeaves(res?.data || []))
      .catch(() => setLeaves([]));
  }

  useEffect(load, []);

  const stats = useMemo(() => {
    const all = leaves || [];
    return {
      pending: all.filter((l) => l.status === "Pending").length,
      approved: all.filter((l) => l.status === "Approved").length,
      rejected: all.filter((l) => l.status === "Rejected").length,
      total: all.length,
    };
  }, [leaves]);

  const filtered = useMemo(() => {
    if (!leaves) return null;
    let list = leaves;
    if (tab !== "All") list = list.filter((l) => l.status === tab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((l) => {
        const name = l.employees?.full_name?.toLowerCase() || "";
        const type = l.leave_types?.leave_name?.toLowerCase() || "";
        return name.includes(q) || type.includes(q);
      });
    }
    // Oldest pending first — that's the request that's been waiting longest.
    return [...list].sort(
      (a, b) => new Date(a.applied_date) - new Date(b.applied_date),
    );
  }, [leaves, tab, search]);

  return (
    <div>
      <PageHeader
        title="Team Leave Requests"
        subtitle="View leave requests from your team. Approval is handled by Super Admin — you'll see status update here as decisions are made."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Clock}
          label="Pending"
          color="orange"
          loading={leaves === null}
          value={stats.pending}
        />
        <StatCard
          icon={CheckCircle2}
          label="Approved"
          color="blue"
          loading={leaves === null}
          value={stats.approved}
        />
        <StatCard
          icon={XCircle}
          label="Rejected"
          color="red"
          loading={leaves === null}
          value={stats.rejected}
        />
        <StatCard
          icon={Users}
          label="Total Requests"
          color="slate"
          loading={leaves === null}
          value={stats.total}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        {/* Tabs + search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  tab === t.value
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.label}
                {t.value === "Pending" && stats.pending > 0 && (
                  <span className="ml-1">({stats.pending})</span>
                )}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee or leave type..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>
        </div>

        {/* List */}
        {filtered === null ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-slate-100 rounded animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <CheckCircle2 size={20} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-600">
              {tab === "Pending"
                ? "No pending requests right now."
                : "No requests match here."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((leave) => {
              const typeStyle = leaveTypeStyle(leave.leave_types?.leave_name);
              const TypeIcon = typeStyle.icon;
              const status = statusStyle(leave.status);
              const StatusIcon = status.icon;

              return (
                <li
                  key={leave.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4"
                >
                  {/* Employee */}
                  <div className="flex items-center gap-3 sm:w-48 shrink-0">
                    <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold flex items-center justify-center shrink-0">
                      {initials(leave.employees?.full_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {leave.employees?.full_name || "—"}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {leave.employees?.employee_id}
                      </p>
                    </div>
                  </div>

                  {/* Leave details */}
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeStyle.bg} ${typeStyle.text}`}
                    >
                      <TypeIcon size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700">
                        {leave.leave_types?.leave_name || "Leave"}{" "}
                        <span className="text-slate-400 font-normal">
                          · {leave.total_days}{" "}
                          {leave.total_days === 1 ? "day" : "days"}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatShort(leave.start_date)} →{" "}
                        {formatShort(leave.end_date)}
                      </p>
                      {leave.reason && (
                        <p className="text-xs text-slate-500 mt-1 flex items-start gap-1">
                          <MessageSquareText
                            size={12}
                            className="mt-0.5 shrink-0 text-slate-300"
                          />
                          <span className="line-clamp-2">{leave.reason}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status (view-only — approval is Super Admin's call) */}
                  <div className="flex items-center justify-end gap-2 sm:w-56 shrink-0">
                    <span
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${status.bg} ${status.text}`}
                    >
                      <StatusIcon size={13} />
                      {leave.status}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
