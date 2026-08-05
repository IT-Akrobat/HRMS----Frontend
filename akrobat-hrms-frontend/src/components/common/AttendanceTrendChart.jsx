import { TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../services/apiClient";
import Avatar from "./Avatar";

// Donut chart: On Time / Late / On Leave / Absent, aggregated across the
// selected range (Today/Week/Month) into a single ring instead of one bar
// per day — better fit for "what does the split look like right now" than
// a day-by-day trend. Built with plain SVG (no chart dependency installed
// in this repo yet). Center label is always a plain headcount (defaults
// to On Leave, or the hovered segment's count) — never a percentage.
//
// Expects `trend` shaped like the GET /dashboard/attendance-trend payload:
//   { total_employees, trend: [{ date, present, late, on_leave, absent }] }
//
// Clicking a segment (or its legend entry) fetches who's behind that
// number for the same window, via GET /dashboard/attendance-trend/detail,
// and lists them in the empty space to the right of the ring instead of
// opening a separate page/modal.

const SERIES = [
  { key: "onTime", label: "On Time", color: "#F5730B" }, // brand orange
  { key: "late", label: "Late", color: "#FDBA74" }, // light orange
  { key: "on_leave", label: "On Leave", color: "#3B82F6" }, // blue
  { key: "absent", label: "Absent", color: "#CBD5E1" }, // neutral (no data)
];

const RANGE_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

function RangeToggle({ range, onRangeChange }) {
  return (
    <div className="flex items-center bg-slate-100 rounded-full p-0.5 shrink-0">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onRangeChange(opt.key)}
          className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
            range === opt.key
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Builds the <path> for one ring segment given a start/end fraction
// (0..1 of the full circle), centered at (cx, cy) with the given radius
// and stroke width. Using a stroked circle path (rather than pie wedges)
// is what gives the "donut" hole in the middle.
function segmentPath(cx, cy, r, startFrac, endFrac) {
  const startAngle = startFrac * 2 * Math.PI - Math.PI / 2;
  const endAngle = endFrac * 2 * Math.PI - Math.PI / 2;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = endFrac - startFrac > 0.5 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

export default function AttendanceTrendChart({
  trend,
  loading,
  range,
  onRangeChange,
}) {
  const [hoverKey, setHoverKey] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [people, setPeople] = useState([]);
  const [peopleError, setPeopleError] = useState(null);

  const days = trend?.trend || [];
  const windowDays = trend?.days || days.length || 7;

  // Sum each series across every day in the selected range, so the donut
  // shows "how the range's attendance-days split out" as one composition
  // rather than a per-day breakdown. Computed unconditionally (before the
  // loading/empty early-returns below) so hook call order stays stable
  // across renders.
  const totals = useMemo(() => {
    const t = { onTime: 0, late: 0, on_leave: 0, absent: 0 };
    days.forEach((d) => {
      t.onTime += Math.max(0, (d.present || 0) - (d.late || 0));
      t.late += d.late || 0;
      t.on_leave += d.on_leave || 0;
      t.absent += d.absent || 0;
    });
    return t;
  }, [days]);

  // Switching Week/Month (or the underlying trend reloading) invalidates
  // whatever status list was open, since it's scoped to the old window.
  useEffect(() => {
    setSelectedKey(null);
    setPeople([]);
    setPeopleError(null);
  }, [range, windowDays]);

  // Uses the dedicated /dashboard/attendance-trend/detail endpoint rather
  // than the Attendance Reports endpoint (/attendance/org/report) — that
  // one only walks Mon-Fri "working days", so a leave/absence landing on
  // a weekend would count on the donut but never show up in the list.
  // This endpoint mirrors get_attendance_trend()'s own day-by-day math
  // (every calendar day in the window, weekends included) so the count
  // shown here always reconciles with the donut total.
  useEffect(() => {
    if (!selectedKey) return;

    setPeopleLoading(true);
    setPeopleError(null);
    const params = new URLSearchParams({
      days: String(windowDays),
      status: selectedKey,
    });

    apiClient
      .get(`/dashboard/attendance-trend/detail?${params.toString()}`)
      .then((res) => {
        setPeople(res?.people || []);
      })
      .catch((err) => {
        setPeople([]);
        setPeopleError(err.message || "Could not load this list.");
      })
      .finally(() => setPeopleLoading(false));
  }, [selectedKey, windowDays]);

  function toggleSelected(key) {
    setSelectedKey((prev) => (prev === key ? null : key));
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-40 bg-slate-100 rounded animate-pulse" />
          {onRangeChange ? (
            <RangeToggle range={range} onRangeChange={onRangeChange} />
          ) : (
            <div className="h-5 w-16 bg-slate-100 rounded animate-pulse" />
          )}
        </div>
        <div className="h-48 bg-slate-100 rounded-full animate-pulse flex-1 mx-auto aspect-square max-w-[200px]" />
      </div>
    );
  }

  const grandTotal = SERIES.reduce((sum, s) => sum + (totals[s.key] || 0), 0);
  // Center label shows a plain headcount, not a percentage — defaults to
  // the On Leave count for the selected range (Today/Week/Month) so "how
  // many are on leave this week" is visible at a glance without hovering.
  const onLeaveCount = totals.on_leave || 0;

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 78;
  const strokeWidth = 26;

  let cursor = 0;
  const segments = SERIES.map((s) => {
    const value = totals[s.key] || 0;
    const frac = grandTotal > 0 ? value / grandTotal : 0;
    const seg = { ...s, value, startFrac: cursor, endFrac: cursor + frac };
    cursor += frac;
    return seg;
  }).filter((s) => s.value > 0);

  const hovered = hoverKey ? segments.find((s) => s.key === hoverKey) : null;
  const selectedSeries = selectedKey
    ? SERIES.find((s) => s.key === selectedKey)
    : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <TrendingUp size={17} className="text-orange-500" /> Attendance Trend
        </h3>
        {onRangeChange ? (
          <RangeToggle range={range} onRangeChange={onRangeChange} />
        ) : (
          <span className="text-xs text-slate-400">
            Last {days.length || 7} days
          </span>
        )}
      </div>

      {days.length === 0 || grandTotal === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center flex-1 flex items-center justify-center">
          No attendance data yet for this period.
        </p>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row items-center gap-2 min-h-[180px]">
          {/* ---------- Donut + legend (left) ---------- */}
          <div className="flex flex-col items-center shrink-0">
            <div className="relative flex items-center justify-center">
              <svg
                viewBox={`0 0 ${size} ${size}`}
                className="max-w-[200px] w-full h-auto"
              >
                {/* faint full-circle track underneath the segments */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke="#F1F5F9"
                  strokeWidth={strokeWidth}
                />
                {segments.map((s) => (
                  <path
                    key={s.key}
                    d={segmentPath(cx, cy, r, s.startFrac, s.endFrac)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={strokeWidth}
                    strokeLinecap={segments.length > 1 ? "butt" : "round"}
                    opacity={hoverKey === null || hoverKey === s.key ? 1 : 0.35}
                    onMouseEnter={() => setHoverKey(s.key)}
                    onMouseLeave={() => setHoverKey(null)}
                    onClick={() => toggleSelected(s.key)}
                    style={{ cursor: "pointer", transition: "opacity 0.15s" }}
                  />
                ))}

                {/* center label */}
                <text
                  x={cx}
                  y={cy - 4}
                  textAnchor="middle"
                  fontSize="26"
                  fontWeight="600"
                  fill="#1E293B"
                >
                  {hovered ? hovered.value : onLeaveCount}
                </text>
                <text
                  x={cx}
                  y={cy + 16}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#94A3B8"
                >
                  {hovered ? hovered.label : "On Leave"}
                </text>
              </svg>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 justify-center">
              {SERIES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onMouseEnter={() => setHoverKey(s.key)}
                  onMouseLeave={() => setHoverKey(null)}
                  onClick={() => toggleSelected(s.key)}
                  className={`flex items-center gap-1.5 text-xs cursor-pointer transition-opacity rounded-md px-1.5 py-0.5 ${
                    selectedKey === s.key ? "bg-slate-100" : ""
                  } ${
                    hoverKey === null || hoverKey === s.key
                      ? "text-slate-500"
                      : "text-slate-300"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.label} · {totals[s.key] || 0}
                </button>
              ))}
            </div>
          </div>

          {/* ---------- Detail panel (right, previously empty space) ---------- */}
          <div className="flex-1 self-stretch min-w-0 border-t lg:border-t-0 lg:border-l border-slate-100 pt-3 lg:pt-0 lg:pl-5 mt-3 lg:mt-0">
            {!selectedSeries ? (
              <div className="h-full flex items-center justify-center text-center px-4">
                <p className="text-xs text-slate-400">
                  Click a segment or a legend entry to see who's behind that
                  number.
                </p>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <span
                      className="w-2.5 h-2.5 rounded-sm inline-block"
                      style={{ backgroundColor: selectedSeries.color }}
                    />
                    {selectedSeries.label}
                    <span className="text-slate-400 font-normal">
                      ({totals[selectedKey] || 0})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(null)}
                    aria-label="Close"
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X size={15} />
                  </button>
                </div>

                {peopleLoading ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-9 bg-slate-50 rounded-lg animate-pulse"
                      />
                    ))}
                  </div>
                ) : peopleError ? (
                  <p className="text-xs text-red-500">{peopleError}</p>
                ) : people.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No one matches this for the selected range.
                  </p>
                ) : (
                  <div className="space-y-1 overflow-y-auto no-scrollbar max-h-[220px] pr-1">
                    {people.map((p) => (
                      <div
                        key={p.employee_id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50"
                      >
                        <Avatar
                          name={p.full_name}
                          photo={p.profile_photo}
                          size="w-7 h-7"
                          textSize="text-[11px]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-slate-700 truncate">
                            {p.full_name}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {p.department || p.employee_code}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 shrink-0">
                          {p.days} {p.days === 1 ? "day" : "days"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
