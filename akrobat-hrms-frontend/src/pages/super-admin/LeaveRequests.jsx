import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import { apiClient } from "../../services/apiClient";

// ---------------------------------------------------------------------
// Backend contract:
//   GET /leaves/?page&limit&status  (requires VIEW_LEAVE_REQUESTS, which
//     SUPER ADMIN always has) -> { success: true, data: { records, total,
//     page, limit } }
//   PUT /leaves/{id} { status, comments } -> approve/reject. Gated at the
//     route to SUPER ADMIN only (see app/leaves/routes.py) — company
//     policy is that no other role can approve or reject leave.
// ---------------------------------------------------------------------

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
  { value: "", label: "All" },
];

const PAGE_SIZE = 20;

export default function LeaveRequests() {
  const [records, setRecords] = useState(null); // null = loading
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("Pending");
  const [search, setSearch] = useState("");
  const [actingOn, setActingOn] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectComment, setRejectComment] = useState("");
  const [error, setError] = useState("");

  function load() {
    setRecords(null);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (status) params.set("status", status);

    apiClient
      .get(`/leaves/?${params.toString()}`)
      .then((res) => {
        setRecords(res?.data?.records || []);
        setTotal(res?.data?.total || 0);
      })
      .catch(() => {
        setRecords([]);
        setTotal(0);
      });
  }

  useEffect(load, [page, status]);

  const filtered = useMemo(() => {
    if (!records) return null;
    if (!search.trim()) return records;
    const q = search.trim().toLowerCase();
    return records.filter((l) => {
      const name = l.employees?.full_name?.toLowerCase() || "";
      const type = l.leave_types?.leave_name?.toLowerCase() || "";
      return name.includes(q) || type.includes(q);
    });
  }, [records, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function approve(leave) {
    setError("");
    setActingOn(leave.id);
    try {
      await apiClient.put(`/leaves/${leave.id}`, { status: "Approved" });
      load();
    } catch (err) {
      setError(err.message || "Unable to approve this request.");
    } finally {
      setActingOn(null);
    }
  }

  function openReject(leave) {
    setRejectTarget(leave);
    setRejectComment("");
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setError("");
    setActingOn(rejectTarget.id);
    try {
      await apiClient.put(`/leaves/${rejectTarget.id}`, {
        status: "Rejected",
        comments: rejectComment.trim() || undefined,
      });
      setRejectTarget(null);
      load();
    } catch (err) {
      setError(err.message || "Unable to reject this request.");
    } finally {
      setActingOn(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Leave Requests"
        subtitle="Company-wide leave approvals. As Super Admin, you're the only role that can approve or reject a request."
      />

      {error && (
        <div className="mb-4 text-sm text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-4 py-2.5">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200">
        {/* Tabs + search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  setStatus(t.value);
                  setPage(1);
                }}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  status === t.value
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.label}
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
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 bg-slate-100 rounded animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <CalendarDays size={20} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-600">
              {status === "Pending"
                ? "No pending requests. You're all caught up."
                : "No requests match here."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((leave) => {
              const st = statusStyle(leave.status);
              const StatusIcon = st.icon;
              const isPending = leave.status === "Pending";
              const isActing = actingOn === leave.id;

              return (
                <li
                  key={leave.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4"
                >
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

                  <div className="flex-1 min-w-0">
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
                  </div>

                  <div className="flex items-center justify-end gap-2 sm:w-56 shrink-0">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => approve(leave)}
                          disabled={isActing}
                          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
                        >
                          {isActing ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Check size={13} />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => openReject(leave)}
                          disabled={isActing}
                          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-orange-600 border border-orange-200 hover:bg-orange-50 disabled:opacity-50 rounded-lg transition-colors"
                        >
                          <X size={13} />
                          Reject
                        </button>
                      </>
                    ) : (
                      <span
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${st.bg} ${st.text}`}
                      >
                        <StatusIcon size={13} />
                        {leave.status}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Page {page} of {totalPages} · {total} total
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reject reason modal */}
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject Leave Request"
        subtitle={
          rejectTarget
            ? `${rejectTarget.employees?.full_name} · ${rejectTarget.leave_types?.leave_name}`
            : ""
        }
        footer={
          <>
            <button
              onClick={() => setRejectTarget(null)}
              className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmReject}
              disabled={actingOn === rejectTarget?.id}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 rounded-lg"
            >
              {actingOn === rejectTarget?.id && (
                <Loader2 size={14} className="animate-spin" />
              )}
              Confirm Reject
            </button>
          </>
        }
      >
        <label className="block text-xs font-medium text-slate-500 mb-1.5">
          Reason for rejection (optional — shared with the employee)
        </label>
        <textarea
          rows={3}
          maxLength={300}
          value={rejectComment}
          onChange={(e) => setRejectComment(e.target.value)}
          placeholder="e.g. Team is short-staffed that week, please pick alternate dates."
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
        />
      </Modal>
    </div>
  );
}
