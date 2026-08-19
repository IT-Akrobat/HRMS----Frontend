import {
  AlertTriangle,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { apiClient } from "../../services/apiClient";

// ---------------------------------------------------------------------
// Headcount-by-department / headcount-by-designation view. Deliberately
// counts-only (no employee list, no edit/delete) — this is a quick
// "how many people are in Department X, and how are they split across
// its designations" glance, not another Employees table.
//
// Wired to the same reference endpoints Employees.jsx already uses:
//   GET /departments/   -> [{ id, department_name }]
//   GET /designations/  -> [{ id, designation_name, department_id }]
//   GET /employees/     -> { data: [{ id, department_id, designation_id,
//                             employment_status, ... }] }
// Counts are derived client-side from these three lists rather than a
// dedicated aggregation endpoint, since the data is small (department/
// designation counts, not per-employee detail).
// ---------------------------------------------------------------------

const UNASSIGNED_DEPT = "__unassigned_dept__";
const UNASSIGNED_DESIG = "__unassigned_desig__";

function buildCounts(employees, key) {
  const map = {};
  employees.forEach((e) => {
    const id =
      e[key] || (key === "department_id" ? UNASSIGNED_DEPT : UNASSIGNED_DESIG);
    map[id] = (map[id] || 0) + 1;
  });
  return map;
}

export default function OrganizationDepartments() {
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeOnly, setActiveOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  // Mobile accordion — which department card is expanded (independent
  // of `selectedDeptId`, which drives the desktop detail panel).
  const [expandedMobileId, setExpandedMobileId] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiClient.get("/departments/").catch(() => []),
      apiClient.get("/designations/").catch(() => []),
      apiClient.get("/employees/"),
    ])
      .then(([deptRes, desigRes, empRes]) => {
        setDepartments(deptRes || []);
        setDesignations(desigRes || []);
        setEmployees(empRes?.data || []);
      })
      .catch((err) => {
        setError(err.message || "Couldn't load departments.");
      })
      .finally(() => setLoading(false));
  }, []);

  const scopedEmployees = useMemo(
    () =>
      activeOnly
        ? employees.filter((e) => e.employment_status === "Active")
        : employees,
    [employees, activeOnly],
  );

  const deptCounts = useMemo(
    () => buildCounts(scopedEmployees, "department_id"),
    [scopedEmployees],
  );
  const desigCounts = useMemo(
    () => buildCounts(scopedEmployees, "designation_id"),
    [scopedEmployees],
  );

  // Department rows: real departments + a synthetic "Unassigned" row
  // if any (scoped) employee has no department_id, so the counts on
  // this page always add up to the total headcount.
  const deptRows = useMemo(() => {
    const rows = departments.map((d) => ({
      id: d.id,
      name: d.department_name || "Untitled Department",
      count: deptCounts[d.id] || 0,
    }));
    if (deptCounts[UNASSIGNED_DEPT]) {
      rows.push({
        id: UNASSIGNED_DEPT,
        name: "Unassigned",
        count: deptCounts[UNASSIGNED_DEPT],
        virtual: true,
      });
    }
    return rows.sort((a, b) => b.count - a.count);
  }, [departments, deptCounts]);

  const filteredDeptRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deptRows;
    return deptRows.filter((d) => d.name.toLowerCase().includes(q));
  }, [deptRows, search]);

  const maxDeptCount = Math.max(1, ...deptRows.map((d) => d.count));

  // Designations scoped to a given department, each with its own
  // headcount + a synthetic "Unassigned" row for that department if
  // any of its employees have no designation_id.
  function designationRowsFor(deptId) {
    const rows = designations
      .filter((d) => d.department_id === deptId)
      .map((d) => ({
        id: d.id,
        name: d.designation_name || "Untitled Designation",
        count: desigCounts[d.id] || 0,
      }));
    if (deptId !== UNASSIGNED_DEPT) {
      const unassignedInDept = scopedEmployees.filter(
        (e) => e.department_id === deptId && !e.designation_id,
      ).length;
      if (unassignedInDept) {
        rows.push({
          id: `${deptId}-${UNASSIGNED_DESIG}`,
          name: "Unassigned",
          count: unassignedInDept,
          virtual: true,
        });
      }
    }
    return rows.sort((a, b) => b.count - a.count);
  }

  // Keep the desktop detail panel pointed at a valid, visible
  // department once data loads / the search narrows the list.
  useEffect(() => {
    if (filteredDeptRows.length === 0) {
      setSelectedDeptId(null);
      return;
    }
    if (!filteredDeptRows.some((d) => d.id === selectedDeptId)) {
      setSelectedDeptId(filteredDeptRows[0].id);
    }
  }, [filteredDeptRows, selectedDeptId]);

  const selectedDept = filteredDeptRows.find((d) => d.id === selectedDeptId);
  const selectedDesigRows = selectedDept
    ? designationRowsFor(selectedDept.id)
    : [];
  const maxSelectedDesigCount = Math.max(
    1,
    ...selectedDesigRows.map((d) => d.count),
  );

  const totals = {
    departments: departments.length,
    designations: designations.length,
    employees: scopedEmployees.length,
  };

  return (
    <div>
      <PageHeader
        title="Departments & Designations"
        subtitle="Headcount by department, and by designation within each department."
      />

      {error ? (
        <div className="flex items-center gap-2 text-orange-600 bg-orange-50 rounded-xl px-4 py-3 text-sm mb-6">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : (
        <>
          {/* ---------- KPI strip ---------- */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5 sm:mb-6">
            <StatCard
              icon={Building2}
              label="Departments"
              color="orange"
              loading={loading}
              value={totals.departments}
            />
            <StatCard
              icon={Briefcase}
              label="Designations"
              color="blue"
              loading={loading}
              value={totals.designations}
            />
            <StatCard
              icon={Users}
              label={activeOnly ? "Active Employees" : "Employees"}
              color="slate"
              loading={loading}
              value={totals.employees}
            />
          </div>

          {/* ---------- Controls: search + active-only toggle ---------- */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search departments..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
              />
            </div>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 self-start">
              <button
                onClick={() => setActiveOnly(false)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  !activeOnly
                    ? "bg-orange-500 text-white"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                All Employees
              </button>
              <button
                onClick={() => setActiveOnly(true)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeOnly
                    ? "bg-orange-500 text-white"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Active Only
              </button>
            </div>
          </div>

          {/* ==================================================
              Desktop / tablet — master-detail: department list on
              the left drives a designation breakdown on the right.
              ================================================== */}
          <div className="hidden sm:grid sm:grid-cols-5 gap-4">
            <div className="sm:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Departments
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                {loading ? (
                  <div className="p-3 space-y-2">
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="h-11 bg-slate-100 rounded-lg animate-pulse"
                      />
                    ))}
                  </div>
                ) : filteredDeptRows.length === 0 ? (
                  <div className="px-4 py-10 text-center text-slate-400 text-sm">
                    No departments found.
                  </div>
                ) : (
                  <div className="p-2">
                    {filteredDeptRows.map((d) => {
                      const isActive = d.id === selectedDeptId;
                      return (
                        <button
                          key={d.id}
                          onClick={() => setSelectedDeptId(d.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                            isActive ? "bg-orange-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isActive
                                ? "bg-orange-500 text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <Building2 size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div
                              className={`text-sm font-medium truncate ${
                                isActive ? "text-orange-700" : "text-slate-700"
                              } ${d.virtual ? "italic" : ""}`}
                            >
                              {d.name}
                            </div>
                            <div className="mt-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${isActive ? "bg-orange-400" : "bg-slate-300"}`}
                                style={{
                                  width: `${Math.round((d.count / maxDeptCount) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                          <span
                            className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${
                              isActive
                                ? "bg-orange-500 text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {d.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="sm:col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
              {loading ? (
                <div className="p-4 space-y-2.5">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="h-10 bg-slate-100 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : !selectedDept ? (
                <div className="px-4 py-16 text-center text-slate-400 text-sm">
                  Select a department to see its designations.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        {selectedDept.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {selectedDesigRows.length}{" "}
                        {selectedDesigRows.length === 1
                          ? "designation"
                          : "designations"}
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-orange-50 text-orange-600">
                      <Users size={12} />
                      {selectedDept.count} total
                    </span>
                  </div>
                  <div className="max-h-[464px] overflow-y-auto p-3 space-y-1.5">
                    {selectedDesigRows.length === 0 ? (
                      <div className="px-2 py-10 text-center text-slate-400 text-sm">
                        No designations set up for this department yet.
                      </div>
                    ) : (
                      selectedDesigRows.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50"
                        >
                          <div
                            className={`text-sm text-slate-700 flex-1 min-w-0 truncate ${r.virtual ? "italic text-slate-400" : ""}`}
                          >
                            {r.name}
                          </div>
                          <div className="w-32 h-1.5 rounded-full bg-slate-100 overflow-hidden hidden md:block">
                            <div
                              className="h-full rounded-full bg-blue-400"
                              style={{
                                width: `${Math.round((r.count / maxSelectedDesigCount) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="shrink-0 text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-600 min-w-[2rem] text-center">
                            {r.count}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ==================================================
              Mobile — accordion: tap a department to expand its
              designation counts inline underneath.
              ================================================== */}
          <div className="sm:hidden space-y-2.5">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-white border border-slate-200 rounded-2xl animate-pulse"
                />
              ))
            ) : filteredDeptRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center bg-white border border-slate-200 rounded-2xl">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <Search size={16} className="text-slate-400" />
                </div>
                <div className="text-slate-500 text-sm font-medium">
                  No departments found
                </div>
              </div>
            ) : (
              filteredDeptRows.map((d) => {
                const isOpen = expandedMobileId === d.id;
                const rows = isOpen ? designationRowsFor(d.id) : [];
                const maxRowCount = Math.max(1, ...rows.map((r) => r.count));
                return (
                  <div
                    key={d.id}
                    className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedMobileId(isOpen ? null : d.id)}
                      className="w-full flex items-center gap-3 p-3.5"
                    >
                      <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                        <Building2 size={16} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div
                          className={`text-sm font-medium text-slate-800 truncate ${d.virtual ? "italic" : ""}`}
                        >
                          {d.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {d.count} {d.count === 1 ? "employee" : "employees"}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                        {d.count}
                      </span>
                      {isOpen ? (
                        <ChevronDown
                          size={16}
                          className="text-slate-400 shrink-0"
                        />
                      ) : (
                        <ChevronRight
                          size={16}
                          className="text-slate-400 shrink-0"
                        />
                      )}
                    </button>
                    {isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/60 p-3 space-y-1.5">
                        {rows.length === 0 ? (
                          <div className="text-center text-xs text-slate-400 py-4">
                            No designations set up for this department yet.
                          </div>
                        ) : (
                          rows.map((r) => (
                            <div
                              key={r.id}
                              className="flex items-center gap-2.5 bg-white rounded-lg px-3 py-2 border border-slate-100"
                            >
                              <div
                                className={`text-xs text-slate-700 flex-1 min-w-0 truncate ${r.virtual ? "italic text-slate-400" : ""}`}
                              >
                                {r.name}
                              </div>
                              <div className="w-14 h-1 rounded-full bg-slate-100 overflow-hidden shrink-0">
                                <div
                                  className="h-full rounded-full bg-blue-400"
                                  style={{
                                    width: `${Math.round((r.count / maxRowCount) * 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 min-w-[1.75rem] text-center">
                                {r.count}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-400">
          <Loader2 size={13} className="animate-spin" /> Loading departments...
        </div>
      )}
    </div>
  );
}
// import {
//   AlertTriangle,
//   Briefcase,
//   Building2,
//   ChevronRight,
//   Loader2,
//   Search,
//   Users,
// } from "lucide-react";
// import { useEffect, useMemo, useState } from "react";
// import DepartmentDistributionChart from "../../components/common/DepartmentDistributionChart";
// import Modal from "../../components/common/Modal";
// import PageHeader from "../../components/common/PageHeader";
// import StatCard from "../../components/common/StatCard";
// import { apiClient } from "../../services/apiClient";

// // ---------------------------------------------------------------------
// // Headcount-by-department / headcount-by-designation view. Deliberately
// // counts-only (no employee list, no edit/delete) — this is a quick
// // "how many people are in Department X, and how are they split across
// // its designations" glance, not another Employees table.
// //
// // Wired to the same reference endpoints Employees.jsx already uses:
// //   GET /departments/   -> [{ id, department_name }]
// //   GET /designations/  -> [{ id, designation_name, department_id }]
// //   GET /employees/     -> { data: [{ id, department_id, designation_id,
// //                             employment_status, ... }] }
// // Counts are derived client-side from these three lists rather than a
// // dedicated aggregation endpoint, since the data is small (department/
// // designation counts, not per-employee detail).
// //
// // Redesigned as a chart-led overview (reusing the dashboard's donut) +
// // a department card grid. Clicking a card opens a modal with that
// // department's designation breakdown as colored bars, replacing the
// // old split list-panel + separate mobile-accordion layout.
// // ---------------------------------------------------------------------

// const UNASSIGNED_DEPT = "__unassigned_dept__";
// const UNASSIGNED_DESIG = "__unassigned_desig__";

// // Brand orange + navy/blue tints, same family as DepartmentDistributionChart.
// const PALETTE = [
//   "#F5730B",
//   "#0B1830",
//   "#3B82F6",
//   "#FDBA74",
//   "#1E40AF",
//   "#FB923C",
//   "#93C5FD",
//   "#C2410C",
// ];

// function buildCounts(employees, key) {
//   const map = {};
//   employees.forEach((e) => {
//     const id =
//       e[key] || (key === "department_id" ? UNASSIGNED_DEPT : UNASSIGNED_DESIG);
//     map[id] = (map[id] || 0) + 1;
//   });
//   return map;
// }

// export default function OrganizationDepartments() {
//   const [departments, setDepartments] = useState([]);
//   const [designations, setDesignations] = useState([]);
//   const [employees, setEmployees] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   const [activeOnly, setActiveOnly] = useState(false);
//   const [search, setSearch] = useState("");
//   // Which department card's designation breakdown is open in the modal.
//   const [openDeptId, setOpenDeptId] = useState(null);

//   useEffect(() => {
//     setLoading(true);
//     setError(null);
//     Promise.all([
//       apiClient.get("/departments/").catch(() => []),
//       apiClient.get("/designations/").catch(() => []),
//       apiClient.get("/employees/"),
//     ])
//       .then(([deptRes, desigRes, empRes]) => {
//         setDepartments(deptRes || []);
//         setDesignations(desigRes || []);
//         setEmployees(empRes?.data || []);
//       })
//       .catch((err) => {
//         setError(err.message || "Couldn't load departments.");
//       })
//       .finally(() => setLoading(false));
//   }, []);

//   const scopedEmployees = useMemo(
//     () =>
//       activeOnly
//         ? employees.filter((e) => e.employment_status === "Active")
//         : employees,
//     [employees, activeOnly],
//   );

//   const deptCounts = useMemo(
//     () => buildCounts(scopedEmployees, "department_id"),
//     [scopedEmployees],
//   );
//   const desigCounts = useMemo(
//     () => buildCounts(scopedEmployees, "designation_id"),
//     [scopedEmployees],
//   );

//   // Department rows: real departments + a synthetic "Unassigned" row
//   // if any (scoped) employee has no department_id, so the counts on
//   // this page always add up to the total headcount.
//   const deptRows = useMemo(() => {
//     const rows = departments.map((d) => ({
//       id: d.id,
//       name: d.department_name || "Untitled Department",
//       count: deptCounts[d.id] || 0,
//     }));
//     if (deptCounts[UNASSIGNED_DEPT]) {
//       rows.push({
//         id: UNASSIGNED_DEPT,
//         name: "Unassigned",
//         count: deptCounts[UNASSIGNED_DEPT],
//         virtual: true,
//       });
//     }
//     return rows.sort((a, b) => b.count - a.count);
//   }, [departments, deptCounts]);

//   const filteredDeptRows = useMemo(() => {
//     const q = search.trim().toLowerCase();
//     if (!q) return deptRows;
//     return deptRows.filter((d) => d.name.toLowerCase().includes(q));
//   }, [deptRows, search]);

//   const totalHeadcount = scopedEmployees.length;

//   // Designations scoped to a given department, each with its own
//   // headcount + a synthetic "Unassigned" row for that department if
//   // any of its employees have no designation_id.
//   function designationRowsFor(deptId) {
//     const rows = designations
//       .filter((d) => d.department_id === deptId)
//       .map((d) => ({
//         id: d.id,
//         name: d.designation_name || "Untitled Designation",
//         count: desigCounts[d.id] || 0,
//       }));
//     if (deptId !== UNASSIGNED_DEPT) {
//       const unassignedInDept = scopedEmployees.filter(
//         (e) => e.department_id === deptId && !e.designation_id,
//       ).length;
//       if (unassignedInDept) {
//         rows.push({
//           id: `${deptId}-${UNASSIGNED_DESIG}`,
//           name: "Unassigned",
//           count: unassignedInDept,
//           virtual: true,
//         });
//       }
//     }
//     return rows.sort((a, b) => b.count - a.count);
//   }

//   // Org-wide top designations (across all departments), for the
//   // overview chart row next to the department distribution donut.
//   const topDesignations = useMemo(() => {
//     const rows = designations.map((d) => ({
//       id: d.id,
//       name: d.designation_name || "Untitled Designation",
//       count: desigCounts[d.id] || 0,
//     }));
//     if (desigCounts[UNASSIGNED_DESIG]) {
//       rows.push({
//         id: UNASSIGNED_DESIG,
//         name: "Unassigned",
//         count: desigCounts[UNASSIGNED_DESIG],
//         virtual: true,
//       });
//     }
//     return rows
//       .filter((r) => r.count > 0)
//       .sort((a, b) => b.count - a.count)
//       .slice(0, 6);
//   }, [designations, desigCounts]);
//   const maxTopDesig = Math.max(1, ...topDesignations.map((d) => d.count));

//   const openDept = deptRows.find((d) => d.id === openDeptId);
//   const openDesigRows = openDept ? designationRowsFor(openDept.id) : [];
//   const maxOpenDesigCount = Math.max(1, ...openDesigRows.map((d) => d.count));

//   const totals = {
//     departments: departments.length,
//     designations: designations.length,
//     employees: scopedEmployees.length,
//   };

//   return (
//     <div>
//       <PageHeader
//         title="Departments & Designations"
//         subtitle="Headcount by department, and by designation within each department."
//       />

//       {error ? (
//         <div className="flex items-center gap-2 text-orange-600 bg-orange-50 rounded-xl px-4 py-3 text-sm mb-6">
//           <AlertTriangle size={16} />
//           {error}
//         </div>
//       ) : (
//         <>
//           {/* ---------- KPI strip ---------- */}
//           <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5 sm:mb-6">
//             <StatCard
//               icon={Building2}
//               label="Departments"
//               color="orange"
//               loading={loading}
//               value={totals.departments}
//             />
//             <StatCard
//               icon={Briefcase}
//               label="Designations"
//               color="blue"
//               loading={loading}
//               value={totals.designations}
//             />
//             <StatCard
//               icon={Users}
//               label={activeOnly ? "Active Employees" : "Employees"}
//               color="slate"
//               loading={loading}
//               value={totals.employees}
//             />
//           </div>

//           {/* ---------- Overview: distribution donut + top designations ---------- */}
//           <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
//             <div className="lg:col-span-2">
//               <DepartmentDistributionChart
//                 loading={loading}
//                 departments={deptRows.map((d) => ({
//                   department_id: d.id,
//                   department_name: d.name,
//                   employee_count: d.count,
//                 }))}
//               />
//             </div>

//             <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5">
//               <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
//                 <Briefcase size={17} className="text-orange-500" /> Top
//                 Designations Org-wide
//               </h3>
//               {loading ? (
//                 <div className="space-y-3">
//                   {[...Array(5)].map((_, i) => (
//                     <div
//                       key={i}
//                       className="h-6 bg-slate-100 rounded animate-pulse"
//                     />
//                   ))}
//                 </div>
//               ) : topDesignations.length === 0 ? (
//                 <p className="text-sm text-slate-400 py-8 text-center">
//                   No designation data to show yet.
//                 </p>
//               ) : (
//                 <div className="space-y-3">
//                   {topDesignations.map((r, idx) => (
//                     <div key={r.id} className="flex items-center gap-3">
//                       <span className="w-5 shrink-0 text-xs font-semibold text-slate-400">
//                         {idx + 1}
//                       </span>
//                       <div className="flex-1 min-w-0">
//                         <div className="flex items-center justify-between mb-1">
//                           <span
//                             className={`text-sm text-slate-700 truncate ${r.virtual ? "italic text-slate-400" : ""}`}
//                           >
//                             {r.name}
//                           </span>
//                           <span className="text-xs font-semibold text-slate-500 shrink-0 ml-2">
//                             {r.count}
//                           </span>
//                         </div>
//                         <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
//                           <div
//                             className="h-full rounded-full transition-all"
//                             style={{
//                               width: `${Math.round((r.count / maxTopDesig) * 100)}%`,
//                               backgroundColor: PALETTE[idx % PALETTE.length],
//                             }}
//                           />
//                         </div>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>
//           </div>

//           {/* ---------- Controls: search + active-only toggle ---------- */}
//           <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
//             <div className="relative flex-1 max-w-sm">
//               <Search
//                 size={15}
//                 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
//               />
//               <input
//                 value={search}
//                 onChange={(e) => setSearch(e.target.value)}
//                 placeholder="Search departments..."
//                 className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
//               />
//             </div>
//             <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 self-start">
//               <button
//                 onClick={() => setActiveOnly(false)}
//                 className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
//                   !activeOnly
//                     ? "bg-orange-500 text-white"
//                     : "text-slate-500 hover:text-slate-700"
//                 }`}
//               >
//                 All Employees
//               </button>
//               <button
//                 onClick={() => setActiveOnly(true)}
//                 className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
//                   activeOnly
//                     ? "bg-orange-500 text-white"
//                     : "text-slate-500 hover:text-slate-700"
//                 }`}
//               >
//                 Active Only
//               </button>
//             </div>
//           </div>

//           {/* ---------- Department card grid ---------- */}
//           {loading ? (
//             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//               {[...Array(6)].map((_, i) => (
//                 <div
//                   key={i}
//                   className="h-32 bg-white border border-slate-200 rounded-2xl animate-pulse"
//                 />
//               ))}
//             </div>
//           ) : filteredDeptRows.length === 0 ? (
//             <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center bg-white border border-slate-200 rounded-2xl">
//               <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
//                 <Search size={16} className="text-slate-400" />
//               </div>
//               <div className="text-slate-500 text-sm font-medium">
//                 No departments found
//               </div>
//             </div>
//           ) : (
//             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//               {filteredDeptRows.map((d, idx) => {
//                 const pct =
//                   totalHeadcount > 0
//                     ? Math.round((d.count / totalHeadcount) * 100)
//                     : 0;
//                 const color = PALETTE[idx % PALETTE.length];
//                 const preview = designationRowsFor(d.id).slice(0, 2);

//                 return (
//                   <button
//                     key={d.id}
//                     onClick={() => setOpenDeptId(d.id)}
//                     className="text-left bg-white rounded-2xl border border-slate-200 p-4 hover:border-orange-200 hover:shadow-sm transition-all group"
//                   >
//                     <div className="flex items-start justify-between gap-3">
//                       <div className="flex items-center gap-3 min-w-0">
//                         <div
//                           className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
//                           style={{
//                             backgroundColor: `${color}1A`,
//                             color,
//                           }}
//                         >
//                           <Building2 size={18} />
//                         </div>
//                         <div className="min-w-0">
//                           <div
//                             className={`text-sm font-semibold text-slate-800 truncate ${d.virtual ? "italic text-slate-400" : ""}`}
//                           >
//                             {d.name}
//                           </div>
//                           <div className="text-xs text-slate-400">
//                             {d.count} {d.count === 1 ? "employee" : "employees"}
//                           </div>
//                         </div>
//                       </div>
//                       <ChevronRight
//                         size={16}
//                         className="text-slate-300 group-hover:text-orange-400 shrink-0 mt-1 transition-colors"
//                       />
//                     </div>

//                     {/* Share-of-org bar */}
//                     <div className="mt-3.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
//                       <div
//                         className="h-full rounded-full transition-all"
//                         style={{ width: `${pct}%`, backgroundColor: color }}
//                       />
//                     </div>
//                     <div className="mt-1 text-[11px] text-slate-400">
//                       {pct}% of {activeOnly ? "active headcount" : "headcount"}
//                     </div>

//                     {/* Top designation chips */}
//                     {preview.length > 0 && (
//                       <div className="mt-3 flex flex-wrap gap-1.5">
//                         {preview.map((r) => (
//                           <span
//                             key={r.id}
//                             className={`text-[11px] px-2 py-1 rounded-full bg-slate-50 text-slate-500 ${r.virtual ? "italic" : ""}`}
//                           >
//                             {r.name} · {r.count}
//                           </span>
//                         ))}
//                       </div>
//                     )}
//                   </button>
//                 );
//               })}
//             </div>
//           )}
//         </>
//       )}

//       {loading && (
//         <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-400">
//           <Loader2 size={13} className="animate-spin" /> Loading departments...
//         </div>
//       )}

//       {/* ---------- Designation breakdown modal ---------- */}
//       <Modal
//         open={!!openDept}
//         onClose={() => setOpenDeptId(null)}
//         title={openDept?.name}
//         subtitle={
//           openDept
//             ? `${openDept.count} ${openDept.count === 1 ? "employee" : "employees"} · ${openDesigRows.length} ${openDesigRows.length === 1 ? "designation" : "designations"}`
//             : undefined
//         }
//         width="max-w-md"
//       >
//         {openDesigRows.length === 0 ? (
//           <div className="text-center text-slate-400 text-sm py-10">
//             No designations set up for this department yet.
//           </div>
//         ) : (
//           <div className="space-y-3">
//             {openDesigRows.map((r, idx) => (
//               <div key={r.id}>
//                 <div className="flex items-center justify-between mb-1">
//                   <span
//                     className={`text-sm text-slate-700 truncate ${r.virtual ? "italic text-slate-400" : ""}`}
//                   >
//                     {r.name}
//                   </span>
//                   <span className="text-xs font-semibold text-slate-500 ml-2 shrink-0">
//                     {r.count}
//                   </span>
//                 </div>
//                 <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
//                   <div
//                     className="h-full rounded-full transition-all"
//                     style={{
//                       width: `${Math.round((r.count / maxOpenDesigCount) * 100)}%`,
//                       backgroundColor: PALETTE[idx % PALETTE.length],
//                     }}
//                   />
//                 </div>
//               </div>
//             ))}
//           </div>
//         )}
//       </Modal>
//     </div>
//   );
// }
