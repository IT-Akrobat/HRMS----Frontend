import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { apiClient } from "../../services/apiClient";

// Part-time employees: only worked time is calculated. These two components
// show "days worked" + "total hours" for a month.
//   <PartTimeMySummary />   -> logged-in employee (renders nothing unless part-time)
//   <PartTimeOrgSummary />  -> HR / Super Admin: every part-time employee

const pad = (n) => String(n).padStart(2, "0");
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export function formatMinutes(mins) {
  const m = Math.max(0, Math.round(mins || 0));
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
}

function fmtTime(v) {
  if (!v) return "—";
  // server timestamps are naive UTC
  const iso = /Z|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`;
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MonthSwitcher({ cursor, setCursor }) {
  const label = cursor.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const move = (n) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => move(-1)}
        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
      >
        <ChevronLeft size={14} />
      </button>
      <span className="text-sm font-medium text-slate-700 min-w-[120px] text-center">
        {label}
      </span>
      <button
        type="button"
        onClick={() => move(1)}
        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

export function PartTimeMySummary() {
  const [cursor, setCursor] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    apiClient
      .get(`/attendance/part-time/my-summary?month=${monthKey(cursor)}`)
      .then((res) => alive && setData(res.data ?? null))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [cursor]);

  if (!data || !data.is_part_time) return null;

  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Clock size={16} className="text-orange-500" /> Part-time monthly
          summary
        </div>
        <MonthSwitcher cursor={cursor} setCursor={setCursor} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-orange-50 px-3 py-3">
          <div className="text-xs text-slate-500">Days worked</div>
          <div className="text-2xl font-semibold text-orange-600">
            {data.days_worked}
          </div>
        </div>
        <div className="rounded-lg bg-orange-50 px-3 py-3">
          <div className="text-xs text-slate-500">Total working hours</div>
          <div className="text-2xl font-semibold text-orange-600">
            {formatMinutes(data.total_working_minutes)}
          </div>
        </div>
      </div>
      {data.open_days > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          {data.open_days} day(s) checked in but not checked out yet — hours are
          counted after check-out.
        </p>
      )}
      {data.daily?.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="py-1 pr-3 font-medium">Date</th>
                <th className="py-1 pr-3 font-medium">In</th>
                <th className="py-1 pr-3 font-medium">Out</th>
                <th className="py-1 pr-3 font-medium">Break</th>
                <th className="py-1 font-medium">Worked</th>
              </tr>
            </thead>
            <tbody>
              {data.daily.map((d) => (
                <tr
                  key={d.date}
                  className="border-t border-slate-100 text-slate-600"
                >
                  <td className="py-1.5 pr-3">{d.date}</td>
                  <td className="py-1.5 pr-3">{fmtTime(d.check_in_time)}</td>
                  <td className="py-1.5 pr-3">{fmtTime(d.check_out_time)}</td>
                  <td className="py-1.5 pr-3">
                    {d.break_minutes ? `${d.break_minutes}m` : "—"}
                  </td>
                  <td className="py-1.5">
                    {d.check_out_time ? formatMinutes(d.working_minutes) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function PartTimeOrgSummary() {
  const [cursor, setCursor] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;
    apiClient
      .get(`/attendance/part-time/summary?month=${monthKey(cursor)}`)
      .then((res) => alive && setRows(Array.isArray(res.data) ? res.data : []))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [cursor]);

  // Hide completely when the company has no part-time employees.
  if (!rows.length) return null;

  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Clock size={16} className="text-orange-500" /> Part-time employees —
          monthly hours
        </div>
        <MonthSwitcher cursor={cursor} setCursor={setCursor} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="py-1 pr-3 font-medium">Employee</th>
              <th className="py-1 pr-3 font-medium">Days worked</th>
              <th className="py-1 font-medium">Total hours</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.employee_id}
                className="border-t border-slate-100 text-slate-600"
              >
                <td className="py-1.5 pr-3">
                  {r.full_name}{" "}
                  <span className="text-xs text-slate-400">
                    ({r.employee_code})
                  </span>
                </td>
                <td className="py-1.5 pr-3">{r.days_worked}</td>
                <td className="py-1.5">
                  {formatMinutes(r.total_working_minutes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
