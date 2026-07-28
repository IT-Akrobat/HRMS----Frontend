import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  History,
  Info,
  TimerReset,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/common/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../services/apiClient";
import { toLocalISODate } from "../../utils/date";
import { isFieldEmployee } from "../../utils/employeeType";
// ---------------------------------------------------------------------
// Same GET /attendance/timeline/{date} + check-in/break-start/break-end/
// check-out endpoints used by CheckInOutCard.jsx — reimplemented here
// (rather than dropping CheckInOutCard in as-is) because this page needs
// the exact "Today's Status" / "Today's Timeline" layout from the design,
// not the generic card. Geolocation is intentionally skipped: per
// CheckInOutCard's own notes, the backend only enforces the geofence when
// a location_id is sent, so a plain check-in/out call is safe here.
//
// "Attendance Calendar" pulls the month's rows from GET /attendance/my
// (same contract as AttendanceHistory.jsx) to color each day's dot.
//
// Clicking a day in the calendar re-fetches GET /attendance/timeline/{date}
// for that date and swaps it into "Summary" / "Timeline" below (renamed
// from "Today's Summary" / "Today's Timeline" once a non-today date is
// selected) — the endpoint already supports any date, not just today, so
// no backend change was needed for this, just wiring the click through.
//
// Layout: Attendance Calendar, Summary, and Timeline all sit in a single
// row of 3 columns. CheckInOutCard / SiteVisitCard / Shift & Location are
// intentionally left commented out below rather than removed, so they're
// easy to bring back later without reconstructing them from scratch.
// ---------------------------------------------------------------------

// Fallback only — real values now come from `dayData.shift`
// (GET /attendance/timeline/{date}), which resolves the employee's actual
// shift (Office / Operation Site / Inspection Site / Work Shop, weekday
// vs Saturday) per sql/003_attendance_info_seed.sql. See formatShiftTime /
// formatShiftHours below.
const SHIFT_START_LABEL = "--:--";
const SHIFT_END_LABEL = "--:--";
const SHIFT_HOURS_LABEL = "--";

