import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Filter,
  LogIn,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { apiClient } from "../../services/apiClient";
import { parseServerDate } from "../../utils/date";

// ---------------------------------------------------------------------
// Backend contract (app/audit_logs/routes.py — VIEW_AUDIT_LOGS, which
// SUPER ADMIN always has via the require_permission() bypass):
//   GET /audit-logs/?page&limit                 -> { records, total, page, limit }
//   GET /audit-logs/module/{module}?page&limit  -> same shape, one module
//   GET /audit-logs/action/{action}?page&limit  -> same shape, one action
//   GET /audit-logs/date/{YYYY-MM-DD}           -> { data: [...] } (no paging)
//   DELETE /audit-logs/{id}                     -> MANAGE_AUDIT_LOGS (Super Admin only)
//
// Row shape: { id, employee_id, action, module, record_id, description,
//   ip_address, user_agent, created_at, employees: { full_name, employee_id } }
//
// `description` is sometimes a plain string ("Login: name@co.com") and
// sometimes a JSON string packed by app/core/audit.py._diff() — e.g.
// {"message": "...", "target_employee_id": "...", "changes": {"status":
// {"old": "Pending", "new": "Approved"}}} — so it's parsed defensively
// wherever it's shown.
// ---------------------------------------------------------------------

const MODULES = [
  "ATTENDANCE",
  "AUDIT_LOGS",
  "AUTH",
  "DOCUMENTS",
  "EMPLOYEE",
  "LEAVE",
  "PAYROLL",
];

const ACTION_META = {
  CREATE: { icon: Plus, text: "text-blue-600", bg: "bg-blue-50" },
  APPLY: { icon: Plus, text: "text-blue-600", bg: "bg-blue-50" },
  UPDATE: { icon: Pencil, text: "text-amber-600", bg: "bg-amber-50" },
  ADMIN_UPDATE: { icon: Pencil, text: "text-amber-600", bg: "bg-amber-50" },
  DELETE: { icon: Trash2, text: "text-orange-600", bg: "bg-orange-50" },
  LOGIN: { icon: LogIn, text: "text-violet-600", bg: "bg-violet-50" },
  APPROVED: { icon: ArrowUpCircle, text: "text-blue-600", bg: "bg-blue-50" },
  REJECTED: {
    icon: ArrowDownCircle,
    text: "text-orange-600",
    bg: "bg-orange-50",
  },
  CHECK_IN: { icon: ArrowUpCircle, text: "text-blue-600", bg: "bg-blue-50" },
  CHECK_OUT: {
    icon: ArrowDownCircle,
    text: "text-slate-500",
    bg: "bg-slate-100",
  },
};

function actionMeta(action) {
  return (
    ACTION_META[(action || "").toUpperCase()] || {
      icon: ClipboardList,
      text: "text-slate-500",
      bg: "bg-slate-100",
    }
  );
}

// description can be plain text, or JSON packed by record_audit_log's
// _diff(). Normalize both into { message, changes, targetEmployeeId }.
function parseDescription(raw) {
  if (!raw) return { message: "", changes: null, targetEmployeeId: null };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return {
        message: parsed.message || "",
        changes: parsed.changes || null,
        targetEmployeeId: parsed.target_employee_id || null,
      };
    }
  } catch {
    // not JSON — plain description string
  }
  return { message: raw, changes: null, targetEmployeeId: null };
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

function Avatar({ person, className }) {
  return person?.profile_photo ? (
    <img
      src={person.profile_photo}
      alt={person.full_name}
      className={`${className} object-cover shrink-0`}
    />
  ) : (
    <div
      className={`${className} bg-orange-100 text-orange-700 font-semibold flex items-center justify-center shrink-0`}
    >
      {initials(person?.full_name)}
    </div>
  );
}

function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  const d = parseServerDate(dateStr);
  if (!d) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PAGE_SIZE = 20;

