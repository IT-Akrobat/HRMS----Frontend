import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Avatar from "../../components/common/Avatar";
import CreateLeaveTypeButton from "../../components/common/CreateLeaveTypeButton";
import HrManagedLeaveForm from "../../components/common/HrManagedLeaveForm";
import McCertificate from "../../components/common/McCertificate";
import McValidationQueue from "../../components/common/McValidationQueue";
import PageHeader from "../../components/common/PageHeader";
import SearchInput from "../../components/common/SearchInput";
import { apiClient } from "../../services/apiClient";
import { leaveDaysText } from "../../utils/leaveDays";

// ---------------------------------------------------------------------
// Backend contract:
//   GET /leaves/?page&limit&status  (requires VIEW_LEAVE_REQUESTS, which
//     SUPER ADMIN always has) -> { success: true, data: { records, total,
//     page, limit } }
// VIEW ONLY: Super Admin sees every request but does not approve/reject.
// The employee's reporting manager decides (Team Leave Requests page).
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

// "MC" is a client-side view, not a leave status: it lists every medical
// leave (any leave with an mc_status) with its certificate for validation.
const MC_TAB = "MC";

const TABS = [
  { value: "", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: MC_TAB, label: "Medical (MC)", icon: Stethoscope },
];

const MC_FILTERS = [
  { value: "", label: "All MC" },
  { value: "CERTIFICATE_UPLOADED", label: "To validate" },
  { value: "AWAITING_CERTIFICATE", label: "No certificate yet" },
  { value: "VALIDATED", label: "Validated" },
];

const PAGE_SIZE = 20;
// The endpoint has no MC filter, so the MC tab pulls bigger pages and keeps
// the medical ones, stopping after a safe number of pages.
const MC_FETCH_LIMIT = 100;
const MC_MAX_PAGES = 20;

