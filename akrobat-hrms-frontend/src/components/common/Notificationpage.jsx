import {
  Bell,
  CalendarClock,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Megaphone,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../services/apiClient";
import { parseServerDate } from "../../utils/date";
import PageHeader from "./PageHeader";

// ---------------------------------------------------------------------
// Backend contract: GET /notifications/my (see app/notifications)
// -> { success: true, data: [ {
//      id, employee_id, title, message, notification_type, is_read,
//      created_at
//    }, ... ] }
// notification_type is one of LEAVE / OVERTIME / ATTENDANCE / SYSTEM /
// GENERAL. The leaves module fires these automatically: applying for
// leave notifies the manager, approving/rejecting notifies the employee.
// ---------------------------------------------------------------------

const TYPE_META = {
  LEAVE: {
    icon: CalendarClock,
    text: "text-orange-500",
    bg: "bg-orange-50",
    label: "Leave",
  },
  OVERTIME: {
    icon: Clock,
    text: "text-blue-500",
    bg: "bg-blue-50",
    label: "Overtime",
  },
  ATTENDANCE: {
    icon: Clock,
    text: "text-blue-500",
    bg: "bg-blue-50",
    label: "Attendance",
  },
  SYSTEM: {
    icon: Megaphone,
    text: "text-slate-500",
    bg: "bg-slate-100",
    label: "System",
  },
  GENERAL: {
    icon: Bell,
    text: "text-slate-500",
    bg: "bg-slate-100",
    label: "General",
  },
};

function typeMeta(type) {
  return TYPE_META[(type || "").toUpperCase()] || TYPE_META.GENERAL;
}

// Notifications list is paginated client-side, 10 per page.
const PAGE_SIZE = 10;

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = parseServerDate(dateStr);
  if (!d) return "";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "LEAVE", label: "Leave" },
  { value: "SYSTEM", label: "System" },
];

/**
 * @param {string} subtitle - shown under the page title
 * @param {string} reviewLink - optional CTA (e.g. manager -> /manager/leave/pending)
 * @param {string} reviewLabel - label for that CTA
 */
export default function NotificationsPage({
  subtitle = "Stay up to date with requests, approvals and announcements.",
  reviewLink,
  reviewLabel = "Review Pending Approvals",
}) {
  const [notifications, setNotifications] = useState(null); // null = loading
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [page, setPage] = useState(1);

  function load() {
    apiClient
      .get("/notifications/my")
      .then((res) => setNotifications(res?.data || []))
      .catch(() => setNotifications([]));
  }

  useEffect(load, []);

  const unreadCount = useMemo(
    () => (notifications || []).filter((n) => !n.is_read).length,
    [notifications],
  );

  const leaveUnreadCount = useMemo(
    () =>
      (notifications || []).filter(
        (n) =>
          !n.is_read && (n.notification_type || "").toUpperCase() === "LEAVE",
      ).length,
    [notifications],
  );

  // Unread count per filter chip (WhatsApp-style badges) — "all" and
  // "unread" both reflect the same total unread count, while each type
  // chip (LEAVE, SYSTEM, ...) reflects only its own unseen items.
  const filterCounts = useMemo(() => {
    const counts = { all: unreadCount, unread: unreadCount };
    for (const f of FILTERS) {
      if (f.value === "all" || f.value === "unread") continue;
      counts[f.value] = (notifications || []).filter(
        (n) =>
          !n.is_read && (n.notification_type || "").toUpperCase() === f.value,
      ).length;
    }
    return counts;
  }, [notifications, unreadCount]);

  const filtered = useMemo(() => {
    if (!notifications) return null;
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((n) => !n.is_read);
    return notifications.filter(
      (n) => (n.notification_type || "").toUpperCase() === filter,
    );
  }, [notifications, filter]);

  // Reset to page 1 whenever the filter changes or the underlying list
  // reloads, so switching tabs never leaves you stranded on a page that
  // no longer exists.
  useEffect(() => {
    setPage(1);
  }, [filter, notifications]);

  const totalPages = Math.max(
    1,
    Math.ceil((filtered?.length || 0) / PAGE_SIZE),
  );
  const pageItems = useMemo(() => {
    if (!filtered) return filtered;
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, page]);

  async function markRead(n) {
    if (n.is_read) return;
    setNotifications((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)),
    );
    try {
      await apiClient.put(`/notifications/${n.id}/read`);
    } catch {
      load();
    }
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await apiClient.put("/notifications/my/read-all");
    } catch {
      load();
    }
  }

  async function remove(n) {
    setBusyId(n.id);
    const previous = notifications;
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    try {
      await apiClient.delete(`/notifications/${n.id}`);
    } catch {
      setNotifications(previous);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={subtitle}
        actions={
          unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors"
            >
              <CheckCheck size={15} /> Mark All Read
            </button>
          )
        }
      />

      {reviewLink && (
        <div className="mb-6">
          <Link
            to={reviewLink}
            className="bg-orange-500 hover:bg-orange-600 transition-colors rounded-xl p-4 flex items-center justify-between text-white max-w-sm"
          >
            <div>
              <span className="text-sm text-orange-50">{reviewLabel}</span>
              <div className="text-2xl font-bold">
                {leaveUnreadCount > 0 ? leaveUnreadCount : "—"}
              </div>
            </div>
            <CalendarClock size={22} />
          </Link>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const count = filterCounts[f.value] || 0;
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? "bg-orange-500 border-orange-500 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
              {count > 0 && (
                <span
                  className={`min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center ${
                    active
                      ? "bg-white/25 text-white"
                      : "bg-orange-500 text-white"
                  }`}
                >
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200">
        {filtered === null ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 bg-slate-100 rounded animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Bell size={20} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-600">
              {filter === "unread"
                ? "You're all caught up."
                : "No notifications yet."}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              You'll see updates on leave requests and announcements here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pageItems.map((n) => {
              const meta = typeMeta(n.notification_type);
              const Icon = meta.icon;
              return (
                <li
                  key={n.id}
                  onClick={() => markRead(n)}
                  className={`flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                    !n.is_read ? "bg-orange-50/40" : ""
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${meta.bg} ${meta.text}`}
                  >
                    <Icon size={17} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDate(n.created_at)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(n);
                    }}
                    disabled={busyId === n.id}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-orange-500 hover:bg-orange-50 transition-colors disabled:opacity-40"
                    aria-label="Delete notification"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination — 10 notifications per page */}
        {filtered && filtered.length > 0 && (
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
                aria-label="Previous page"
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
                aria-label="Next page"
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
