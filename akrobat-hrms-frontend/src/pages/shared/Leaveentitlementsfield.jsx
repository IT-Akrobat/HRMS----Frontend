import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../../services/apiClient";

// ---------------------------------------------------------------------
// Compact "Leave days" block for UserformModal.
//
// Replaces the old Annual / Childcare tier dropdowns with plain number
// inputs -- one small box per leave type (Annual, Medical (MC),
// Replacement, Childcare, Maternity, Paternity + any type HR adds).
//
//   GET  /leaves/policy/entitlement-types            -> which boxes to show
//   GET  /leaves/policy/employee-entitlements/{id}   -> current values (Edit)
//   (New leave types are created from the Leave Requests page header.)
//
// Behaviour:
//   * Blank box  = "use the company default" (shown as the placeholder).
//   * Only boxes HR actually typed in / changed are reported through
//     onChange as [{ leave_type_id, days }], so editing a user never
//     overwrites numbers HR didn't touch.
//   * Boxes are hidden when the form's Gender / Marital Status make the
//     leave ineligible (e.g. Maternity for a male, Childcare for a single
//     employee), using the same rules the backend enforces.
// ---------------------------------------------------------------------

const inputCls =
  "w-full border border-slate-200 rounded-lg px-2.5 py-2 sm:py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:border-orange-400";

// Which boxes each Leave Scheme shows:
//   SG_LIST  -> Annual, MC, Replacement, Childcare (+ Maternity / Paternity)
//   MC_ONLY  -> MC only
//   STANDARD -> Sick (MC), Casual, Annual (Chennai: 12 / 12 / 12)
//               (+ Maternity / Paternity, + any leave type HR added)
// Maternity / Paternity are shown on every scheme except MC only, and are
// still hidden by Gender (Maternity: female only, Paternity: male only).
const SCHEME_TYPES = {
  SG_LIST: [
    "ANNUAL LEAVE",
    "SICK LEAVE",
    "REPLACEMENT LEAVE",
    "CHILDCARE LEAVE",
    "MATERNITY LEAVE",
    "PATERNITY LEAVE",
  ],
  MC_ONLY: ["SICK LEAVE"],
  STANDARD: [
    "SICK LEAVE",
    "CASUAL LEAVE",
    "ANNUAL LEAVE",
    "MATERNITY LEAVE",
    "PATERNITY LEAVE",
  ],
};
const BUILT_IN = new Set([
  "ANNUAL LEAVE",
  "SICK LEAVE",
  "CASUAL LEAVE",
  "REPLACEMENT LEAVE",
  "CHILDCARE LEAVE",
  "MATERNITY LEAVE",
  "PATERNITY LEAVE",
]);

function inScheme(leaveName, scheme) {
  const name = String(leaveName || "").toUpperCase();
  const allowed = SCHEME_TYPES[scheme] || SCHEME_TYPES.STANDARD;
  if (allowed.includes(name)) return true;
  // HR-created types only make sense on the Standard scheme.
  return scheme === "STANDARD" && !BUILT_IN.has(name);
}