function formatShiftTime(hhmm) {
  if (!hhmm) return null;
  const [hh, mm] = String(hhmm).split(":").map(Number);
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatShiftHours(hours) {
  if (hours == null) return null;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

const DOT_COLOR = {
  Present: "bg-green-500",
  Absent: "bg-red-500",
  "Half Day": "bg-amber-500",
  "Weekly Off": "bg-slate-300",
  "On Leave": "bg-blue-500",
};

function todayIso() {
  return toLocalISODate();
}

function formatTime(iso) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(minutes) {
  if (minutes == null) return "--";
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

function formatShortDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Attendance() {
  const { user } = useAuth();
  const isFieldStaff = isFieldEmployee(user);

  // The date currently shown in the "Summary" / "Timeline" panels below —
  // defaults to today, but changes when a calendar day is clicked.
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [dayData, setDayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [monthRows, setMonthRows] = useState([]);
  const [monthEndpointMissing, setMonthEndpointMissing] = useState(false);

  function loadDay(dateStr) {
    setLoading(true);
    setError(null);
    apiClient
      .get(`/attendance/timeline/${dateStr}`)
      .then((res) => setDayData(res.data ?? null))
      .catch((err) => {
        setDayData(null);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }

  function loadMonth(cursor) {
    const start = toLocalISODate(
      new Date(cursor.getFullYear(), cursor.getMonth(), 1),
    );
    const end = toLocalISODate(
      new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0),
    );
    apiClient
      .get(`/attendance/my?from_date=${start}&to_date=${end}`)
      .then((res) => {
        setMonthRows(res.data || []);
        setMonthEndpointMissing(false);
      })
      .catch((err) => {
        setMonthRows([]);
        if (err.status === 404) setMonthEndpointMissing(true);
      });
  }

  useEffect(() => {
    loadDay(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    loadMonth(monthCursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthCursor]);

  function selectDate(dateStr) {
    setSelectedDate(dateStr);
  }

  async function runAction(path) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(path, {});
      loadDay(todayIso());
      loadMonth(monthCursor);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isViewingToday = selectedDate === todayIso();
  const checkedIn = !!dayData?.check_in_time;
  const checkedOut = !!dayData?.check_out_time;

  const shiftStartLabel =
    formatShiftTime(dayData?.shift?.start_time) || SHIFT_START_LABEL;
  const shiftEndLabel =
    formatShiftTime(dayData?.shift?.end_time) || SHIFT_END_LABEL;
  const shiftHoursLabel =
    formatShiftHours(dayData?.shift?.working_hours) || SHIFT_HOURS_LABEL;
  const shiftNameLabel = dayData?.shift?.shift_name || "General Shift";
  const onBreak =
    (dayData?.breaks || []).length > 0 &&
    !dayData.breaks[dayData.breaks.length - 1]?.break_end;

  const statusLabel = checkedOut
    ? "Checked Out"
    : checkedIn
      ? "Present"
      : dayData?.status || "Not Checked In";

  // ---------- calendar grid ----------
  const rowsByDate = useMemo(() => {
    const map = {};
    monthRows.forEach((r) => {
      map[r.date] = r.status;
    });
    return map;
  }, [monthRows]);

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  return (
    <div>
      <PageHeader
        title="My Attendance"
        subtitle="Track your daily attendance and working hours."
        actions={
          <Link
            to="/employee/attendance/history"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-lg"
          >
            <History size={15} /> View History
          </Link>
        }
      />

      {error && (
        <div className="mb-4 text-sm text-orange-500 bg-orange-50 border border-orange-100 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Calendar, Summary, and Timeline all in a single row of 3
          columns — previously the calendar sat alone in its own row
          (with CheckInOutCard/SiteVisitCard commented out, leaving 1-2
          empty grid cells beside it) and Summary/Timeline were in a
          second row below. Merged into one grid so all three sit
          side-by-side. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CheckInOutCard keeps its own "today" state for the check-in/out
            button widget, but the Summary panel and calendar below read from
            this page's own dayData/monthRows state. Without this callback,
            checking out here updated the card itself but left the Summary
            panel (Working Hours, Early Checkout, etc.) showing stale data
            until a manual page refresh. onActivityChange fires right after
            every check-in/break/check-out call succeeds, so we just reload
            whatever this page is currently showing. */}
        {/* <CheckInOutCard
          onActivityChange={() => {
            if (isViewingToday) {
              loadDay(todayIso());
            }
            loadMonth(monthCursor);
          }}
        /> */}

        {/* Only for Inspection/Operation field staff — office employees
            have one fixed workplace, so a "which site am I at" card isn't
            relevant and the page reverts to the plain 2-column layout
            above instead of leaving an empty third slot. */}
        {/* {isFieldStaff && isViewingToday && (
          <SiteVisitCard
            checkedIn={checkedIn}
            checkedOut={checkedOut}
            onActivityChange={() => loadDay(todayIso())}
          />
        )} */}

        {/* ---------- Attendance Calendar ---------- */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">
              Attendance Calendar
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMonthCursor(new Date(year, month - 1, 1))}
                className="p-1 rounded-md hover:bg-orange-50 text-slate-600"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-xs font-medium text-slate-600 w-20 text-center">
                {monthCursor.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <button
                onClick={() => setMonthCursor(new Date(year, month + 1, 1))}
                className="p-1 rounded-md hover:bg-orange-50 text-slate-600"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 mb-2 text-[10px] font-bold text-blue-900 text-center">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-2 text-center">
            {Array.from({ length: firstDay }).map((_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const status = rowsByDate[dateStr];
              const isToday = dateStr === todayIso();
              const isSelected = dateStr === selectedDate;
              const isFuture = dateStr > todayIso();
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => !isFuture && selectDate(dateStr)}
                  disabled={isFuture}
                  title={isFuture ? undefined : `View summary for ${dateStr}`}
                  className="flex flex-col items-center gap-0.5 group disabled:cursor-not-allowed"
                >
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-xs transition-colors ${
                      isToday
                        ? "bg-blue-600 text-white font-semibold"
                        : isFuture
                          ? "text-slate-300"
                          : "text-slate-600 group-hover:bg-orange-50"
                    } ${
                      isSelected && !isToday
                        ? "ring-2 ring-orange-400 ring-offset-1"
                        : ""
                    } ${isSelected && isToday ? "ring-2 ring-blue-300 ring-offset-1" : ""}`}
                  >
                    {day}
                  </span>
                  <span
                    className={`w-1 h-1 rounded-full ${
                      DOT_COLOR[status] || "bg-transparent"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {monthEndpointMissing && (
            <p className="text-xs text-slate-400 mt-3">
              Attendance history for this month isn't available yet.
            </p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" /> Present
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Absent
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Half Day
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-300" /> Weekly Off
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> On Leave
            </span>
          </div>
        </div>

        {/* ---------- Summary (today, or whichever date is selected) ---------- */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">
              {isViewingToday ? "Today's Summary" : "Summary"}
            </h3>
            <div className="flex items-center gap-2">
              {!isViewingToday && (
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  {formatShortDate(selectedDate)}
                </span>
              )}
              {!isViewingToday && (
                <button
                  onClick={() => selectDate(todayIso())}
                  className="text-[11px] font-medium text-orange-600 hover:text-orange-700"
                >
                  Back to Today
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-4 bg-slate-100 rounded" />
              ))}
            </div>
          ) : !dayData && !isViewingToday ? (
            <div className="text-sm text-slate-400 py-6 text-center">
              No attendance record for {formatShortDate(selectedDate)}.
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock size={15} className="text-blue-500" /> Working Hours
                  </span>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-800">
                      {formatDuration(dayData?.working_minutes)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      of {shiftHoursLabel}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-slate-600">
                    <Coffee size={15} className="text-purple-500" /> Break Time
                  </span>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-800">
                      {formatDuration(dayData?.break_minutes)}
                    </div>
                    <div className="text-[11px] text-slate-400">of 01h 00m</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-slate-600">
                    <TimerReset size={15} className="text-orange-500" />{" "}
                    Expected Check Out
                  </span>
                  <div className="text-sm font-semibold text-slate-800">
                    {shiftEndLabel}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-slate-600">
                    <AlertTriangle size={15} className="text-amber-500" /> Late
                    Arrival
                  </span>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-800">
                      {dayData?.late_minutes
                        ? formatDuration(dayData.late_minutes)
                        : "00h 00m"}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {dayData?.late_minutes
                        ? `checked in after ${shiftStartLabel}`
                        : "on time"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-slate-600">
                    <TimerReset size={15} className="text-red-500" /> Early
                    Checkout
                  </span>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-800">
                      {dayData?.early_checkout_minutes
                        ? formatDuration(dayData.early_checkout_minutes)
                        : "00h 00m"}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {dayData?.early_checkout_minutes
                        ? checkedOut
                          ? `checked out before ${shiftEndLabel}`
                          : "short so far"
                        : checkedOut
                          ? "on time"
                          : "--"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock size={15} className="text-slate-400" /> Overtime
                  </span>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-400">
                      {dayData?.overtime_minutes
                        ? formatDuration(dayData.overtime_minutes)
                        : "--"}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {dayData?.overtime_minutes
                        ? `checked out after ${shiftEndLabel}`
                        : "No overtime"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 mt-4">
                <Info size={14} className="shrink-0 mt-0.5" />
                {isViewingToday
                  ? checkedOut
                    ? "Day complete. See you tomorrow!"
                    : checkedIn
                      ? "You are on time. Great going!"
                      : "Don't forget to check in for today."
                  : checkedOut
                    ? "Day complete."
                    : checkedIn
                      ? "Checked in, no check-out recorded."
                      : `Status: ${dayData?.status || "No record"}.`}
              </div>
            </>
          )}
        </div>

        {/* ---------- Timeline (today, or whichever date is selected) ---------- */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">
              {isViewingToday ? "Today's Timeline" : "Timeline"}
            </h3>
            {!isViewingToday && (
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {formatShortDate(selectedDate)}
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-4 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 bg-slate-100 rounded" />
              ))}
            </div>
          ) : !dayData ? (
            <div className="text-sm text-slate-400 py-6 text-center">
              {isViewingToday
                ? "No check-in recorded yet today."
                : `No attendance record for ${formatShortDate(selectedDate)}.`}
            </div>
          ) : (
            <>
              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      checkedIn ? "bg-green-500" : "bg-slate-200"
                    }`}
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-700">
                        {checkedIn
                          ? `${formatTime(dayData?.check_in_time)} Checked In`
                          : "Not Checked In"}
                      </div>
                      <div className="text-xs text-slate-400">
                        Office - Main Entrance
                      </div>
                    </div>
                    {checkedIn && (
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          dayData?.late_minutes
                            ? "bg-amber-50 text-amber-600"
                            : "bg-green-50 text-green-600"
                        }`}
                      >
                        {dayData?.late_minutes ? "Late" : "On Time"}
                      </span>
                    )}
                  </div>
                </li>

                {(dayData?.breaks || []).map((b, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <div className="flex-1 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-slate-700">
                          {formatTime(b.break_start)} Break Started
                        </div>
                        <div className="text-xs text-slate-400">
                          {b.break_end
                            ? `Ended ${formatTime(b.break_end)}`
                            : "In progress"}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}

                <li className="flex items-center gap-3">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      checkedOut ? "bg-slate-500" : "bg-slate-200"
                    }`}
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-700">
                        Check Out
                      </div>
                      <div className="text-xs text-slate-400">
                        {checkedOut
                          ? formatTime(dayData?.check_out_time)
                          : "Yet to Check Out"}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        checkedOut
                          ? "bg-slate-100 text-slate-500"
                          : "bg-orange-50 text-orange-500"
                      }`}
                    >
                      {checkedOut ? "Done" : "Pending"}
                    </span>
                  </div>
                </li>
              </ul>

              {isViewingToday && !checkedOut && checkedIn && (
                <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 mt-4">
                  <Info size={14} className="shrink-0 mt-0.5" />
                  Please remember to check out at the end of your working hours.
                </div>
              )}
            </>
          )}
        </div>

        {/* ---------- Shift & Location ---------- */}
        {/* <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">
            Shift & Location
          </h3>

          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-500">
                <Clock size={15} /> Shift Time
              </span>
              <span className="font-medium text-slate-800">
                {shiftStartLabel} - {shiftEndLabel}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-500">
                <CalendarClock size={15} /> Working Days
              </span>
              <span className="font-medium text-slate-800">
                {new Date(`${selectedDate}T00:00:00`).getDay() === 6
                  ? "Sat (half day)"
                  : "Mon - Fri"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-500">
                <MapPin size={15} /> Location
              </span>
              <span className="font-medium text-slate-800 text-right">
                Office - Main Branch
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-500">
                <Briefcase size={15} /> {isViewingToday ? "Today's" : ""} Shift
              </span>
              <span className="text-[11px] font-medium bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
                {shiftNameLabel}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5 mt-4">
            <Building2 size={14} className="shrink-0 mt-0.5 text-slate-400" />
            <div>
              <div className="font-medium text-slate-700">
                Roster: Fixed Shift
              </div>
              <div className="text-slate-500 mt-0.5">
                Your shift follows the fixed roster set by your manager.
              </div>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
}