export default function LeaveRequests() {
  const [records, setRecords] = useState(null); // null = loading
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(""); // "All" tab is active initially
  const [search, setSearch] = useState("");
  const [mcFilter, setMcFilter] = useState("");
  const isMc = status === MC_TAB;
  // KPI strip counts (same compact grid as the Departments page).
  const [counts, setCounts] = useState(null); // null = loading
  // Leaves THIS logged-in Super Admin is the assigned reporting manager for
  // (from GET /leaves/team -> can_decide). Only those get Approve / Reject.
  const [decidableIds, setDecidableIds] = useState(() => new Set());
  const [actingId, setActingId] = useState(null);
  const [actionError, setActionError] = useState("");

  async function decide(leave, nextStatus) {
    let comments;
    if (nextStatus === "Rejected") {
      comments = window.prompt("Reason for rejecting (optional):") ?? undefined;
    }
    setActingId(leave.id);
    setActionError("");
    try {
      await apiClient.put(`/leaves/${leave.id}`, {
        status: nextStatus,
        comments,
      });
      load();
      loadCounts();
    } catch (e) {
      setActionError(e.message || "Unable to update this request.");
    } finally {
      setActingId(null);
    }
  }

  async function loadMcRecords() {
    const all = [];
    let p = 1;
    let serverTotal = Infinity;
    while (all.length < serverTotal && p <= MC_MAX_PAGES) {
      const res = await apiClient.get(
        `/leaves/?page=${p}&limit=${MC_FETCH_LIMIT}`,
      );
      const batch = res?.data?.records || [];
      serverTotal = res?.data?.total ?? batch.length;
      all.push(...batch);
      if (batch.length === 0) break;
      p += 1;
    }
    return all.filter((l) => l.mc_status);
  }

  function load() {
    setRecords(null);

    if (isMc) {
      loadMcRecords()
        .then((rows) => {
          setRecords(rows);
          setTotal(rows.length);
        })
        .catch(() => {
          setRecords([]);
          setTotal(0);
        });
      loadDecidable();
      return;
    }

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

    loadDecidable();
  }

  function loadCounts() {
    const one = (st) =>
      apiClient
        .get(`/leaves/?page=1&limit=1${st ? `&status=${st}` : ""}`)
        .then((res) => res?.data?.total || 0)
        .catch(() => 0);
    Promise.all([
      one(""),
      one("Pending"),
      one("Approved"),
      one("Rejected"),
    ]).then(([all, pending, approved, rejected]) =>
      setCounts({ all, pending, approved, rejected }),
    );
  }

  function loadDecidable() {
    apiClient
      .get("/leaves/team")
      .then((res) => {
        const rows = Array.isArray(res?.data) ? res.data : [];
        setDecidableIds(
          new Set(
            rows
              .filter((r) => r.can_decide && r.status === "Pending")
              .map((r) => r.id),
          ),
        );
      })
      .catch(() => setDecidableIds(new Set()));
  }

  useEffect(loadCounts, []);

  // The MC tab pages client-side, so a page change must not refetch it.
  useEffect(load, [isMc ? 0 : page, status]);

  const mcCounts = useMemo(() => {
    const c = {
      "": 0,
      CERTIFICATE_UPLOADED: 0,
      AWAITING_CERTIFICATE: 0,
      VALIDATED: 0,
    };
    if (isMc && records) {
      c[""] = records.length;
      records.forEach((l) => {
        if (c[l.mc_status] !== undefined) c[l.mc_status] += 1;
      });
    }
    return c;
  }, [records, isMc]);

  const filtered = useMemo(() => {
    if (!records) return null;
    let rows = records;
    if (isMc && mcFilter) rows = rows.filter((l) => l.mc_status === mcFilter);
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((l) => {
      const name = l.employees?.full_name?.toLowerCase() || "";
      const type = l.leave_types?.leave_name?.toLowerCase() || "";
      return name.includes(q) || type.includes(q);
    });
  }, [records, search, isMc, mcFilter]);

  // Normal tabs page on the server; the MC tab pages the filtered list here.
  const listTotal = isMc ? filtered?.length || 0 : total;
  const totalPages = Math.max(1, Math.ceil(listTotal / PAGE_SIZE));
  const visible = useMemo(() => {
    if (!filtered) return null;
    if (!isMc) return filtered;
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, isMc, page]);

  return (
    <div>
      {/* Desktop: title + description on the left, button at the right. */}
      <div className="hidden sm:block">
        <PageHeader
          title="Leave Requests"
          subtitle="Company-wide leave requests. Each employee's reporting manager approves or rejects their leave (you can decide only the ones where you are the reporting manager)."
          actions={
            <>
              <CreateLeaveTypeButton />
              <HrManagedLeaveForm onChanged={load} />
            </>
          }
        />
      </div>

      {/* Mobile: title with the button at its right; no description on mobile. */}
      <div className="sm:hidden mb-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-800">Leave Requests</h1>
          <div className="flex items-center gap-2">
            <CreateLeaveTypeButton label="Leave type" plusOnly />
            <HrManagedLeaveForm
              onChanged={load}
              label="Record leave"
              plusOnly
            />
          </div>
        </div>
      </div>

      {/* KPI strip — compact tiles (same size as the Departments page) */}

      {!isMc && <McValidationQueue onChanged={load} />}

      <div className="bg-white rounded-xl border border-slate-200">
        {/* Tabs + search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  setStatus(t.value);
                  setMcFilter("");
                  setPage(1);
                }}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  status === t.value
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.icon && <t.icon size={13} />}
                {t.label}
              </button>
            ))}
          </div>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search employee or leave type..."
            className="w-full sm:w-64"
            iconSize={14}
            inputClassName="py-2"
          />
        </div>

        {/* MC sub-filters */}
        {isMc && (
          <div className="flex items-center gap-1.5 overflow-x-auto px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            {MC_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => {
                  setMcFilter(f.value);
                  setPage(1);
                }}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  mcFilter === f.value
                    ? "bg-slate-800 border-slate-800 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f.label}
                {records && (
                  <span className="ml-1.5 opacity-70">{mcCounts[f.value]}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* List */}
        {visible === null ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 bg-slate-100 rounded animate-pulse"
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <CalendarDays size={20} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-600">
              {isMc
                ? "No medical leave with a certificate matches here."
                : status === "Pending"
                  ? "No pending requests. You're all caught up."
                  : "No requests match here."}
            </p>
          </div>
        ) : (
          <>
            {actionError && (
              <p className="px-5 py-2 text-xs text-red-600 bg-red-50">
                {actionError}
              </p>
            )}
            <ul className="divide-y divide-slate-100">
              {visible.map((leave) => {
                const st = statusStyle(leave.status);
                const StatusIcon = st.icon;
                const isPending = leave.status === "Pending";

                return (
                  <li
                    key={leave.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4"
                  >
                    <div className="flex items-center gap-3 sm:w-48 shrink-0">
                      <Avatar
                        name={leave.employees?.full_name}
                        photo={leave.employees?.profile_photo}
                      />
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
                          · {leaveDaysText(leave, true)}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatShort(leave.start_date)} →{" "}
                        {formatShort(leave.end_date)}
                      </p>
                      <McCertificate leave={leave} mode="hr" onChanged={load} />
                    </div>

                    <div className="flex items-center justify-end gap-2 sm:w-56 shrink-0">
                      {isPending && decidableIds.has(leave.id) ? (
                        <>
                          <button
                            onClick={() => decide(leave, "Approved")}
                            disabled={actingId === leave.id}
                            className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => decide(leave, "Rejected")}
                            disabled={actingId === leave.id}
                            className="px-3.5 py-1.5 text-xs font-medium text-orange-600 border border-orange-200 hover:bg-orange-50 disabled:opacity-50 rounded-lg"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span
                          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${st.bg} ${st.text}`}
                        >
                          <StatusIcon size={13} />
                          {isPending
                            ? "Awaiting reporting manager"
                            : leave.status}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {/* Pagination */}
        {listTotal > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Page {page} of {totalPages} · {listTotal} total
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
    </div>
  );
}
