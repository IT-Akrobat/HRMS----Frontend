import {
    Bell,
    Building2,
    CheckCircle2,
    Eye,
    EyeOff,
    Globe,
    Lock,
    Mail,
    Phone,
    ShieldCheck,
    User,
    XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/common/PageHeader";
import ToggleSwitch from "../../components/common/ToggleSwitch";
import { ROLE_BASE_PATH } from "../../config/roles";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../services/apiClient";

// Account Settings — one shared page for every role instead of four
// near-copies (previously: only Employee had a real implementation;
// Manager and HR Admin each rendered an empty PlaceholderPage, and Super
// Admin had no "Settings" entry at all). None of this page is actually
// role-specific — every logged-in user has the same account, security,
// notification-preference, and display-preference concerns — so it's now
// mounted once via commonRoutes.jsx and reused under every role's area.
// Org-wide configuration stays separate (SystemSettingsConfigurations,
// HR/Super-Admin only, backed by GET/PUT /settings) — this page is
// intentionally scoped to "me" only.
//
// Tabs:
//   Account       — read-only summary from GET /auth/me, links out to
//                   the shared My Profile page (owns the editable form;
//                   no point duplicating it here).
//   Security      — change password, backed by POST /auth/change-password
//                   (see app/auth/routes.py / app/auth/services.py).
//   Notifications — per-user alert toggles. No preferences endpoint
//                   exists yet either, so these persist to localStorage
//                   for now (keyed per user) rather than silently doing
//                   nothing; swap the marked spots for real API calls
//                   once a /notifications/preferences endpoint exists.
//   Preferences   — language/date-format/theme. Same story: local-only
//                   until there's somewhere to save it server-side.

const TABS = [
  { key: "account", label: "Account", icon: User },
  { key: "security", label: "Security", icon: Lock },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "preferences", label: "Preferences", icon: Globe },
];

const NOTIF_DEFAULTS = {
  email_notifications: true,
  leave_updates: true,
  announcements: true,
  celebrations: true,
  attendance_reminders: false,
};

