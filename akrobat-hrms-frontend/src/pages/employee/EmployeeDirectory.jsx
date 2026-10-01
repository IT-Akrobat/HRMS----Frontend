import { AlertTriangle, Building2, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Avatar from "../../components/common/Avatar";
import EmployeeProfileModal from "../../components/common/EmployeeProfileModal";
import SearchInput from "../../components/common/SearchInput";
import SelectDropdown from "../../components/common/SelectDropdown";
import { fetchEmployeeDirectory } from "../../services/directoryService";

// Employee -> People -> All Employees
// Everyone in the company as profile cards, grouped under their department.
// Tap a card to see that person's main details.

export default function EmployeeDirectory() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchEmployeeDirectory()
      .then(setEmployees)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const departmentOptions = useMemo(() => {
    const names = new Set(
      employees.map((e) => e.departments?.department_name).filter(Boolean),
    );
    return [
      { value: "all", label: "All Departments" },
      ...[...names].sort().map((n) => ({ value: n, label: n })),
    ];
  }, [employees]);

  // [{ name, members: [] }] sorted by department name, filtered by search/dept
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map();
    employees.forEach((e) => {
      const dept = e.departments?.department_name || "No Department";
      if (department !== "all" && dept !== department) return;
      if (
        q &&
        !(
          e.full_name?.toLowerCase().includes(q) ||
          e.employee_id?.toLowerCase().includes(q) ||
          dept.toLowerCase().includes(q) ||
          e.designations?.designation_name?.toLowerCase().includes(q)
        )
      )
        return;
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept).push(e);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, members]) => ({ name, members }));
  }, [employees, search, department]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
          All Employees
        </h1>
        {/* Hidden on mobile to save space */}
        <p className="hidden sm:block text-sm text-slate-500 mt-1">
          All Members
        </p>
      </div>

      <div className="flex flex-row items-center gap-2 mb-5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search…"
          className="flex-1 min-w-0"
        />
        <SelectDropdown
          value={department}
          onChange={setDepartment}
          options={departmentOptions}
          className="w-36 sm:w-56 shrink-0"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-24 bg-slate-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-orange-500 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-400">
          No employees found.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.name}>
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={15} className="text-orange-500" />
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                  {g.name}
                </h2>
                <span className="hidden sm:inline text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                  {g.members.length}
                </span>
                <div className="flex-1 h-px bg-slate-200 ml-1" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5">
                {g.members.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setSelected(e)}
                    className="group text-left bg-white rounded-xl border border-slate-200 border-t-2 border-t-[#0b1f45] px-2.5 py-3 flex flex-col items-center text-center hover:shadow-md hover:border-orange-300 hover:border-t-orange-400 transition"
                  >
                    <Avatar
                      name={e.full_name}
                      photo={e.profile_photo}
                      size="w-10 h-10"
                      textSize="text-xs"
                    />
                    <div className="mt-2 w-full text-[13px] font-semibold text-slate-800 truncate group-hover:text-orange-600">
                      {e.full_name}
                    </div>
                    <div className="w-full text-[11px] text-slate-500 truncate">
                      {e.designations?.designation_name || "—"}
                    </div>
                    {e.work_location && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-slate-400 max-w-full">
                        <MapPin size={9} className="shrink-0" />
                        <span className="truncate">{e.work_location}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <EmployeeProfileModal
        employee={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
