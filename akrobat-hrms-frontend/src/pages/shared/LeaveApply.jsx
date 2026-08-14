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
import SelectDropdown from "../../components/common/SelectDropdown";
import DatePicker from "../../components/layout/DatePicker";
import { ROLE_BASE_PATH } from "../../config/roles";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../services/apiClient";
import { toLocalISODate } from "../../utils/date";

// ---------------------------------------------------------------------------
// Leave type display metadata (icon / color only — NOT day counts)
// ---------------------------------------------------------------------------
// This used to be a single hardcoded LEAVE_TYPES array with a fixed `days`
// value that was shown to every employee regardless of who they were —
// which is exactly why Maternity Leave (112 days) used to render for male
// employees and Paternity Leave for female employees: the UI never asked
// the backend "is this person even eligible for this leave type, and how
// many days do THEY specifically have". Eligibility (gender / marital
// status / nationality / office-vs-field) and entitlement (tier / balance
// / replacement credits) are per-employee facts that live in the backend
// policy engine (app/leaves/policy_services.py), so they can only be
// known after fetching GET /leaves/my-entitlements for the logged-in
// employee. This map is now purely cosmetic — which icon/color to use for
// a given leave_name — never which types to show or how many days.
const LEAVE_TYPE_DISPLAY = {
  "CASUAL LEAVE": { icon: Umbrella, color: "text-blue-500 bg-blue-50" },
  "SICK LEAVE": { icon: ShieldAlert, color: "text-blue-500 bg-blue-50" },
  "ANNUAL LEAVE": { icon: CalendarDays, color: "text-blue-500 bg-blue-50" },
  "EMERGENCY LEAVE": { icon: Clock3, color: "text-orange-500 bg-orange-50" },
  "UNPAID LEAVE": { icon: Info, color: "text-slate-500 bg-slate-100" },
  "HOSPITALISATION LEAVE": {
    icon: HeartPulse,
    color: "text-red-500 bg-red-50",
  },
  "REPLACEMENT LEAVE": { icon: RefreshCcw, color: "text-teal-500 bg-teal-50" },
  "CHILDCARE LEAVE": { icon: Baby, color: "text-pink-500 bg-pink-50" },
  "CHILDREN LEAVE": { icon: Baby, color: "text-pink-500 bg-pink-50" },
  "COMPASSIONATE LEAVE": {
    icon: HeartHandshake,
    color: "text-purple-500 bg-purple-50",
  },
  "NATIONAL SERVICE LEAVE": {
    icon: ShieldCheck,
    color: "text-green-600 bg-green-50",
  },
  "PATERNITY LEAVE": { icon: Baby, color: "text-blue-500 bg-blue-50" },
  "MATERNITY LEAVE": { icon: Baby, color: "text-pink-500 bg-pink-50" },
};

const DEFAULT_DISPLAY = {
  icon: CalendarDays,
  color: "text-slate-500 bg-slate-100",
};

function displayFor(leaveName) {
  return LEAVE_TYPE_DISPLAY[(leaveName || "").toUpperCase()] || DEFAULT_DISPLAY;
}

