import {
  ArrowLeft,
  Baby,
  CalendarDays,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  HeartPulse,
  Info,
  Loader2,
  RefreshCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Umbrella,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "../../components/common/PageHeader";
import DatePicker from "../../components/layout/DatePicker";
import { apiClient } from "../../services/apiClient";
import { toLocalISODate } from "../../utils/date";

// ---------------------------------------------------------------------------
// Leave types
// ---------------------------------------------------------------------------
// There's no GET /leave-types endpoint exposed yet — only the seeded rows in
// leave_types (sql/001_schema.sql). CreateLeaveRequest.leave_type is matched
// server-side via `.strip().upper()` against leave_name, so sending the
// nicely-cased label below resolves fine without a lookup call. If a
// /leave-types endpoint gets added later, swap this constant for a fetch.
const LEAVE_TYPES = [
  {
    value: "Casual Leave",
    label: "Casual Leave",
    days: 12,
    icon: Umbrella,
    color: "text-blue-500 bg-blue-50",
  },
  {
    value: "Sick Leave",
    label: "Sick Leave",
    days: 14,
    icon: ShieldAlert,
    color: "text-blue-500 bg-blue-50",
  },
  {
    value: "Annual Leave",
    label: "Annual Leave",
    days: 18,
    icon: CalendarDays,
    color: "text-blue-500 bg-blue-50",
  },
  {
    value: "Emergency Leave",
    label: "Emergency Leave",
    days: 5,
    icon: Clock3,
    color: "text-orange-500 bg-orange-50",
  },
  {
    value: "Unpaid Leave",
    label: "Unpaid Leave",
    days: 0,
    icon: Info,
    color: "text-slate-500 bg-slate-100",
  },
  {
    value: "Hospitalisation Leave",
    label: "Hospitalisation Leave",
    days: 46,
    icon: HeartPulse,
    color: "text-red-500 bg-red-50",
  },
  {
    value: "Replacement Leave",
    label: "Replacement Leave",
    days: 0,
    icon: RefreshCcw,
    color: "text-teal-500 bg-teal-50",
  },
  {
    value: "Children Leave",
    label: "Children Leave",
    days: 6,
    icon: Baby,
    color: "text-pink-500 bg-pink-50",
  },
  {
    value: "Compassionate Leave",
    label: "Compassionate Leave",
    days: 0,
    icon: HeartHandshake,
    color: "text-purple-500 bg-purple-50",
  },
  {
    value: "National Service Leave",
    label: "National Service Leave",
    days: 0,
    icon: ShieldCheck,
    color: "text-green-600 bg-green-50",
  },
  {
    value: "Paternity Leave",
    label: "Paternity Leave",
    days: 20,
    icon: Baby,
    color: "text-blue-500 bg-blue-50",
  },
  {
    value: "Maternity Leave",
    label: "Maternity Leave",
    days: 112,
    icon: Baby,
    color: "text-pink-500 bg-pink-50",
  },
];

const STATUS_STYLES = {
  Approved: "bg-blue-50 text-blue-600",
  Pending: "bg-orange-50 text-orange-600",
  Rejected: "bg-orange-50 text-orange-500",
};

function toDays(fromDate, toDate) {
  if (!fromDate || !toDate) return null;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const diff = Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : null;
}

export default function LeaveApply() {
  const navigate = useNavigate();
  const today = toLocalISODate();

  const [form, setForm] = useState({
    leave_type: LEAVE_TYPES[0].value,
    from_date: "",
    to_date: "",
    reason: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const [allLeaves, setAllLeaves] = useState(null); // null = loading

  useEffect(() => {
    apiClient
      .get("/leaves/my")
      .then((res) => setAllLeaves(res.data || []))
      .catch(() => setAllLeaves([]));
  }, []);

  const recent = useMemo(
    () => (allLeaves === null ? null : allLeaves.slice(0, 3)),
    [allLeaves],
  );

  // Real balance, computed client-side from this employee's own approved
  // requests this year — there's no GET /leaves/balance endpoint yet (see
  // note above LEAVE_TYPES), so "remaining" here is Entitlement (the
  // default_days seeded per leave type) minus days already Approved in
  // the current calendar year. Pending requests aren't subtracted since
  // they may still be rejected.
  const balanceByType = useMemo(() => {
    const map = {};
    LEAVE_TYPES.forEach((t) => {
      map[t.value.toUpperCase()] = 0;
    });
    if (allLeaves) {
      const currentYear = new Date().getFullYear();
      allLeaves.forEach((r) => {
        if (r.status !== "Approved") return;
        if (new Date(r.start_date).getFullYear() !== currentYear) return;
        const name = (r.leave_types?.leave_name || "").toUpperCase();
        if (map[name] !== undefined) map[name] += r.total_days || 0;
      });
    }
    return map;
  }, [allLeaves]);

  const totalDays = useMemo(
    () => toDays(form.from_date, form.to_date),
    [form.from_date, form.to_date],
  );

  const selectedType = LEAVE_TYPES.find((t) => t.value === form.leave_type);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate() {
    const errs = {};
    if (!form.leave_type) errs.leave_type = "Select a leave type.";
    if (!form.from_date) errs.from_date = "Start date is required.";
    if (!form.to_date) errs.to_date = "End date is required.";
    if (form.from_date && form.to_date && form.to_date < form.from_date) {
      errs.to_date = "End date must be on or after the start date.";
    }
    if (!form.reason.trim())
      errs.reason = "Please tell us why you're taking leave.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSuccess("");
    setError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await apiClient.post("/leaves/", {
        leave_type: form.leave_type,
        from_date: form.from_date,
        to_date: form.to_date,
        reason: form.reason.trim(),
      });

      setSuccess(res?.message || "Leave request submitted successfully.");
      setForm({
        leave_type: LEAVE_TYPES[0].value,
        from_date: "",
        to_date: "",
        reason: "",
      });

      // Refresh so "Recent Requests" and the balance card reflect the new one.
      apiClient
        .get("/leaves/my")
        .then((r) => setAllLeaves(r.data || []))
        .catch(() => {});
    } catch (err) {
      setError(
        err.message || "Unable to submit leave request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Apply Leave"
        subtitle="Fill in the details below to apply for leave."
        actions={
          <Link
            to="/employee/leave/history"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={15} /> Back to My Leaves
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ---------------- Form ---------------- */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          {success && (
            <div className="mb-5 flex items-start gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-sm rounded-lg p-3">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}
          {error && (
            <div className="mb-5 flex items-start gap-2 bg-orange-50 border border-orange-100 text-orange-600 text-sm rounded-lg p-3">
              <XCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Leave Details */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">
                1. Leave Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Leave Type <span className="text-orange-500">*</span>
                  </label>
                  <select
                    value={form.leave_type}
                    onChange={(e) => update("leave_type", e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                  >
                    {LEAVE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.leave_type && (
                    <p className="text-xs text-orange-500 mt-1">
                      {fieldErrors.leave_type}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Date Range <span className="text-orange-500">*</span>
                  </label>

                  <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50/60 hover:border-slate-300 transition-colors">
                    <DatePicker
                      value={
                        form.from_date
                          ? new Date(form.from_date + "T00:00:00")
                          : null
                      }
                      min={today}
                      placeholder="From"
                      onSelect={(d) => {
                        const iso = toLocalISODate(d);
                        update("from_date", iso);
                        if (form.to_date && form.to_date < iso) {
                          update("to_date", "");
                        }
                      }}
                    />
                    <span className="text-slate-300">→</span>
                    <DatePicker
                      value={
                        form.to_date
                          ? new Date(form.to_date + "T00:00:00")
                          : null
                      }
                      min={form.from_date || today}
                      placeholder="To"
                      onSelect={(d) => update("to_date", toLocalISODate(d))}
                    />
                  </div>

                  {(fieldErrors.from_date || fieldErrors.to_date) && (
                    <p className="text-xs text-orange-500 mt-1">
                      {fieldErrors.from_date || fieldErrors.to_date}
                    </p>
                  )}
                </div>
              </div>

              {totalDays !== null && (
                <div className="mt-3 inline-flex items-center gap-2 bg-orange-50 text-orange-700 text-xs font-medium rounded-lg px-3 py-1.5">
                  <CalendarDays size={13} />
                  {totalDays} {totalDays === 1 ? "day" : "days"} of{" "}
                  {selectedType?.label}
                </div>
              )}
            </div>

            {/* Reason */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">
                2. Reason
              </h3>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Reason for Leave <span className="text-orange-500">*</span>
              </label>
              <textarea
                rows={4}
                maxLength={500}
                value={form.reason}
                onChange={(e) => update("reason", e.target.value)}
                placeholder="Let your manager know why you're taking leave..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
              />
              <div className="flex items-center justify-between mt-1">
                {fieldErrors.reason ? (
                  <p className="text-xs text-orange-500">
                    {fieldErrors.reason}
                  </p>
                ) : (
                  <span />
                )}
                <p className="text-xs text-slate-400">
                  {form.reason.length}/500
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate("/employee/leave/history")}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 rounded-lg transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send size={15} /> Submit Leave Request
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ---------------- Sidebar ---------------- */}
        <div className="space-y-6">
          {/* Leave balance — Entitlement is the leave_types.default_days
              seed; Used is summed client-side from this employee's own
              Approved requests this year (see balanceByType above). There's
              no GET /leaves/balance endpoint yet, so this is the closest
              real signal available without new backend work. */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4 text-sm">
              Leave Type Entitlements
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Used / entitled days, this year
            </p>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1 scrollbar-hide">
              {LEAVE_TYPES.map((t) => {
                const Icon = t.icon;
                const used = balanceByType[t.value.toUpperCase()] || 0;
                const remaining = Math.max(t.days - used, 0);
                return (
                  <div
                    key={t.value}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${t.color}`}
                      >
                        <Icon size={15} />
                      </div>
                      <span className="text-sm text-slate-600 truncate">
                        {t.label}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      {t.days > 0 ? (
                        <>
                          <span className="text-sm font-semibold text-slate-800">
                            {remaining}
                          </span>
                          <span className="text-xs text-slate-400">
                            {" "}
                            / {t.days} left
                          </span>
                          {used > 0 && (
                            <p className="text-[11px] text-slate-400">
                              {used} used
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-sm font-semibold text-slate-800">
                          —
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent requests */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 text-sm">
                Recent Requests
              </h3>
              <Link
                to="/employee/leave/history"
                className="text-xs text-orange-600 font-medium"
              >
                View All
              </Link>
            </div>

            {recent === null ? (
              <div className="space-y-2">
                <div className="h-10 bg-slate-100 rounded animate-pulse" />
                <div className="h-10 bg-slate-100 rounded animate-pulse" />
              </div>
            ) : recent.length === 0 ? (
              <p className="text-sm text-slate-400">No leave requests yet.</p>
            ) : (
              <ul className="space-y-3">
                {recent.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div>
                      <p className="text-slate-700 font-medium">
                        {r.leave_types?.leave_name || "Leave"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(r.start_date).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                        {" – "}
                        {new Date(r.end_date).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        STATUS_STYLES[r.status] || "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Note */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-2.5">
            <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">
              All leave requests are subject to your manager's approval. You can
              track the status of this request in{" "}
              <Link
                to="/employee/leave/history"
                className="font-medium underline"
              >
                Leave History
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
