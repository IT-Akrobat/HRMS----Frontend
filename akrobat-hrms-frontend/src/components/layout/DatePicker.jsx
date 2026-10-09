import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalBackClose } from "../common/usemodalbackclose";

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
  // When true, the calendar popover is rendered in a portal on <body>
  // (position: fixed) instead of inside the picker's own box. Use this
  // when the picker sits inside something that clips or scrolls its
  // content -- e.g. a Modal's `overflow-y-auto` body, where the normal
  // absolutely-positioned calendar gets cut off by the modal footer.
  // The popover opens below the field, flips ABOVE it when there is not
  // enough room underneath (typical on phones), is clamped inside the
  // viewport on every side, and scrolls internally as a last resort.
  portal = false,
  // When true there is no trigger and no popup: the calendar itself is
  // rendered right where the component is placed (always visible, in the
  // normal page flow). Use it to show the calendar INSIDE a form/modal.
  // Selecting a day calls onSelect/onChange as usual; the parent decides
  // when to hide it.
  inline = false,
  // Month to show first when there is no selected value (Date or ISO).
  defaultMonth,
  // Title shown in the mobile bottom sheet that portal mode uses on phones
  // (e.g. "From date"). Falls back to "Select date".
  sheetTitle,
  // When true, the picker switches to a compact month + year chooser
  // (a 4x3 grid of months under a year header with prev/next-year and
  // a quick year-jump list) instead of the day grid. `value`/`onChange`
  // then use a "YYYY-MM" string, matching a native <input type="month">,
  // so it's a drop-in replacement for that element.
  monthOnly = false,
  // On phones (< 640px) open the calendar as a bottom sheet (portal on
  // <body>, dimmed backdrop, back button closes it) instead of a floating
  // popover. A popover on a narrow screen is what ended up overlapping
  // the filter chips / search box underneath it (Audit Logs). Off by
  // default so every existing caller keeps its current behavior.
  sheetOnMobile = false,
  // Compact (label-less) mode only: draw the trigger as a bordered,
  // input-style box (h-9) instead of the bare icon + text link.
  bordered = false,
  // Adds a Clear / Today footer to the day calendar and, with `bordered`,
  // a small X on the trigger to clear the date.
  clearable = false,
}) {
  const [open, setOpen] = useState(false);

  // Only tracked when the bottom-sheet behavior is requested.
  const [isMobile, setIsMobile] = useState(
    () =>
      sheetOnMobile &&
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 639px)").matches,
  );
  useEffect(() => {
    if (!sheetOnMobile) return;
    const mq = window.matchMedia("(max-width: 639px)");
    const handler = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [sheetOnMobile]);
  const useSheet = sheetOnMobile && isMobile;

  // Phone back button closes the sheet instead of leaving the page.
  useModalBackClose(open && useSheet, () => setOpen(false));
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
        (selectedDate || toDate(defaultMonth) || today).getFullYear(),
        (selectedDate || toDate(defaultMonth) || today).getMonth(),
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

  // ---- Day-mode month + year chooser (tap the "October 2026" title) ----
  const [dayView, setDayView] = useState("days"); // "days" | "months"
  const [yearPageStart, setYearPageStart] = useState(
    () => today.getFullYear() - 8,
  );

  useEffect(() => {
    if (!open) {
      setYearListOpen(false);
      setDayView("days");
    }
  }, [open]);

  const containerRef = useRef(null);
  const sheetRef = useRef(null);

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

  // ---- Portal mode: smart placement (below / above / clamped) ----
  const popRef = useRef(null);
  const [portalPos, setPortalPos] = useState(null);
  const usePortal = portal && !useSheet;

  // Phones (< 640px): portal calendars dock to the bottom-right of the
  // screen (with a dim backdrop) instead of floating next to the field.
  const [isNarrow, setIsNarrow] = useState(
    () =>
      portal &&
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 639px)").matches,
  );
  useEffect(() => {
    if (!portal) return;
    const mq = window.matchMedia("(max-width: 639px)");
    const handler = (e) => setIsNarrow(e.matches);
    setIsNarrow(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [portal]);
  const portalMobile = usePortal && isNarrow;

  useLayoutEffect(() => {
    if (!open || !usePortal || portalMobile) {
      setPortalPos(null);
      return;
    }

    function place() {
      const trigger = containerRef.current;
      if (!trigger) return;
      const pop = popRef.current;
      const r = trigger.getBoundingClientRect();
      const margin = 8;
      const gap = 6;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(256, vw - margin * 2);

      // Natural (unclamped) height of the calendar.
      const naturalH = pop ? pop.scrollHeight + 2 : 330;
      const spaceBelow = vh - r.bottom - gap - margin;
      const spaceAbove = r.top - gap - margin;

      let top;
      let maxHeight;
      if (naturalH <= spaceBelow) {
        // Fits under the field.
        top = r.bottom + gap;
        maxHeight = spaceBelow;
      } else if (naturalH <= spaceAbove) {
        // Fits above the field.
        top = r.top - gap - naturalH;
        maxHeight = spaceAbove;
      } else if (spaceBelow >= spaceAbove) {
        // Fits neither side: use the roomier side and scroll inside.
        top = r.bottom + gap;
        maxHeight = Math.max(spaceBelow, 180);
      } else {
        maxHeight = Math.max(spaceAbove, 180);
        top = Math.max(margin, r.top - gap - Math.min(naturalH, maxHeight));
      }

      const left = Math.max(margin, Math.min(r.left, vw - width - margin));
      setPortalPos({ top, left, maxHeight, width });
    }

    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
    // Re-measure whenever the calendar's height can change (6-row months,
    // month/year chooser views).
  }, [
    open,
    usePortal,
    portalMobile,
    dayView,
    currentMonth,
    yearListOpen,
    pickerYear,
  ]);

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
      // The bottom sheet lives in a portal, so it is outside
      // containerRef in the DOM — treat it as "inside" too.
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target) &&
        !(sheetRef.current && sheetRef.current.contains(event.target)) &&
        !(popRef.current && popRef.current.contains(event.target))
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
  // (Skipped for the bottom sheet — it isn't anchored to the trigger, and
  // its own content shouldn't close it.)
  useEffect(() => {
    if (!open || useSheet) return;
    function handleScroll(e) {
      // Scrolling inside the calendar itself (portal mode, short screens)
      // must not close it.
      if (popRef.current && popRef.current.contains(e.target)) return;
      setOpen(false);
    }
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [open, useSheet]);

  // Lock page scroll behind the bottom sheet.
  useEffect(() => {
    if (!open || !useSheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, useSheet]);

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
        <button
          type="button"
          onClick={() => {
            setPickerYear(year);
            setYearListOpen(false);
            setDayView("months");
          }}
          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 px-2 py-1 rounded-md hover:bg-orange-50"
          aria-label="Choose month and year"
        >
          {currentMonth.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
          <ChevronDown size={14} className="text-slate-400" />
        </button>
        <button
          type="button"
          onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
          disabled={!!maxDate && new Date(year, month + 1, 1) > maxDate}
          className="p-1 rounded-md hover:bg-orange-50 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
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
              className={`${
                useSheet
                  ? "h-10 w-10 text-sm mx-auto"
                  : inline
                    ? "h-9 w-9 text-sm mx-auto"
                    : portalMobile
                      ? "h-9 w-9 text-sm mx-auto"
                      : "h-7 w-7 text-[11px]"
              } relative transition-colors ${
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

  // ---- Month + year chooser shown from the day calendar's title ----
  const dayMonthYearBody = (
    <>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() =>
            yearListOpen
              ? setYearPageStart((y) => y - 12)
              : setPickerYear((y) => y - 1)
          }
          className="p-1 rounded-md hover:bg-orange-50 text-slate-600"
          aria-label={yearListOpen ? "Earlier years" : "Previous year"}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (!yearListOpen) setYearPageStart(pickerYear - 8);
            setYearListOpen((o) => !o);
          }}
          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 px-2.5 py-1 rounded-md hover:bg-orange-50"
        >
          {yearListOpen
            ? `${yearPageStart} – ${yearPageStart + 11}`
            : pickerYear}
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform ${
              yearListOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        <button
          type="button"
          onClick={() =>
            yearListOpen
              ? setYearPageStart((y) => y + 12)
              : setPickerYear((y) => y + 1)
          }
          disabled={
            !!maxDate &&
            (yearListOpen
              ? yearPageStart + 12 > maxDate.getFullYear()
              : pickerYear >= maxDate.getFullYear())
          }
          className="p-1 rounded-md hover:bg-orange-50 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label={yearListOpen ? "Later years" : "Next year"}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {yearListOpen ? (
        <div className="grid grid-cols-4 gap-1.5 mb-1">
          {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map((yr) => {
            const yrDisabled =
              (!!maxDate && yr > maxDate.getFullYear()) ||
              (!!minDate && yr < minDate.getFullYear());
            return (
              <button
                type="button"
                key={yr}
                disabled={yrDisabled}
                onClick={() => {
                  setPickerYear(yr);
                  setYearListOpen(false);
                }}
                className={`h-9 rounded-md text-xs font-medium transition-colors ${
                  yr === pickerYear
                    ? "bg-blue-900 text-white font-bold"
                    : yrDisabled
                      ? "text-slate-300 cursor-not-allowed"
                      : yr === today.getFullYear()
                        ? "text-orange-500 font-bold hover:bg-orange-50"
                        : "text-slate-600 hover:bg-orange-50"
                }`}
              >
                {yr}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5 mb-1">
          {MONTH_NAMES.map((m, i) => {
            const mStart = new Date(pickerYear, i, 1);
            const mEnd = new Date(pickerYear, i + 1, 0);
            const mDisabled =
              (!!maxDate && mStart > maxDate) || (!!minDate && mEnd < minDate);
            const isShown = year === pickerYear && month === i;
            const isCurrent =
              today.getFullYear() === pickerYear && today.getMonth() === i;
            return (
              <button
                type="button"
                key={m}
                disabled={mDisabled}
                onClick={() => {
                  setCurrentMonth(new Date(pickerYear, i, 1));
                  setDayView("days");
                }}
                className={`h-9 rounded-md text-xs font-medium transition-colors ${
                  isShown
                    ? "bg-blue-900 text-white font-bold"
                    : mDisabled
                      ? "text-slate-300 cursor-not-allowed"
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
    </>
  );

  function clearDate() {
    onChange?.("");
    onSelect?.(null);
    setOpen(false);
  }

  function pickToday() {
    const now = new Date();
    if (
      isDisabled(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    ) {
      return;
    }
    onSelect?.(now);
    onChange?.(toIso(now));
    setOpen(false);
  }

  const dayFooter =
    clearable && !monthOnly ? (
      <div className="flex items-center justify-between pt-2 mt-3 border-t border-slate-100 text-xs font-semibold">
        <button
          type="button"
          onClick={clearDate}
          disabled={!selectedDate}
          className="text-blue-700 hover:underline disabled:opacity-40 disabled:no-underline"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={pickToday}
          className="text-blue-700 hover:underline"
        >
          Today
        </button>
      </div>
    ) : null;

  const popoverBody = monthOnly ? (
    monthYearBody
  ) : (
    <>
      {dayView === "months" ? dayMonthYearBody : calendarBody}
      {dayFooter}
    </>
  );

  const calendarPopover =
    open &&
    (useSheet ? (
      createPortal(
        <div className="fixed inset-0 z-[100] flex items-end">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={monthOnly ? "Select month" : "Select date"}
            className="relative w-full bg-white rounded-t-2xl shadow-xl border-t border-slate-200 px-5 pt-2.5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          >
            <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-2" />
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-slate-800">
                {label || (monthOnly ? "Select month" : "Select date")}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg p-1.5 -mr-1.5"
              >
                <X size={18} />
              </button>
            </div>
            {popoverBody}
          </div>
        </div>,
        document.body,
      )
    ) : portalMobile ? (
      createPortal(
        // Centered popup. It does NOT touch browser history (unlike
        // sheetOnMobile), so it is safe on top of a Modal that already
        // manages the back button.
        <div
          ref={popRef}
          className="fixed inset-0 z-[110] flex items-center justify-center p-5"
        >
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              sheetTitle || (monthOnly ? "Select month" : "Select date")
            }
            className="relative w-full max-w-[20rem] bg-white rounded-2xl shadow-xl border border-slate-200 p-4 overflow-y-auto overscroll-contain"
            style={{ maxHeight: "100%" }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">
                {sheetTitle || (monthOnly ? "Select month" : "Select date")}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg p-1 -mr-1"
              >
                <X size={16} />
              </button>
            </div>
            {popoverBody}
          </div>
        </div>,
        document.body,
      )
    ) : usePortal ? (
      createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label={monthOnly ? "Select month" : "Select date"}
          className="fixed bg-white rounded-xl border border-slate-200 shadow-lg p-4 z-[110] overflow-y-auto overscroll-contain"
          style={{
            top: portalPos ? portalPos.top : 0,
            left: portalPos ? portalPos.left : 0,
            width: portalPos ? portalPos.width : 256,
            maxHeight: portalPos ? portalPos.maxHeight : undefined,
            // Hidden for the single frame it takes to measure + place it,
            // so it never flashes in the wrong spot.
            visibility: portalPos ? "visible" : "hidden",
          }}
        >
          {popoverBody}
        </div>,
        document.body,
      )
    ) : overlay && overlayPos ? (
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

  // ---------------- Inline mode (calendar shown in place) ----------------
  if (inline) {
    return (
      <div
        className={`bg-white rounded-xl border border-slate-200 p-3 ${className}`}
      >
        {popoverBody}
      </div>
    );
  }

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

  // ---------------- Compact bordered (input-style) trigger ----------------
  if (bordered) {
    const showClear = clearable && !!selectedDate;
    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`w-full h-9 flex items-center gap-2 pl-3 ${
            showClear ? "pr-9" : "pr-3"
          } border rounded-lg bg-white text-sm text-left transition-colors ${
            selectedDate
              ? "border-orange-400 text-slate-700"
              : "border-slate-200 text-slate-500 hover:border-slate-300"
          } ${open ? "ring-2 ring-orange-200" : ""}`}
        >
          <Calendar
            size={15}
            className={`shrink-0 ${
              selectedDate ? "text-orange-500" : "text-slate-400"
            }`}
          />
          <span className="truncate">{displayLabel}</span>
        </button>
        {showClear && (
          <button
            type="button"
            title="Clear date"
            aria-label="Clear date"
            onClick={clearDate}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X size={13} />
          </button>
        )}
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
