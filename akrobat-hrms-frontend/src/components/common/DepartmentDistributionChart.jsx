import { PieChart } from "lucide-react";
import { useState } from "react";

// Donut chart built from plain SVG circles (stroke-dasharray trick) rather
// than a charting library — see AttendanceTrendChart.jsx for why.
//
// Expects the GET /dashboard/department-distribution payload:
//   { departments: [{ department_id, department_name, employee_count }] }

// Orange + navy brand tints only (no other hues), ordered for max
// contrast between adjacent department slices.
const PALETTE = [
  "#F5730B", // brand orange
  "#0B1830", // brand navy
  "#3B82F6", // blue
  "#FDBA74", // light orange
  "#1E40AF", // dark blue
  "#FB923C", // mid orange
  "#93C5FD", // light blue
  "#C2410C", // dark orange
];

export default function DepartmentDistributionChart({ departments, loading }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 h-full flex flex-col">
        <div className="h-5 w-48 bg-slate-100 rounded animate-pulse mb-4" />
        <div className="h-48 bg-slate-100 rounded animate-pulse flex-1" />
      </div>
    );
  }

  const rows = (departments || []).filter((d) => d.employee_count > 0);
  const total = rows.reduce((sum, d) => sum + d.employee_count, 0);

  const size = 180;
  const strokeWidth = 26;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const center = size / 2;

  let cumulative = 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 h-full flex flex-col">
      <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
        <PieChart size={17} className="text-orange-500" /> Employees by
        Department
      </h3>

      {rows.length === 0 || total === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center flex-1 flex items-center justify-center">
          No department data to show yet.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-6 flex-1 min-h-0">
          <div className="relative shrink-0">
            <svg
              viewBox={`0 0 ${size} ${size}`}
              width={size}
              height={size}
              style={{ transform: "rotate(-90deg)" }}
            >
              {rows.map((row, idx) => {
                const fraction = row.employee_count / total;
                const segLength = fraction * circumference;
                const offset = -cumulative * circumference;
                cumulative += fraction;
                const isFaded = hoverIdx != null && hoverIdx !== idx ? 0.35 : 1;
                return (
                  <circle
                    key={row.department_id ?? row.department_name}
                    cx={center}
                    cy={center}
                    r={r}
                    fill="none"
                    stroke={PALETTE[idx % PALETTE.length]}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${segLength} ${circumference - segLength}`}
                    strokeDashoffset={offset}
                    opacity={isFaded}
                    style={{ cursor: "pointer", transition: "opacity 0.15s" }}
                    onMouseEnter={() => setHoverIdx(idx)}
                    onMouseLeave={() => setHoverIdx(null)}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-slate-800">
                {hoverIdx != null ? rows[hoverIdx].employee_count : total}
              </span>
              <span className="text-[10px] text-slate-400 text-center px-2 truncate max-w-[90px]">
                {hoverIdx != null
                  ? rows[hoverIdx].department_name
                  : "Employees"}
              </span>
            </div>
          </div>

          {/* Scrollable rather than unbounded — with enough departments
              this list used to grow taller than the Attendance Trend
              chart next to it, throwing the two cards out of alignment.
              Same max-h-64 + overflow-y-auto pattern as the On Leave
              Today / Birthdays lists below. */}
          <div className="w-full space-y-2 overflow-y-auto max-h-64">
            {rows.map((row, idx) => (
              <div
                key={row.department_id ?? row.department_name}
                className="flex items-center justify-between text-xs cursor-pointer"
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{
                  opacity: hoverIdx != null && hoverIdx !== idx ? 0.5 : 1,
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 inline-block"
                    style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
                  />
                  <span className="text-slate-600 truncate">
                    {row.department_name}
                  </span>
                </div>
                <span className="text-slate-400 shrink-0 ml-2">
                  {row.employee_count} ·{" "}
                  {Math.round((row.employee_count / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
