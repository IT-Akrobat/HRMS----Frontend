import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Laptop,
  LogIn,
  Monitor,
  Search,
  Smartphone,
  Tablet,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { apiClient } from "../../services/apiClient";
import { parseServerDate } from "../../utils/date";

// ---------------------------------------------------------------------
// Backend contract:
//   GET /audit-logs/action/LOGIN?page&limit (requires VIEW_AUDIT_LOGS,
//     which SUPER ADMIN always has) -> { records, total, page, limit }
//   Every successful sign-in writes one row here — see
//   app/auth/services.py login_user(): module="AUTH", action="LOGIN",
//   description="Login: {email}", plus ip_address/user_agent captured
//   from the request. There's no separate "login activity" table —
//   this page is the AUTH/LOGIN slice of the same audit trail shown on
//   the Audit Logs page.
// ---------------------------------------------------------------------

const PAGE_SIZE = 20;

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
      className={`${className} bg-violet-100 text-violet-700 font-semibold flex items-center justify-center shrink-0`}
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

function emailFromDescription(desc) {
  if (!desc) return null;
  const m = desc.match(/Login:\s*(.+)/i);
  return m ? m[1].trim() : null;
}

// Lightweight UA parsing — good enough for a device/browser column
// without pulling in a full UA-parser dependency.
function parseUserAgent(ua) {
  if (!ua) return { device: "Unknown", icon: Monitor, browser: "—", os: "—" };

  const isTablet = /iPad|Tablet/i.test(ua);
  const isMobile = !isTablet && /Mobile|Android|iPhone/i.test(ua);
  const device = isTablet ? "Tablet" : isMobile ? "Mobile" : "Desktop";
  const icon = isTablet ? Tablet : isMobile ? Smartphone : Laptop;

  let browser = "Other";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";

  let os = "Other";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";

  return { device, icon, browser, os };
}

export default function SecurityLoginActivity() {
  const [records, setRecords] = useState(null); // null = loading
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  function load() {
    setRecords(null);
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });

    apiClient
      .get(`/audit-logs/action/LOGIN?${params.toString()}`)
      .then((res) => {
        setRecords(res?.data?.records || []);
        setTotal(res?.data?.total || 0);
      })
      .catch((err) => {
        setRecords([]);
        setTotal(0);
        setError(err.message || "Unable to load login activity.");
      });
  }

  useEffect(load, [page]);

  const filtered = useMemo(() => {
    if (!records) return null;
    if (!search.trim()) return records;
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      const name = r.employees?.full_name?.toLowerCase() || "";
      const email = (emailFromDescription(r.description) || "").toLowerCase();
      const ip = (r.ip_address || "").toLowerCase();
      return name.includes(q) || email.includes(q) || ip.includes(q);
    });
  }, [records, search]);

  const todayCount = useMemo(() => {
    if (!records) return 0;
    const today = new Date().toDateString();
    return records.filter(
      (r) => parseServerDate(r.created_at)?.toDateString() === today,
    ).length;
  }, [records]);

  const uniqueUsers = useMemo(() => {
    if (!records) return 0;
    return new Set(records.map((r) => r.employee_id).filter(Boolean)).size;
  }, [records]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Login Activity"
        subtitle="Every successful sign-in across the organization, with device and location details."
      />

      {error && (
        <div className="mb-4 text-sm text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-4 py-2.5">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={LogIn}
          label="Total logins"
          value={total}
          loading={records === null}
        />
        <StatCard
          icon={Calendar}
          label="Logins today (this page)"
          value={todayCount}
          loading={records === null}
          color="blue"
        />
        <StatCard
          icon={Users}
          label="Unique users (this page)"
          value={uniqueUsers}
          loading={records === null}
          color="purple"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-medium text-slate-700">Recent sign-ins</p>
          <div className="relative w-full sm:w-64">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or IP..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>
        </div>

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
              <LogIn size={20} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-600">
              No login activity found.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="font-medium px-5 py-3">User</th>
                  <th className="font-medium px-3 py-3">Device</th>
                  <th className="font-medium px-3 py-3">Browser / OS</th>
                  <th className="font-medium px-3 py-3">IP Address</th>
                  <th className="font-medium px-3 py-3 text-right">
                    Signed in
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((log) => {
                  const email = emailFromDescription(log.description);
                  const {
                    device,
                    icon: DeviceIcon,
                    browser,
                    os,
                  } = parseUserAgent(log.user_agent);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            person={log.employees}
                            className="w-8 h-8 rounded-full text-[10px]"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">
                              {log.employees?.full_name || "Unknown user"}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {email || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                          <DeviceIcon size={12} />
                          {device}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {browser} · {os}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400 font-mono">
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
    </div>
  );
}
