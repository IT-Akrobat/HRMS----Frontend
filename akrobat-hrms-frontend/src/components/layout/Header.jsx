import {
  AlarmClock,
  Bell,
  CalendarClock,
  Clock,
  LogOut,
  Megaphone,
  Menu,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROLE_BASE_PATH, ROLE_LABELS } from "../../config/roles";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useNotificationLiveUpdates } from "../../hooks/useNotificationLiveUpdates";
import { apiClient } from "../../services/apiClient";
import { initNotificationFallback } from "../../services/Notificationfallback";

// Notification bell now backed by the real API (see app/notifications —
// GET /notifications/my, PUT /:id/read, PUT /my/read-all). The leaves
// module fires an insert into this table whenever a request is applied
// for (-> manager) or approved/rejected (-> employee), so this dropdown
// is what surfaces those to the person it concerns.

const TYPE_STYLES = {
  LEAVE: { icon: CalendarClock, className: "text-orange-500 bg-orange-50" },
  OVERTIME: { icon: Clock, className: "text-blue-500 bg-blue-50" },
  ATTENDANCE: { icon: Clock, className: "text-blue-500 bg-blue-50" },
  ATTENDANCE_REMINDER: {
    icon: AlarmClock,
    className: "text-orange-500 bg-orange-50",
  },
  SYSTEM: { icon: Megaphone, className: "text-slate-500 bg-slate-100" },
  GENERAL: { icon: Bell, className: "text-slate-500 bg-slate-100" },
};

function typeStyle(type) {
  return TYPE_STYLES[(type || "").toUpperCase()] || TYPE_STYLES.GENERAL;
}

// Short two-tone "ping" generated in-browser (no audio file to ship/host).
// Wrapped in try/catch because some browsers block audio until the user
// has interacted with the page at least once (autoplay policy) — that's
// fine, it just silently no-ops on the very first notification in that case.
function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Chrome/Safari/Firefox all create a new AudioContext in the
    // "suspended" state until it's explicitly resumed at least once —
    // scheduling oscillators on a suspended context doesn't throw, it
    // just never actually produces sound, which is why this silently
    // "did nothing" before. resume() is async, so the actual scheduling
    // has to happen after it resolves, not before.
    const schedule = () => {
      const now = ctx.currentTime;
      [880, 1174].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + i * 0.12;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.15, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.2);
      });
      setTimeout(() => ctx.close(), 500);
    };

    if (ctx.state === "suspended") {
      ctx
        .resume()
        .then(schedule)
        .catch(() => {});
    } else {
      schedule();
    }
  } catch {
    // Web Audio unsupported/blocked — non-fatal, toast still shows.
  }
}

// Native OS/browser notification — this is what shows up even when the
// person has switched to another tab or app (like WhatsApp Web), as long
// as this tab is still open somewhere in the browser. It needs the
// person to have granted the browser's notification permission once
// (requested below on first load); if they never grant it, or the
// browser doesn't support the API, this just silently no-ops and the
// in-app toast + bell badge are still there as the fallback.
function showBrowserNotification(n, onOpen) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    const popup = new Notification(n.title || "New notification", {
      body: n.message || "",
      icon: "/akrobat-logo.png",
      tag: `akrobat-notification-${n.id}`,
    });
    popup.onclick = () => {
      window.focus();
      onOpen?.();
      popup.close();
    };
  } catch {
    // Some mobile browsers only support ServiceWorkerRegistration
    // .showNotification, not the plain Notification constructor — non-fatal.
  }
}

