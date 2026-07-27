import { TrendingUp } from "lucide-react";
import { useState } from "react";

// Stacked daily bar chart: On Time / Late / On Leave / Absent, stacked to
// each day's total_employees so bar height stays comparable across days.
// Built with plain SVG rather than pulling in a charting library — this repo
// has no chart dependency installed yet, and this keeps the bundle untouched.
//
// Expects `trend` shaped like the GET /dashboard/attendance-trend payload:
//   { total_employees, trend: [{ date, present, late, on_leave, absent }] }

const SERIES = [
  { key: "onTime", label: "On Time", color: "#F5730B" }, // brand orange
  { key: "late", label: "Late", color: "#FDBA74" }, // light orange
  { key: "on_leave", label: "On Leave", color: "#3B82F6" }, // blue
  { key: "absent", label: "Absent", color: "#CBD5E1" }, // neutral (no data)
];

function dayLabel(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString([], {
    weekday: "short",
  });
}

// Compact-label variant used for the Month view (30 daily bars) — weekday
// names ("Mon") get crowded/illegible at that bar width, so this shows
// "D Mon" (e.g. "3 Jul") instead, matching the tooltip's date format.
function dayLabelShort(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
}

const RANGE_OPTIONS = [
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

export default function AttendanceTrendChart({
  trend,
  loading,
  range,
  onRangeChange,
}) {
  const [hoverIdx, setHoverIdx] = useState(null);

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
        <div className="h-48 bg-slate-100 rounded animate-pulse flex-1" />
      </div>
    );
  }

  const days = trend?.trend || [];
  const totalEmployees = trend?.total_employees || 0;

  const width = 560;
  const height = 220;
  const padTop = 12;
  const padBottom = 28;
  const padLeft = 8;
  const padRight = 8;
  const chartHeight = height - padTop - padBottom;
  const chartWidth = width - padLeft - padRight;
  const scaleMax = Math.max(totalEmployees, 1);

  const n = Math.max(days.length, 1);
  const gap = 10;
  const barWidth = Math.max(6, (chartWidth - gap * (n - 1)) / n);

  const rows = days.map((d) => ({
    ...d,
    onTime: Math.max(0, (d.present || 0) - (d.late || 0)),
  }));

  const hovered = hoverIdx != null ? rows[hoverIdx] : null;

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

      {days.length === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center flex-1 flex items-center justify-center">
          No attendance data yet for this period.
        </p>
      ) : (
        <>
          <div className="relative flex-1 flex flex-col justify-center">
            {hovered && (
              <div
                className="absolute -top-1 bg-slate-800 text-white text-[11px] rounded-lg px-2.5 py-1.5 pointer-events-none shadow-lg z-10"
                style={{
                  left: `${((hoverIdx + 0.5) / n) * 100}%`,
                  transform: "translate(-50%, -100%)",
                }}
              >
                <div className="font-medium mb-0.5">
                  {new Date(hovered.date + "T00:00:00").toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div>On time: {hovered.onTime}</div>
                <div>Late: {hovered.late}</div>
                <div>On leave: {hovered.on_leave}</div>
                <div>Absent: {hovered.absent}</div>
              </div>
            )}

            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full"
              style={{ height: 220 }}
            >
              {/* baseline */}
              <line
                x1={padLeft}
                y1={height - padBottom}
                x2={width - padRight}
                y2={height - padBottom}
                stroke="#F1F5F9"
                strokeWidth="1"
              />

              {rows.map((row, idx) => {
                const x = padLeft + idx * (barWidth + gap);
                let yCursor = height - padBottom;
                return (
                  <g
                    key={row.date}
                    onMouseEnter={() => setHoverIdx(idx)}
                    onMouseLeave={() => setHoverIdx(null)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* invisible full-height hit target so hover works even
                        over empty space above short bars */}
                    <rect
                      x={x}
                      y={padTop}
                      width={barWidth}
                      height={chartHeight}
                      fill="transparent"
                    />
                    {SERIES.map((s) => {
                      const value = row[s.key] || 0;
                      const segHeight = (value / scaleMax) * chartHeight;
                      yCursor -= segHeight;
                      return (
                        <rect
                          key={s.key}
                          x={x}
                          y={yCursor}
                          width={barWidth}
                          height={segHeight}
                          fill={s.color}
                          opacity={
                            hoverIdx === idx || hoverIdx === null ? 1 : 0.4
                          }
                          rx={segHeight > 0 ? 2 : 0}
                        />
                      );
                    })}
                    {/* Month view (30 bars) skips every other label — even
                        at fontSize 9 all 30 would overlap and smear
                        together — Week view (7 bars) shows every one. */}
                    {(n <= 10 || idx % 2 === 0) && (
                      <text
                        x={x + barWidth / 2}
                        y={height - padBottom + 16}
                        textAnchor="middle"
                        fontSize={n > 10 ? "9" : "10"}
                        fill="#94A3B8"
                      >
                        {n > 10 ? dayLabelShort(row.date) : dayLabel(row.date)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
            {SERIES.map((s) => (
              <div
                key={s.key}
                className="flex items-center gap-1.5 text-xs text-slate-500"
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ backgroundColor: s.color }}
                />
                {s.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