const PREF_DEFAULTS = {
  date_format: "DD/MM/YYYY",
  theme: "light",
};

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function Banner({ type, message }) {
  if (!message) return null;
  const isSuccess = type === "success";
  return (
    <div
      className={`mb-5 flex items-start gap-2 text-sm rounded-lg p-3 border ${
        isSuccess
          ? "bg-blue-50 border-blue-100 text-blue-700"
          : "bg-orange-50 border-orange-100 text-orange-600"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
      ) : (
        <XCircle size={16} className="mt-0.5 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}

function SectionCard({ title, description, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      {title && (
        <div className="mb-5">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function PasswordField({ label, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          className="w-full rounded-lg border border-slate-200 pl-3 pr-10 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          tabIndex={-1}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState("account");

  const storageKey = `akrobat_settings_${user?.id || "guest"}`;

  // My Profile is mounted under every role via commonRoutes.jsx at
  // "profile/personal", so this just needs to point at the current role's
  // own base path (e.g. /manager/profile/personal) rather than being
  // hardcoded to /employee.
  const profileLink = `${ROLE_BASE_PATH[role] || "/employee"}/profile/personal`;

  // ---------------- Security: change password ----------------
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState({ type: "", text: "" });

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPwdMsg({ type: "", text: "" });

    if (!pwd.current || !pwd.next || !pwd.confirm) {
      setPwdMsg({ type: "error", text: "Please fill in all three fields." });
      return;
    }
    if (pwd.next.length < 8) {
      setPwdMsg({
        type: "error",
        text: "New password must be at least 8 characters.",
      });
      return;
    }
    if (pwd.next !== pwd.confirm) {
      setPwdMsg({ type: "error", text: "New passwords do not match." });
      return;
    }

    setPwdSaving(true);
    try {
      // Backed by POST /auth/change-password (app/auth/routes.py) —
      // verifies current_password against Supabase before rotating it.
      await apiClient.post("/auth/change-password", {
        current_password: pwd.current,
        new_password: pwd.next,
      });
      setPwdMsg({ type: "success", text: "Password updated successfully." });
      setPwd({ current: "", next: "", confirm: "" });
    } catch (err) {
      setPwdMsg({
        type: "error",
        text: err.message || "Could not update password.",
      });
    } finally {
      setPwdSaving(false);
    }
  }

  // ---------------- Notifications ----------------
  const [notifs, setNotifs] = useState(NOTIF_DEFAULTS);
  const [notifMsg, setNotifMsg] = useState("");

  // ---------------- Preferences ----------------
  const [prefs, setPrefs] = useState(PREF_DEFAULTS);
  const [prefMsg, setPrefMsg] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (saved.notifications)
        setNotifs({ ...NOTIF_DEFAULTS, ...saved.notifications });
      if (saved.preferences)
        setPrefs({ ...PREF_DEFAULTS, ...saved.preferences });
    } catch {
      // ignore malformed local data
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(partial) {
    const current = JSON.parse(localStorage.getItem(storageKey) || "{}");
    localStorage.setItem(
      storageKey,
      JSON.stringify({ ...current, ...partial }),
    );
  }

  function saveNotifications() {
    // No /notifications/preferences endpoint yet — persisted locally so
    // the toggles aren't purely cosmetic. Swap in an apiClient.put(...)
    // call here once one exists.
    persist({ notifications: notifs });
    setNotifMsg("Notification preferences saved.");
    setTimeout(() => setNotifMsg(""), 2500);
  }

  function savePreferences() {
    persist({ preferences: prefs });
    setPrefMsg("Preferences saved.");
    setTimeout(() => setPrefMsg(""), 2500);
  }

  const profile = user?.profile || {};
  const designation = profile.designation?.designation_name;
  const department = user?.department?.department_name;

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage your account, security and notification preferences."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* ---------------- Tab nav ---------------- */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-2 flex lg:flex-col gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2.5 shrink-0 text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-orange-50 text-brand-orange"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ---------------- Tab content ---------------- */}
        <div className="lg:col-span-3 space-y-6">
          {activeTab === "account" && (
            <SectionCard>
              <div className="flex items-center gap-4 pb-5 mb-5 border-b border-slate-100">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-lg font-semibold text-slate-600 overflow-hidden shrink-0">
                  {profile.profile_photo ? (
                    <img
                      src={profile.profile_photo}
                      alt={user?.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    initials(user?.name)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">
                    {user?.name || "—"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {designation ? `${designation} · ` : ""}
                    {department || ""}
                  </p>
                  {profile.employee_id && (
                    <span className="inline-block mt-1 text-[11px] font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                      {profile.employee_id}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                    <Mail size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Email</p>
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {user?.email || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                    <Phone size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Phone</p>
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {profile.phone || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                    <Building2 size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Department</p>
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {department || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                    <ShieldCheck size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Role</p>
                    <p className="text-sm font-medium text-slate-800 truncate capitalize">
                      {user?.backendRole || user?.role || "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100 flex justify-end">
                <Link
                  to={profileLink}
                  className="text-sm font-medium text-brand-orange hover:underline"
                >
                  Edit personal details in My Profile →
                </Link>
              </div>
            </SectionCard>
          )}

          {activeTab === "security" && (
            <SectionCard
              title="Change password"
              description="Choose a strong password you're not using elsewhere."
            >
              <Banner type={pwdMsg.type} message={pwdMsg.text} />
              <form
                onSubmit={handlePasswordSubmit}
                className="space-y-4 max-w-md"
              >
                <PasswordField
                  label="Current password"
                  autoComplete="current-password"
                  value={pwd.current}
                  onChange={(e) =>
                    setPwd((p) => ({ ...p, current: e.target.value }))
                  }
                />
                <PasswordField
                  label="New password"
                  autoComplete="new-password"
                  value={pwd.next}
                  onChange={(e) =>
                    setPwd((p) => ({ ...p, next: e.target.value }))
                  }
                />
                <PasswordField
                  label="Confirm new password"
                  autoComplete="new-password"
                  value={pwd.confirm}
                  onChange={(e) =>
                    setPwd((p) => ({ ...p, confirm: e.target.value }))
                  }
                />
                <p className="text-xs text-slate-400">
                  Use at least 8 characters, with a mix of letters and numbers.
                </p>
                <button
                  type="submit"
                  disabled={pwdSaving}
                  className="bg-brand-orange text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-60 transition"
                >
                  {pwdSaving ? "Updating…" : "Update password"}
                </button>
              </form>
            </SectionCard>
          )}

          {activeTab === "notifications" && (
            <SectionCard
              title="Notification preferences"
              description="Choose what you'd like to be notified about."
            >
              {notifMsg && <Banner type="success" message={notifMsg} />}
              <div className="divide-y divide-slate-100">
                <ToggleSwitch
                  label="Email notifications"
                  description="Receive a copy of important updates by email."
                  checked={notifs.email_notifications}
                  onChange={(v) =>
                    setNotifs((n) => ({ ...n, email_notifications: v }))
                  }
                />
                <ToggleSwitch
                  label="Leave request updates"
                  description="When your leave is approved, rejected, or commented on."
                  checked={notifs.leave_updates}
                  onChange={(v) =>
                    setNotifs((n) => ({ ...n, leave_updates: v }))
                  }
                />
                <ToggleSwitch
                  label="Announcements"
                  description="Company-wide announcements."
                  checked={notifs.announcements}
                  onChange={(v) =>
                    setNotifs((n) => ({ ...n, announcements: v }))
                  }
                />
                <ToggleSwitch
                  label="Birthdays & work anniversaries"
                  description="Reminders about teammates' celebrations."
                  checked={notifs.celebrations}
                  onChange={(v) =>
                    setNotifs((n) => ({ ...n, celebrations: v }))
                  }
                />
                <ToggleSwitch
                  label="Attendance reminders"
                  description="A nudge if you haven't checked in by your shift start."
                  checked={notifs.attendance_reminders}
                  onChange={(v) =>
                    setNotifs((n) => ({ ...n, attendance_reminders: v }))
                  }
                />
              </div>
              <div className="mt-5 pt-5 border-t border-slate-100 flex justify-end">
                <button
                  onClick={saveNotifications}
                  className="bg-brand-orange text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:opacity-90 transition"
                >
                  Save preferences
                </button>
              </div>
            </SectionCard>
          )}

          {activeTab === "preferences" && (
            <SectionCard
              title="Preferences"
              description="Display and regional settings for your account."
            >
              {prefMsg && <Banner type="success" message={prefMsg} />}
              <div className="space-y-5 max-w-md">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Language
                  </label>
                  <select
                    disabled
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-500 bg-slate-50 cursor-not-allowed"
                    value="en"
                    onChange={() => {}}
                  >
                    <option value="en">English</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    More languages coming soon.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Date format
                  </label>
                  <div className="flex gap-2">
                    {["DD/MM/YYYY", "MM/DD/YYYY"].map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() =>
                          setPrefs((p) => ({ ...p, date_format: fmt }))
                        }
                        className={`text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${
                          prefs.date_format === fmt
                            ? "border-brand-orange bg-orange-50 text-brand-orange"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Theme
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-sm font-medium px-3 py-2 rounded-lg border border-brand-orange bg-orange-50 text-brand-orange"
                    >
                      Light
                    </button>
                    <button
                      type="button"
                      disabled
                      className="text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-400 cursor-not-allowed"
                    >
                      Dark (coming soon)
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-5 border-t border-slate-100 flex justify-end">
                <button
                  onClick={savePreferences}
                  className="bg-brand-orange text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:opacity-90 transition"
                >
                  Save preferences
                </button>
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
