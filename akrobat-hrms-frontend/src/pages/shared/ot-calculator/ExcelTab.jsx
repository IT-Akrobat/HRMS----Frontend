import {
  ChevronLeft,
  ChevronRight,
  Download,
  Save,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import SearchInput from "../../../components/common/SearchInput";
import SelectDropdown from "../../../components/common/SelectDropdown";
import { formatClock } from "../../../utils/timeFormat";
import { exportOtExcel, readOtExcel } from "./otExcel";
import { effectiveRow, empTotals, formatH } from "./otUtils";

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

// Tab 2: spreadsheet-style view of every OT employee for the month.
// Export -> calculate/edit in Excel ->
// Import the edited file back, then Save.

const COLS = [
  "Code",
  "Employee",
  "Date",
  "Day",
  "Shift end",
  "Check-out",
  "After shift (min)",
  "Auto OT (h)",
  "Manual (h)",
  "Final (h)",
  "Note",
];

// Monday-first week number inside a month: days 1..n of the month are
// grouped into weeks (Week 1 may be short if the 1st is mid-week).
function monthOffset(year, monthIdx) {
  return (new Date(year, monthIdx, 1).getDay() + 6) % 7; // Mon = 0
}

function weekOf(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const offset = monthOffset(d.getFullYear(), d.getMonth());
  return Math.floor((d.getDate() - 1 + offset) / 7) + 1;
}

function buildWeeks(month) {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const offset = monthOffset(y, m - 1);
  const count = Math.floor((daysInMonth - 1 + offset) / 7) + 1;
  return Array.from({ length: count }, (_, i) => {
    const week = i + 1;
    return {
      week,
      start: Math.max(1, (week - 1) * 7 - offset + 1),
      end: Math.min(daysInMonth, week * 7 - offset),
    };
  });
}

export default function ExcelTab({
  data,
  month,
  edits,
  onEdit,
  onSave,
  onReview,
  saving,
  dirtyCount,
  onMessage,
}) {
  const employees = data.employees || [];
  const fileRef = useRef(null);
  const [filterId, setFilterId] = useState("");
  const shown = filterId
    ? employees.filter((e) => e.employee_id === filterId)
    : employees;

  // Mobile only: employee list -> tap one -> full details screen.
  const [mobileEmpId, setMobileEmpId] = useState(null);
  const [query, setQuery] = useState("");
  const [weekSel, setWeekSel] = useState(null); // null = latest week with data
  const topRef = useRef(null);
  const mobileEmp =
    employees.find((e) => e.employee_id === mobileEmpId) || null;
  const q = query.trim().toLowerCase();
  const mobileList = q
    ? employees.filter(
        (e) =>
          (e.full_name || "").toLowerCase().includes(q) ||
          String(e.employee_code || "")
            .toLowerCase()
            .includes(q),
      )
    : employees;
  const allFinal = employees.reduce(
    (acc, e) => acc + empTotals(e, edits).final,
    0,
  );
  const mobileTotals = mobileEmp ? empTotals(mobileEmp, edits) : null;

  const weeks = buildWeeks(month);
  const lastRow = mobileEmp?.rows[mobileEmp.rows.length - 1];
  const activeWeek =
    weekSel ?? (lastRow ? weekOf(lastRow.date) : weeks[weeks.length - 1].week);
  const weekRows = mobileEmp
    ? mobileEmp.rows.filter((r) => weekOf(r.date) === activeWeek)
    : [];
  const activeRange = weeks.find((w) => w.week === activeWeek);
  const weekFinal = mobileEmp
    ? weekRows.reduce(
        (acc, r) => acc + effectiveRow(mobileEmp, r, edits).final,
        0,
      )
    : 0;
  const monthShort = new Date(`${month}-01T00:00:00`).toLocaleString("en-US", {
    month: "short",
  });

  function openEmployee(id) {
    setMobileEmpId(id);
    setWeekSel(null);
    requestAnimationFrame(() =>
      topRef.current?.scrollIntoView({ block: "start" }),
    );
  }

  const sum = shown.reduce(
    (acc, emp) => {
      const t = empTotals(emp, edits);
      return {
        after: acc.after + t.afterShift,
        auto: acc.auto + t.auto,
        final: acc.final + t.final,
      };
    },
    { after: 0, auto: 0, final: 0 },
  );

  async function handleImport(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { patches, unmatched } = await readOtExcel(file, employees, edits);
      patches.forEach((p) =>
        onEdit(p.employee, p.row, { manual: p.manual, note: p.note }),
      );
      onMessage(
        `${patches.length} change(s) imported${
          unmatched ? `, ${unmatched} row(s) not matched` : ""
        }. Click Save to keep them.`,
      );
    } catch {
      onMessage(
        "Could not read that file. Use a file exported from here.",
        true,
      );
    }
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleImport}
      />

      {/* ---------------- Web: unchanged table view ---------------- */}
      <div className="hidden lg:block">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <SelectDropdown
            searchable
            value={filterId}
            onChange={setFilterId}
            options={[
              { value: "", label: `All OT staff (${employees.length})` },
              ...employees.map((e) => ({
                value: e.employee_id,
                label: e.full_name,
              })),
            ]}
            searchPlaceholder="Search employee..."
            className="w-64"
            triggerClassName="min-h-[44px]"
          />
          <button
            type="button"
            onClick={() => exportOtExcel(shown, edits, month)}
            className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 flex items-center gap-2"
          >
            <Download size={16} />
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 flex items-center gap-2"
          >
            <Upload size={16} />
            Import edited Excel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || dirtyCount === 0}
            className="bg-brand-orange text-white text-sm font-medium px-4 py-2.5 min-h-[44px] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50 transition flex items-center gap-2 ml-auto"
          >
            <Save size={16} />
            {saving
              ? "Saving..."
              : `Save changes${dirtyCount ? ` (${dirtyCount})` : ""}`}
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-auto max-h-[60vh]">
          <table className="w-full text-sm min-w-[1100px] border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-xs font-bold">
                <th className="w-10 border-r border-slate-200 sticky top-0 z-10 bg-slate-100" />
                {COLS.map((c) => (
                  <th
                    key={c}
                    className="px-3 py-2.5 text-left border-r border-slate-200 whitespace-nowrap sticky top-0 z-10 bg-slate-100"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.flatMap((emp) =>
                emp.rows.map((row) => {
                  const cur = effectiveRow(emp, row, edits);
                  return (
                    <tr
                      key={`${emp.employee_id}|${row.date}`}
                      className="border-t border-slate-200"
                    >
                      <td className="bg-slate-100 text-center text-xs text-slate-500 border-r border-slate-200" />
                      <td className="px-3 py-2 border-r border-slate-100">
                        {emp.employee_code}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-100 font-medium">
                        {emp.full_name}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-100">
                        {row.date}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-100">
                        {row.weekday}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-100">
                        {formatClock(row.shift_end) || "--"}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-100">
                        {formatClock(row.check_out) || "--"}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-100">
                        {row.after_shift_minutes}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-100">
                        {row.auto_ot_hours}
                      </td>
                      <td
                        className={`p-0 border-r border-slate-100 ${
                          cur.edited
                            ? "bg-orange-50 outline outline-2 -outline-offset-2 outline-orange-600"
                            : ""
                        }`}
                      >
                        <input
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
                          aria-label={`Manual OT for ${emp.full_name} on ${row.date}`}
                          value={cur.manual}
                          onChange={(e) =>
                            onEdit(emp, row, { manual: e.target.value })
                          }
                          className="w-24 min-h-[40px] bg-transparent px-3 text-sm font-bold text-orange-800"
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-slate-100 font-bold">
                        {cur.final}
                      </td>
                      <td className="p-0 border-r border-slate-100">
                        <input
                          type="text"
                          maxLength={300}
                          aria-label={`Note for ${emp.full_name} on ${row.date}`}
                          value={cur.note}
                          onChange={(e) =>
                            onEdit(emp, row, { note: e.target.value })
                          }
                          className="w-56 min-h-[40px] bg-transparent px-3 text-sm"
                        />
                      </td>
                    </tr>
                  );
                }),
              )}
              <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
                <td className="border-r border-slate-200 sticky bottom-0 bg-slate-100" />
                <td
                  className="px-3 py-2.5 sticky bottom-0 bg-slate-100"
                  colSpan={6}
                >
                  Total
                </td>
                <td className="px-3 py-2.5 sticky bottom-0 bg-slate-100">
                  {sum.after}
                </td>
                <td className="px-3 py-2.5 sticky bottom-0 bg-slate-100">
                  {formatH(sum.auto)}
                </td>
                <td className="px-3 py-2.5 sticky bottom-0 bg-slate-100" />
                <td className="px-3 py-2.5 text-orange-700 sticky bottom-0 bg-slate-100">
                  {formatH(sum.final)}
                </td>
                <td className="sticky bottom-0 bg-slate-100" />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Type in the Manual column and Final updates. Or export, edit in Excel,
          import back, then Save.
        </p>
      </div>

      {/* ---------------- Mobile: list -> details screen ---------------- */}
      <div ref={topRef} className="lg:hidden scroll-mt-4">
        {mobileEmp ? (
          <div>
            <button
              type="button"
              onClick={() => setMobileEmpId(null)}
              className="flex items-center gap-1 min-h-[40px] mb-2 -ml-1 text-sm font-medium text-slate-600"
            >
              <ChevronLeft size={18} />
              All staff
            </button>

            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-3 flex items-center gap-3">
              <span className="w-10 h-10 shrink-0 rounded-full bg-orange-100 text-orange-700 font-bold text-sm flex items-center justify-center">
                {initials(mobileEmp.full_name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-800 truncate">
                  {mobileEmp.full_name}
                </div>
                <div className="text-xs text-slate-500">
                  {mobileEmp.employee_code} · {month}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  Final
                </div>
                <div className="text-xl font-bold text-orange-700 leading-none">
                  {formatH(mobileTotals.final)}
                </div>
              </div>
            </div>

            <div
              className="grid gap-1.5 mb-2"
              style={{
                gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
              }}
            >
              {weeks.map((w) => {
                const on = w.week === activeWeek;
                const hasRows = mobileEmp.rows.some(
                  (r) => weekOf(r.date) === w.week,
                );
                return (
                  <button
                    type="button"
                    key={w.week}
                    onClick={() => setWeekSel(w.week)}
                    className={`aspect-square rounded-full border flex flex-col items-center justify-center text-center transition-colors ${
                      on
                        ? "bg-[var(--primary)] border-[var(--primary)] text-white"
                        : hasRows
                          ? "bg-white border-slate-200 text-slate-700"
                          : "bg-white border-slate-200 text-slate-300"
                    }`}
                  >
                    <div className="text-xs font-bold leading-tight">
                      W{w.week}
                    </div>
                    <div
                      className={`text-[10px] leading-tight ${
                        on ? "text-white/80" : "text-slate-400"
                      }`}
                    >
                      {w.start}–{w.end}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-3 px-0.5">
              <span>
                Week {activeWeek} · {activeRange?.start}–{activeRange?.end}{" "}
                {monthShort}
              </span>
              <span>
                Week total{" "}
                <b className="text-orange-700">{formatH(weekFinal)}</b>
              </span>
            </div>

            {weekRows.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
                No attendance this week.
              </div>
            )}
            <div className="space-y-3">
              {weekRows.map((row) => {
                const cur = effectiveRow(mobileEmp, row, edits);
                return (
                  <div
                    key={row.date}
                    className={`rounded-xl border p-3 ${
                      cur.edited
                        ? "border-orange-300 bg-orange-50/60"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 text-center shrink-0">
                        <div className="text-lg font-bold leading-none text-slate-800">
                          {row.date.slice(8)}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {row.weekday}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-800">
                          {formatClock(row.check_out) || "--"}
                        </div>
                        <div className="text-xs text-slate-400">
                          till {formatClock(row.shift_end) || "--"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-bold ${
                            cur.final > 0
                              ? "bg-green-100 text-green-800"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {cur.final} h
                        </span>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Auto {row.auto_ot_hours} h
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-[88px_1fr] gap-2 mt-3">
                      <input
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        inputMode="decimal"
                        aria-label={`Manual OT for ${mobileEmp.full_name} on ${row.date}`}
                        placeholder="Edit (h)"
                        value={cur.manual}
                        onChange={(e) =>
                          onEdit(mobileEmp, row, { manual: e.target.value })
                        }
                        className={`w-full min-h-[40px] rounded-lg px-3 text-center text-sm ${
                          cur.edited
                            ? "border-2 border-orange-600 bg-orange-50 font-bold text-orange-800"
                            : "border border-slate-200 bg-white text-slate-600"
                        }`}
                      />
                      <input
                        type="text"
                        maxLength={300}
                        aria-label={`Note for ${mobileEmp.full_name} on ${row.date}`}
                        placeholder="Reason (optional)"
                        value={cur.note}
                        onChange={(e) =>
                          onEdit(mobileEmp, row, { note: e.target.value })
                        }
                        className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search employee..."
                className="flex-1"
                inputClassName="min-h-[44px]"
              />
              <button
                type="button"
                aria-label="Export Excel"
                onClick={() => exportOtExcel(employees, edits, month)}
                className="w-11 h-11 shrink-0 rounded-lg border border-slate-200 bg-white text-slate-600 flex items-center justify-center"
              >
                <Download size={18} />
              </button>
              <button
                type="button"
                aria-label="Import edited Excel"
                onClick={() => fileRef.current?.click()}
                className="w-11 h-11 shrink-0 rounded-lg border border-slate-200 bg-white text-slate-600 flex items-center justify-center"
              >
                <Upload size={18} />
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {mobileList.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No employees found.
                </div>
              )}
              {mobileList.map((e) => {
                const t = empTotals(e, edits);
                return (
                  <button
                    type="button"
                    key={e.employee_id}
                    onClick={() => openEmployee(e.employee_id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left border-t border-slate-100 first:border-t-0 active:bg-slate-50"
                  >
                    <span className="w-9 h-9 shrink-0 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center">
                      {initials(e.full_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-slate-800 truncate">
                          {e.full_name}
                        </span>
                        {t.editedDays > 0 && (
                          <span
                            className="w-1.5 h-1.5 shrink-0 rounded-full bg-orange-500"
                            title="Edited"
                          />
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {e.employee_code}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold ${
                        t.final > 0
                          ? "bg-green-100 text-green-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {formatH(t.final)}
                    </span>
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-slate-300"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {dirtyCount > 0 && (
          <div className="sticky bottom-3 mt-4 bg-white border border-slate-200 rounded-xl shadow-lg p-3 flex items-center gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-slate-500 leading-none">
                All staff
              </div>
              <div className="text-lg font-bold text-orange-700 leading-tight">
                {formatH(allFinal)}
              </div>
            </div>
            <button
              type="button"
              onClick={onReview || onSave}
              disabled={saving || dirtyCount === 0}
              className="flex-1 bg-brand-orange text-white text-sm font-medium px-4 min-h-[44px] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50 transition flex items-center justify-center gap-2"
            >
              <Save size={16} />
              {saving
                ? "Saving..."
                : `Save changes${dirtyCount ? ` (${dirtyCount})` : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
