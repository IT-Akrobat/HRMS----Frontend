import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Coffee,
  History,
  Info,
  TimerReset,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/common/PageHeader";
import { PartTimeMySummary } from "../../components/common/PartTimeSummary";
import { useAuth } from "../../context/AuthContext";
import { useBasePath } from "../../hooks/useBasePath";
import { apiClient } from "../../services/apiClient";
import { parseServerDate, toLocalISODate } from "../../utils/date";
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
  Holiday: "bg-purple-500",
  "Early Checkout": "bg-orange-400",
};

// Option B calendar cards: label + colours per attendance status.
const HOLIDAY_CARD = {
  box: "bg-purple-50 border-purple-200",
  text: "text-purple-700",
};
const DAY_CARD = {
  Present: {
    label: "Present",
    box: "bg-green-50 border-green-200",
    text: "text-green-700",
  },
  Absent: {
    label: "Absent",
    box: "bg-red-50 border-red-200",
    text: "text-red-600",
  },
  "Half Day": {
    label: "Half Day",
    box: "bg-amber-50 border-amber-200",
    text: "text-amber-600",
  },
  "Weekly Off": {
    label: "Off",
    box: "bg-slate-100 border-slate-100",
    text: "text-slate-400",
  },
  // Checked in but left early — its own status, NOT absent.
  "Early Checkout": {
    label: "Early Out",
    box: "bg-orange-50 border-orange-200",
    text: "text-orange-600",
  },
  // Backend marks holiday gap days "Holiday"; the festival name replaces
  // this label when /holidays/ has loaded.
  Holiday: {
    label: "Holiday",
    box: "bg-purple-50 border-purple-200",
    text: "text-purple-700",
  },
  "On Leave": {
    label: "Leave",
    box: "bg-blue-50 border-blue-200",
    text: "text-blue-600",
  },
};

function todayIso() {
  return toLocalISODate();
}

// Monday (YYYY-MM-DD) of the week containing the given date.
function mondayOfIso(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const dow = d.getDay(); // 0 = Sun .. 6 = Sat
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return toLocalISODate(d);
}

