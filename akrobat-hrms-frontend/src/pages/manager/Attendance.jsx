import {
  Building2,
  ChevronDown,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  Route,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { apiClient } from "../../services/apiClient";
import { unwrap } from "../../utils/unwrap";

// ---------------------------------------------------------------------
// Team Attendance for managers, split in two because the two groups of
// staff genuinely need different information:
//
//  - Field staff (Inspection / Operation departments — see
//    get_field_employee_ids() in the backend) visit several sites in a
//    day, so "where are they right now" matters more than a single
//    check-in time. GET /attendance/team/site-visits carries that.
//  - Everyone else has one fixed workplace, so the plain check-in /
//    check-out table from GET /attendance/team is all that's relevant.
//
// Same data source, same manager-scoping (both endpoints already
// restrict to this manager's direct + indirect reports server-side) —
// just two different shapes of the same "how's my team doing today".
// ---------------------------------------------------------------------

function formatTime(iso) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(minutes) {
  if (minutes == null) return "in progress";
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Same "so far" treatment as the employee-facing SiteVisitCard: an open
// visit (no departure_time) carries a backend-computed `live_minutes`
// instead of a null duration_minutes, so a manager sees how long the
// report has actually been on site right now, not a frozen "in progress".
function formatVisitDuration(v) {
  const inProgress = !v.departure_time;
  const minutes = inProgress ? v.live_minutes : v.duration_minutes;
  return inProgress
    ? `${formatDuration(minutes)} so far`
    : formatDuration(minutes);
}

const STATUS_STYLE = {
  on_site: {
    label: "On Site",
    dot: "bg-green-500",
    text: "text-green-700",
    bg: "bg-green-50",
  },
  checked_in_no_site: {
    label: "Checked In",
    dot: "bg-blue-500",
    text: "text-blue-700",
    bg: "bg-blue-50",
  },
  checked_out: {
    label: "Checked Out",
    dot: "bg-slate-400",
    text: "text-slate-600",
    bg: "bg-slate-100",
  },
  not_checked_in: {
    label: "Not Checked In",
    dot: "bg-orange-400",
    text: "text-orange-600",
    bg: "bg-orange-50",
  },
};

function HistoryPanel({ employeeId }) {
  const [days, setDays] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 6);
    const toIso = to.toISOString().slice(0, 10);
    const fromIso = from.toISOString().slice(0, 10);

    apiClient
      .get(
        `/attendance/employee/${employeeId}/site-visits?from_date=${fromIso}&to_date=${toIso}`,
      )
      .then((res) => setDays(unwrap(res) || []))
      .catch(() => setDays([]))
      .finally(() => setLoading(false));
  }, [employeeId]);

  if (loading) {
    return <div className="h-16 bg-slate-50 rounded animate-pulse" />;
  }

  if (!days || days.length === 0) {
    return (
      <p className="text-xs text-slate-400 py-2">
        No site visits logged in the past 7 days.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {days.map((d) => (
        <div
          key={d.attendance_date}
          className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2"
        >
          <span className="font-medium text-slate-600">
            {new Date(d.attendance_date).toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            <Route size={11} /> {d.site_count} site
            {d.site_count !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <Clock size={11} /> {formatDuration(d.total_minutes)}
          </span>
        </div>
      ))}
    </div>
  );
}

function FieldStaffRow({ row }) {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const style = STATUS_STYLE[row.live_status] || STATUS_STYLE.not_checked_in;
  const hasVisits = (row.visits || []).length > 0;

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 py-3 text-left cursor-pointer"
      >
        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-semibold text-sm shrink-0">
          {(row.employee?.full_name || "?").slice(0, 1)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800 truncate">
            {row.employee?.full_name || "Unknown"}
          </p>
          <p className="text-xs text-slate-400 truncate">
            {row.live_status === "on_site" && row.current_site ? (
              <span className="flex items-center gap-1">
                <MapPin size={11} />
                {row.current_site.location_name} · since{" "}
                {formatTime(row.current_site_since)}
              </span>
            ) : row.check_in_time ? (
              <span>Checked in {formatTime(row.check_in_time)}</span>
            ) : (
              <span>No activity today</span>
            )}
          </p>
        </div>

        {row.sites_visited_today > 0 && (
          <span className="hidden sm:flex items-center gap-1 text-xs text-slate-400 shrink-0">
            <Route size={12} /> {row.sites_visited_today} site
            {row.sites_visited_today > 1 ? "s" : ""}
          </span>
        )}

        <span
          className={`shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>

        <ChevronDown
          size={15}
          className={`text-slate-300 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="pb-3 pl-12 pr-2 space-y-2">
          {hasVisits ? (
            row.visits.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 text-xs bg-slate-50 rounded-lg px-3 py-2"
              >
                <Building2 size={13} className="text-slate-400 shrink-0" />
                <span className="font-medium text-slate-700 truncate flex-1">
                  {v.locations?.location_name || "Unknown site"}
                </span>
                <span className="flex items-center gap-1 text-slate-500 shrink-0">
                  <LogIn size={11} /> {formatTime(v.arrival_time)}
                </span>
                <span className="flex items-center gap-1 text-slate-500 shrink-0">
                  <LogOut size={11} />
                  {v.departure_time
                    ? formatTime(v.departure_time)
                    : "still there"}
                </span>
                <span className="flex items-center gap-1 text-slate-400 shrink-0">
                  <Clock size={11} /> {formatVisitDuration(v)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400">No sites logged today yet.</p>
          )}

          <button
            type="button"
            onClick={() => setShowHistory((h) => !h)}
            className="text-xs font-medium text-orange-600 pt-1"
          >
            {showHistory ? "Hide" : "Show"} past 7 days
          </button>

          {showHistory && <HistoryPanel employeeId={row.employee_id} />}
        </div>
      )}
    </div>
  );
}

export default function ManagerAttendance() {
  const [fieldStaff, setFieldStaff] = useState([]);
  const [fieldLoading, setFieldLoading] = useState(true);
  const [fieldError, setFieldError] = useState(null);

  const [officeTeam, setOfficeTeam] = useState([]);
  const [officeLoading, setOfficeLoading] = useState(true);

  function loadFieldStaff() {
    apiClient
      .get("/attendance/team/site-visits")
      .then((res) => setFieldStaff(unwrap(res) || []))
      .catch((err) => setFieldError(err.message))
      .finally(() => setFieldLoading(false));
  }

  useEffect(() => {
    loadFieldStaff();

    apiClient
      .get("/attendance/team")
      .then((res) => setOfficeTeam(unwrap(res) || []))
      .catch(() => setOfficeTeam([]))
      .finally(() => setOfficeLoading(false));

    // "Live status" should stay live — poll so a manager watching this
    // screen sees an employee's on-site time (and who's newly arrived
    // or departed) without needing to refresh the page themselves.
    const id = setInterval(loadFieldStaff, 60000);
    return () => clearInterval(id);
  }, []);

  const fieldIds = new Set(fieldStaff.map((r) => r.employee_id));
  const officeOnly = officeTeam.filter((row) => !fieldIds.has(row.employee_id));

  const onSiteCount = fieldStaff.filter(
    (r) => r.live_status === "on_site",
  ).length;
  const officePresentCount = officeOnly.filter(
    (r) => r.status === "Present",
  ).length;

  return (
    <div>
      <PageHeader
        title="Team Attendance"
        subtitle="Field staff live location, plus everyone else's check-in status."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Users}
          label="Field Staff"
          color="orange"
          loading={fieldLoading}
          value={fieldStaff.length || "—"}
        />
        <StatCard
          icon={MapPin}
          label="On Site Now"
          color="green"
          loading={fieldLoading}
          value={onSiteCount}
        />
        <StatCard
          icon={Users}
          label="Office Team"
          color="blue"
          loading={officeLoading}
          value={officeOnly.length || "—"}
        />
        <StatCard
          icon={Building2}
          label="Present (Office)"
          color="slate"
          loading={officeLoading}
          value={officePresentCount}
        />
      </div>

      {/* ---------- Field staff — live site status ---------- */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h3 className="font-semibold text-slate-800 mb-1">
          Field Staff — Live Status
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Inspection / Operation reports who visit multiple sites in a day. Tap
          a row to see today's full site-by-site breakdown.
        </p>

        {fieldError && (
          <div className="mb-3 text-sm text-orange-500 bg-orange-50 border border-orange-100 rounded-lg px-4 py-3">
            {fieldError}
          </div>
        )}

        {fieldLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 bg-slate-100 rounded animate-pulse"
              />
            ))}
          </div>
        ) : fieldStaff.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">
            No field staff (Inspection / Operation) report to you.
          </p>
        ) : (
          <div>
            {fieldStaff.map((row) => (
              <FieldStaffRow key={row.employee_id} row={row} />
            ))}
          </div>
        )}
      </div>

      {/* ---------- Everyone else — plain check-in/out ---------- */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-4">
          Office Team — Today
        </h3>

        {officeLoading ? (
          <div className="h-24 bg-slate-100 rounded animate-pulse" />
        ) : officeOnly.length === 0 ? (
          <p className="text-sm text-slate-400">
            No office attendance records for your team today.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="pb-2 font-medium">Employee</th>
                <th className="pb-2 font-medium">Check In</th>
                <th className="pb-2 font-medium">Check Out</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {officeOnly.map((row) => (
                <tr key={row.id}>
                  <td className="py-2 text-slate-700">
                    {row.employees?.full_name || "—"}
                  </td>
                  <td className="py-2 text-slate-500">
                    {formatTime(row.check_in_time)}
                  </td>
                  <td className="py-2 text-slate-500">
                    {formatTime(row.check_out_time)}
                  </td>
                  <td className="py-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        row.status === "Present"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-orange-50 text-orange-500"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
