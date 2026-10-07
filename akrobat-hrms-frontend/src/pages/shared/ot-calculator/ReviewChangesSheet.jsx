import { X } from "lucide-react";
import { useMemo } from "react";
import { effectiveRow, formatH, rowKey } from "./otUtils";

// MOBILE ONLY bottom sheet. Opens when "Save changes" is tapped so the admin
// can see exactly which dates were edited before anything is sent to the
// server. Web keeps saving directly (this component is `lg:hidden`).

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function prettyDate(dateStr) {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]}`;
}

function signed(n) {
  const v = Math.round(n * 100) / 100;
  if (v === 0) return "0 h";
  return `${v > 0 ? "+" : "-"}${formatH(Math.abs(v))}`;
}

// Only rows whose manual value or note really differs from what is saved.
function buildGroups(employees, edits) {
  const groups = [];
  employees.forEach((emp) => {
    const rows = [];
    emp.rows.forEach((row) => {
      if (!edits[rowKey(emp.employee_id, row.date)]) return;
      const before = effectiveRow(emp, row, {});
      const after = effectiveRow(emp, row, edits);
      if (before.manual === after.manual && before.note === after.note) return;
      rows.push({
        date: row.date,
        weekday: row.weekday,
        auto: row.auto_ot_hours,
        before,
        after,
        delta: after.final - before.final,
      });
    });
    if (rows.length) {
      groups.push({
        emp,
        rows,
        delta: rows.reduce((a, r) => a + r.delta, 0),
      });
    }
  });
  return groups;
}

export default function ReviewChangesSheet({
  open,
  employees,
  edits,
  saving,
  onClose,
  onConfirm,
}) {
  const groups = useMemo(
    () => (open ? buildGroups(employees, edits) : []),
    [open, employees, edits],
  );
  if (!open) return null;

  const dayCount = groups.reduce((a, g) => a + g.rows.length, 0);
  const net = groups.reduce((a, g) => a + g.delta, 0);

  return (
    <div className="lg:hidden fixed inset-0 z-[100] flex items-end justify-center">
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={saving ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Review changes before saving"
        className="relative w-full bg-white rounded-t-2xl shadow-xl max-h-[88vh] flex flex-col"
      >
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mt-2.5 shrink-0" />

        <div className="flex items-start gap-3 px-4 pt-3 pb-3 border-b border-slate-100 shrink-0">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-800">
              Review changes before saving
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {dayCount} day{dayCount === 1 ? "" : "s"} edited in{" "}
              {groups.length} employee{groups.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={saving}
            className="w-9 h-9 -mr-1 shrink-0 flex items-center justify-center rounded-lg text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {groups.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-500">
              No changes to save.
            </div>
          )}
          {groups.map(({ emp, rows, delta }) => (
            <div key={emp.employee_id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 shrink-0 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center">
                  {initials(emp.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800 truncate">
                    {emp.full_name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {emp.employee_code}
                  </div>
                </div>
                <span
                  className={`text-xs font-bold ${
                    delta > 0
                      ? "text-green-700"
                      : delta < 0
                        ? "text-red-600"
                        : "text-slate-500"
                  }`}
                >
                  {signed(delta)}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                {rows.map((r) => (
                  <div
                    key={r.date}
                    className="px-3 py-2.5 border-t border-slate-100 first:border-t-0 bg-orange-50/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 shrink-0">
                        <div className="text-sm font-bold text-slate-800 leading-tight">
                          {prettyDate(r.date)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {r.weekday}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 text-xs text-slate-500">
                        <div>Auto {r.auto} h</div>
                        <div className="mt-0.5">
                          <span className="text-slate-400">
                            {r.before.manual === ""
                              ? "no edit"
                              : `${r.before.manual} h`}
                          </span>{" "}
                          →{" "}
                          <b className="text-slate-800">
                            {r.after.manual === ""
                              ? "auto"
                              : `${r.after.manual} h`}
                          </b>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-slate-800">
                          {formatH(r.after.final)}
                        </div>
                        <div
                          className={`text-[11px] font-semibold ${
                            r.delta > 0
                              ? "text-green-700"
                              : r.delta < 0
                                ? "text-red-600"
                                : "text-slate-400"
                          }`}
                        >
                          {signed(r.delta)}
                        </div>
                      </div>
                    </div>
                    {r.after.note && (
                      <div className="mt-1.5 text-[11px] text-slate-500 break-words">
                        Note: {r.after.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2.5">
            <span>Net change</span>
            <b
              className={`text-sm ${
                net > 0
                  ? "text-green-700"
                  : net < 0
                    ? "text-red-600"
                    : "text-slate-700"
              }`}
            >
              {signed(net)}
            </b>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="min-h-[44px] rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Back to editing
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={saving}
              className="min-h-[44px] rounded-lg bg-brand-orange text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Confirm and save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