// Turns "MATERNITY LEAVE" into "Maternity Leave" for the dropdown/labels.
function toTitleCase(name) {
  return (name || "")
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

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

  // This page is mounted once (src/routes/commonRoutes.jsx) and shared by
  // every role -- Employee, Manager, HR Admin, Super Admin all apply for
  // their own leave the same way. "Leave History" always means MY leave
  // history though, which lives under the current role's own base path
  // (e.g. /manager/leave/history), never a hardcoded /employee/... link.
  const { role } = useAuth();
  const leaveHistoryPath = `${ROLE_BASE_PATH[role] || "/employee"}/leave/history`;

  const [form, setForm] = useState({
    leave_type: "",
    from_date: "",
    to_date: "",
    reason: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const [allLeaves, setAllLeaves] = useState(null); // null = loading

  // The leave types THIS employee is actually eligible for, each with
  // their own real total/used/remaining days — fetched fresh from
  // GET /leaves/my-entitlements (app/leaves/policy_services.py
  // get_my_leave_entitlements), which runs the eligibility rules
  // (gender / marital_status / nationality / office-vs-field) before
  // returning anything. A male employee simply never gets a Maternity
  // Leave entry back, and vice versa for Paternity Leave — this is
  // enforced server-side, not filtered/guessed in the UI.
  const [entitlements, setEntitlements] = useState(null); // null = loading
  const [entitlementsError, setEntitlementsError] = useState("");

  useEffect(() => {
    apiClient
      .get("/leaves/my")
      .then((res) => setAllLeaves(res.data || []))
      .catch(() => setAllLeaves([]));

    apiClient
      .get("/leaves/my-entitlements")
      .then((res) => {
        const data = res.data || [];
        setEntitlements(data);
        setForm((prev) =>
          prev.leave_type
            ? prev
            : { ...prev, leave_type: data[0]?.leave_name || "" },
        );
      })
      .catch(() => {
        setEntitlements([]);
        setEntitlementsError(
          "Unable to load your leave entitlements right now.",
        );
      });
  }, []);

  const recent = useMemo(
    () => (allLeaves === null ? null : allLeaves.slice(0, 3)),
    [allLeaves],
  );

  const totalDays = useMemo(
    () => toDays(form.from_date, form.to_date),
    [form.from_date, form.to_date],
  );

  const selectedType = (entitlements || []).find(
    (t) => t.leave_name === form.leave_type,
  );

  // Options for the leave-type dropdown, built from whatever state
  // `entitlements` is currently in (loading / empty / loaded) so the
  // SelectDropdown placeholder always reflects reality instead of
  // showing a stale/empty list.
  const leaveTypeOptions = (entitlements || []).map((t) => ({
    value: t.leave_name,
    label:
      toTitleCase(t.leave_name) +
      (t.leave_name === "REPLACEMENT LEAVE"
        ? ` — ${t.remaining_days ?? 0} day${
            (t.remaining_days ?? 0) === 1 ? "" : "s"
          } available`
        : ""),
  }));
  const leaveTypePlaceholder =
    entitlements === null
      ? "Loading leave types…"
      : entitlements?.length === 0
        ? "No leave types available"
        : "Select leave type";

  // Replacement Leave is credited by HR (one day per public holiday
  // that fell on a Saturday, see app/leaves/policy_services.py
  // credit_replacement_leave) and expires 1 year after it's credited.
  // It already shows up in the leave type dropdown/entitlements panel
  // like any other type -- this just surfaces it a bit more so the
  // employee notices it's there and how many days they actually have.
  const replacementEntitlement = (entitlements || []).find(
    (t) => t.leave_name === "REPLACEMENT LEAVE",
  );
  const replacementDaysAvailable = replacementEntitlement?.remaining_days ?? 0;

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
        leave_type: entitlements?.[0]?.leave_name || "",
        from_date: "",
        to_date: "",
        reason: "",
      });

      // Refresh so "Recent Requests" and the entitlements panel reflect
      // the new (Pending) request's future effect on balances.
      apiClient
        .get("/leaves/my")
        .then((r) => setAllLeaves(r.data || []))
        .catch(() => {});
      apiClient
        .get("/leaves/my-entitlements")
        .then((r) => setEntitlements(r.data || []))
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
            to={leaveHistoryPath}
            title="Back to My Leaves"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg px-2.5 sm:px-3 py-2 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={15} />{" "}
            <span className="hidden sm:inline">Back to My Leaves</span>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ---------------- Form ---------------- */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          {replacementDaysAvailable > 0 &&
            form.leave_type !== "REPLACEMENT LEAVE" && (
              <div className="mb-5 flex items-center gap-2.5 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2.5">
                <RefreshCcw size={16} className="text-teal-600 shrink-0" />
                <p className="flex-1 text-xs text-teal-700">
                  <span className="font-semibold">
                    {replacementDaysAvailable}{" "}
                    {replacementDaysAvailable === 1 ? "day" : "days"} of
                    Replacement Leave
                  </span>{" "}
                  available to use.
                </p>
                <button
                  type="button"
                  onClick={() => update("leave_type", "REPLACEMENT LEAVE")}
                  className="shrink-0 text-xs font-medium text-teal-700 border border-teal-200 rounded-md px-2.5 py-1 hover:bg-teal-100 transition-colors"
                >
                  Apply
                </button>
              </div>
            )}
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
                  {/* Only leave types this employee is eligible for
                      appear here — e.g. Maternity Leave is simply
                      absent from the list for a male employee, rather
                      than shown and silently ignored. Uses the shared
                      SelectDropdown so it matches every other dropdown
                      in the app (e.g. Attendance Reports' department
                      filter) instead of the browser's native <select>
                      popover. */}
                  <SelectDropdown
                    value={form.leave_type}
                    onChange={(val) => update("leave_type", val)}
                    options={leaveTypeOptions}
                    placeholder={leaveTypePlaceholder}
                    disabled={!entitlements || entitlements.length === 0}
                    triggerClassName="py-2.5"
                  />
                  {fieldErrors.leave_type && (
                    <p className="text-xs text-orange-500 mt-1">
                      {fieldErrors.leave_type}
                    </p>
                  )}
                  {entitlementsError && (
                    <p className="text-xs text-orange-500 mt-1">
                      {entitlementsError}
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
                  {toTitleCase(selectedType?.leave_name) || form.leave_type}
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
                onClick={() => navigate(leaveHistoryPath)}
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
          {/* Leave entitlements — sourced from GET /leaves/my-entitlements,
              which only returns leave types this employee is eligible for
              (see app/leaves/policy_services.py get_my_leave_entitlements).
              total/used/remaining come from this employee's own
              leave_balances / tier / replacement-credit rows, never a
              shared constant, so two employees never see the same numbers
              here unless their actual entitlement really is the same. */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4 text-sm">
              Leave Type Entitlements
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Used / entitled days, this year
            </p>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1 scrollbar-hide">
              {entitlements === null && (
                <div className="space-y-2">
                  <div className="h-9 bg-slate-100 rounded animate-pulse" />
                  <div className="h-9 bg-slate-100 rounded animate-pulse" />
                  <div className="h-9 bg-slate-100 rounded animate-pulse" />
                </div>
              )}
              {entitlements?.length === 0 && !entitlementsError && (
                <p className="text-sm text-slate-400">
                  No leave types configured for your profile yet.
                </p>
              )}
              {entitlements?.map((t) => {
                const { icon: Icon, color } = displayFor(t.leave_name);
                const remaining = t.remaining_days ?? 0;
                const used = t.used_days ?? 0;
                return (
                  <div
                    key={t.leave_type_id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}
                      >
                        <Icon size={15} />
                      </div>
                      <span className="text-sm text-slate-600 truncate">
                        {toTitleCase(t.leave_name)}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      {t.unlimited ? (
                        <span className="text-sm font-semibold text-slate-800">
                          —
                        </span>
                      ) : t.tier_not_assigned ? (
                        <span className="text-[11px] text-slate-400"> — </span>
                      ) : (
                        <>
                          <span className="text-sm font-semibold text-slate-800">
                            {Math.max(remaining, 0)}
                          </span>
                          <span className="text-xs text-slate-400">
                            {" "}
                            / {t.total_days ?? 0} left
                          </span>
                          {used > 0 && (
                            <p className="text-[11px] text-slate-400">
                              {used} used
                            </p>
                          )}
                        </>
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
                to={leaveHistoryPath}
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
              <Link to={leaveHistoryPath} className="font-medium underline">
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
