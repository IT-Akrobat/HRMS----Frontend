import { CheckCircle2, Globe, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import { apiClient } from "../../services/apiClient";

// Org-wide configuration — company profile, office hours, and the
// timezone shift start_time / grace_period are authored in.
// Backed by GET/PUT /settings (see app/settings/routes.py /
// app/settings/services.py); the "settings" table backing this has a
// single row for the whole company (see sql/001_schema.sql).
//
// TIMEZONE is the field that matters most here: app/attendance/services.py
// (_get_company_timezone / _late_minutes) localizes every shift's
// start_time wall-clock to whatever is saved here before comparing it
// against a check-in. Previously that conversion was hardcoded to IST
// (Asia/Kolkata) no matter what — a Singapore-based company would have
// every on-time check-in miscalculated as hours late. Changing this
// dropdown and saving is what actually fixes that for real, since the
// backend now reads this value on every check-in instead of assuming
// India.
const TIMEZONE_OPTIONS = [
  { value: "Asia/Singapore", label: "Singapore Time" },
  { value: "Asia/Kolkata", label: "India Time" },
];

const CURRENCY_OPTIONS = ["SGD", "INR", "USD"];

const EMPTY_FORM = {
  company_name: "",
  company_email: "",
  company_phone: "",
  company_address: "",
  office_start_time: "09:00",
  office_end_time: "18:00",
  currency: "SGD",
  timezone: "Asia/Singapore",
};

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

// HH:MM:SS (as stored/returned) <-> HH:MM (what <input type="time"> needs).
function toInputTime(value) {
  if (!value) return "";
  return value.slice(0, 5);
}

export default function SystemSettingsConfigurations() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [hasExistingRow, setHasExistingRow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .get("/settings/")
      .then((row) => {
        if (cancelled || !row || !row.id) return;
        setHasExistingRow(true);
        setForm({
          company_name: row.company_name || "",
          company_email: row.company_email || "",
          company_phone: row.company_phone || "",
          company_address: row.company_address || "",
          office_start_time: toInputTime(row.office_start_time) || "09:00",
          office_end_time: toInputTime(row.office_end_time) || "18:00",
          currency: row.currency || "SGD",
          timezone: row.timezone || "Asia/Singapore",
        });
      })
      .catch(() => {
        // No settings row yet, or endpoint unreachable — stick with
        // EMPTY_FORM defaults; Save below will create the row.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setMsg({ type: "", text: "" });
    try {
      const payload = {
        company_name: form.company_name,
        company_email: form.company_email,
        company_phone: form.company_phone,
        company_address: form.company_address,
        office_start_time: form.office_start_time,
        office_end_time: form.office_end_time,
        currency: form.currency,
        timezone: form.timezone,
      };

      const row = hasExistingRow
        ? await apiClient.put("/settings/", payload)
        : await apiClient.post("/settings/", payload);

      if (row) {
        setHasExistingRow(true);
        setForm((f) => ({
          ...f,
          office_start_time:
            toInputTime(row.office_start_time) || f.office_start_time,
          office_end_time:
            toInputTime(row.office_end_time) || f.office_end_time,
        }));
      }
      setMsg({ type: "success", text: "Configuration saved." });
      setTimeout(() => setMsg({ type: "", text: "" }), 2500);
    } catch (err) {
      setMsg({
        type: "error",
        text: err.message || "Could not save configuration.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Configurations"
        subtitle="Company profile, office hours, and the timezone attendance is calculated against."
      />

      <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-2xl">
        {loading ? (
          <p className="text-sm text-slate-500">Loading configuration…</p>
        ) : (
          <>
            <Banner type={msg.type} message={msg.text} />

            <div className="mb-6">
              <h3 className="font-semibold text-slate-800">Company profile</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Shown on payslips, letters, and other generated documents.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Company name
                </label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={(e) => update("company_name", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Company email
                </label>
                <input
                  type="email"
                  value={form.company_email}
                  onChange={(e) => update("company_email", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Company phone
                </label>
                <input
                  type="text"
                  value={form.company_phone}
                  onChange={(e) => update("company_phone", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Currency
                </label>
                <select
                  value={form.currency}
                  onChange={(e) => update("currency", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Company address
                </label>
                <input
                  type="text"
                  value={form.company_address}
                  onChange={(e) => update("company_address", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                />
              </div>
            </div>

            <div className="mb-6 pt-2 border-t border-slate-100">
              <h3 className="font-semibold text-slate-800 mt-6 flex items-center gap-2">
                <Globe size={16} className="text-slate-400" />
                Office hours & timezone
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Shift start times and late-arrival grace periods are interpreted
                in this timezone. Employees checking in from that office will be
                marked late or on-time correctly once this matches where they
                actually work.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Office start time
                </label>
                <input
                  type="time"
                  value={form.office_start_time}
                  onChange={(e) => update("office_start_time", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Office end time
                </label>
                <input
                  type="time"
                  value={form.office_end_time}
                  onChange={(e) => update("office_end_time", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Timezone
                </label>
                <div className="flex gap-2">
                  {TIMEZONE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update("timezone", opt.value)}
                      className={`text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${
                        form.timezone === opt.value
                          ? "border-brand-orange bg-orange-50 text-brand-orange"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  Currently: {form.timezone}
                </p>
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-slate-100 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-brand-orange text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save configuration"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