// "Oct 26 - Nov 1" (no year) for the week strip heading.
function formatDayMonth(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso) {
  if (!iso) return "--:--";
  const d = parseServerDate(iso);
  if (!d || Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString([], {
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
  const base = useBasePath();
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
  // Company holidays (GET /holidays/ — same endpoint as the dashboard's
  // Upcoming Holidays card). Used to show the festival name on calendar days.
  const [holidays, setHolidays] = useState([]);
  const [monthEndpointMissing, setMonthEndpointMissing] = useState(false);

  // Mobile-only: "This week" strip is the default, "Full calendar" swaps
  // it for the same month grid used on desktop. Desktop is unaffected —
  // this state only drives the <div className="lg:hidden"> block below.
  const [mobileCalendarExpanded, setMobileCalendarExpanded] = useState(false);

  // Mobile week strip: which Monday-started week is on screen. Swiping the
  // strip moves this by +/-7 days (it does NOT change selectedDate, so the
  // summary/timeline below stay on the day the person tapped).
  const [weekStart, setWeekStart] = useState(() => mondayOfIso(todayIso()));
  // Attendance status per date for the visible week (the month fetch only
  // covers monthCursor, so a week from another month would have no dots).
  const [weekRows, setWeekRows] = useState({});
  const swipeRef = useRef(null);

  // Ticks every 30s so the live "working now" time keeps counting up while
  // the employee is checked in and hasn't checked out yet.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

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
    apiClient
      .get("/holidays/")
      .then((res) => setHolidays(res.data || []))
      .catch(() => setHolidays([]));
  }, []);

  useEffect(() => {
    loadDay(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    loadMonth(monthCursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthCursor]);

  // Keep the strip on the week of the selected date when it changes from
  // elsewhere (e.g. picking a day in "Full calendar"). Tapping a day inside
  // the strip never changes the week, so this is a no-op there.
  useEffect(() => {
    setWeekStart(mondayOfIso(selectedDate));
  }, [selectedDate]);

  function loadWeek(startIso) {
    const d = new Date(`${startIso}T00:00:00`);
    d.setDate(d.getDate() + 6);
    apiClient
      .get(`/attendance/my?from_date=${startIso}&to_date=${toLocalISODate(d)}`)
      .then((res) => {
        const map = {};
        (res.data || []).forEach((r) => {
          map[r.date] = r.status;
        });
        setWeekRows(map);
      })
      .catch(() => setWeekRows({}));
  }

  useEffect(() => {
    loadWeek(weekStart);
  }, [weekStart]);

  // Swipe handling for the week strip: swipe right = previous week, swipe
  // left = next week (never past the current week).
  function shiftWeek(delta) {
    const d = new Date(`${weekStart}T00:00:00`);
    d.setDate(d.getDate() + delta * 7);
    const next = toLocalISODate(d);
    if (next > mondayOfIso(todayIso())) return;
    setWeekStart(next);
  }
  function onStripTouchStart(e) {
    const t = e.touches[0];
    swipeRef.current = { x: t.clientX, y: t.clientY };
  }
  function onStripTouchEnd(e) {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    shiftWeek(dx > 0 ? -1 : 1);
  }

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
      loadWeek(weekStart);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isViewingToday = selectedDate === todayIso();
  const checkedIn = !!dayData?.check_in_time;
  const checkedOut = !!dayData?.check_out_time;

  // Live working time: while checked in and not yet checked out today, the
  // backend's working_minutes is still 0, so count from check-in until now
  // and subtract breaks (including a break that is still running). After
  // check-out, or when viewing another day, use the backend's own figure.
  const isLive = selectedDate === todayIso() && checkedIn && !checkedOut;
  let workedMinutes = dayData?.working_minutes ?? 0;
  if (isLive) {
    const inAt = parseServerDate(dayData.check_in_time);
    if (inAt && !Number.isNaN(inAt.getTime())) {
      const brk = (dayData.breaks || []).reduce((sum, bk) => {
        const st = parseServerDate(bk.break_start);
        if (!st || Number.isNaN(st.getTime())) return sum;
        const en = bk.break_end ? parseServerDate(bk.break_end) : new Date(now);
        return sum + Math.max(0, (en.getTime() - st.getTime()) / 60000);
      }, 0);
      workedMinutes = Math.max(0, (now - inAt.getTime()) / 60000 - brk);
    }
  }

  const shiftStartLabel =
    formatShiftTime(dayData?.shift?.start_time) || SHIFT_START_LABEL;
  const shiftEndLabel =
    formatShiftTime(dayData?.shift?.end_time) || SHIFT_END_LABEL;
  const shiftHoursLabel =
    formatShiftHours(dayData?.shift?.working_hours) || SHIFT_HOURS_LABEL;
  // const shiftNameLabel = dayData?.shift?.shift_name || "General Shift";
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

  // date (YYYY-MM-DD) -> holiday name. India and Singapore calendars are
  // merged, so if two names share a date keep the longer/more descriptive one.
  const holidayByDate = useMemo(() => {
    const map = {};
    holidays.forEach((h) => {
      const d = String(h.holiday_date || "").slice(0, 10);
      const name = (h.holiday_name || "").trim();
      if (!d || !name) return;
      if (!map[d] || name.length > map[d].length) map[d] = name;
    });
    return map;
  }, [holidays]);

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  // ---------- mobile week strip (Mon-Sun containing selectedDate) ----------
  const weekDates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const dt = new Date(`${weekStart}T00:00:00`);
        dt.setDate(dt.getDate() + i);
        return toLocalISODate(dt);
      }),
    [weekStart],
  );
  const isCurrentWeek = weekStart === mondayOfIso(todayIso());
  const weekLabel = isCurrentWeek
    ? "This week"
    : `${formatDayMonth(weekDates[0])} - ${formatDayMonth(weekDates[6])}`;
  const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

  // ---------- Option B: progress ring + month counters ----------
  // Falls back to an 8h shift when the timeline response has no shift hours
  // (otherwise the ring would stay empty even after a full day).
  const shiftMinutes = (dayData?.shift?.working_hours || 8) * 60;
  const progress =
    shiftMinutes > 0
      ? Math.min(1, Math.max(0, workedMinutes / shiftMinutes))
      : 0;
  // Full shift worked -> the ring turns blue.
  const ringDone = progress >= 1;
  const presentCount = monthRows.filter((r) => r.status === "Present").length;
  // A holiday is never an absence, even if the API still labels the day
  // "Absent" (older backend) — the festival name on that date wins.
  const absentCount = monthRows.filter(
    (r) => r.status === "Absent" && !holidayByDate[r.date],
  ).length;
  const earlyCount = monthRows.filter(
    (r) => r.status === "Early Checkout",
  ).length;

  return (
    <div>
      <PageHeader
        title="My Attendance"
        subtitle="Track your daily attendance and working hours."
        actionsInline
        actions={
          <Link
            to={`${base}/attendance/history`}
            title="View History"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-2.5 sm:px-3.5 py-2 rounded-lg"
          >
            <History size={15} />{" "}
            <span className="hidden sm:inline">View History</span>
          </Link>
        }
      />

      <PartTimeMySummary />

      {error && (
        <div className="mb-4 text-sm text-orange-500 bg-orange-50 border border-orange-100 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* ==================================================================
          MOBILE-ONLY layout (< lg). Replaces the stacked Calendar/Summary/
          Timeline cards with: status header, a Mon-Sun week strip (tap
          "Full calendar" to swap in the month grid), a 2x2 metrics grid,
          and a condensed timeline. Reads the same selectedDate/dayData/
          monthRows state as the desktop view below — nothing new is
          fetched. Desktop layout (the `hidden lg:grid` block further
          down) is untouched.
      ================================================================== */}
      <div className="lg:hidden space-y-4">
        {/* ---- Status header ---- */}
        <div className="bg-[#0B1830] rounded-2xl px-4 pt-4 pb-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] text-slate-400">
                {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
                  "en-US",
                  { weekday: "long", month: "short", day: "numeric" },
                )}
              </div>
              <div className="text-base font-semibold">My Attendance</div>
            </div>
            {/* <Link
              to={`${base}/attendance/history`}
              title="View History"
              className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center"
            >
              <History size={16} />
            </Link> */}
          </div>

          <div className="bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-slate-400 mb-0.5">Status</div>
              <div className="text-sm font-medium text-slate-200 truncate">
                {checkedOut
                  ? `Out at ${formatTime(dayData?.check_out_time)}`
                  : checkedIn
                    ? `In at ${formatTime(dayData?.check_in_time)}`
                    : "Not checked in yet"}
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white ${
                checkedOut
                  ? "bg-slate-500"
                  : checkedIn
                    ? "bg-blue-500"
                    : "bg-orange-500"
              }`}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        {/* ---- Week strip / full calendar toggle ---- */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-800">
              {mobileCalendarExpanded ? "Full calendar" : weekLabel}
            </span>
            <button
              type="button"
              onClick={() => setMobileCalendarExpanded((v) => !v)}
              className="text-xs text-slate-500 flex items-center gap-1"
            >
              {mobileCalendarExpanded ? "This week" : "Full calendar"}
              <ChevronRight size={13} />
            </button>
          </div>

          {!mobileCalendarExpanded ? (
            <div
              className="flex gap-1.5 touch-pan-y select-none"
              onTouchStart={onStripTouchStart}
              onTouchEnd={onStripTouchEnd}
            >
              {weekDates.map((dateStr, i) => {
                const status = weekRows[dateStr] ?? rowsByDate[dateStr];
                const isToday = dateStr === todayIso();
                const isSelected = dateStr === selectedDate;
                const isFuture = dateStr > todayIso();
                const dayNum = Number(dateStr.slice(-2));
                return (
                  <button
                    key={dateStr}
                    type="button"
                    disabled={isFuture}
                    onClick={() => !isFuture && selectDate(dateStr)}
                    className={`flex-1 text-center py-2 rounded-xl border disabled:cursor-not-allowed ${
                      isSelected
                        ? "bg-[#0B1830] border-[#0B1830]"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <div
                      className={`text-[10px] ${
                        isSelected ? "text-slate-400" : "text-slate-400"
                      }`}
                    >
                      {WEEKDAY_LETTERS[i]}
                    </div>
                    <div
                      className={`text-xs font-medium my-1 ${
                        isFuture
                          ? "text-slate-300"
                          : isSelected
                            ? "text-white"
                            : isToday
                              ? "text-blue-600"
                              : "text-slate-700"
                      }`}
                    >
                      {dayNum}
                    </div>
                    <span
                      className={`block w-1.5 h-1.5 rounded-full mx-auto ${
                        isSelected
                          ? "bg-orange-400"
                          : DOT_COLOR[status] ||
                            (holidayByDate[dateStr]
                              ? DOT_COLOR.Holiday
                              : "bg-transparent")
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setMonthCursor(new Date(year, month - 1, 1))}
                  className="p-1 rounded-md hover:bg-orange-50 text-slate-600"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="text-xs font-medium text-slate-600">
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
              <div className="grid grid-cols-7 mb-2 text-[10px] font-bold text-blue-900 text-center">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-2 text-center">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <span key={`mpad-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                  (day) => {
                    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const status = rowsByDate[dateStr];
                    const isToday = dateStr === todayIso();
                    const isSelected = dateStr === selectedDate;
                    const isFuture = dateStr > todayIso();
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          if (isFuture) return;
                          selectDate(dateStr);
                          setMobileCalendarExpanded(false);
                        }}
                        disabled={isFuture}
                        className="flex flex-col items-center gap-0.5 disabled:cursor-not-allowed"
                      >
                        <span
                          className={`w-6 h-6 flex items-center justify-center rounded-full text-xs ${
                            isToday
                              ? "bg-blue-600 text-white font-semibold"
                              : isFuture
                                ? "text-slate-300"
                                : "text-slate-600"
                          } ${isSelected && !isToday ? "ring-2 ring-orange-400 ring-offset-1" : ""}`}
                        >
                          {day}
                        </span>
                        <span
                          className={`w-1 h-1 rounded-full ${DOT_COLOR[status] || (holidayByDate[dateStr] ? DOT_COLOR.Holiday : "bg-transparent")}`}
                        />
                      </button>
                    );
                  },
                )}
              </div>
            </>
          )}
        </div>

        {/* ---- Metrics 2x2 grid ---- */}
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-xl" />
            ))}
          </div>
        ) : !dayData && !isViewingToday ? (
          <div className="bg-white rounded-xl border border-slate-200 py-6 text-center text-sm text-slate-400">
            No attendance record for {formatShortDate(selectedDate)}.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <Clock size={16} className="text-blue-500" />
              <div className="text-sm font-semibold text-slate-800 mt-2">
                {formatDuration(workedMinutes)}
              </div>
              <div className="text-[11px] text-slate-400">
                of {shiftHoursLabel} working
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <Coffee size={16} className="text-purple-500" />
              <div className="text-sm font-semibold text-slate-800 mt-2">
                {formatDuration(dayData?.break_minutes)}
              </div>
              <div className="text-[11px] text-slate-400">break time</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <AlertTriangle size={16} className="text-amber-500" />
              <div className="text-sm font-semibold text-slate-800 mt-2">
                {dayData?.late_minutes
                  ? formatDuration(dayData.late_minutes)
                  : "On time"}
              </div>
              <div className="text-[11px] text-slate-400">
                {dayData?.late_minutes
                  ? `checked in after ${shiftStartLabel}`
                  : "arrival"}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <TimerReset size={16} className="text-orange-500" />
              <div className="text-sm font-semibold text-slate-800 mt-2">
                {shiftEndLabel}
              </div>
              <div className="text-[11px] text-slate-400">expected out</div>
            </div>
          </div>
        )}

        {/* ---- Condensed timeline ---- */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-800">
              {isViewingToday ? "Today's timeline" : "Timeline"}
            </h3>
            {!isViewingToday && (
              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {formatShortDate(selectedDate)}
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-3.5 bg-slate-100 rounded" />
              ))}
            </div>
          ) : !dayData ? (
            <div className="text-xs text-slate-400 py-4 text-center">
              {isViewingToday
                ? "No check-in recorded yet today."
                : `No attendance record for ${formatShortDate(selectedDate)}.`}
            </div>
          ) : (
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5">
                {checkedIn ? (
                  <CheckCircle2
                    size={15}
                    className="text-green-500 mt-0.5 shrink-0"
                  />
                ) : (
                  <Circle
                    size={15}
                    className="text-slate-300 mt-0.5 shrink-0"
                  />
                )}
                <div>
                  <div className="text-xs font-medium text-slate-700">
                    {checkedIn
                      ? `${formatTime(dayData?.check_in_time)} - Checked in`
                      : "Not checked in"}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Office - Main Entrance
                  </div>
                </div>
              </li>

              {(dayData?.breaks || []).map((b, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Coffee
                    size={15}
                    className="text-purple-400 mt-0.5 shrink-0"
                  />
                  <div>
                    <div className="text-xs font-medium text-slate-700">
                      {formatTime(b.break_start)}
                      {b.break_end ? ` - ${formatTime(b.break_end)}` : ""} -
                      Break
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {b.break_end ? "Ended" : "In progress"}
                    </div>
                  </div>
                </li>
              ))}

              <li className="flex items-start gap-2.5">
                {checkedOut ? (
                  <CheckCircle2
                    size={15}
                    className="text-slate-400 mt-0.5 shrink-0"
                  />
                ) : (
                  <Circle
                    size={15}
                    className="text-slate-300 mt-0.5 shrink-0"
                  />
                )}
                <div>
                  <div className="text-xs font-medium text-slate-700">
                    {checkedOut
                      ? `${formatTime(dayData?.check_out_time)} - Checked out`
                      : "Yet to check out"}
                  </div>
                </div>
              </li>
            </ul>
          )}
        </div>
      </div>

      {/* ==================================================================
          DESKTOP layout (lg and up) — "Option B": left panel with the
          progress ring, check-in/out button and timeline; right side with
          the summary tiles and a card-style month calendar. Reads the same
          selectedDate / dayData / monthRows state as before.
      ================================================================== */}
      <div className="hidden lg:flex gap-6 items-stretch">
        {/* ---------- Left panel: ring + action + timeline ---------- */}
        <div className="w-[290px] shrink-0 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col items-center">
          <div className="text-xs font-bold tracking-wide text-slate-500 uppercase">
            {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>

          {loading ? (
            <div className="w-[140px] h-[140px] my-3 rounded-full bg-slate-100 animate-pulse" />
          ) : (
            <svg
              width="140"
              height="140"
              viewBox="0 0 220 220"
              className="my-3"
              role="img"
              aria-label="Working hours progress"
            >
              <circle
                cx="110"
                cy="110"
                r="94"
                fill="none"
                stroke="#eef1f8"
                strokeWidth="16"
              />
              <circle
                cx="110"
                cy="110"
                r="94"
                fill="none"
                stroke={ringDone ? "#2563eb" : "#f26a1b"}
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray="590.6"
                strokeDashoffset={590.6 * (1 - progress)}
                transform="rotate(-90 110 110)"
              />
              <text
                x="110"
                y="108"
                textAnchor="middle"
                fontWeight="800"
                fontSize="30"
                fill="#0b1d45"
              >
                {formatDuration(workedMinutes)}
              </text>
              <text
                x="110"
                y="134"
                textAnchor="middle"
                fontWeight="600"
                fontSize="12"
                fill="#64708a"
              >
                {isLive
                  ? "working now"
                  : isViewingToday
                    ? "worked today"
                    : "worked"}
              </text>
            </svg>
          )}

          <span
            className={`text-xs font-bold px-3.5 py-1.5 rounded-full ${
              checkedOut
                ? "bg-slate-100 text-slate-600"
                : checkedIn
                  ? dayData?.late_minutes
                    ? "bg-amber-50 text-amber-600"
                    : "bg-green-50 text-green-700"
                  : "bg-orange-50 text-orange-600"
            }`}
          >
            ●{" "}
            {checkedOut
              ? "Checked out"
              : checkedIn
                ? `Checked in · ${dayData?.late_minutes ? "Late" : "On Time"}`
                : statusLabel}
          </span>

          {isViewingToday && !checkedOut && (
            <button
              type="button"
              disabled={busy || loading}
              onClick={() =>
                runAction(
                  checkedIn ? "/attendance/check-out" : "/attendance/check-in",
                )
              }
              className={`w-full h-10 mt-3 text-sm rounded-xl text-white font-bold disabled:opacity-60 ${
                checkedIn
                  ? "bg-[#0B1D45] hover:bg-[#13295e]"
                  : "bg-orange-500 hover:bg-orange-600"
              }`}
            >
              {busy ? "Please wait..." : checkedIn ? "Check Out" : "Check In"}
            </button>
          )}

          {/* Timeline */}
          <div className="w-full mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-extrabold text-slate-800">
                {isViewingToday ? "Today's Timeline" : "Timeline"}
              </h3>
              {!isViewingToday && (
                <button
                  onClick={() => selectDate(todayIso())}
                  className="text-[11px] font-medium text-orange-600 hover:text-orange-700"
                >
                  Back to Today
                </button>
              )}
            </div>

            {loading ? (
              <div className="space-y-3 animate-pulse">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-4 bg-slate-100 rounded" />
                ))}
              </div>
            ) : !dayData ? (
              <div className="text-sm text-slate-400 py-3 text-center">
                {isViewingToday
                  ? "No check-in recorded yet today."
                  : `No attendance record for ${formatShortDate(selectedDate)}.`}
              </div>
            ) : (
              <ul className="space-y-2.5">
                <li className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm text-slate-700">
                      {checkedIn ? (
                        <>
                          <b>{formatTime(dayData?.check_in_time)}</b> Checked in
                        </>
                      ) : (
                        "Not checked in"
                      )}
                    </div>
                    <div className="text-xs text-slate-400">
                      Office - Main Entrance
                    </div>
                  </div>
                  {checkedIn && (
                    <span
                      className={`text-xs font-bold ${
                        dayData?.late_minutes
                          ? "text-amber-600"
                          : "text-green-700"
                      }`}
                    >
                      {dayData?.late_minutes ? "Late" : "On Time"}
                    </span>
                  )}
                </li>

                {(dayData?.breaks || []).map((b, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="text-sm text-slate-700">
                        <b>{formatTime(b.break_start)}</b> Break started
                      </div>
                      <div className="text-xs text-slate-400">
                        {b.break_end
                          ? `Ended ${formatTime(b.break_end)}`
                          : "In progress"}
                      </div>
                    </div>
                  </li>
                ))}

                <li className="flex items-start justify-between gap-2">
                  <div className="text-sm text-slate-700">
                    <b>
                      {checkedOut
                        ? formatTime(dayData?.check_out_time)
                        : "--:--"}
                    </b>{" "}
                    Check out
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      checkedOut ? "text-slate-500" : "text-amber-600"
                    }`}
                  >
                    {checkedOut ? "Done" : "Pending"}
                  </span>
                </li>
              </ul>
            )}
          </div>

          {isViewingToday && checkedIn && !checkedOut && (
            <div className="mt-auto pt-3 w-full">
              <div className="flex items-start gap-2 text-xs font-medium text-blue-700 bg-blue-50 rounded-xl px-3.5 py-3">
                <Info size={14} className="shrink-0 mt-0.5" />
                Remember to check out at the end of your working hours.
              </div>
            </div>
          )}
        </div>

        {/* ---------- Right side: summary tiles + calendar ---------- */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Summary tiles */}
          {loading ? (
            <div className="grid grid-cols-4 gap-3 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[64px] bg-slate-100 rounded-xl" />
              ))}
            </div>
          ) : !dayData && !isViewingToday ? (
            <div className="bg-white rounded-2xl border border-slate-200 py-6 text-center text-sm text-slate-400">
              No attendance record for {formatShortDate(selectedDate)}.
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {[
                {
                  label: "Break",
                  value: formatDuration(dayData?.break_minutes),
                  sub: "of 01h 00m",
                },
                {
                  label: "Late arrival",
                  value: dayData?.late_minutes
                    ? formatDuration(dayData.late_minutes)
                    : "On time",
                  sub: dayData?.late_minutes
                    ? `after ${shiftStartLabel}`
                    : "00h 00m",
                },
                {
                  label: "Early checkout",
                  value: dayData?.early_checkout_minutes
                    ? formatDuration(dayData.early_checkout_minutes)
                    : "00h 00m",
                  sub: dayData?.early_checkout_minutes
                    ? checkedOut
                      ? `before ${shiftEndLabel}`
                      : "short so far"
                    : checkedOut
                      ? "on time"
                      : "none",
                },
                {
                  label: "Overtime",
                  value: dayData?.overtime_minutes
                    ? formatDuration(dayData.overtime_minutes)
                    : "--",
                  sub: dayData?.overtime_minutes
                    ? `after ${shiftEndLabel}`
                    : "No overtime",
                },
              ].map((t) => (
                <div
                  key={t.label}
                  className="bg-white rounded-xl border border-slate-200 px-3.5 py-2.5"
                >
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    {t.label}
                  </div>
                  <div className="text-lg font-extrabold text-slate-800 mt-0.5">
                    {t.value}
                  </div>
                  <div className="text-[11px] text-slate-400">{t.sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* Shift info line (expected check out, shift hours) */}
          {/* <div className="flex items-center gap-2 text-xs text-slate-500 -mt-2">
            <Clock size={13} className="text-slate-400" />
            {shiftNameLabel}: {shiftStartLabel} - {shiftEndLabel} (
            {shiftHoursLabel})
          </div> */}

          {/* Calendar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMonthCursor(new Date(year, month - 1, 1))}
                  className="p-1.5 rounded-md hover:bg-orange-50 text-slate-600"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>
                <h3 className="text-base font-extrabold text-slate-800 min-w-[130px] text-center">
                  {monthCursor.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
                <button
                  onClick={() => setMonthCursor(new Date(year, month + 1, 1))}
                  className="p-1.5 rounded-md hover:bg-orange-50 text-slate-600"
                  aria-label="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="text-xs font-bold text-slate-500">
                {presentCount} present · {absentCount} absent
                {earlyCount > 0 ? ` · ${earlyCount} early checkout` : ""}
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 mb-1 text-center text-xs font-bold text-slate-500">
              {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: firstDay }).map((_, i) => (
                <span key={`pad-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                (day) => {
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const status = rowsByDate[dateStr];
                  const holidayName = holidayByDate[dateStr];
                  // A holiday shows its festival name unless the employee
                  // actually worked / was on leave that day.
                  const showHoliday =
                    !!holidayName &&
                    ![
                      "Present",
                      "Half Day",
                      "On Leave",
                      "Early Checkout",
                    ].includes(status);
                  const card = showHoliday ? HOLIDAY_CARD : DAY_CARD[status];
                  const cardLabel = showHoliday ? holidayName : card?.label;
                  const isToday = dateStr === todayIso();
                  const isSelected = dateStr === selectedDate;
                  const isFuture = dateStr > todayIso();
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={isFuture}
                      onClick={() => !isFuture && selectDate(dateStr)}
                      title={
                        holidayName
                          ? holidayName
                          : isFuture
                            ? undefined
                            : `View summary for ${dateStr}`
                      }
                      className={`h-[44px] min-w-0 overflow-hidden rounded-xl border px-2 py-1 flex flex-col justify-between items-start text-left transition-colors disabled:cursor-not-allowed ${
                        isToday
                          ? "bg-orange-500 border-orange-500 text-white"
                          : card
                            ? `${card.box} ${card.text}`
                            : "bg-white border-slate-200 text-slate-700"
                      } ${isSelected && !isToday ? "ring-2 ring-orange-400 ring-offset-1" : ""} ${
                        isSelected && isToday
                          ? "ring-2 ring-orange-300 ring-offset-1"
                          : ""
                      }`}
                    >
                      <span
                        className={`text-[13px] leading-none font-extrabold ${
                          isFuture && !showHoliday
                            ? "text-slate-300"
                            : isToday
                              ? "text-white"
                              : "text-slate-800"
                        }`}
                      >
                        {day}
                      </span>
                      <span className="text-[10px] leading-none font-bold w-full truncate">
                        {isToday && !showHoliday ? "Today" : cardLabel || ""}
                      </span>
                    </button>
                  );
                },
              )}
            </div>

            {monthEndpointMissing && (
              <p className="text-xs text-slate-400 mt-3">
                Attendance history for this month isn't available yet.
              </p>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
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
                <span className="w-2 h-2 rounded-full bg-slate-300" /> Weekly
                Off
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> On Leave
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500" /> Holiday
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-400" /> Early
                Checkout
              </span>
            </div>
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
    </div>
  );
}
