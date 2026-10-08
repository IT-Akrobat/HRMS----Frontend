import { AlertTriangle, ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAttendanceLiveUpdates } from "../../hooks/Useattendanceliveupdates";
import { apiClient } from "../../services/apiClient";
import McCertificate from "./McCertificate";

// HR / Super Admin queue: MCs that still need validation (certificate
// missing, or uploaded but not yet validated), oldest first. MCs waiting
// 5+ days are marked overdue -- the same ones the daily reminder covers.
// Backend: GET /leaves/mc/pending-validation (app/leaves/routes.py)
function fmt(d) {
  return d
    ? new Date(d).toLocaleDateString([], { month: "short", day: "numeric" })
    : "—";
}

export default function McValidationQueue({ onChanged }) {
  const [rows, setRows] = useState(null); // null = loading
  const [open, setOpen] = useState(true);

  function load() {
    apiClient
      .get("/leaves/mc/pending-validation")
      .then((res) => setRows(res.data || []))
      .catch(() => setRows([]));
  }

  useEffect(load, []);
  useAttendanceLiveUpdates((e) => {
    if (e?.type === "leave_event") load();
  });

  if (rows === null) {
    return (
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-400">
        <Loader2 size={14} className="animate-spin" /> Loading MCs to validate…
      </div>
    );
  }
  if (rows.length === 0) return null;

  const overdue = rows.filter((r) => r.overdue).length;

  return (
    <div className="mb-4 bg-white rounded-xl border border-orange-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-orange-50"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-orange-700">
          <AlertTriangle size={15} />
          MCs needing validation ({rows.length})
          {overdue > 0 && (
            <span className="text-xs font-medium text-orange-600">
              · {overdue} overdue
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`text-orange-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {r.employees?.full_name || "—"}{" "}
                    <span className="text-xs text-slate-400 font-normal">
                      {r.employees?.employee_id}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    MC {fmt(r.start_date)} → {fmt(r.end_date)} · {r.total_days}{" "}
                    {r.total_days === 1 ? "day" : "days"}
                  </p>
                </div>
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    r.overdue
                      ? "bg-orange-100 text-orange-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {r.days_waiting === 0
                    ? "Applied today"
                    : `Waiting ${r.days_waiting} day${r.days_waiting === 1 ? "" : "s"}`}
                  {r.overdue ? " · overdue" : ""}
                </span>
              </div>
              <McCertificate
                leave={r}
                mode="hr"
                onChanged={() => {
                  load();
                  onChanged?.();
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
