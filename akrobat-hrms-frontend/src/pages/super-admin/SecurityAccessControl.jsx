import { AlertCircle, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import ToggleSwitch from "../../components/common/ToggleSwitch";

import { accessControlService } from "../../services/Accesscontrolservice ";

// ---------------------------------------------------------------------
// Scope note: this page is login security / password / lockout rules
// for admin accounts — NOT the role<->permission matrix (that's fully
// wired at Users > Permissions, see UsersPermissions.jsx) and NOT a
// history/log view (sign-in history lives at Security > Login Activity,
// failed-attempt + every other admin action at Security > Audit Logs).
//
// Backend: app/access_control/routes.py (SUPER ADMIN only).
//   GET  /access-control/                 -> current settings row
//   PUT  /access-control/                 -> partial update, any subset of fields
//   POST /access-control/force-logout-all -> revokes every SUPER ADMIN /
//     HR ADMIN session via the Supabase GoTrue admin API
//
// These aren't just stored — they're enforced at login. See
// app/auth/services.py::login_user: the IP allowlist and lockout
// counters are checked before a sign-in attempt is made, and
// require_2fa comes back as `mfa_required` on the login response (no
// OTP challenge screen exists yet, so it's informational only for now).
// ---------------------------------------------------------------------

const SESSION_TIMEOUT_OPTIONS = [30, 60, 240, 480];

function fmtMinutes(mins) {
  if (mins < 60) return `${mins} minutes`;
  const hrs = mins / 60;
  return `${hrs} hour${hrs === 1 ? "" : "s"}`;
}

export default function SecurityAccessControl() {
  const [settings, setSettings] = useState(null); // null = loading
  const [ipRangesInput, setIpRangesInput] = useState("");
  const [error, setError] = useState("");
  const [savingField, setSavingField] = useState(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [logoutResult, setLogoutResult] = useState(null);

  useEffect(() => {
    accessControlService
      .getSettings()
      .then((res) => {
        const data = res?.data || {};
        setSettings(data);
        setIpRangesInput((data.allowed_ip_ranges || []).join(", "));
      })
      .catch((err) => {
        setError(err.message || "Unable to load access control settings.");
        setSettings({});
      });
  }, []);

  async function saveField(field, value) {
    const previous = settings[field];
    setSettings((s) => ({ ...s, [field]: value })); // optimistic
    setSavingField(field);
    setError("");

    try {
      const res = await accessControlService.updateSettings({ [field]: value });
      setSettings((s) => ({ ...s, ...res?.data }));
    } catch (err) {
      setSettings((s) => ({ ...s, [field]: previous })); // revert
      setError(err.message || `Couldn't save that change. Try again.`);
    } finally {
      setSavingField(null);
    }
  }

  function saveIpRanges() {
    const ranges = ipRangesInput
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    saveField("allowed_ip_ranges", ranges);
  }

  async function handleForceLogoutAll() {
    setLoggingOutAll(true);
    setLogoutResult(null);
    setError("");
    try {
      const res = await accessControlService.forceLogoutAll();
      setLogoutResult(res?.data);
    } catch (err) {
      setError(err.message || "Couldn't sign everyone out. Try again.");
    } finally {
      setLoggingOutAll(false);
    }
  }

  if (settings === null) {
    return (
      <div>
        <PageHeader
          title="Access Control"
          subtitle="Login security, password policy, and access restrictions for admin accounts."
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 bg-slate-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Access Control"
        subtitle="Login security, password policy, and access restrictions for admin accounts."
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-4 py-2.5">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {logoutResult && (
        <div className="mb-4 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5">
          Signed out {logoutResult.signed_out} of {logoutResult.targeted} admin
          session(s).
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-800 mb-1">
            Login security
          </p>

          <div className="divide-y divide-slate-100">
            <ToggleSwitch
              checked={!!settings.require_2fa}
              onChange={(val) => saveField("require_2fa", val)}
              disabled={savingField === "require_2fa"}
              label="Require 2FA for admins"
              description="Super Admin and HR Admin roles. Flag only for now — the OTP challenge screen isn't built yet."
            />

            <div className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Session timeout
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Auto sign-out after inactivity
                </p>
              </div>
              <select
                value={settings.session_timeout_minutes ?? 60}
                disabled={savingField === "session_timeout_minutes"}
                onChange={(e) =>
                  saveField("session_timeout_minutes", Number(e.target.value))
                }
                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-orange-500/30 disabled:opacity-50"
              >
                {SESSION_TIMEOUT_OPTIONS.map((mins) => (
                  <option key={mins} value={mins}>
                    {fmtMinutes(mins)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Active sessions
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sign out every device, every admin
                </p>
              </div>
              <button
                onClick={handleForceLogoutAll}
                disabled={loggingOutAll}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-600 border border-orange-200 rounded-lg px-3 py-1.5 hover:bg-orange-50 disabled:opacity-50"
              >
                <LogOut size={12} />
                {loggingOutAll ? "Signing out..." : "Force logout all"}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-800 mb-1">
            Password policy
          </p>

          <div className="divide-y divide-slate-100">
            <div className="flex items-center justify-between gap-4 py-3">
              <p className="text-sm font-medium text-slate-800">
                Minimum length
              </p>
              <input
                type="number"
                min={6}
                max={32}
                defaultValue={settings.password_min_length ?? 8}
                key={`min-length-${settings.password_min_length}`}
                onBlur={(e) => {
                  const val = Number(e.target.value);
                  if (val !== settings.password_min_length) {
                    saveField("password_min_length", val);
                  }
                }}
                className="w-16 text-sm text-center border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>

            <ToggleSwitch
              checked={!!settings.password_require_complexity}
              onChange={(val) => saveField("password_require_complexity", val)}
              disabled={savingField === "password_require_complexity"}
              label="Require uppercase and number"
              description="Enforced when a password is set or changed"
            />

            <div className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Password expiry
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Days before a reset is required
                </p>
              </div>
              <input
                type="number"
                min={0}
                max={365}
                defaultValue={settings.password_expiry_days ?? 90}
                key={`expiry-${settings.password_expiry_days}`}
                onBlur={(e) => {
                  const val = Number(e.target.value);
                  if (val !== settings.password_expiry_days) {
                    saveField("password_expiry_days", val);
                  }
                }}
                className="w-16 text-sm text-center border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-800 mb-1">
          Account lockout &amp; IP restriction
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">
                Lock account after
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Consecutive failed login attempts
              </p>
            </div>
            <input
              type="number"
              min={3}
              max={10}
              defaultValue={settings.lockout_attempts ?? 5}
              key={`lockout-${settings.lockout_attempts}`}
              onBlur={(e) => {
                const val = Number(e.target.value);
                if (val !== settings.lockout_attempts) {
                  saveField("lockout_attempts", val);
                }
              }}
              className="w-16 text-sm text-center border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>

          <ToggleSwitch
            checked={!!settings.restrict_to_office}
            onChange={(val) => saveField("restrict_to_office", val)}
            disabled={savingField === "restrict_to_office"}
            label="Restrict admin login to office network"
            description="Allowlist trusted IP ranges"
          />
        </div>

        {settings.restrict_to_office && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-1.5">
              Allowed IP / CIDR ranges, comma-separated
            </p>
            <div className="flex gap-2">
              <input
                value={ipRangesInput}
                onChange={(e) => setIpRangesInput(e.target.value)}
                placeholder="203.0.113.0/24, 198.51.100.14"
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500/30"
              />
              <button
                onClick={saveIpRanges}
                disabled={savingField === "allowed_ip_ranges"}
                className="text-xs font-medium text-orange-600 border border-orange-200 rounded-lg px-3 py-2 hover:bg-orange-50 disabled:opacity-50"
              >
                Save
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Left empty, the office restriction won't block anyone — add at
              least one range before relying on it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
