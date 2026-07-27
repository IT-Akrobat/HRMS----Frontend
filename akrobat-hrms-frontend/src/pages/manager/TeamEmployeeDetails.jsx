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
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
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
  if (!employee) return null;
  const statusClass =
    STATUS_STYLE[employee.employment_status] || "bg-slate-100 text-slate-500";

  return (
    <Modal
      open={!!employee}
      onClose={onClose}
      title="Employee Details"
      width="max-w-xl"
    >
      <div className="flex items-center gap-4 pb-4 mb-2 border-b border-slate-100">
        <Avatar person={employee} className="w-14 h-14 rounded-full text-lg" />
        <div className="min-w-0">
          <h4 className="text-base font-semibold text-slate-800 truncate">
            {employee.full_name}
          </h4>
          <p className="text-xs text-slate-400">{employee.employee_id}</p>
        </div>
        <span
          className={`ml-auto shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${statusClass}`}
        >
          {employee.employment_status || "Active"}
        </span>
      </div>

      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
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
    </Modal>
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
      <PageHeader
        title="Employee Details"
        subtitle="Full profile details for everyone reporting to you, direct or indirect."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
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
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
      </div>

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
          <table className="w-full text-sm">
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
        )}
      </div>

      <EmployeeDetailModal
        employee={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
