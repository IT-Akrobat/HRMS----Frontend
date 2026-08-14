import {
  AlarmClock,
  AlertTriangle,
  ChevronDown,
  MapPin,
  Search,
  Timer,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Avatar from "../../components/common/Avatar";
import PageHeader from "../../components/common/PageHeader";
import DatePicker from "../../components/layout/DatePicker";
import { apiClient } from "../../services/apiClient";
import { parseServerDate, toLocalISODate } from "../../utils/date";
import { unwrap } from "../../utils/unwrap";

// ---------------------------------------------------------------------
// Company-wide Attendance Overview for HR Admin, for a single selected
// day (defaults to today). Three real endpoints feed it:
//
//  - GET /attendance/analytics?from_date=X&to_date=X  -> the aggregate
//    counts (present/half-day/late, avg working minutes, overtime)
//    used for the donut + quick-stat cards. See get_attendance_analytics
//    in app/attendance/services.py.
//  - GET /attendance/?target_date=X&limit=200          -> the actual
//    per-employee rows for that day. Only employees who have *some*
//    attendance record (i.e. checked in) show up here — there's no
//    "Absent" row in the table itself, so "Absent" is derived as
//    (active headcount - records for the day).
//  - GET /attendance/org/site-visits                    -> today's live
//    field-staff site status, company-wide (same shape used by the
//    Super Admin Live Tracking page) — used just for "On site now".
//
// GET /employees/ supplies the active headcount used for the Absent
// figure, same list the Employee List / drill-down screen already
// loads.
// ---------------------------------------------------------------------

const STATUS_COLORS = {
  Present: { dot: "#639922", bg: "bg-blue-50", text: "text-blue-600" },
  Late: { dot: "#BA7517", bg: "bg-orange-50", text: "text-orange-600" },
  "Half Day": { dot: "#888780", bg: "bg-slate-100", text: "text-slate-500" },
  Absent: { dot: "#E24B4A", bg: "bg-orange-50", text: "text-orange-600" },
};

function formatTime(iso) {
  const d = parseServerDate(iso);
  if (!d) return "--:--";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatMinutes(minutes) {
  if (minutes == null) return "—";
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

// A record is "Late" for display purposes if it carries late_minutes,
// even though the backend still stores its underlying status as
// "Present" — matches how /attendance/analytics counts late_count
// separately from present_count.
function displayStatus(record) {
  if (record.status === "Half Day") return "Half Day";
  if ((record.late_minutes || 0) > 0) return "Late";
  return record.status || "Present";
}

const STANDARD_SHIFT_MINUTES = 480; // 8h — used only for the progress bar width

function DonutChart({ present, late, halfDay, absent }) {
  const total = present + late + halfDay + absent || 1;
  const segments = [
    { value: present, color: "#c2410c" },
    { value: late, color: "#1d4ed8" },
    { value: halfDay, color: "#122a51" },
    { value: absent, color: "#f5730b" },
  ];
  const radius = 65;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 180 180" className="w-full max-w-[180px]">
      <g transform="translate(90,90) rotate(-90)">
        <circle r={radius} fill="none" stroke="#F1EFE8" strokeWidth="18" />
        {segments.map((seg, i) => {
          const fraction = seg.value / total;
          const dash = fraction * circumference;
          const el = (
            <circle
              key={i}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="18"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </g>
    </svg>
  );
}

function AttendanceRow({ record }) {
  const status = displayStatus(record);
  const style = STATUS_COLORS[status] || STATUS_COLORS.Present;
  const pct = record.working_minutes
    ? Math.min(
        100,
        Math.round((record.working_minutes / STANDARD_SHIFT_MINUTES) * 100),
      )
    : 0;

  return (
    <div
      className="flex items-center gap-3 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl"
      style={{ borderLeft: `3px solid ${style.dot}` }}
    >
      <Avatar
        name={record.employees?.full_name}
        photo={record.employees?.profile_photo}
        size="w-8 h-8"
      />
      <div className="min-w-[130px] max-w-[160px]">
        <div className="text-sm font-medium text-slate-800 truncate">
          {record.employees?.full_name || "—"}
        </div>
        <div className="text-xs text-slate-400 truncate">
          {record.employees?.employee_id || "—"}
        </div>
      </div>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: style.dot }}
        />
      </div>
      <span className="text-xs text-slate-500 w-32 shrink-0 text-right hidden md:block">
        {formatTime(record.check_in_time)} –{" "}
        {record.check_out_time
          ? formatTime(record.check_out_time)
          : "in progress"}
      </span>
      <span className="text-xs text-slate-500 w-16 shrink-0 text-right">
        {formatMinutes(record.working_minutes)}
      </span>
      <span
        className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${style.bg} ${style.text}`}
      >
        {status}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------
// Mobile-only presentation pieces below (StatChip, AttendanceCard) and
// the `lg:hidden` block in the return statement further down. Nothing
// above this line, and none of the desktop JSX in the `hidden lg:block`
// block, is changed — same components, same two effects, same derived
// numbers feed both layouts; only the markup below switches on the
// `lg` (1024px) breakpoint, the same one Sidebar/Header already use.
// ---------------------------------------------------------------------

// Compact stat card that scrolls horizontally on mobile instead of
// sitting in the desktop's 3-column grid.
function StatChip({ icon: Icon, label, value }) {
  return (
    <div className="shrink-0 min-w-[132px] bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1.5">
        <Icon size={13} />
        {label}
      </div>
      <div className="text-lg font-bold text-slate-800">{value}</div>
    </div>
  );
}

// Full-width stacked card, replacing the desktop table row for narrow
// screens. Same status/progress logic as AttendanceRow above.
function AttendanceCard({ record }) {
  const status = displayStatus(record);
  const style = STATUS_COLORS[status] || STATUS_COLORS.Present;
  const pct = record.working_minutes
    ? Math.min(
        100,
        Math.round((record.working_minutes / STANDARD_SHIFT_MINUTES) * 100),
      )
    : 0;

  return (
    <div
      className="bg-white border border-slate-200 rounded-xl p-3"
      style={{ borderLeft: `3px solid ${style.dot}` }}
    >
      <div className="flex items-start gap-2.5">
        <Avatar
          name={record.employees?.full_name}
          photo={record.employees?.profile_photo}
          size="w-9 h-9"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-800 truncate">
                {record.employees?.full_name || "—"}
              </div>
              <div className="text-xs text-slate-400 truncate">
                {record.employees?.employee_id || "—"}
              </div>
            </div>
            <span
              className={`text-[11px] font-medium px-2 py-1 rounded-full shrink-0 ${style.bg} ${style.text}`}
            >
              {status}
            </span>
          </div>

          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2.5">
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: style.dot }}
            />
          </div>

          <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
            <span>
              {formatTime(record.check_in_time)} –{" "}
              {record.check_out_time
                ? formatTime(record.check_out_time)
                : "in progress"}
            </span>
            <span className="font-medium text-slate-700">
              {formatMinutes(record.working_minutes)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;
const PAGE_SIZE_MOBILE = 8; // smaller batches for the mobile "Load more" button

export default function HrAttendanceOverview() {
  const [selectedDate, setSelectedDate] = useState(toLocalISODate());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Mobile-only UI state — desktop layout doesn't use these.
  const [mobileVisibleCount, setMobileVisibleCount] =
    useState(PAGE_SIZE_MOBILE);

  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [activeHeadcount, setActiveHeadcount] = useState(null);
  const [onSiteCount, setOnSiteCount] = useState(0);

  useEffect(() => {
    apiClient
      .get("/employees/")
      .then((res) => {
        const list = unwrap(res) || [];
        setActiveHeadcount(
          list.filter((e) => e.employment_status === "Active").length,
        );
      })
      .catch(() => setActiveHeadcount(null));
  }, []);

  useEffect(() => {
    function loadSiteVisits() {
      apiClient
        .get("/attendance/org/site-visits")
        .then((res) => {
          const rows = unwrap(res) || [];
          setOnSiteCount(
            rows.filter((r) => r.live_status === "on_site").length,
          );
        })
        .catch(() => setOnSiteCount(0));
    }
    loadSiteVisits();
    const id = setInterval(loadSiteVisits, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setAnalyticsLoading(true);
    apiClient
      .get(
        `/attendance/analytics?from_date=${selectedDate}&to_date=${selectedDate}`,
      )
      .then((res) => setAnalytics(unwrap(res)))
      .catch(() => setAnalytics(null))
      .finally(() => setAnalyticsLoading(false));

    setRecordsLoading(true);
    setLoadError(null);
    apiClient
      .get(`/attendance/?target_date=${selectedDate}&limit=200`)
      .then((res) => {
        const data = unwrap(res);
        setRecords(data?.records || []);
      })
      .catch((err) => {
        setRecords([]);
        setLoadError(err.message || "Could not load attendance records.");
      })
      .finally(() => setRecordsLoading(false));
  }, [selectedDate]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => {
      const haystack =
        `${r.employees?.full_name || ""} ${r.employees?.employee_id || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [records, search]);

  // Reset to page 1 whenever the day or search filter changes so we
  // never land on an out-of-range page.
  useEffect(() => {
    setPage(1);
  }, [selectedDate, search]);

  // Same reset, for the mobile "Load more" batch size.
  useEffect(() => {
    setMobileVisibleCount(PAGE_SIZE_MOBILE);
  }, [selectedDate, search]);

  const mobileVisibleRecords = filteredRecords.slice(0, mobileVisibleCount);
  const mobileHasMore = mobileVisibleCount < filteredRecords.length;

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const pagedRecords = filteredRecords.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const presentCount = analytics?.present_count || 0;
  const lateCount = analytics?.late_count || 0;
  const halfDayCount = analytics?.half_day_count || 0;
  // "Present" from the backend already includes late check-ins, so pull
  // the late slice back out for the donut/legend instead of double
  // counting it against the headcount below.
  const onTimePresentCount = Math.max(0, presentCount - lateCount);
  const totalMarked = analytics?.total_records || 0;
  const absentCount =
    activeHeadcount != null ? Math.max(0, activeHeadcount - totalMarked) : 0;

  const avgHours = analytics?.average_working_minutes
    ? formatMinutes(analytics.average_working_minutes)
    : "—";
  const overtimeHours = analytics?.total_overtime_minutes
    ? formatMinutes(analytics.total_overtime_minutes)
    : "0m";

  const isToday = selectedDate === toLocalISODate();

  return (
    <div>
      {/* =================== DESKTOP (unchanged) =================== */}
      <div className="hidden lg:block">
        <PageHeader
          title="Attendance Overview"
          subtitle="Company-wide check-in status for the selected day."
          actions={
            <div className="flex items-center gap-2">
              <div className="border border-slate-200 rounded-lg px-3 py-1.5">
                <DatePicker
                  value={selectedDate}
                  max={toLocalISODate()}
                  onChange={(iso) => setSelectedDate(iso)}
                />
              </div>
              {!isToday && (
                <button
                  onClick={() => setSelectedDate(toLocalISODate())}
                  className="text-sm font-medium text-orange-600 hover:underline whitespace-nowrap"
                >
                  Jump to today
                </button>
              )}
              <div className="relative w-72">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or employee ID..."
                  className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
                />
              </div>
            </div>
          }
        />

        {loadError && (
          <div className="flex items-center gap-2 text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-4 py-3 text-sm mb-5">
            <AlertTriangle size={16} />
            {loadError}
          </div>
        )}

        <div className="flex flex-col lg:flex-row items-stretch gap-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 content-start flex-1">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                <Timer size={14} />
                Avg hours worked
              </div>
              <div className="text-xl font-bold text-slate-800">
                {analyticsLoading ? "—" : avgHours}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                <AlarmClock size={14} />
                Overtime logged
              </div>
              <div className="text-xl font-bold text-slate-800">
                {analyticsLoading ? "—" : overtimeHours}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                <MapPin size={14} />
                On site now
              </div>
              <div className="text-xl font-bold text-slate-800">
                {onSiteCount}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center lg:w-[220px] shrink-0">
            {analyticsLoading ? (
              <div className="w-[180px] h-[180px] rounded-full bg-slate-100 animate-pulse" />
            ) : (
              <div className="relative w-full max-w-[180px]">
                <DonutChart
                  present={onTimePresentCount}
                  late={lateCount}
                  halfDay={halfDayCount}
                  absent={absentCount}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-slate-800">
                    {activeHeadcount ?? "—"}
                  </span>
                  <span className="text-[11px] text-slate-400">employees</span>
                </div>
              </div>
            )}

            <div className="w-full max-w-xs mt-3 space-y-1.5">
              {[
                {
                  label: "Present",
                  value: onTimePresentCount,
                  color: "#c2410c",
                },
                { label: "Late", value: lateCount, color: "#1d4ed8" },
                { label: "Half day", value: halfDayCount, color: "#122a51" },
                { label: "Absent", value: absentCount, color: "#f5730b" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    {row.label}
                  </span>
                  <span className="font-medium text-slate-800">
                    {analyticsLoading ? "—" : row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-orange-500" />
          <h3 className="font-semibold text-slate-800 text-sm">
            {isToday ? "Today's attendance" : "Attendance"}
            {!recordsLoading && (
              <span className="text-slate-400 font-normal">
                {" "}
                ({filteredRecords.length} of {records.length} checked in)
              </span>
            )}
          </h3>
        </div>

        {recordsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-14 bg-slate-100 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400">
            No one has checked in {search ? "matching that search" : "yet"} for
            this day.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {pagedRecords.map((record) => (
                <AttendanceRow key={record.id} record={record} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-slate-400">
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, filteredRecords.length)} of{" "}
                  {filteredRecords.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-7 h-7 text-xs font-medium rounded-lg ${
                          p === page
                            ? "bg-orange-500 text-white"
                            : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {/* ================= /DESKTOP =================== */}

      {/* ===================== MOBILE ===================== */}
      <div className="lg:hidden pb-6">
        <div className="sticky top-0 z-10 bg-[#F7F5EF] pt-1 pb-3 -mx-4 px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-800 truncate">
                Attendance Overview
              </h1>
              <p className="text-xs text-slate-500 truncate">
                Company-wide check-in status
              </p>
            </div>
            {/* Same pattern as Attendance reports: a small always-visible
                search box sits right on the title line next to the text,
                instead of a toggle button that hides/reveals it. */}
            <div className="relative shrink-0">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="pl-7 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg w-24 bg-white focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 border border-slate-200 rounded-lg bg-white px-3 py-2">
              <DatePicker
                value={selectedDate}
                max={toLocalISODate()}
                onChange={(iso) => setSelectedDate(iso)}
                className="w-full"
              />
            </div>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(toLocalISODate())}
                className="shrink-0 text-xs font-medium text-orange-600 whitespace-nowrap px-2 py-2"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {loadError && (
          <div className="flex items-center gap-2 text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2.5 text-xs mb-4">
            <AlertTriangle size={15} className="shrink-0" />
            {loadError}
          </div>
        )}

        <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 mb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <StatChip
            icon={Timer}
            label="Avg hours worked"
            value={analyticsLoading ? "—" : avgHours}
          />
          <StatChip
            icon={AlarmClock}
            label="Overtime logged"
            value={analyticsLoading ? "—" : overtimeHours}
          />
          <StatChip icon={MapPin} label="On site now" value={onSiteCount} />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-row items-center gap-4 mb-5">
          {analyticsLoading ? (
            <div className="shrink-0 w-[120px] h-[120px] rounded-full bg-slate-100 animate-pulse" />
          ) : (
            <div className="relative shrink-0 w-[120px]">
              <DonutChart
                present={onTimePresentCount}
                late={lateCount}
                halfDay={halfDayCount}
                absent={absentCount}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-slate-800">
                  {activeHeadcount ?? "—"}
                </span>
                <span className="text-[9px] text-slate-400">employees</span>
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0 grid grid-cols-1 gap-1.5">
            {[
              {
                label: "Present",
                value: onTimePresentCount,
                color: "#c2410c",
              },
              { label: "Late", value: lateCount, color: "#1d4ed8" },
              { label: "Half day", value: halfDayCount, color: "#122a51" },
              { label: "Absent", value: absentCount, color: "#f5730b" },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2.5 py-1.5"
              >
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: row.color }}
                  />
                  {row.label}
                </span>
                <span className="font-medium text-slate-800">
                  {analyticsLoading ? "—" : row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Users size={15} className="text-orange-500" />
          <h3 className="font-semibold text-slate-800 text-sm">
            {isToday ? "Today's attendance" : "Attendance"}
            {!recordsLoading && (
              <span className="text-slate-400 font-normal">
                {" "}
                ({filteredRecords.length} of {records.length})
              </span>
            )}
          </h3>
        </div>

        {recordsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-20 bg-slate-100 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-400">
            No one has checked in {search ? "matching that search" : "yet"} for
            this day.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {mobileVisibleRecords.map((record) => (
                <AttendanceCard key={record.id} record={record} />
              ))}
            </div>

            {mobileHasMore && (
              <button
                onClick={() =>
                  setMobileVisibleCount((c) => c + PAGE_SIZE_MOBILE)
                }
                className="w-full mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-orange-600 bg-white border border-slate-200 rounded-xl py-2.5"
              >
                Load more
                <ChevronDown size={15} />
              </button>
            )}
          </>
        )}
      </div>
      {/* ==================== /MOBILE ==================== */}
    </div>
  );
}