export default function LeaveEntitlementsField({
  isEdit,
  employeeId,
  gender,
  maritalStatus,
  leaveScheme,
  onChange,
}) {
  const [types, setTypes] = useState([]);
  const [initial, setInitial] = useState({}); // { leave_type_id: "14" } as loaded
  const [values, setValues] = useState({}); // { leave_type_id: "12" } as typed
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const requests = [apiClient.get("/leaves/policy/entitlement-types")];
    if (isEdit && employeeId) {
      requests.push(
        apiClient
          .get(`/leaves/policy/employee-entitlements/${employeeId}`)
          .catch(() => null),
      );
    }

    Promise.all(requests)
      .then(([typesRes, currentRes]) => {
        if (cancelled) return;
        setTypes(typesRes?.data || []);
        const current = {};
        Object.entries(currentRes?.data || {}).forEach(([id, days]) => {
          if (days !== null && days !== undefined) current[id] = String(days);
        });
        setInitial(current);
        setValues(current);
      })
      .catch((err) => {
        if (cancelled) return;
        setTypes([]);
        setError(
          err?.message ||
            "Could not load leave types. Confirm the leave_entitlement_form.sql migration has run.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isEdit, employeeId]);

  // Standard (Chennai) scheme = 12 Sick / 12 Casual / 12 Annual. On a NEW
  // employee those three boxes are pre-filled with 12 (HR can change them);
  // switching to another scheme clears what was pre-filled. Edit mode never
  // pre-fills -- it shows the employee's real saved numbers.
  const prefilled = useRef(new Set());
  useEffect(() => {
    if (isEdit || loading || types.length === 0) return;
    const ids = types
      .filter((t) => SCHEME_TYPES.STANDARD.slice(0, 3).includes(t.leave_name))
      .map((t) => t.id);
    if (leaveScheme === "STANDARD") {
      setValues((v) => {
        const next = { ...v };
        ids.forEach((id) => {
          if (next[id] === undefined || next[id] === "") {
            next[id] = "12";
            prefilled.current.add(id);
          }
        });
        return next;
      });
    } else if (prefilled.current.size) {
      setValues((v) => {
        const next = { ...v };
        prefilled.current.forEach((id) => {
          if (next[id] === "12") delete next[id];
        });
        return next;
      });
      prefilled.current = new Set();
    }
  }, [leaveScheme, types, loading, isEdit]);

  // Same rule the backend uses: an exclusion on gender / marital status
  // hides the leave. While that field is still blank we can't confirm
  // eligibility, so the box stays hidden until it's picked.
  const { visible, waitingOn } = useMemo(() => {
    const fields = { gender, marital_status: maritalStatus };
    const waiting = new Set();
    const shown = types.filter((t) => {
      if (!inScheme(t.leave_name, leaveScheme)) return false;
      const rules = t.excluded_when || [];
      for (const rule of rules) {
        const mine = fields[rule.field];
        if (!mine) {
          waiting.add(rule.field === "gender" ? "Gender" : "Marital Status");
          return false;
        }
        if (String(mine).toLowerCase() === String(rule.value).toLowerCase())
          return false;
      }
      return true;
    });
    return { visible: shown, waitingOn: [...waiting] };
  }, [types, gender, maritalStatus, leaveScheme]);

  // Report only what HR typed / changed.
  useEffect(() => {
    const visibleIds = new Set(visible.map((t) => t.id));
    const payload = [];
    Object.entries(values).forEach(([id, raw]) => {
      if (!visibleIds.has(id)) return;
      if (raw === "" || raw === undefined) return;
      if (raw === initial[id]) return;
      const days = Number(raw);
      if (Number.isNaN(days)) return;
      payload.push({ leave_type_id: id, days });
    });
    onChange(payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, initial, visible]);

  function setDays(id, raw) {
    // digits with an optional single decimal place (whole / half days)
    if (raw !== "" && !/^\d{0,3}(\.\d?)?$/.test(raw)) return;
    setValues((v) => ({ ...v, [id]: raw }));
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-600">
          Leave days
          <span className="ml-2 text-xs font-normal text-slate-400">
            Blank = company default
          </span>
        </span>
      </div>

      {error && (
        <div className="mb-2 rounded-lg bg-orange-50 border border-orange-100 text-orange-600 text-xs px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">
          <Loader2 size={14} className="animate-spin shrink-0" />
          Loading leave types…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3">
          {visible.map((t) => (
            <label key={t.id} className="block">
              <span className="mb-1 block truncate text-xs text-slate-500">
                {t.label}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={values[t.id] ?? ""}
                onChange={(e) => setDays(t.id, e.target.value)}
                placeholder={t.default_days ? String(t.default_days) : "0"}
                className={inputCls}
              />
            </label>
          ))}
        </div>
      )}

      {!loading && waitingOn.length > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          Select {waitingOn.join(" and ")} above to see Maternity / Paternity /
          Childcare days.
        </p>
      )}
    </div>
  );
}
