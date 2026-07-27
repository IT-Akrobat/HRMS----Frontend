import { Clock3, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { apiClient } from "../../services/apiClient";

// Top employees by attendance punctuality over the trailing 30 days —
// backed by GET /dashboard/top-performers (see
// app/dashboard/services.py -> get_top_performers). There's no separate
// "performance rating" concept in this schema, so rather than show fake
// numbers, this is real punctuality/attendance data, ranked.

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

// Gold / silver / bronze for the top 3, plain slate after that.
const RANK_STYLES = [
  { bg: "bg-amber-100", fg: "text-amber-600", ring: "ring-amber-200" },
  { bg: "bg-slate-200", fg: "text-slate-600", ring: "ring-slate-300" },
  { bg: "bg-orange-100", fg: "text-orange-500", ring: "ring-orange-200" },
];

function RankBadge({ rank }) {
  const style = RANK_STYLES[rank - 1] || {
    bg: "bg-slate-100",
    fg: "text-slate-400",
    ring: "ring-slate-100",
  };
  return (
    <div
      className={`w-5 h-5 rounded-full ${style.bg} ${style.fg} text-[10px] font-bold flex items-center justify-center shrink-0`}
    >
      {rank}
    </div>
  );
}

function Avatar({ person, rank }) {
  const style = RANK_STYLES[rank - 1];
  return (
    <div
      className={`relative w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-semibold text-slate-600 overflow-hidden shrink-0 ${
        style ? `ring-2 ${style.ring}` : ""
      }`}
    >
      {person.profile_photo ? (
        <img
          src={person.profile_photo}
          alt={person.full_name}
          className="w-full h-full object-cover"
        />
      ) : (
        initials(person.full_name)
      )}
    </div>
  );
}

export default function TopPerformersCard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiClient
      .get("/dashboard/top-performers?days=30&limit=5")
      .then((res) => setData(res || { employees: [] }))
      .catch(() => setData({ employees: [] }));
  }, []);

  const employees = data?.employees || [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Trophy size={17} className="text-amber-500" /> Top Performance
        </h3>
        {data && (
          <span className="text-xs text-slate-400 shrink-0">Last 30 days</span>
        )}
      </div>

      {!data ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-10 bg-slate-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <p className="text-sm text-slate-400">
          Not enough attendance data yet to rank employees.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-y-auto max-h-64">
          {employees.map((p, i) => {
            const rank = i + 1;
            return (
              <li
                key={p.employee_id}
                className="flex items-center gap-3 py-2.5"
              >
                <RankBadge rank={rank} />
                <Avatar person={p} rank={rank} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {p.full_name}
                  </p>
                  <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                    <Clock3 size={10} className="shrink-0" />
                    {p.on_time_days}/{p.present_days} on-time
                    {p.department_name ? ` · ${p.department_name}` : ""}
                  </p>
                </div>
                <span className="text-xs font-semibold text-emerald-600 shrink-0">
                  {p.punctuality_rate}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