export default function SecurityAuditLogs() {
  const [records, setRecords] = useState(null); // null = loading
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [module, setModule] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  function load() {
    setRecords(null);
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });

    const path = module
      ? `/audit-logs/module/${encodeURIComponent(module)}?${params.toString()}`
      : `/audit-logs/?${params.toString()}`;

    apiClient
      .get(path)
      .then((res) => {
        setRecords(res?.data?.records || []);
        setTotal(res?.data?.total || 0);
      })
      .catch((err) => {
        setRecords([]);
        setTotal(0);
        setError(err.message || "Unable to load audit logs.");
      });
  }

  useEffect(load, [page, module]);

  const filtered = useMemo(() => {
    if (!records) return null;
    if (!search.trim()) return records;
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      const name = r.employees?.full_name?.toLowerCase() || "";
      const action = (r.action || "").toLowerCase();
      const desc = parseDescription(r.description).message.toLowerCase();
      return name.includes(q) || action.includes(q) || desc.includes(q);
    });
  }, [records, search]);

  const todayCount = useMemo(() => {
    if (!records) return 0;
    const today = new Date().toDateString();
    return records.filter(
      (r) => parseServerDate(r.created_at)?.toDateString() === today,
    ).length;
  }, [records]);

  const loginCount = useMemo(() => {
    if (!records) return 0;
    return records.filter((r) => r.action === "LOGIN").length;
  }, [records]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Full trail of who did what, across every module — company-wide."
      />

      {error && (
        <div className="mb-4 text-sm text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-4 py-2.5">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={ClipboardList}
          label="Total logged events"
          value={total}
          loading={records === null}
        />
        <StatCard
          icon={Shield}
          label="Events on this page"
          value={records?.length ?? 0}
          loading={records === null}
          color="blue"
        />
        <StatCard
          icon={LogIn}
          label="Logins on this page"
          value={loginCount}
          loading={records === null}
          color="purple"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0 pr-1">
              <Filter size={13} /> Module
            </div>
            <button
              onClick={() => {
                setModule("");
                setPage(1);
              }}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                module === ""
                  ? "bg-orange-500 border-orange-500 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              All
            </button>
            {MODULES.map((m) => (
              <button
                key={m}
                onClick={() => {
                  setModule(m);
                  setPage(1);
                }}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  module === m
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64 shrink-0">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search this page..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>
        </div>

        {/* Table */}
        {filtered === null ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-14 bg-slate-100 rounded animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <ClipboardList size={20} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-600">
              No matching audit events.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="font-medium px-5 py-3">Actor</th>
                  <th className="font-medium px-3 py-3">Module</th>
                  <th className="font-medium px-3 py-3">Action</th>
                  <th className="font-medium px-3 py-3">Description</th>
                  <th className="font-medium px-3 py-3">IP Address</th>
                  <th className="font-medium px-3 py-3 text-right">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((log) => {
                  const meta = actionMeta(log.action);
                  const ActionIcon = meta.icon;
                  const { message } = parseDescription(log.description);

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelected(log)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            person={log.employees}
                            className="w-7 h-7 rounded-full text-[10px]"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">
                              {log.employees?.full_name || "System"}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {log.employees?.employee_id || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                          {log.module}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${meta.bg} ${meta.text}`}
                        >
                          <ActionIcon size={12} />
                          {log.action}
                        </span>
                      </td>
                      <td className="px-3 py-3 max-w-xs">
                        <p className="text-sm text-slate-600 truncate">
                          {message || "—"}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {log.ip_address || "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400 text-right whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

      {/* Detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Audit Log Detail"
        subtitle={selected ? `${selected.module} · ${selected.action}` : ""}
      >
        {selected && <AuditDetail log={selected} />}
      </Modal>
    </div>
  );
}

function AuditDetail({ log }) {
  const { message, changes, targetEmployeeId } = parseDescription(
    log.description,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Actor" value={log.employees?.full_name || "System"} />
        <Field label="Employee ID" value={log.employees?.employee_id || "—"} />
        <Field label="Timestamp" value={formatDateTime(log.created_at)} />
        <Field label="IP Address" value={log.ip_address || "—"} />
        <Field label="Record ID" value={log.record_id || "—"} mono />
        {targetEmployeeId && (
          <Field label="Target Employee" value={targetEmployeeId} mono />
        )}
      </div>

      {message && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Description</p>
          <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2.5">
            {message}
          </p>
        </div>
      )}

      {changes && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5">
            Field changes
          </p>
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {Object.entries(changes).map(([field, diff]) => (
              <div
                key={field}
                className="flex items-center justify-between px-3 py-2 text-xs"
              >
                <span className="font-medium text-slate-500 capitalize">
                  {field.replace(/_/g, " ")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-orange-500 line-through">
                    {String(diff.old ?? "—")}
                  </span>
                  <span className="text-slate-300">→</span>
                  <span className="text-blue-600 font-medium">
                    {String(diff.new ?? "—")}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {log.user_agent && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">User Agent</p>
          <p className="text-xs text-slate-400 break-all">{log.user_agent}</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p
        className={`text-sm text-slate-700 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
