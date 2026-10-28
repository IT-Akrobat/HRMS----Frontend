import { ChevronDown, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { parseLocalISODate } from "../../../utils/date";

// Change if the company pays in another currency.
export const CURRENCY = "S$";

export function fmtDate(value) {
  if (!value) return "—";
  const d = parseLocalISODate(String(value).slice(0, 10));
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function money(n) {
  const v = Number(n || 0);
  return `${CURRENCY} ${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function hours(minutes) {
  if (!minutes) return "—";
  return `${(minutes / 60).toFixed(1)} h`;
}

export function initials(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join("") || "?"
  );
}

const TAG_STYLES = {
  green: "bg-emerald-50 text-emerald-700",
  orange: "bg-orange-50 text-orange-700",
  blue: "bg-blue-50 text-blue-700",
  slate: "bg-slate-100 text-slate-600",
  red: "bg-red-50 text-red-700",
};

export function Tag({ color = "slate", children }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${TAG_STYLES[color]}`}
    >
      {children}
    </span>
  );
}

export function statusColor(status = "") {
  const s = status.toLowerCase();
  if (["relieved", "paid", "approved", "present", "verified"].includes(s))
    return "green";
  if (["serving notice", "pending", "late"].includes(s)) return "orange";
  if (["rejected", "absent", "cancelled"].includes(s)) return "red";
  if (s.includes("leave")) return "blue";
  return "slate";
}

export function Card({ title, actions, children, className = "" }) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-4 md:rounded-xl ${className}`}
    >
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && (
            <h3 className="text-[15px] font-semibold text-slate-800">
              {title}
            </h3>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 text-xs text-slate-500">{label}</div>
      <div className="break-words text-sm font-medium text-slate-800">
        {children === undefined || children === null || children === ""
          ? "—"
          : children}
      </div>
    </div>
  );
}

export function FieldGrid({ children }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
      {children}
    </div>
  );
}

// scroll: optional max-height class (e.g. "max-h-[380px]") for a fixed-height,
// vertically scrolling body. mobileCards: force stacked cards on phones.
export function Table({
  columns,
  rows,
  empty = "No records.",
  rowKey,
  scroll = "",
  mobileCards,
  mobileRow,
}) {
  // Narrow tables turn into stacked cards on phones; wide ones scroll.
  const compact = mobileCards ?? (mobileRow ? true : columns.length <= 4);
  return (
    <>
      {compact && (
        <div className={`overflow-y-auto md:hidden ${scroll}`}>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-slate-400">
              {empty}
            </p>
          ) : mobileRow ? (
            <div className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <div
                  key={rowKey ? rowKey(r) : (r.id ?? i)}
                  className="py-3 first:pt-0 last:pb-0"
                >
                  {mobileRow(r)}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div
                  key={rowKey ? rowKey(r) : (r.id ?? i)}
                  className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                >
                  {columns.map((c) => (
                    <div
                      key={c.header}
                      className="flex items-start justify-between gap-3 py-0.5 text-[13px]"
                    >
                      <span className="shrink-0 text-slate-500">
                        {c.header}
                      </span>
                      <span className="min-w-0 break-words text-right font-medium text-slate-700">
                        {c.render(r)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div
        className={`max-w-full overflow-auto ${scroll} ${compact ? "hidden md:block" : ""}`}
      >
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.header}
                  className="sticky top-0 z-[1] whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-500"
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-slate-400"
                >
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={rowKey ? rowKey(r) : (r.id ?? i)}>
                  {columns.map((c) => (
                    <td
                      key={c.header}
                      className="whitespace-nowrap border-b border-slate-100 px-3 py-2 text-[13px] text-slate-700"
                    >
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {message || "Something went wrong."}
      {onRetry && (
        <button onClick={onRetry} className="ml-3 font-semibold underline">
          Retry
        </button>
      )}
    </div>
  );
}

// Loads data for a tab once, with loading/error state and a reload().
export function useLoad(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const data = await loader();
      setState({ data, loading: false, error: "" });
    } catch (e) {
      setState({
        data: null,
        loading: false,
        error: e?.message || "Unable to load.",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}

export const inputCls =
  "w-full min-h-[44px] md:min-h-[36px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] text-slate-800 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-50";
export const btnPrimary =
  "inline-flex min-h-[44px] md:min-h-[36px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#F5730B] px-3.5 text-[13px] font-semibold text-white hover:bg-orange-600 disabled:opacity-60";
export const btnGhost =
  "inline-flex min-h-[44px] md:min-h-[36px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60";

// Styled dropdown: native arrow hidden, one chevron, same height as inputs.
// `className` goes on the wrapper (use it for width, e.g. "w-44").
export function Select({ className = "", children, ...props }) {
  return (
    <div className={`relative ${className}`}>
      <select
        {...props}
        className={`${inputCls} cursor-pointer appearance-none pr-8`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
