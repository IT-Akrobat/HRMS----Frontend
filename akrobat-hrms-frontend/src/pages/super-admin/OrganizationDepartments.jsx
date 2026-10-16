import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Building2,
  ChevronRight,
  Loader2,
  Search,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import { apiClient } from "../../services/apiClient";

// ---------------------------------------------------------------------
// Departments overview — card grid. Each card shows headcount, share of
// the organisation and its top designations; clicking a card opens a
// slide-in panel with the full designation breakdown.
//
// Data (unchanged):
//   GET /departments/   -> [{ id, department_name }]
//   GET /designations/  -> [{ id, designation_name, department_id }]
//   GET /employees/     -> { data: [{ department_id, designation_id,
//                             employment_status, ... }] }
// Counts are derived client-side. Counts-only: no edit/delete.
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
  const [sortBy, setSortBy] = useState("count"); // "count" | "name"
  const [openDeptId, setOpenDeptId] = useState(null);
  const [openDesigId, setOpenDesigId] = useState(null);

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
      .catch((err) => setError(err.message || "Couldn't load departments."))
      .finally(() => setLoading(false));
  }, []);

  // Collapse any expanded designation when another department is opened.
  useEffect(() => {
    setOpenDesigId(null);
  }, [openDeptId]);

  // Close the panel on Escape.
  useEffect(() => {
    if (!openDeptId) return;
    // Escape goes back one step: members -> designations -> close.
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (openDesigId) setOpenDesigId(null);
      else setOpenDeptId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDeptId, openDesigId]);

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

  function designationRowsFor(deptId) {
    const rows = designations
      .filter((d) => d.department_id === deptId)
      .map((d) => ({
        id: d.id,
        name: d.designation_name || "Untitled Designation",
        count: desigCounts[d.id] || 0,
      }));
    if (deptId !== UNASSIGNED_DEPT) {
      const unassigned = scopedEmployees.filter(
        (e) => e.department_id === deptId && !e.designation_id,
      ).length;
      if (unassigned) {
        rows.push({
          id: `${deptId}-${UNASSIGNED_DESIG}`,
          name: "Unassigned",
          count: unassigned,
          virtual: true,
        });
      }
    }
    return rows.sort((a, b) => b.count - a.count);
  }

  function employeesFor(deptId, desig) {
    return scopedEmployees
      .filter((e) => {
        const inDept =
          deptId === UNASSIGNED_DEPT
            ? !e.department_id
            : e.department_id === deptId;
        if (!inDept) return false;
        return desig.virtual
          ? !e.designation_id
          : e.designation_id === desig.id;
      })
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  }

  const totalHeadcount = scopedEmployees.length;

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
    return rows.map((r) => ({
      ...r,
      share: totalHeadcount ? Math.round((r.count / totalHeadcount) * 100) : 0,
      desigRows: designationRowsFor(r.id),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departments, designations, deptCounts, desigCounts, scopedEmployees]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? deptRows.filter((d) => d.name.toLowerCase().includes(q))
      : [...deptRows];
    list.sort((a, b) =>
      sortBy === "name" ? a.name.localeCompare(b.name) : b.count - a.count,
    );
    return list;
  }, [deptRows, search, sortBy]);

  const largest = deptRows.reduce(
    (m, d) => (d.count > (m?.count ?? -1) ? d : m),
    null,
  );
  const openDept = deptRows.find((d) => d.id === openDeptId) || null;
  const openDesig =
    openDept?.desigRows.find((r) => r.id === openDesigId) || null;
  const openPeople = openDesig ? employeesFor(openDept.id, openDesig) : [];
  const maxOpenCount = Math.max(
    1,
    ...(openDept?.desigRows || []).map((r) => r.count),
  );

  return (
    <div>
      <PageHeader
        title="Departments & Designations"
        subtitle={
          <span className="hidden lg:inline">
            Headcount by department, and by designation within each department.
          </span>
        }
      />

      {error ? (
        <div className="flex items-center gap-2 text-orange-600 bg-orange-50 rounded-xl px-4 py-3 text-sm mb-6">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : (
        <>
          {/* ---------- KPI strip ---------- */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
            {[
              {
                icon: Building2,
                label: "Departments",
                value: departments.length,
                tone: "bg-orange-50 text-orange-600",
              },
              {
                icon: Briefcase,
                label: "Designations",
                value: designations.length,
                tone: "bg-blue-50 text-blue-600",
              },
              {
                icon: Users,
                label: activeOnly ? "Active Employees" : "Employees",
                value: totalHeadcount,
                tone: "bg-slate-100 text-slate-600",
              },
            ].map(({ icon: Icon, label, value, tone }) => (
              <div
                key={label}
                className="bg-white rounded-lg border border-slate-200 px-2.5 py-2 flex items-center gap-2.5"
              >
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${tone}`}
                >
                  <Icon size={14} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] sm:text-[11px] text-slate-500 truncate leading-tight">
                    {label}
                  </div>
                  {loading ? (
                    <div className="h-4 w-8 mt-0.5 bg-slate-100 rounded animate-pulse" />
                  ) : (
                    <div className="text-base font-bold text-slate-800 leading-tight">
                      {value}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ---------- Controls ---------- */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
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

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
                {[
                  [false, "All Employees"],
                  [true, "Active Only"],
                ].map(([val, label]) => (
                  <button
                    key={label}
                    onClick={() => setActiveOnly(val)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeOnly === val
                        ? "bg-orange-500 text-white"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
                {[
                  ["count", "Most staff"],
                  ["name", "A – Z"],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setSortBy(val)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      sortBy === val
                        ? "bg-slate-800 text-white"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {!loading && largest && (
              <div className="lg:ml-auto text-xs text-slate-500">
                Largest:{" "}
                <span className="font-semibold text-slate-700">
                  {largest.name}
                </span>{" "}
                ({largest.count})
              </div>
            )}
          </div>

          {/* ---------- Department cards ---------- */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-44 bg-white border border-slate-200 rounded-2xl animate-pulse"
                />
              ))}
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center bg-white border border-slate-200 rounded-2xl">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <Search size={16} className="text-slate-400" />
              </div>
              <div className="text-slate-500 text-sm font-medium">
                No departments found
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {visibleRows.map((d) => {
                const top = d.desigRows.filter((r) => !r.virtual).slice(0, 3);
                const extra = d.desigRows.length - top.length;
                return (
                  <button
                    key={d.id}
                    onClick={() => setOpenDeptId(d.id)}
                    className="group text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-orange-300 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange-100"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                        <Building2 size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-semibold text-slate-800 truncate ${d.virtual ? "italic" : ""}`}
                        >
                          {d.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {d.desigRows.length}{" "}
                          {d.desigRows.length === 1
                            ? "designation"
                            : "designations"}
                        </div>
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-slate-300 group-hover:text-orange-500 transition-colors shrink-0 mt-1"
                      />
                    </div>

                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <div className="text-2xl font-bold text-slate-800 leading-none">
                          {d.count}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {d.count === 1 ? "employee" : "employees"}
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-orange-50 text-orange-600">
                        {d.share}% of org
                      </span>
                    </div>

                    <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-orange-400"
                        style={{ width: `${d.share}%` }}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5 min-h-[24px]">
                      {top.length === 0 ? (
                        <span className="text-[11px] text-slate-400">
                          No designations yet
                        </span>
                      ) : (
                        <>
                          {top.map((r) => (
                            <span
                              key={r.id}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 max-w-[9rem] truncate"
                            >
                              {r.name} · {r.count}
                            </span>
                          ))}
                          {extra > 0 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-600">
                              +{extra} more
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-400">
          <Loader2 size={13} className="animate-spin" /> Loading departments...
        </div>
      )}

      {/* ---------- Detail panel: side drawer (desktop) / bottom sheet (mobile) ----------
          Two steps: designations list -> members of the chosen designation.
          The back arrow in the header returns from members to designations. */}
      {openDept && (
        <div className="fixed inset-0 z-50 flex sm:justify-end items-end sm:items-stretch">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpenDeptId(null)}
          />
          <div className="relative bg-white w-full sm:w-[420px] h-[85vh] sm:h-auto rounded-t-2xl sm:rounded-none shadow-xl flex flex-col">
            <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
              {openDesig ? (
                <button
                  onClick={() => setOpenDesigId(null)}
                  className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center shrink-0"
                  aria-label="Back to designations"
                >
                  <ArrowLeft size={18} />
                </button>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0">
                  <Building2 size={18} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold text-slate-800 truncate">
                  {openDesig ? openDesig.name : openDept.name}
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {openDesig ? (
                    <>
                      {openDept.name} · {openPeople.length}{" "}
                      {openPeople.length === 1 ? "employee" : "employees"}
                    </>
                  ) : (
                    <>
                      {openDept.desigRows.length}{" "}
                      {openDept.desigRows.length === 1
                        ? "designation"
                        : "designations"}
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => setOpenDeptId(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {openDesig ? (
              /* ----- Step 2: members of the selected designation ----- */
              <div className="flex-1 overflow-y-auto px-3 py-3">
                {openPeople.length === 0 ? (
                  <div className="px-2 py-10 text-center text-slate-400 text-sm">
                    No employees in this designation.
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-100 divide-y divide-slate-100">
                    {openPeople.map((p) => (
                      <div
                        key={p.id ?? p.employee_id}
                        className="flex items-center gap-2.5 px-3 py-2.5"
                      >
                        <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[11px] font-semibold shrink-0">
                          {(p.full_name || "?")
                            .trim()
                            .split(/\s+/)
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0 text-sm text-slate-700 truncate">
                          {p.full_name || "Unnamed"}
                        </div>
                        <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                          {p.employee_id || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* ----- Step 1: designations of the department ----- */}
                <div className="grid grid-cols-2 gap-3 px-5 py-4 border-b border-slate-100">
                  <div className="rounded-xl bg-orange-50 px-3 py-2.5">
                    <div className="text-[11px] text-orange-600/80">
                      Employees
                    </div>
                    <div className="text-xl font-bold text-orange-600">
                      {openDept.count}
                    </div>
                  </div>
                  <div className="rounded-xl bg-blue-50 px-3 py-2.5">
                    <div className="text-[11px] text-blue-600/80">
                      Share of org
                    </div>
                    <div className="text-xl font-bold text-blue-600">
                      {openDept.share}%
                    </div>
                  </div>
                </div>

                <div className="px-5 pt-4 pb-1 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  By designation
                </div>
                <div className="flex-1 overflow-y-auto px-3 pb-5 space-y-1">
                  {openDept.desigRows.length === 0 ? (
                    <div className="px-2 py-10 text-center text-slate-400 text-sm">
                      No designations set up for this department yet.
                    </div>
                  ) : (
                    openDept.desigRows.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setOpenDesigId(r.id)}
                        className="w-full text-left px-3 py-2 rounded-lg transition-colors hover:bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={`flex items-center gap-1.5 text-sm truncate ${r.virtual ? "italic text-slate-400" : "text-slate-700"}`}
                          >
                            <span className="truncate">{r.name}</span>
                          </span>
                          <span className="shrink-0 flex items-center gap-1.5">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 min-w-[2rem] text-center">
                              {r.count}
                            </span>
                            <ChevronRight
                              size={14}
                              className="text-slate-300 shrink-0"
                            />
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-400"
                            style={{
                              width: `${Math.round((r.count / maxOpenCount) * 100)}%`,
                            }}
                          />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
