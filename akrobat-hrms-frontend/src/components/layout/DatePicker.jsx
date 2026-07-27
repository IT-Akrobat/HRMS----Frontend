// import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
// import { useEffect, useRef, useState } from "react";

// export default function DatePicker() {
//     const [open, setOpen] = useState(false);

//     const today = new Date();

//     const [selectedDate, setSelectedDate] = useState(null);

//     const [currentMonth, setCurrentMonth] = useState(
//         new Date(today.getFullYear(), today.getMonth(), 1),
//     );

//     const calendarRef = useRef(null);

//     const year = currentMonth.getFullYear();

//     const month = currentMonth.getMonth();

//     const daysInMonth = new Date(year, month + 1, 0).getDate();

//     const firstDay = new Date(year, month, 1).getDay();

//     useEffect(() => {
//         const handleOutside = (event) => {
//             if (calendarRef.current && !calendarRef.current.contains(event.target)) {
//                 setOpen(false);
//             }
//         };

//         document.addEventListener("mousedown", handleOutside);

//         return () => {
//             document.removeEventListener("mousedown", handleOutside);
//         };
//     }, []);

//     const previousMonth = () => {
//         setCurrentMonth(new Date(year, month - 1, 1));
//     };

//     const nextMonth = () => {
//         setCurrentMonth(new Date(year, month + 1, 1));
//     };

//     const selectDate = (day) => {
//         const date = new Date(year, month, day);

//         setSelectedDate(date);

//         setOpen(false);
//     };

//     return (
//         <div ref={calendarRef} className="relative">
//             <button
//                 onClick={() => setOpen(!open)}
//                 className="
//                     flex
//                     items-center
//                     gap-2
//                     text-sm
//                     text-slate-600
//                     hover:text-orange-500
//                 "
//             >
//                 <Calendar size={17} />

//                 <div
//                     className="
//                     hidden
//                     lg:flex
//                     items-center
//                     gap-2
//                 "
//                 >
//                     {selectedDate ? (
//                         <>
//                             <span className="font-medium">
//                                 {selectedDate.toLocaleDateString("en-US", {
//                                     month: "long",
//                                     day: "2-digit",
//                                 })}
//                             </span>

//                             <span className="text-slate-300">|</span>

//                             <span>
//                                 {selectedDate.toLocaleDateString("en-US", {
//                                     weekday: "long",
//                                 })}
//                             </span>
//                         </>
//                     ) : (
//                         <span className="text-slate-400">Select Date</span>
//                     )}
//                 </div>
//             </button>

//             {open && (
//                 <div
//                     className="
//                         absolute
//                         top-full
//                         mt-2
//                         right-0
//                         w-64
//                         bg-white
//                         rounded-xl
//                         border
//                         border-slate-200
//                         shadow-lg
//                         p-4
//                         z-50
//                     "
//                 >
//                     {/* Header */}

//                     <div
//                         className="
//                             flex
//                             items-center
//                             justify-between
//                             mb-4
//                         "
//                     >
//                         <button
//                             onClick={previousMonth}
//                             className="
//                                 p-1
//                                 rounded-md
//                                 hover:bg-orange-50
//                                 text-slate-600
//                             "
//                         >
//                             <ChevronLeft size={16} />
//                         </button>

//                         <h3
//                             className="
//                                 text-sm
//                                 font-semibold
//                                 text-slate-700
//                             "
//                         >
//                             {currentMonth.toLocaleDateString("en-US", {
//                                 month: "long",
//                                 year: "numeric",
//                             })}
//                         </h3>

//                         <button
//                             onClick={nextMonth}
//                             className="
//                                 p-1
//                                 rounded-md
//                                 hover:bg-orange-50
//                                 text-slate-600
//                             "
//                         >
//                             <ChevronRight size={16} />
//                         </button>
//                     </div>

//                     {/* Week */}

//                     <div
//                         className="
//                             grid
//                             grid-cols-7
//                             mb-2
//                             text-[11px]
//                             font-bold
//                             text-blue-900
//                         "
//                     >
//                         {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
//                             <span key={index} className="text-center">
//                                 {day}
//                             </span>
//                         ))}
//                     </div>

//                     {/* Dates */}

//                     <div
//                         className="
//                             grid
//                             grid-cols-7
//                             gap-1
//                         "
//                     >
//                         {Array.from({
//                             length: firstDay,
//                         }).map((_, i) => (
//                             <span key={i} />
//                         ))}

//                         {Array.from(
//                             {
//                                 length: daysInMonth,
//                             },
//                             (_, i) => i + 1,
//                         ).map((day) => {
//                             const isToday =
//                                 day === today.getDate() &&
//                                 month === today.getMonth() &&
//                                 year === today.getFullYear();

//                             const isSelected =
//                                 selectedDate &&
//                                 day === selectedDate.getDate() &&
//                                 month === selectedDate.getMonth() &&
//                                 year === selectedDate.getFullYear();

//                             return (
//                                 <button
//                                     key={day}
//                                     onClick={() => selectDate(day)}
//                                     className={`
//                                         h-7
//                                         w-7
//                                         rounded-md
//                                         text-[11px]
//                                         relative

//                                         ${isSelected
//                                             ? "bg-blue-900 text-white font-bold"
//                                             : isToday
//                                                 ? "text-orange-500 font-bold"
//                                                 : "text-slate-600 hover:bg-orange-50"
//                                         }

//                                     `}
//                                 >
//                                     {day}

//                                     {isToday && !isSelected && (
//                                         <span
//                                             className="
//                                                     absolute
//                                                     bottom-0.5
//                                                     left-1/2
//                                                     -translate-x-1/2
//                                                     w-1
//                                                     h-1
//                                                     rounded-full
//                                                     bg-orange-500
//                                                 "
//                                         />
//                                     )}
//                                 </button>
//                             );
//                         })}
//                     </div>
//                 </div>
//             )}
//         </div>
//     );
// }
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();

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

  const containerRef = useRef(null);

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

  const displayLabel = selectedDate
    ? selectedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
    : placeholder;

  const calendarPopover = open && (
    <div className="absolute top-full mt-2 left-0 w-64 bg-white rounded-xl border border-slate-200 shadow-lg p-4 z-50">
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

          return (
            <button
              type="button"
              key={day}
              onClick={() => selectDate(day)}
              disabled={disabled}
              className={`h-7 w-7 rounded-md text-[11px] relative transition-colors ${
                isSelected
                  ? "bg-blue-900 text-white font-bold"
                  : disabled
                    ? "text-slate-300 cursor-not-allowed"
                    : isToday
                      ? "text-orange-500 font-bold hover:bg-orange-50"
                      : "text-slate-600 hover:bg-orange-50"
              }`}
            >
              {day}
              {isToday && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

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
          <span className={selectedDate ? "text-slate-700" : "text-slate-400"}>
            {displayLabel}
          </span>
          <Calendar size={15} className="text-slate-400 shrink-0" />
        </button>
        {error && <p className="text-xs text-orange-500 mt-1">{error}</p>}
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
