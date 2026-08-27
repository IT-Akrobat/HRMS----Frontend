import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Globe,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Upload,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/common/PageHeader";
import ToggleSwitch from "../../components/common/ToggleSwitch";
import { ROLE_BASE_PATH, ROLES } from "../../config/roles";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../services/apiClient";
import { holidaysService } from "../../services/holidaysService";

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
//   Notifications — per-user alert toggles, backed by GET/PUT
//                   /notification-preferences/me (see
//                   app/notification_preferences/routes.py). The
//                   "Attendance reminders" toggle here is what
//                   app/attendance/services.py::get_attendance_reminder_status()
//                   checks before ever sending a reminder — see the
//                   periodic poll added in Header.jsx.
//   Preferences   — language/date-format/time-format/theme. Still
//                   local-only until there's somewhere to save it
//                   server-side.

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
  time_format: "24h",
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
  const { user, role, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState("account");

  // Holidays (Excel upload) is only relevant to roles that can manage
  // the company holiday calendar -- HR Admin / HR Executive and Super
  // Admin hold EDIT_EMPLOYEE, which POST /holidays/bulk-import/excel
  // requires (see sql/002_role_permissions_seed.sql). A Manager or
  // Employee wouldn't be able to use it even if they saw the tab, so it
  // isn't shown to them at all rather than showing then failing.
  const canManageHolidays =
    role === ROLES.HR_ADMIN || role === ROLES.SUPER_ADMIN;
  const tabs = canManageHolidays
    ? [...TABS, { key: "holidays", label: "Holidays", icon: CalendarDays }]
    : TABS;

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
      setTimeout(() => setPwdMsg({ type: "", text: "" }), 30000);
      setPwd({ current: "", next: "", confirm: "" });
      // Clears the Access Control expiry banner in DashboardLayout right
      // away instead of leaving it up until the next login.
      updateUser({ passwordExpired: false });
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
  // Backed by GET/PUT /notification-preferences/me (see
  // app/notification_preferences/routes.py) — previously these five
  // toggles only ever persisted to localStorage and nothing on the
  // backend could read them (in particular, the "Attendance reminders"
  // toggle had no effect on anything). Now the value in the DB is what
  // app/attendance/services.py::get_attendance_reminder_status() checks
  // before it will ever send a reminder.
  const [notifs, setNotifs] = useState(NOTIF_DEFAULTS);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState({ type: "", text: "" });

  // ---------------- Preferences ----------------
  // Language/date-format/theme still have nowhere server-side to live —
  // unchanged, local-only for now.
  const [prefs, setPrefs] = useState(PREF_DEFAULTS);
  const [prefMsg, setPrefMsg] = useState("");

  // ---------------- Holidays (Excel upload) ----------------
  const [holidayUploadCountry, setHolidayUploadCountry] = useState("SG");
  const [holidayUploading, setHolidayUploading] = useState(false);
  const [holidayUploadResult, setHolidayUploadResult] = useState(null);
  const holidayFileInputRef = useRef(null);

  async function downloadHolidayTemplate() {
    const XLSX = await import("xlsx-js-style");
    // Header row matches the `holidays` table's own column names exactly
    // (id/raw_holiday_date/is_sunday_shifted/created_at are all
    // auto-computed by the backend on import, so they're left out here —
    // see app/holidays/services.py::import_holidays_from_excel).
    const header = ["holiday_name", "holiday_date", "description", "country"];
    const sample = [
      ["New Year's Day", "2027-01-01", "Public holiday", "SG"],
      ["Republic Day", "2027-01-26", "Public holiday", "IN"],
    ];
    const sheet = XLSX.utils.aoa_to_sheet([header, ...sample]);
    sheet["!cols"] = header.map((h) => ({ wch: Math.max(16, h.length + 4) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Holidays");
    XLSX.writeFile(workbook, "holidays-upload-template.xlsx");
  }

  function pickHolidayFile() {
    holidayFileInputRef.current?.click();
  }

  async function handleHolidayFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-choosing the same file next time
    if (!file) return;

    setHolidayUploading(true);
    setHolidayUploadResult(null);
    try {
      const result = await holidaysService.uploadExcel(file, {
        country: holidayUploadCountry,
      });
      setHolidayUploadResult(result);
    } catch (err) {
      setHolidayUploadResult({
        imported: [],
        errors: [err.message || "Upload failed."],
      });
    } finally {
      setHolidayUploading(false);
    }
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (saved.preferences)
        setPrefs({ ...PREF_DEFAULTS, ...saved.preferences });
    } catch {
      // ignore malformed local data
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    setNotifLoading(true);
    apiClient
      .get("/notification-preferences/me")
      .then((res) => {
        if (cancelled) return;
        const row = res?.data || {};
        setNotifs({
          email_notifications:
            row.email_notifications ?? NOTIF_DEFAULTS.email_notifications,
          leave_updates: row.leave_updates ?? NOTIF_DEFAULTS.leave_updates,
          announcements: row.announcements ?? NOTIF_DEFAULTS.announcements,
          celebrations: row.celebrations ?? NOTIF_DEFAULTS.celebrations,
          attendance_reminders:
            row.attendance_reminders ?? NOTIF_DEFAULTS.attendance_reminders,
        });
      })
      .catch(() => {
        // Endpoint unreachable — fall back to defaults rather than
        // leaving the tab stuck on a spinner; Save will retry the PUT.
        if (!cancelled) setNotifs(NOTIF_DEFAULTS);
      })
      .finally(() => {
        if (!cancelled) setNotifLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function persist(partial) {
    const current = JSON.parse(localStorage.getItem(storageKey) || "{}");
    localStorage.setItem(
      storageKey,
      JSON.stringify({ ...current, ...partial }),
    );
  }

  async function saveNotifications() {
    setNotifSaving(true);
    setNotifMsg({ type: "", text: "" });
    try {
      const res = await apiClient.put("/notification-preferences/me", notifs);
      const row = res?.data;
      if (row) {
        setNotifs({
          email_notifications: row.email_notifications,
          leave_updates: row.leave_updates,
          announcements: row.announcements,
          celebrations: row.celebrations,
          attendance_reminders: row.attendance_reminders,
        });
      }
      setNotifMsg({
        type: "success",
        text: "Notification preferences saved.",
      });
      setTimeout(() => setNotifMsg({ type: "", text: "" }), 2500);
    } catch (err) {
      setNotifMsg({
        type: "error",
        text: err.message || "Could not save notification preferences.",
      });
    } finally {
      setNotifSaving(false);
    }
  }

  function savePreferences() {
    persist({ preferences: prefs });
    setPrefMsg("Preferences saved.");
    setTimeout(() => setPrefMsg(""), 2500);
  }

  const profile = user?.profile || {};
  const designation = profile.designation?.designation_name;
  const department = user?.department?.department_name;

  // If no real email was ever set for this employee, the backend fills
  // in a placeholder login email built from the employee code itself
  // (e.g. "akr-ins-cw-0002@akrobat.com.sg" — see create_employee() in
  // app/employees/services.py). It's only there so Supabase Auth has
  // something to log in with; it should never be shown here as if it
  // were a real email, since that reads as "the employee code got
  // appended into my email". Show "Not set" instead when that's the
  // case — same rule MyProfile.jsx already applies, just missing here.
  const rawEmail = user?.email || "";
  const employeeIdForEmailCheck = profile.employee_id || "";
  const isPlaceholderEmail =
    !!rawEmail &&
    !!employeeIdForEmailCheck &&
    rawEmail.split("@")[0]?.toLowerCase() ===
      employeeIdForEmailCheck.toLowerCase();
  const displayEmail = isPlaceholderEmail ? "" : rawEmail;

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
            {tabs.map((tab) => {
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
                      {displayEmail || "Not set"}
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
              {notifMsg.text && (
                <Banner type={notifMsg.type} message={notifMsg.text} />
              )}
              {notifLoading ? (
                <div className="space-y-4 animate-pulse">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 bg-slate-100 rounded-lg" />
                  ))}
                </div>
              ) : (
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
              )}
              <div className="mt-5 pt-5 border-t border-slate-100 flex justify-end">
                <button
                  onClick={saveNotifications}
                  disabled={notifLoading || notifSaving}
                  className="bg-brand-orange text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-60 transition"
                >
                  {notifSaving ? "Saving…" : "Save preferences"}
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
                    Time format
                  </label>
                  <div className="flex gap-2">
                    {[
                      { value: "12h", label: "12-hour (AM/PM)" },
                      { value: "24h", label: "24-hour" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setPrefs((p) => ({ ...p, time_format: opt.value }))
                        }
                        className={`text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${
                          prefs.time_format === opt.value
                            ? "border-brand-orange bg-orange-50 text-brand-orange"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {opt.label}
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

          {activeTab === "holidays" && canManageHolidays && (
            <SectionCard
              title="Holidays"
              description="Upload your company holiday calendar from an Excel file."
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#172033]/10 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-[#172033]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500">
                    Needs holiday name and date. Description and country are
                    optional.
                  </p>

                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      {/* Compact segmented control, matching the country
                          tabs in HolidaysCalendarCard.jsx — sized to its
                          content instead of a full-width native <select>,
                          so it sits comfortably next to the button on
                          mobile instead of forcing a stacked layout. */}
                      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 shrink-0">
                        {[
                          { code: "SG", label: "SG" },
                          { code: "IN", label: "IN" },
                        ].map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => setHolidayUploadCountry(c.code)}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                              holidayUploadCountry === c.code
                                ? "bg-white text-[#172033] shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={pickHolidayFile}
                        disabled={holidayUploading}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#172033] text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
                      >
                        {holidayUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        ) : (
                          <Upload className="w-4 h-4 shrink-0" />
                        )}
                        {holidayUploading ? "Uploading..." : "Upload Excel"}
                      </button>
                    </div>
                    <button
                      onClick={downloadHolidayTemplate}
                      className="block text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
                    >
                      Download template
                    </button>
                    <input
                      ref={holidayFileInputRef}
                      type="file"
                      accept=".xlsx,.xlsm"
                      className="hidden"
                      onChange={handleHolidayFileChosen}
                    />
                  </div>

                  {holidayUploadResult && (
                    <div className="mt-3 space-y-2">
                      {holidayUploadResult.imported?.length > 0 && (
                        <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>
                            {holidayUploadResult.imported.length} holiday
                            {holidayUploadResult.imported.length === 1
                              ? ""
                              : "s"}{" "}
                            imported successfully.
                          </span>
                        </div>
                      )}
                      {holidayUploadResult.errors?.length > 0 && (
                        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">
                              {holidayUploadResult.errors.length} row
                              {holidayUploadResult.errors.length === 1
                                ? ""
                                : "s"}{" "}
                              skipped:
                            </p>
                            <ul className="list-disc list-inside mt-1 space-y-0.5">
                              {holidayUploadResult.errors.map((msg, i) => (
                                <li key={i}>{msg}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
