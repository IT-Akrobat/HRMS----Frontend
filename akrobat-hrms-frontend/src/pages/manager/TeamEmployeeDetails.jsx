import {
  AlertTriangle,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Mail,
  MapPin,
  Phone,
  Search,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import SelectDropdown from "../../components/common/SelectDropdown";
import StatCard from "../../components/common/StatCard";
import { apiClient } from "../../services/apiClient";
import { parseLocalISODate } from "../../utils/date";
import { unwrap } from "../../utils/unwrap";

// ---------------------------------------------------------------------
// Manager -> "My Team" -> Employee Details
//
// Full profile detail (contact, department/designation, shift, joining
// date, employment status) for exactly this manager's direct + indirect
// reports — backed by GET /employees/my-team, which walks the org chart
// down from the caller (app/employees/services.py get_my_team_employees,
// same "resolve caller -> get_all_report_ids -> scope query" pattern as
// GET /site-assignments/my-team used by Team Members and GET /leaves/team
// used by Team Leave Requests). Nothing outside the caller's own
// reporting line is ever returned, so there's no client-side filtering
// to get this wrong.
//
// This is a read-only directory. Editing an employee record is an
// HR/Super-Admin action (PUT /employees/{id}, gated to EDIT_EMPLOYEE,
// which the MANAGER role doesn't hold — see sql/002_role_permissions_seed.sql)
// so there's intentionally no edit button here.
// ---------------------------------------------------------------------

const STATUS_STYLE = {
  Active: "bg-green-50 text-green-700",
  "On Leave": "bg-blue-50 text-blue-700",
  Inactive: "bg-slate-100 text-slate-500",
  Terminated: "bg-orange-50 text-orange-600",
};

function formatDate(value) {
  if (!value) return "—";
  const d = parseLocalISODate(value);
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function tenure(joiningDate) {
  if (!joiningDate) return null;
  const start = parseLocalISODate(joiningDate);
  if (!start || Number.isNaN(start.getTime())) return null;
  const months = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (months < 1) return "Joined this month";
  const years = Math.floor(months / 12);
  const remMonths = Math.round(months % 12);
  if (years === 0) return `${remMonths} mo${remMonths !== 1 ? "s" : ""}`;
  return `${years} yr${years !== 1 ? "s" : ""}${remMonths ? ` ${remMonths} mo` : ""}`;
}

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function Avatar({ person, className }) {
  return person?.profile_photo ? (
    <img
      src={person.profile_photo}
      alt={person.full_name}
      className={`${className} object-cover shrink-0`}
    />
  ) : (
    <div
      className={`${className} bg-orange-50 text-orange-600 flex items-center justify-center font-semibold shrink-0`}
    >
      {initials(person?.full_name)}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 text-slate-400">
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-sm text-slate-700 font-medium truncate">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function EmployeeDetailModal({ employee, onClose }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!employee) return;
    const raf = requestAnimationFrame(() => setShow(true));
    return () => {
      cancelAnimationFrame(raf);
      setShow(false);
    };
  }, [employee]);

  useEffect(() => {
    if (!employee) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [employee, onClose]);

  if (!employee) return null;
  const statusClass =
    STATUS_STYLE[employee.employment_status] || "bg-slate-100 text-slate-500";

  return (
    <div className="fixed inset-0 z-50">
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/50 transition-opacity duration-200 ${
          show ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        className={`absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-200 ease-out ${
          show ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar person={employee} className="w-12 h-12 rounded-full" />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-800 truncate">
                {employee.full_name}
              </h2>
              <p className="text-xs text-slate-500">{employee.employee_id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <span
            className={`inline-flex shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${statusClass}`}
          >
            {employee.employment_status || "Active"}
          </span>

          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mt-5 mb-1">
            Contact
          </p>
          <DetailRow icon={Mail} label="Email" value={employee.email} />
          <DetailRow icon={Phone} label="Phone" value={employee.phone} />

          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mt-4 mb-1">
            Employment
          </p>
          <DetailRow
            icon={Building2}
            label="Department"
            value={employee.departments?.department_name}
          />
          <DetailRow
            icon={Briefcase}
            label="Designation"
            value={employee.designations?.designation_name}
          />
          <DetailRow
            icon={Clock}
            label="Shift"
            value={employee.shifts?.shift_name}
          />
          <DetailRow
            icon={MapPin}
            label="Work Location"
            value={employee.work_location}
          />
          <DetailRow
            icon={Calendar}
            label="Joining Date"
            value={
              employee.joining_date
                ? `${formatDate(employee.joining_date)} · ${tenure(employee.joining_date)}`
                : "—"
            }
          />
        </div>

        {/* <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div> */}
      </div>
    </div>
  );
}

export default function TeamEmployeeDetails() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get("/employees/my-team")
      .then((res) => setTeam(unwrap(res) || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const departments = useMemo(() => {
    const names = new Set(
      team.map((t) => t.departments?.department_name).filter(Boolean),
    );
    return Array.from(names);
  }, [team]);

  const filtered = useMemo(() => {
    return team.filter((t) => {
      const matchesSearch =
        !search ||
        t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        t.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
        t.email?.toLowerCase().includes(search.toLowerCase());
      const matchesDept =
        !departmentFilter ||
        t.departments?.department_name === departmentFilter;
      return matchesSearch && matchesDept;
    });
  }, [team, search, departmentFilter]);

  const activeCount = team.filter(
    (t) => (t.employment_status || "Active") === "Active",
  ).length;

  return (
    <div>
      {/* Hides the scrollbar visually on the mobile stat strip below,
          while keeping it scrollable — mirrors the same helper in
          manager/Dashboard.jsx. */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ---------- Desktop/tablet header (lg and up) — unchanged ---------- */}
      <div className="hidden lg:block">
        <PageHeader
          title="Employee Details"
          subtitle="Full profile details for everyone reporting to you, direct or indirect."
        />
      </div>

      {/* ---------- Mobile header (below lg) ----------
          Title + subtitle, with the search box grouped right underneath
          them as part of the same header block instead of appearing
          further down the page after the stat cards. */}
      <div className="lg:hidden mb-4">
        <h1 className="text-xl font-bold text-slate-800 mb-1">
          Employee Details
        </h1>
        <p className="text-sm text-slate-500 mb-3">
          Full profile details for everyone reporting to you, direct or
          indirect.
        </p>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, employee ID, or email…"
            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
          />
        </div>
      </div>

      {/* ---------- Desktop/tablet stat grid (lg and up) — unchanged ---------- */}
      <div className="hidden lg:grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={Users}
          label="Team Size"
          value={team.length}
          loading={loading}
        />
        <StatCard
          icon={Users}
          label="Active"
          value={activeCount}
          color="blue"
          loading={loading}
        />
        <StatCard
          icon={Building2}
          label="Departments"
          value={departments.length}
          color="slate"
          loading={loading}
        />
      </div>

      {/* ---------- Mobile stat strip (below lg) ----------
          Single-line, horizontally scrolling row instead of three stacked
          cards, so the three numbers are visible together at a glance. */}
      <div className="lg:hidden -mx-4 px-4 mb-4">
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1">
          {[
            {
              key: "team-size",
              icon: Users,
              label: "Team Size",
              value: team.length,
              iconBg: "bg-orange-50",
              iconFg: "text-orange-500",
            },
            {
              key: "active",
              icon: Users,
              label: "Active",
              value: activeCount,
              iconBg: "bg-blue-50",
              iconFg: "text-blue-600",
            },
            {
              key: "departments",
              icon: Building2,
              label: "Departments",
              value: departments.length,
              iconBg: "bg-slate-100",
              iconFg: "text-slate-500",
            },
          ].map((stat) => (
            <div
              key={stat.key}
              className="snap-start shrink-0 w-[150px] bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col gap-2.5"
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.iconBg} ${stat.iconFg}`}
              >
                <stat.icon size={18} />
              </div>
              {loading ? (
                <div className="h-6 w-12 bg-slate-100 rounded animate-pulse" />
              ) : (
                <div className="text-xl font-bold text-slate-800 leading-none">
                  {stat.value}
                </div>
              )}
              <span className="text-xs text-slate-500 leading-tight">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Desktop/tablet search + department filter (lg and up) — unchanged ---------- */}
      <div className="hidden lg:flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, employee ID, or email…"
            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
          />
        </div>
        {departments.length > 0 && (
          <SelectDropdown
            value={departmentFilter}
            onChange={setDepartmentFilter}
            placeholder="All Departments"
            options={[
              { value: "", label: "All Departments" },
              ...departments.map((d) => ({ value: d, label: d })),
            ]}
            className="w-full sm:w-auto sm:min-w-[180px]"
          />
        )}
      </div>

      {/* ---------- Mobile department filter (below lg) ----------
          Search now lives up in the header block, so this is just the
          department filter on its own full-width line. */}
      {departments.length > 0 && (
        <div className="lg:hidden mb-4">
          <SelectDropdown
            value={departmentFilter}
            onChange={setDepartmentFilter}
            placeholder="All Departments"
            options={[
              { value: "", label: "All Departments" },
              ...departments.map((d) => ({ value: d, label: d })),
            ]}
            className="w-full"
          />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-12 bg-slate-100 rounded animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-orange-500 flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            {team.length === 0
              ? "No one reports to you yet."
              : "No team members match your search."}
          </div>
        ) : (
          <>
            {/* ---------- Desktop/tablet table (lg and up) — unchanged ---------- */}
            <table className="hidden lg:table w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => {
                  const statusClass =
                    STATUS_STYLE[emp.employment_status] ||
                    "bg-slate-100 text-slate-500";
                  return (
                    <tr
                      key={emp.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 cursor-pointer"
                      onClick={() => setSelected(emp)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            person={emp}
                            className="w-8 h-8 rounded-full text-xs"
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-slate-800 truncate">
                              {emp.full_name}
                            </div>
                            <div className="text-xs text-slate-400">
                              {emp.employee_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {emp.departments?.department_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {emp.designations?.designation_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        <div className="truncate max-w-[180px]">
                          {emp.email || "—"}
                        </div>
                        {emp.phone && <div>{emp.phone}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {formatDate(emp.joining_date)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusClass}`}
                        >
                          {emp.employment_status || "Active"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(emp);
                          }}
                          className="text-xs font-medium text-orange-600 hover:text-orange-700"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* ---------- Mobile card list (below lg) ----------
                A 7-column table has no room on a phone — each employee
                becomes a tappable card instead: avatar + name/ID + status
                badge up top (the three things worth scanning at a glance),
                department/designation/contact/joined below, the whole card
                tappable (like the table row) to open the same detail
                drawer. */}
            <ul className="lg:hidden divide-y divide-slate-100">
              {filtered.map((emp) => {
                const statusClass =
                  STATUS_STYLE[emp.employment_status] ||
                  "bg-slate-100 text-slate-500";
                return (
                  <li
                    key={emp.id}
                    onClick={() => setSelected(emp)}
                    className="px-4 py-3.5 active:bg-slate-50 cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar
                        person={emp}
                        className="w-10 h-10 rounded-full text-xs"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-slate-800 truncate">
                              {emp.full_name}
                            </div>
                            <div className="text-xs text-slate-400">
                              {emp.employee_id}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${statusClass}`}
                          >
                            {emp.employment_status || "Active"}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 mt-1.5 truncate">
                          {[
                            emp.departments?.department_name,
                            emp.designations?.designation_name,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </div>

                        <div className="text-xs text-slate-400 mt-1 truncate">
                          {emp.email || "—"}
                          {emp.phone ? ` · ${emp.phone}` : ""}
                        </div>

                        <div className="text-xs text-slate-400 mt-1">
                          Joined {formatDate(emp.joining_date)}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <EmployeeDetailModal
        employee={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
