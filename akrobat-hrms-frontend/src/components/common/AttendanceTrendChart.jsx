import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { ChevronLeft, FileText, Loader2, TrendingUp, X } from "lucide-react";
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

// Small icon button used to trigger the PDF export. Rendered twice at
// different breakpoints (see ExportButton usages below) rather than once
// with responsive classes, since desktop places it inline next to the
// range toggle while mobile places it on its own row below the tabs.
function ExportButton({ exporting, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={exporting}
      aria-label="Export as PDF"
      title="Export as PDF"
      className={`flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 shrink-0 ${className}`}
    >
      {exporting ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <FileText size={13} />
      )}
    </button>
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

// Redraws the exact same donut + legend composition seen on screen onto
// an offscreen <canvas>, returning a PNG data URL. jsPDF (no svg2pdf
// plugin installed in this repo) can only place raster images, not the
// live SVG this component renders in the browser -- this keeps the same
// colors/segments/center-label so the PDF's chart matches what's on
// screen pixel-for-pixel in composition, just rasterized.
function renderDonutImage(totals) {
  const scale = 2;
  const width = 480 * scale;
  const height = 220 * scale;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  const cx = 110 * scale;
  const cy = height / 2;
  const r = 78 * scale;
  const strokeWidth = 26 * scale;
  const grandTotal = SERIES.reduce((sum, s) => sum + (totals[s.key] || 0), 0);

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "#F1F5F9";
  ctx.lineWidth = strokeWidth;
  ctx.stroke();

  let cursor = -Math.PI / 2;
  SERIES.forEach((s) => {
    const value = totals[s.key] || 0;
    if (!value || grandTotal === 0) return;
    const sweep = (value / grandTotal) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, cursor, cursor + sweep);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "butt";
    ctx.stroke();
    cursor += sweep;
  });

  ctx.fillStyle = "#1E293B";
  ctx.font = `600 ${26 * scale}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(String(totals.on_leave || 0), cx, cy - 2 * scale);
  ctx.fillStyle = "#94A3B8";
  ctx.font = `${11 * scale}px sans-serif`;
  ctx.fillText("On Leave", cx, cy + 18 * scale);

  const legendX = 230 * scale;
  let legendY = cy - (SERIES.length * 26 * scale) / 2 + 8 * scale;
  ctx.textAlign = "left";
  SERIES.forEach((s) => {
    ctx.fillStyle = s.color;
    ctx.fillRect(legendX, legendY - 9 * scale, 10 * scale, 10 * scale);
    ctx.fillStyle = "#475569";
    ctx.font = `${13 * scale}px sans-serif`;
    ctx.fillText(
      `${s.label} · ${totals[s.key] || 0}`,
      legendX + 16 * scale,
      legendY,
    );
    legendY += 26 * scale;
  });

  return { dataUrl: canvas.toDataURL("image/png"), width, height };
}

function hexToRgbArray(hex) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
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
  const [exporting, setExporting] = useState(false);

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

  // Exports exactly what's on screen right now: the same donut (same
  // range, same totals) plus, for every segment, the full list of
  // employees behind it -- fetched from the same
  // /dashboard/attendance-trend/detail endpoint the click-through list
  // already uses, just for all 4 statuses at once instead of one at a
  // time.
  async function exportPdf() {
    setExporting(true);
    try {
      const results = await Promise.all(
        SERIES.map((s) =>
          apiClient
            .get(
              `/dashboard/attendance-trend/detail?days=${windowDays}&status=${s.key}`,
            )
            .then((res) => ({ key: s.key, people: res?.people || [] }))
            .catch(() => ({ key: s.key, people: [] })),
        ),
      );
      const peopleByKey = Object.fromEntries(
        results.map((r) => [r.key, r.people]),
      );

      const rangeLabel = onRangeChange
        ? RANGE_OPTIONS.find((o) => o.key === range)?.label || "Custom"
        : `Last ${windowDays} days`;

      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text("Attendance Trend", 14, 16);
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(
        `${rangeLabel}  ·  Generated ${new Date().toLocaleDateString()}`,
        14,
        22,
      );

      const { dataUrl, width, height } = renderDonutImage(totals);
      const imgWidthMm = 90;
      const imgHeightMm = (height / width) * imgWidthMm;
      doc.addImage(dataUrl, "PNG", 14, 28, imgWidthMm, imgHeightMm);

      let cursorY = 28 + imgHeightMm + 10;
      SERIES.forEach((s) => {
        const segPeople = peopleByKey[s.key] || [];

        if (cursorY > 260) {
          doc.addPage();
          cursorY = 20;
        }

        doc.setFontSize(11);
        doc.setTextColor(30);
        doc.text(`${s.label} (${totals[s.key] || 0})`, 14, cursorY);

        if (segPeople.length === 0) {
          doc.setFontSize(9);
          doc.setTextColor(140);
          doc.text(
            "No one in this category for the selected range.",
            14,
            cursorY + 6,
          );
          cursorY += 16;
          return;
        }

        autoTable(doc, {
          head: [["Employee", "Employee ID", "Department", "Days"]],
          body: segPeople.map((p) => [
            p.full_name || "",
            p.employee_code || "",
            p.department || "",
            p.days ?? "",
          ]),
          startY: cursorY + 3,
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: hexToRgbArray(s.color) },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: 14, right: 14 },
        });
        cursorY = doc.lastAutoTable.finalY + 10;
      });

      doc.save(
        `attendance_trend_${rangeLabel.toLowerCase().replace(/\s+/g, "_")}.pdf`,
      );
    } finally {
      setExporting(false);
    }
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
  const canExport = days.length > 0 && grandTotal > 0;
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
      <div className="flex items-center justify-between mb-1 gap-2">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2 min-w-0">
          <TrendingUp
            size={17}
            className="hidden lg:inline text-orange-500 shrink-0"
          />
          <span className="lg:hidden">Attendance</span>
          <span className="hidden lg:inline">Attendance Trend</span>
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {onRangeChange ? (
            <RangeToggle range={range} onRangeChange={onRangeChange} />
          ) : (
            <span className="text-xs text-slate-400">
              Last {days.length || 7} days
            </span>
          )}
          {/* Export sits right next to the range toggle on every
              breakpoint — no separate row, no dead space. */}
          {canExport && (
            <ExportButton exporting={exporting} onClick={exportPdf} />
          )}
        </div>
      </div>

      {days.length === 0 || grandTotal === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center flex-1 flex items-center justify-center">
          No attendance data yet for this period.
        </p>
      ) : (
        <div className="flex-1 flex flex-row items-start lg:items-center gap-2 min-h-[180px] mt-4 lg:mt-0">
          {/* ---------- Donut + legend (left) ---------- */}
          {/* On mobile this is a drill-down: hidden once a status is
              selected, so the people list below gets the full card width
              instead of squeezing into a third column next to the ring. */}
          <div
            className={`${
              selectedKey ? "hidden lg:flex" : "flex"
            } w-full lg:w-auto flex-row lg:flex-col items-center justify-between lg:justify-start gap-4 lg:gap-0 shrink-0`}
          >
            <div className="relative flex items-center justify-center shrink-0">
              <svg
                viewBox={`0 0 ${size} ${size}`}
                className="max-w-[170px] lg:max-w-[200px] w-full h-auto"
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

            <div className="flex flex-col lg:flex-row lg:flex-wrap items-start lg:items-center gap-1.5 lg:gap-x-4 lg:gap-y-1.5 lg:mt-2 lg:justify-center min-w-0">
              {SERIES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onMouseEnter={() => setHoverKey(s.key)}
                  onMouseLeave={() => setHoverKey(null)}
                  onClick={() => toggleSelected(s.key)}
                  className={`flex items-center gap-1.5 text-xs cursor-pointer transition-opacity rounded-md px-1.5 py-1 lg:py-0.5 ${
                    selectedKey === s.key ? "bg-slate-100" : ""
                  } ${
                    hoverKey === null || hoverKey === s.key
                      ? "text-slate-500"
                      : "text-slate-300"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="whitespace-nowrap">
                    {s.label} · {totals[s.key] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ---------- Detail panel (right on desktop; full-width drill-down on mobile) ---------- */}
          <div
            className={`${
              selectedKey ? "flex" : "hidden lg:flex"
            } flex-1 self-stretch min-w-0 border-slate-100 border-l-0 lg:border-l pl-0 lg:pl-5 w-full lg:w-auto`}
          >
            {!selectedSeries ? (
              <div className="h-full flex items-center justify-center text-center px-2">
                <p className="text-xs text-slate-400">
                  Click a segment or a legend entry to see who's behind that
                  number.
                </p>
              </div>
            ) : (
              <div className="h-full flex flex-col w-full">
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    onClick={() => setSelectedKey(null)}
                    className="flex items-center gap-1.5 text-sm font-medium text-slate-700 lg:pointer-events-none"
                  >
                    <ChevronLeft
                      size={16}
                      className="text-slate-400 lg:hidden -ml-1"
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-sm inline-block"
                      style={{ backgroundColor: selectedSeries.color }}
                    />
                    {selectedSeries.label}
                    <span className="text-slate-400 font-normal">
                      ({totals[selectedKey] || 0})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(null)}
                    aria-label="Close"
                    className="hidden lg:block text-slate-400 hover:text-slate-600"
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
