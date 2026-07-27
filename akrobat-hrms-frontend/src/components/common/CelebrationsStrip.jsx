import { Cake, PartyPopper, PlaneTakeoff } from "lucide-react";
import { useEffect, useState } from "react";
import { apiClient } from "../../services/apiClient";

// Two bordered cards — same look as HolidaysCalendarCard / the
// Announcements card next to it — instead of the old loose horizontal
// chip strip. Meant to sit side by side in a
// `grid grid-cols-1 lg:grid-cols-2 gap-6` row, OnLeaveTodayCard first:
//   OnLeaveTodayCard   — GET /dashboard/on-leave-today
//   BirthdaysCard      — GET /dashboard/celebrations (birthdays +
//                         work anniversaries, next 30 days)

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function relativeLabel(daysAway) {
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  return new Date(Date.now() + daysAway * 86400000).toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "short" },
  );
}

function Avatar({ person }) {
  return (
    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-semibold text-slate-600 overflow-hidden shrink-0">
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

// "Who's out today" — backed by GET /dashboard/on-leave-today (see
// app/dashboard/services.py -> get_on_leave_today).
export function OnLeaveTodayCard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiClient
      .get("/dashboard/on-leave-today")
      .then((res) => setData(res || { employees: [] }))
      .catch(() => setData({ employees: [] }));
  }, []);

  const employees = data?.employees || [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <PlaneTakeoff size={17} className="text-blue-500" /> On Leave Today
        </h3>
        {data && (
          <span className="text-xs text-slate-400 shrink-0">
            {employees.length} {employees.length === 1 ? "person" : "people"}
          </span>
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
        <p className="text-sm text-slate-400">No one is on leave today.</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-y-auto max-h-64">
          {employees.map((p) => (
            <li key={p.employee_id} className="flex items-center gap-3 py-2.5">
              <Avatar person={p} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {p.full_name}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {p.leave_type || "Leave"}
                  {p.department_name ? ` · ${p.department_name}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CelebrationRow({ person, icon, sublabel }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="relative shrink-0">
        <Avatar person={person} />
        {person.on_leave_today && (
          <div
            title="On leave today"
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center"
          >
            <PlaneTakeoff size={8} className="text-white" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800 truncate flex items-center gap-1">
          {icon} {person.full_name}
        </p>
        <p className="text-xs text-slate-400 truncate">
          {sublabel} · {relativeLabel(person.days_away)}
          {person.on_leave_today && (
            <span className="text-amber-600 font-medium">
              {" "}
              · On leave today
            </span>
          )}
        </p>
      </div>
    </li>
  );
}

// Birthdays + work anniversaries, next 30 days — backed by
// GET /dashboard/celebrations (see app/dashboard/services.py ->
// get_celebrations).
export default function BirthdaysCard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiClient
      .get("/dashboard/celebrations?days=30")
      .then((res) => setData(res || { birthdays: [], anniversaries: [] }))
      .catch(() => setData({ birthdays: [], anniversaries: [] }));
  }, []);

  const birthdays = data?.birthdays || [];
  const anniversaries = data?.anniversaries || [];
  const items = [...birthdays, ...anniversaries];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Cake size={17} className="text-pink-500" /> Upcoming Birthdays
        </h3>
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
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">
          No birthdays or anniversaries in the next 30 days.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-y-auto max-h-64">
          {birthdays.map((p) => (
            <CelebrationRow
              key={`bday-${p.employee_id}`}
              person={p}
              icon={<Cake size={12} className="text-pink-500" />}
              sublabel="Birthday"
            />
          ))}

          {anniversaries.map((p) => (
            <CelebrationRow
              key={`anniv-${p.employee_id}`}
              person={p}
              icon={<PartyPopper size={12} className="text-purple-500" />}
              sublabel={`${p.years} yr${p.years === 1 ? "" : "s"} anniversary`}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
