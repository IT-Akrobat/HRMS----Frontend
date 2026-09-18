import {
  AlarmClock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  LogIn,
  MapPin,
  Moon,
  Pencil,
  Save,
  Search,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Avatar from "../../components/common/Avatar";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import SearchInput from "../../components/common/SearchInput";
import DatePicker from "../../components/layout/DatePicker";
import { useToast } from "../../context/ToastContext";
import { useAttendanceLiveUpdates } from "../../hooks/Useattendanceliveupdates";
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

// The edit modal edits ONLY the time half of the checkout.
//
// The record being fixed is always a specific, already-known attendance
// day (you open this from that day's row, and the date is in the modal
// subtitle), so there is nothing for a date picker to decide -- it was
// just an extra control to get past. The date part is derived in
// `checkOutDatePart` below instead, and the modal shows a single inline
// time picker.
//
// That picker is rendered inline rather than as a dropdown popover: a
// popover inside a modal gets clipped by the modal's own scroll
// container and, on short screens, opens over the footer buttons. Laid
// out inline it can't overflow anything, and the whole control is
// visible without a click.
function toLocalDatePart(iso) {
  const d = parseServerDate(iso);
  return d ? toLocalISODate(d) : "";
}

function toLocalTimePart(iso) {
  const d = parseServerDate(iso);
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const pad2 = (n) => String(n).padStart(2, "0");

// "Select checkout time" picker redesigned to match the missed-checkout
// dialog mock: two number boxes (Hour / Minute) with an up/down stepper
// each — clicking an arrow directly increments or decrements that
// value and wraps at the ends (12 -> 1, 59 -> 0 and back), no dropdown
// list to open/close. Controlled on an "HH:mm" (24h) string, same
// contract the old picker used, so callers didn't need to change.
function TimeSpinnerBox({ label, value, min, max, onChange }) {
  function step(delta) {
    const base = value ?? min;
    const range = max - min + 1;
    const next = ((((base - min + delta) % range) + range) % range) + min;
    onChange(next);
  }

  return (
    <div className="flex-1 min-w-0 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-center">
      <div className="text-xs font-medium text-slate-500 mb-0.5">{label}</div>
      <button
        type="button"
        onClick={() => step(1)}
        aria-label={`Increase ${label.toLowerCase()}`}
        className="w-full flex justify-center text-slate-400 hover:text-slate-600 py-0.5"
      >
        <ChevronUp size={16} />
      </button>
      <div className="text-3xl font-bold text-slate-800 tabular-nums leading-tight py-0.5">
        {value != null ? pad2(value) : "--"}
      </div>
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label={`Decrease ${label.toLowerCase()}`}
        className="w-full flex justify-center text-slate-400 hover:text-slate-600 py-0.5"
      >
        <ChevronDown size={16} />
      </button>
    </div>
  );
}

// Vertical AM/PM capsule — filled navy on the selected half, matching
// the mock (rather than the old horizontal-column AM/PM buttons).
function MeridiemToggle({ isPm, onChange }) {
  return (
    <div className="w-16 shrink-0 rounded-xl bg-slate-50 border border-slate-100 p-1 flex flex-col gap-1">
      {[false, true].map((pm) => (
        <button
          type="button"
          key={pm ? "PM" : "AM"}
          onClick={() => onChange(pm)}
          className={`flex-1 rounded-lg text-sm font-semibold transition-colors ${
            isPm === pm
              ? "bg-blue-950 text-white"
              : "text-slate-400 hover:bg-white"
          }`}
        >
          {pm ? "PM" : "AM"}
        </button>
      ))}
    </div>
  );
}

function InlineTimePicker({ value, onChange, helperText }) {
  const [h24, minute] = (value || "").split(":").map(Number);
  const hasValue = Number.isFinite(h24) && Number.isFinite(minute);
  const hour12 = hasValue ? h24 % 12 || 12 : null;
  const isPm = hasValue ? h24 >= 12 : false;

  function emit({ nextHour12 = hour12, nextMinute = minute, nextPm = isPm }) {
    const base = (nextHour12 ?? 12) % 12;
    onChange?.(`${pad2(base + (nextPm ? 12 : 0))}:${pad2(nextMinute ?? 0)}`);
  }

  return (
    <div className="flex items-start gap-4">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <TimeSpinnerBox
          label="Hour"
          value={hour12}
          min={1}
          max={12}
          onChange={(n) => emit({ nextHour12: n })}
        />
        <span className="text-xl font-bold text-slate-300 mt-4">:</span>
        <TimeSpinnerBox
          label="Minute"
          value={minute}
          min={0}
          max={59}
          onChange={(n) => emit({ nextMinute: n })}
        />
        <MeridiemToggle isPm={isPm} onChange={(pm) => emit({ nextPm: pm })} />
      </div>

      {/* Decorative preview panel — desktop-only breathing room next to
          the pickers, mirroring the mock's clock illustration + helper
          copy. Hidden on narrow screens rather than squeezed in. */}
      {helperText && (
        <div className="hidden sm:flex flex-col items-center text-center w-32 shrink-0 border-l border-slate-100 pl-4 ml-1">
          <div className="relative w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-2">
            <Clock size={22} className="text-blue-900" />
            <Sparkles
              size={12}
              className="absolute -top-1 -right-1 text-orange-400"
            />
          </div>
          <p className="text-[11px] leading-snug text-slate-500">
            {helperText}
          </p>
        </div>
      )}
    </div>
  );
}

// Recombines a "YYYY-MM-DD" date part + "HH:mm" time part (both local)
// back into the UTC ISO string the API expects.
//
// checkInIso, when given, guards against overnight shifts: this modal
// has no date field (see EditAttendanceModal above -- the date is
// fixed to the row being edited), so picking a checkout clock-time
// that's earlier than the check-in clock-time -- e.g. checked in 10:07
// PM, checking out 06:00 AM -- would otherwise combine onto the SAME
// calendar date as check-in, landing before it. That produced a
// negative (clamped to 0) working_minutes and an "Early Checkout"
// status for a perfectly normal overnight shift. If the combined
// instant is at or before check-in, roll it forward one day instead --
// the standard "this clock time means whichever occurrence comes after
// check-in" reading used by every shift-based time tracker.
function combineDateAndTimeToServerISOString(datePart, timePart, checkInIso) {
  if (!datePart || !timePart) return null;
  let d = new Date(`${datePart}T${timePart}:00`);
  if (isNaN(d.getTime())) return null;

  const checkIn = checkInIso ? parseServerDate(checkInIso) : null;
  if (checkIn && d.getTime() <= checkIn.getTime()) {
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }

  return d.toISOString();
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

function AttendanceRow({ record, onEdit }) {
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
      <button
        onClick={() => onEdit?.(record)}
        title="Edit check-in / check-out time"
        className="shrink-0 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg p-1.5"
      >
        <Pencil size={14} />
      </button>
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
function AttendanceCard({ record, onEdit }) {
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

          <button
            onClick={() => onEdit?.(record)}
            className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-orange-600"
          >
            <Pencil size={12} /> Edit times
          </button>
        </div>
      </div>
    </div>
  );
}

// Lets HR fix check-in / check-out time directly on a record -- the
// main use case being a forgotten checkout (check_out_time still null,
// so working_minutes/overtime_minutes on the row are blank/"—"). Saves
// via PUT /attendance/{id} (admin_update_attendance), which recomputes
// working_minutes/overtime_minutes/status server-side from whatever
// check-in/check-out end up final, so those figures fill in correctly
// the moment this is saved -- no separate "recalculate" step needed.
function EditAttendanceModal({ record, onClose, onSaved }) {
  const { showToast } = useToast();
  const [checkOutTime, setCheckOutTime] = useState(() =>
    toLocalTimePart(record?.check_out_time),
  );
  const [saving, setSaving] = useState(false);

  const open = !!record;

  // No date picker: this modal is always opened from one specific day's
  // attendance row, so the date is already decided -- always anchor to
  // the row's own attendance_date.
  //
  // This used to prefer the date an *existing* check_out_time was
  // already on, to "cover a shift that already crossed midnight". That
  // backfires the moment the existing check_out_time is itself wrong:
  // picking a time is re-anchored against whatever day that bad value
  // happened to land on, not the actual attendance day, so the error
  // compounds instead of getting corrected. Concretely -- check-in
  // 9:37 AM, forgotten checkout, HR opens this modal the next day and
  // saves 6:00 PM: combineDateAndTimeToServerISOString correctly
  // stores that same-day 6:00 PM (no rollover, since 6:00 PM is after
  // 9:37 AM). But if that first save had instead landed on the next
  // calendar day for any reason (e.g. an earlier mis-pick that *did*
  // roll over), reopening this modal would seed checkOutDate from that
  // already-rolled date, and a subsequent 6:00 PM pick -- still after
  // 9:37 AM relative to *that* day -- would no longer trigger a
  // rollover check against the true check-in day at all, permanently
  // locking the record a full day ahead (~32h "worked" instead of
  // ~8h23m; see the Attendance Overview bars showing 28-32h stints).
  // Anchoring to attendance_date every time makes repeated edits
  // idempotent: the rollover is always decided fresh against the real
  // check-in, never against a previous edit's possibly-wrong result.
  const checkOutDate = record?.attendance_date || "";

  // Live preview of where combineDateAndTimeToServerISOString's overnight
  // roll-over (see its comment) would land the current picker
  // selection, so the modal can surface it instead of silently filing
  // an overnight checkout under the next day with no explanation.
  const previewCheckoutIso = combineDateAndTimeToServerISOString(
    checkOutDate,
    checkOutTime,
    record?.check_in_time,
  );
  const rolledToNextDay =
    !!previewCheckoutIso &&
    toLocalDatePart(previewCheckoutIso) !== checkOutDate;
  const nextDayLabel = rolledToNextDay
    ? new Date(
        `${toLocalDatePart(previewCheckoutIso)}T00:00:00`,
      ).toLocaleDateString(undefined, { day: "2-digit", month: "short" })
    : "";

  // Re-seed whenever a different record is opened -- this modal stays
  // mounted (record just switches between a row and null) so the state
  // initializer above only runs once per mount, not per row clicked.
  useEffect(() => {
    if (!record) return;
    setCheckOutTime(toLocalTimePart(record.check_out_time));
  }, [record]);

  async function handleSave() {
    if (!checkOutDate || !checkOutTime) {
      showToast({
        title: "Pick a check-out time",
        icon: AlertTriangle,
        iconClassName: "text-orange-500 bg-orange-50",
      });
      return;
    }

    // check_in_time is deliberately left out of the payload -- this
    // modal only ever fixes a forgotten checkout, so the existing
    // check-in stays exactly as it was. admin_update_attendance only
    // touches fields present in the request body, and its
    // working_minutes/overtime recompute already falls back to the
    // row's current check_in_time when this key is absent.
    const payload = {
      check_out_time: combineDateAndTimeToServerISOString(
        checkOutDate,
        checkOutTime,
        record?.check_in_time,
      ),
    };

    setSaving(true);
    try {
      await apiClient.put(`/attendance/${record.id}`, payload);
      showToast({
        title: "Attendance updated",
        message: `Working hours and overtime for ${
          record.employees?.full_name || "this employee"
        } have been recalculated.`,
        icon: CheckCircle2,
        iconClassName: "text-emerald-600 bg-emerald-50",
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      showToast({
        title: "Couldn't update attendance",
        message: err.message,
        icon: AlertTriangle,
        iconClassName: "text-orange-500 bg-orange-50",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title="Log a missed checkout"
      subtitle={
        record
          ? `${record.employees?.full_name || "Employee"} — ${
              record.attendance_date || ""
            }`
          : ""
      }
      icon={
        <div className="relative w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
          <Clock size={24} className="text-orange-500" />
          <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-orange-500 border-2 border-white flex items-center justify-center text-white text-[10px] font-bold leading-none">
            !
          </span>
        </div>
      }
      footer={
        <>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            <Save size={15} />
            {saving ? "Saving..." : "Save changes"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Checked-in context banner — a warm peach panel instead of the
            plain gray inline row this used to be, with the check-in
            time set off on the right by a divider, matching the mock's
            "Checked in" info card. */}
        <div className="flex items-center gap-3 rounded-xl bg-orange-50/70 border border-orange-100 px-4 py-3.5">
          <span className="grid place-items-center w-9 h-9 rounded-full bg-orange-500 text-white shrink-0">
            <LogIn size={16} />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800">
              Checked in
            </div>
          </div>
          <div className="ml-auto pl-4 border-l border-orange-200/70 flex items-center gap-1.5 shrink-0">
            <Clock size={14} className="text-slate-400" />
            <div>
              <div className="text-sm font-bold text-slate-800 tabular-nums leading-tight">
                {record?.check_in_time ? formatTime(record.check_in_time) : "—"}
              </div>
              <div className="text-[10px] text-slate-400">Check-in time</div>
            </div>
          </div>
        </div>

        {/* Picker card — matches the mock's light slate panel with its
            own icon/heading/description instead of the picker sitting
            bare on the modal body. */}
        <div className="rounded-xl bg-slate-50/70 border border-slate-100 p-4">
          <div className="flex items-start gap-2.5 mb-4">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-blue-50 text-blue-900 shrink-0">
              <AlarmClock size={16} />
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-800">
                Select checkout time
              </div>
              <div className="text-xs text-slate-500">
                Choose the time when you want to log your checkout.
              </div>
            </div>
          </div>

          <InlineTimePicker
            value={checkOutTime}
            onChange={setCheckOutTime}
            helperText={
              checkOutDate
                ? `The selected time will be saved as your checkout time for ${checkOutDate}.`
                : undefined
            }
          />
        </div>

        {rolledToNextDay && (
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Moon size={12} className="text-slate-400 shrink-0" />
            Earlier than check-in — this will be logged as a checkout on{" "}
            {nextDayLabel}.
          </p>
        )}
      </div>
    </Modal>
  );
}

const PAGE_SIZE = 10;
const PAGE_SIZE_MOBILE = 8; // smaller batches for the mobile "Load more" button

export default function HrAttendanceOverview() {
  const [selectedDate, setSelectedDate] = useState(toLocalISODate());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingRecord, setEditingRecord] = useState(null);

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

  function loadSiteVisits() {
    apiClient
      .get("/attendance/org/site-visits")
      .then((res) => {
        const rows = unwrap(res) || [];
        setOnSiteCount(rows.filter((r) => r.live_status === "on_site").length);
      })
      .catch(() => setOnSiteCount(0));
  }

  useEffect(() => {
    loadSiteVisits();
  }, []);

  function loadDayData() {
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
  }

  useEffect(() => {
    loadDayData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Refetch the instant anyone checks in/out or starts/ends a break,
  // instead of waiting on the old 60s poll (site visits) or a manual
  // page refresh (analytics/records) — same /ws/dashboard feed the
  // dashboards already use. Only the on-site count needs to stay live
  // regardless of which day is selected; the analytics/records refetch
  // only matters while looking at today, so skip it for past days.
  useAttendanceLiveUpdates(() => {
    loadSiteVisits();
    if (selectedDate === toLocalISODate()) {
      loadDayData();
    }
  });

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
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search by name or employee ID..."
                  className="w-full sm:w-64"
                  iconSize={14}
                  inputClassName="py-2"
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
                <AttendanceRow
                  key={record.id}
                  record={record}
                  onEdit={setEditingRecord}
                />
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
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search "
                className="w-full sm:w-64"
                iconSize={14}
                inputClassName="py-2"
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
                <AttendanceCard
                  key={record.id}
                  record={record}
                  onEdit={setEditingRecord}
                />
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

      <EditAttendanceModal
        record={editingRecord}
        onClose={() => setEditingRecord(null)}
        onSaved={loadDayData}
      />
    </div>
  );
}
