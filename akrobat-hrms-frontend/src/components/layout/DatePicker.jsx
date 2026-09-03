import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------
// Controlled, dual-mode date picker.
//
// Two call shapes are used across the app:
//   1. Compact / icon-trigger mode — AttendanceHistory.jsx's date range
//      box: <DatePicker value={Date} onSelect={(date) => ...} />
//   2. Labeled field mode — LeaveApply.jsx's form fields:
//      <DatePickerField label required min="2026-07-01" value="2026-07-10"
//        onChange={(isoStr) => ...} error="..." />
//
// Which mode renders is decided by whether a `label` prop is passed.
// `value`/`min`/`max` accept either a Date instance or a "YYYY-MM-DD"
// string so both call sites work without extra glue code. Field mode
// reports selections back as an ISO date string (onChange); compact mode
// reports back a Date instance (onSelect), matching what each caller
// already expects.
// ---------------------------------------------------------------------

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const d = new Date(`${value}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function toIso(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sameDay(a, b) {
  return (
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ---- Month-only ("YYYY-MM") helpers, used by the monthOnly picker mode ----
const MONTH_NAMES = [
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

function toMonthStr(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthStrToDate(value) {
  if (!value) return null;
  const [y, m] = String(value).split("-").map(Number);
  if (!y || !m) return null;
  const d = new Date(y, m - 1, 1);
  return isNaN(d.getTime()) ? null : d;
}

export default function DatePicker({
  value,
  onSelect,
  onChange,
  label,
  required = false,
  min,
  max,
  error,
  placeholder = "Select date",
  className = "",
  // Dates that already have an APPROVED leave on them -- shown as a
  // rounded orange highlight so the employee can see at a glance which
  // days are already booked before picking new ones. Accepts Date
  // instances or "YYYY-MM-DD" strings (same flexibility as value/min/max).
  highlightedDates = [],
  // When true, the calendar opens fixed to the viewport (position
  // computed from the trigger's own on-screen position) instead of a
  // small dropdown absolutely positioned inside its own box. It still
  // renders directly below the trigger — just not clipped/squeezed by a
  // narrow parent (e.g. two side-by-side date fields on mobile), so the
  // ~256px-wide calendar can't spill sideways and overlap neighboring
  // controls.
  overlay = false,
  // When true, the picker switches to a compact month + year chooser
  // (a 4x3 grid of months under a year header with prev/next-year and
  // a quick year-jump list) instead of the day grid. `value`/`onChange`
  // then use a "YYYY-MM" string, matching a native <input type="month">,
  // so it's a drop-in replacement for that element.
  monthOnly = false,
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();

  // Normalized once per render into a Set of "YYYY-MM-DD" strings for an
  // O(1) lookup per calendar cell instead of re-scanning the array 42
  // times (once per grid cell) on every render.
  const highlightedSet = new Set(
    (highlightedDates || []).map((d) => toIso(toDate(d))).filter(Boolean),
  );

  const selectedDate = toDate(value);
  const minDate = toDate(min);
  const maxDate = toDate(max);

  const [currentMonth, setCurrentMonth] = useState(
    () =>
      new Date(
        (selectedDate || today).getFullYear(),
        (selectedDate || today).getMonth(),
        1,
      ),
  );

  // ---- monthOnly mode state: which year the month grid is showing, and
  // whether the "jump to a different year" list is open. ----
  const selectedMonthDate = monthOnly ? monthStrToDate(value) : null;
  const [pickerYear, setPickerYear] = useState(() =>
    (selectedMonthDate || today).getFullYear(),
  );
  const [yearListOpen, setYearListOpen] = useState(false);

  useEffect(() => {
    if (!monthOnly) return;
    if (selectedMonthDate) setPickerYear(selectedMonthDate.getFullYear());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOnly, value]);

  useEffect(() => {
    if (!open) setYearListOpen(false);
  }, [open]);

  const containerRef = useRef(null);

  // Where the overlay-mode popover renders (fixed to the viewport, right
  // below the trigger) — computed fresh each time it opens so it always
  // sits directly under the field it belongs to instead of a fixed
  // "float near the top of the screen" spot that can land on top of the
  // field itself. Clamped so a 256px-wide calendar never runs off the
  // right edge of a narrow phone screen.
  const [overlayPos, setOverlayPos] = useState(null);

  useLayoutEffect(() => {
    if (!open || !overlay || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const calendarWidth = 256;
    const left = Math.min(
      rect.left,
      Math.max(8, window.innerWidth - calendarWidth - 8),
    );
    setOverlayPos({ top: rect.bottom + 8, left });
  }, [open, overlay]);

  // Keep the visible month in sync if the controlled value changes from
  // outside (e.g. clearing the field, or a linked "To Date" resetting).
  useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(
        new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    function handleOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Close any open popover on scroll — for the overlay mode this avoids a
  // stale `position: fixed` calendar that was positioned once (from the
  // trigger's on-screen rect) at the moment it opened, then stays put while
  // the trigger moves under it as the page scrolls. For the absolute-mode
  // popovers it just means the calendar doesn't stay open while its trigger
  // scrolls out of view. Capture phase so this also fires for scrolls
  // inside a nested scrollable container (e.g. a card list), not just
  // window scroll.
  useEffect(() => {
    if (!open) return;
    function handleScroll() {
      setOpen(false);
    }
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [open]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  function isDisabled(date) {
    if (
      minDate &&
      date <
        new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())
    ) {
      return true;
    }
    if (
      maxDate &&
      date >
        new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())
    ) {
      return true;
    }
    return false;
  }

  function selectDate(day) {
    const date = new Date(year, month, day);
    if (isDisabled(date)) return;
    onSelect?.(date);
    onChange?.(toIso(date));
    setOpen(false);
  }

  function selectMonth(monthIndex) {
    const date = new Date(pickerYear, monthIndex, 1);
    onChange?.(toMonthStr(date));
    onSelect?.(date);
    setOpen(false);
  }

  function clearMonth() {
    onChange?.("");
    onSelect?.(null);
    setOpen(false);
  }

  function selectThisMonth() {
    const now = new Date();
    setPickerYear(now.getFullYear());
    onChange?.(toMonthStr(now));
    onSelect?.(now);
    setOpen(false);
  }

  const displayLabel = monthOnly
    ? selectedMonthDate
      ? selectedMonthDate.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : placeholder
    : selectedDate
      ? selectedDate.toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        })
      : placeholder;

  const calendarBody = (
    <>
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
          className="p-1 rounded-md hover:bg-orange-50 text-slate-600"
        >
          <ChevronLeft size={16} />
        </button>
        <h3 className="text-sm font-semibold text-slate-700">
          {currentMonth.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </h3>
        <button
          type="button"
          onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
          className="p-1 rounded-md hover:bg-orange-50 text-slate-600"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-2 text-[11px] font-bold text-blue-900">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="text-center">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => (
          <span key={`pad-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const date = new Date(year, month, day);
          const isToday = sameDay(date, today);
          const isSelected = sameDay(date, selectedDate);
          const disabled = isDisabled(date);
          const isApproved = highlightedSet.has(toIso(date));

          return (
            <button
              type="button"
              key={day}
              onClick={() => selectDate(day)}
              disabled={disabled}
              title={isApproved ? "Already approved leave" : undefined}
              className={`h-7 w-7 text-[11px] relative transition-colors ${
                isApproved ? "rounded-full" : "rounded-md"
              } ${
                isSelected
                  ? "bg-blue-900 text-white font-bold"
                  : disabled
                    ? isApproved
                      ? "bg-orange-100 text-orange-400 cursor-not-allowed"
                      : "text-slate-300 cursor-not-allowed"
                    : isApproved
                      ? "bg-orange-100 text-orange-700 font-bold ring-1 ring-orange-400 hover:bg-orange-200"
                      : isToday
                        ? "text-orange-500 font-bold hover:bg-orange-50"
                        : "text-slate-600 hover:bg-orange-50"
              }`}
            >
              {day}
              {isToday && !isSelected && !isApproved && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-500" />
              )}
            </button>
          );
        })}
      </div>
    </>
  );

  // ---- Month + year picker body (monthOnly mode) ----
  const monthYearBody = (
    <>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setPickerYear((y) => y - 1)}
          className="p-1 rounded-md hover:bg-orange-50 text-slate-600"
          aria-label="Previous year"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => setYearListOpen((o) => !o)}
          className="text-sm font-semibold text-slate-700 px-2.5 py-1 rounded-md hover:bg-orange-50"
        >
          {pickerYear}
        </button>
        <button
          type="button"
          onClick={() => setPickerYear((y) => y + 1)}
          className="p-1 rounded-md hover:bg-orange-50 text-slate-600"
          aria-label="Next year"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {yearListOpen ? (
        <div className="grid grid-cols-4 gap-1.5 mb-3 max-h-40 overflow-y-auto">
          {Array.from(
            { length: 12 },
            (_, i) => today.getFullYear() - 6 + i,
          ).map((yr) => (
            <button
              type="button"
              key={yr}
              onClick={() => {
                setPickerYear(yr);
                setYearListOpen(false);
              }}
              className={`h-8 rounded-md text-xs font-medium transition-colors ${
                yr === pickerYear
                  ? "bg-blue-900 text-white font-bold"
                  : yr === today.getFullYear()
                    ? "text-orange-500 font-bold hover:bg-orange-50"
                    : "text-slate-600 hover:bg-orange-50"
              }`}
            >
              {yr}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {MONTH_NAMES.map((m, i) => {
            const isSelected =
              selectedMonthDate &&
              selectedMonthDate.getFullYear() === pickerYear &&
              selectedMonthDate.getMonth() === i;
            const isCurrent =
              today.getFullYear() === pickerYear && today.getMonth() === i;
            return (
              <button
                type="button"
                key={m}
                onClick={() => selectMonth(i)}
                className={`h-9 rounded-md text-xs font-medium transition-colors ${
                  isSelected
                    ? "bg-blue-900 text-white font-bold"
                    : isCurrent
                      ? "text-orange-500 font-bold hover:bg-orange-50"
                      : "text-slate-600 hover:bg-orange-50"
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-semibold">
        <button
          type="button"
          onClick={clearMonth}
          className="text-blue-700 hover:underline"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={selectThisMonth}
          className="text-blue-700 hover:underline"
        >
          This month
        </button>
      </div>
    </>
  );

  const popoverBody = monthOnly ? monthYearBody : calendarBody;

  const calendarPopover =
    open &&
    (overlay && overlayPos ? (
      <div
        className="fixed w-64 max-w-[calc(100vw-1rem)] bg-white rounded-xl border border-slate-200 shadow-lg p-4 z-50"
        style={{ top: overlayPos.top, left: overlayPos.left }}
      >
        {popoverBody}
      </div>
    ) : (
      <div className="absolute top-full mt-2 left-0 w-64 bg-white rounded-xl border border-slate-200 shadow-lg p-4 z-50">
        {popoverBody}
      </div>
    ));

  // ---------------- Field mode (labeled, bordered box) ----------------
  if (label) {
    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">
          {label} {required && <span className="text-orange-500">*</span>}
        </label>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`w-full flex items-center justify-between gap-2 border rounded-lg px-3 py-2.5 text-sm text-left transition-colors ${
            error
              ? "border-orange-300 focus:ring-2 focus:ring-orange-200"
              : "border-slate-200 hover:border-slate-300"
          } ${open ? "ring-2 ring-orange-200 border-orange-400" : ""}`}
        >
          <span
            className={
              (monthOnly ? selectedMonthDate : selectedDate)
                ? "text-slate-700"
                : "text-slate-400"
            }
          >
            {displayLabel}
          </span>
          <Calendar size={15} className="text-slate-400 shrink-0" />
        </button>
        {error && <p className="text-xs text-orange-500 mt-1">{error}</p>}
        {calendarPopover}
      </div>
    );
  }

  // ---------------- Compact bordered mode (monthOnly, no label) ----------------
  // Same box styling as a native <input>, so this drops in wherever a
  // plain <input type="month"> used to sit.
  if (monthOnly) {
    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm text-left transition-colors border-slate-200 hover:border-slate-300 ${
            open ? "ring-2 ring-orange-200 border-orange-400" : ""
          }`}
        >
          <span
            className={selectedMonthDate ? "text-slate-700" : "text-slate-400"}
          >
            {displayLabel}
          </span>
          <Calendar size={14} className="text-slate-400 shrink-0" />
        </button>
        {calendarPopover}
      </div>
    );
  }

  // ---------------- Compact icon-trigger mode ----------------
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-orange-500 transition-colors"
      >
        <Calendar size={14} className="text-slate-400" />
        <span
          className={
            selectedDate ? "font-medium text-slate-700" : "text-slate-400"
          }
        >
          {displayLabel}
        </span>
      </button>
      {calendarPopover}
    </div>
  );
}