function NotificationBell({ overHero = false }) {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [notifications, setNotifications] = useState([]);

  // Tracks notification ids we've already shown (in the list or as a
  // toast), so the live-updates socket (or a reconnect replaying a row
  // that arrived just before it dropped) never toasts the same
  // notification twice.
  const seenIdsRef = useRef(new Set());

  // One-time fetch to populate the list + badge on mount/login. After
  // this, new arrivals come from the /ws/notifications push below, not
  // from calling this again — see useNotificationLiveUpdates.
  function load() {
    apiClient
      .get("/notifications/my")
      .then((res) => {
        const rows = res?.data || [];
        setNotifications(rows);
        for (const n of rows) seenIdsRef.current.add(n.id);
      })
      .catch(() => setNotifications([]));
  }

  useEffect(() => {
    load();
  }, []);

  function openNotifications() {
    navigate(`${ROLE_BASE_PATH[role] || ""}/notifications`);
  }

  // Shared by every delivery path below (WebSocket live-update, and the
  // API-activity fallback) so a notification only ever gets one toast /
  // one sound / one OS popup no matter which channel happens to surface
  // it first — seenIdsRef is the single source of truth for "have we
  // already shown this one".
  function handleIncoming(n) {
    if (seenIdsRef.current.has(n.id)) return;
    seenIdsRef.current.add(n.id);

    setNotifications((prev) => [n, ...prev]);
    playNotificationSound();

    const { icon: Icon, className } = typeStyle(n.notification_type);
    showToast({
      title: n.title,
      message: n.message,
      icon: Icon,
      iconClassName: className,
      onClick: openNotifications,
    });
    // Only fire the OS-level popup when this tab isn't the one the
    // person is actually looking at — if they're already on the site,
    // the toast above is enough and a native popup on top would just be
    // noisy. document.hidden alone isn't enough here: switching to
    // another app (Slack, Outlook, etc.) while the browser window stays
    // open leaves the tab "visible" as far as the Page Visibility API is
    // concerned on most desktop browsers, so document.hidden stays false
    // and the popup silently never fired — the exact "desktop
    // notification not working" symptom. document.hasFocus() catches
    // that case too: it's false whenever the browser window itself
    // isn't the focused window, tab hidden or not.
    if (document.hidden || !document.hasFocus()) {
      showBrowserNotification(n, openNotifications);
    }
  }

  // Real-time push (see app/notifications/services.py::notify_employee()
  // -> app/core/realtime.py::broadcast_to_employee_threadsafe()) — a new
  // notification shows up as a toast the instant it's written, with no
  // delay to wait out.
  useNotificationLiveUpdates(handleIncoming);

  // Safety net under the WebSocket above: some networks/proxies block or
  // silently drop WS upgrades, and real Web Push (pushService.js) needs
  // HTTPS + VAPID keys configured server-side, neither of which this tab
  // can detect or fix on its own. This piggybacks on ordinary API
  // traffic instead — see notificationFallback.js — so a notification
  // still arrives (with up to ~15s of lag) even if both of those
  // channels are broken in a given environment.
  useEffect(() => {
    const unsubscribe = initNotificationFallback(handleIncoming);
    return unsubscribe;
  }, []);

  // "Have I forgotten to check in?" — GET /attendance/reminder-check
  // (see app/attendance/services.py::get_attendance_reminder_status()).
  // This backend has no scheduler (no cron/celery/APScheduler), so
  // nothing can fire this on its own at shift-start time the way a real
  // reminder system would; instead this component -- already mounted
  // in every dashboard layout, already polling every 20s -- pings the
  // check itself while the person is logged in. The endpoint is a safe
  // no-op unless the employee has actually opted into "Attendance
  // reminders" in Settings AND is confirmed late-and-unchecked-in for
  // the day, and it only ever writes one notification per employee per
  // day. When it does write one, the load() poll above picks that row
  // up on its next tick and surfaces it as a toast — no separate
  // delivery path needed here. Every 3 minutes is frequent enough to
  // catch "just walked in late" promptly without hammering the
  // endpoint.
  useEffect(() => {
    function checkAttendanceReminder() {
      apiClient.get("/attendance/reminder-check").catch(() => {
        // Best-effort — a failed check here should never surface to
        // the user; the next poll will just try again.
      });
    }
    checkAttendanceReminder();
    const reminderInterval = setInterval(
      checkAttendanceReminder,
      3 * 60 * 1000,
    );
    return () => clearInterval(reminderInterval);
  }, []);

  // "Have I forgotten to check out?" — GET /attendance/checkout-reminder-check
  // (see app/attendance/services.py::get_checkout_reminder_status()). Same
  // no-scheduler constraint and polling approach as the check-in reminder
  // above, just for the other end of the day — a safe no-op unless the
  // employee has opted into "Checkout reminders" in Settings AND checked
  // in but never checked out after their shift ended.
  useEffect(() => {
    function checkCheckoutReminder() {
      apiClient.get("/attendance/checkout-reminder-check").catch(() => {
        // Best-effort — same as the check-in reminder poll.
      });
    }
    checkCheckoutReminder();
    const checkoutReminderInterval = setInterval(
      checkCheckoutReminder,
      3 * 60 * 1000,
    );
    return () => clearInterval(checkoutReminderInterval);
  }, []);

  // "Is a holiday coming up?" — GET /holidays/reminder-check (see
  // app/holidays/services.py::get_holiday_reminder_status()). Same
  // no-scheduler constraint again: this fires an advance "tomorrow is a
  // holiday" notice the day before (plus a same-day fallback), gated by
  // the employee's own "Holiday reminders" toggle in Settings. A lighter
  // poll interval is fine here — nothing about "is tomorrow a holiday"
  // changes within a session, this just needs to run at least once.
  useEffect(() => {
    function checkHolidayReminder() {
      apiClient.get("/holidays/reminder-check").catch(() => {
        // Best-effort — same as the other reminder polls.
      });
    }
    checkHolidayReminder();
    const holidayReminderInterval = setInterval(
      checkHolidayReminder,
      15 * 60 * 1000,
    );
    return () => clearInterval(holidayReminderInterval);
  }, []);

  // Ask once for permission to show native browser/OS notifications —
  // this is what lets a new notification reach the person even when
  // they've switched away to another tab or app (as long as this tab is
  // still open somewhere), similar to how WhatsApp Web pings you. If they
  // dismiss/deny the prompt, everything still works via the in-app toast
  // and bell badge — this is a bonus channel, not a requirement.
  useEffect(() => {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openNotifications}
        className={`relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
          overHero
            ? "text-slate-500 hover:bg-slate-100 max-lg:text-white max-lg:hover:bg-white/10"
            : "text-slate-500 hover:bg-slate-100"
        }`}
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}

// overHero = the page draws a full-bleed gradient behind this bar on mobile
// (see DashboardLayout / Employee Dashboard). Below lg the bar goes
// transparent with white icons and scrolls away with the hero; lg and up
// is untouched.
export default function Header({ onMenuClick, overHero = false }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  // The employee's actual stored photo, same field every other screen
  // (dashboard cards, team lists, etc) reads from — kept in sync via
  // AuthContext.updateUser() whenever the photo is changed on the
  // My Profile page, so this updates immediately without a re-login.
  const profilePhoto = user?.profile?.profile_photo || null;

  return (
    <header
      className={`header h-16 flex items-center justify-between px-4 sm:px-6 bg-white border-b border-slate-200 sticky top-0 z-20 ${
        overHero
          ? "max-lg:bg-transparent max-lg:border-transparent max-lg:relative max-lg:z-10"
          : ""
      }`}
    >
      {/* Mobile menu toggle + Search */}
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <button
          type="button"
          onClick={onMenuClick}
          className={`lg:hidden shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
            overHero
              ? "text-white hover:bg-white/10"
              : "text-slate-600 hover:bg-slate-100"
          }`}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <div className="relative">
          {/* <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          /> */}
          {/* 
          <input
            placeholder="Search anything..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-orange-500/30"
          /> */}
        </div>
      </div>

      {/* Notifications + Profile */}
      <div className="flex items-center gap-2 ml-auto">
        <NotificationBell overHero={overHero} />

        {/* Avatar + name — tap to open My Profile (/<role>/profile/personal,
            registered for every role in routes/commonRoutes.jsx) */}
        <button
          type="button"
          onClick={() =>
            navigate(`${ROLE_BASE_PATH[role] || ""}/profile/personal`)
          }
          title="My Profile"
          aria-label="Open My Profile"
          className="flex items-center gap-2 rounded-lg p-0.5 pr-1 hover:bg-slate-50 transition-colors"
        >
          <div
            className={`w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-sm overflow-hidden ${
              overHero ? "max-lg:bg-white/20 max-lg:text-white" : ""
            }`}
          >
            {profilePhoto ? (
              <img
                src={profilePhoto}
                alt={user?.name}
                className="w-full h-full object-cover"
              />
            ) : (
              (user?.name?.[0] ?? "U")
            )}
          </div>

          <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-slate-800">{user?.name}</p>
            <p className="text-xs text-slate-400">{ROLE_LABELS[role]}</p>
          </div>
        </button>

        {/* Logout — icon only */}
        <button
          type="button"
          onClick={logout}
          title="Logout"
          aria-label="Logout"
          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
            overHero
              ? "text-slate-500 hover:text-orange-500 hover:bg-orange-50 max-lg:text-white max-lg:hover:bg-white/10 max-lg:hover:text-white"
              : "text-slate-500 hover:text-orange-500 hover:bg-orange-50"
          }`}
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
