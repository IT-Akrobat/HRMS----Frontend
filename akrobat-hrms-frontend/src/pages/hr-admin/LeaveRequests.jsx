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
import McCertificate from "../../components/common/McCertificate";
import McValidationQueue from "../../components/common/McValidationQueue";
import PageHeader from "../../components/common/PageHeader";
import SearchInput from "../../components/common/SearchInput";
import { useAttendanceLiveUpdates } from "../../hooks/Useattendanceliveupdates";
import { apiClient } from "../../services/apiClient";

// ---------------------------------------------------------------------
// Backend contract: GET /leaves/?page&limit&status (see app/leaves/routes.py
// + services.py, requires VIEW_LEAVE_REQUESTS which HR ADMIN holds) ->
// { success: true, data: { records: [...], total, page, limit } }
//
// READ-ONLY: company policy is that only SUPER ADMIN can approve/reject
// leave (PUT /leaves/{id} is gated to SUPER ADMIN at the route level), so
// this is a company-wide visibility screen only — no Approve/Reject here.
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

// "MC" is not a real leave status: it is a client-side view that lists every
// medical leave (any leave with an mc_status) together with its certificate,
// so HR can open and validate the attachments in one place.
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
// The MC tab walks the whole list (the endpoint has no MC filter), so it
// pulls bigger pages and stops after a safe number of them.
const MC_FETCH_LIMIT = 100;
const MC_MAX_PAGES = 20;

export default function LeaveRequests() {
  const [records, setRecords] = useState(null); // null = loading
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [mcFilter, setMcFilter] = useState("");

  const isMc = status === MC_TAB;

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

  function loadRecords() {
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
  }

  // The MC tab pages client-side, so a page change must not refetch it.
  useEffect(loadRecords, [isMc ? 0 : page, status]);

  // Refetches the instant anyone applies for leave or has one
  // approved/rejected, anywhere in the company, instead of waiting for
  // a manual refresh.
  useAttendanceLiveUpdates(loadRecords);

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
          subtitle="Company-wide leave visibility (view only). Each leave is approved by the employee's reporting manager."
          actions={<CreateLeaveTypeButton />}
        />
      </div>

      {/* Mobile: title with the button at its right; no description on mobile. */}
      <div className="sm:hidden mb-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-800">Leave Requests</h1>
          <div className="flex items-center gap-2">
            <CreateLeaveTypeButton label="Leave type" iconOnly />
          </div>
        </div>
      </div>

      {!isMc && <McValidationQueue onChanged={loadRecords} />}

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
                : "No leave requests match here."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((leave) => {
              const st = statusStyle(leave.status);
              const StatusIcon = st.icon;

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
                        · {leave.total_days}{" "}
                        {leave.total_days === 1 ? "day" : "days"}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatShort(leave.start_date)} →{" "}
                      {formatShort(leave.end_date)}
                    </p>
                    <McCertificate
                      leave={leave}
                      mode="hr"
                      onChanged={loadRecords}
                    />
                  </div>

                  <div className="flex items-center justify-end sm:w-32 shrink-0">
                    <span
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${st.bg} ${st.text}`}
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
