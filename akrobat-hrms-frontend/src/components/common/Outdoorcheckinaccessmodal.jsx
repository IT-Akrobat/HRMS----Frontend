import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../services/apiClient";
import Modal from "./Modal";

// ---------------------------------------------------------------------
// Same "Ad-hoc Outdoor Check-in" toggle that already exists inside
// Edit Employee (Employees.jsx), surfaced here as its own quick list —
// opened in-place from a dashboard quick-action button (same pattern
// as "Create User" / "Create Site" already use) instead of a routed
// page or a sidebar nav entry. HR was having to open a specific
// employee's edit modal, scroll to find the toggle, flip it, save, and
// repeat — this is every employee with the toggle right next to their
// name, filterable by search, nothing else.
//
// Same backend contract Employees.jsx already uses:
//   GET /employees/            -> { data: [...] }  (includes
//     outdoor_checkin_enabled and embedded departments/designations —
//     see EMPLOYEE_LIST_SELECT in app/employees/services.py)
//   PUT /employees/{id}        -> { outdoor_checkin_enabled: bool }
//     (every field on EmployeeUpdate is optional, so a minimal payload
//     like this only touches this one column — see
//     app/employees/schemas.py EmployeeUpdate)
// No backend changes needed.
// ---------------------------------------------------------------------

function asList(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

export default function OutdoorCheckinAccessModal({ open, onClose }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [rowError, setRowError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setLoadError(null);
    apiClient
      .get("/employees/")
      .then((res) => setEmployees(asList(res)))
      .catch((err) => {
        setEmployees([]);
        setLoadError(err.message || "Could not load employees.");
      })
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Active employees only — a toggle for someone already inactive
    // isn't useful and just clutters the list.
    const active = employees.filter((e) => e.employment_status === "Active");
    if (!q) return active;
    return active.filter(
      (e) =>
        e.full_name?.toLowerCase().includes(q) ||
        e.employee_id?.toLowerCase().includes(q) ||
        e.departments?.department_name?.toLowerCase().includes(q) ||
        e.designations?.designation_name?.toLowerCase().includes(q),
    );
  }, [employees, search]);

  function handleToggle(employee, next) {
    setRowError(null);
    setSavingId(employee.id);
    // Optimistic update — flip it in the list immediately, roll back
    // on failure so the switch never looks "stuck" mid-request.
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === employee.id ? { ...e, outdoor_checkin_enabled: next } : e,
      ),
    );
    apiClient
      .put(`/employees/${employee.id}`, { outdoor_checkin_enabled: next })
      .catch((err) => {
        setEmployees((prev) =>
          prev.map((e) =>
            e.id === employee.id ? { ...e, outdoor_checkin_enabled: !next } : e,
          ),
        );
        setRowError(
          `Couldn't update ${employee.full_name}: ${err.message || "please try again."}`,
        );
      })
      .finally(() => setSavingId(null));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Outdoor Check-in Access"
      width="max-w-xl"
    >
      <div className="px-0">
        <div className="relative mb-3">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ID, department..."
            className="w-full text-sm rounded-lg border border-slate-200 pl-9 pr-3 py-2.5 sm:py-2 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
          />
        </div>

        {rowError && (
          <div className="mb-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {rowError}
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Loading employees…
          </div>
        ) : loadError ? (
          <div className="py-10 text-center text-sm text-red-500">
            {loadError}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            No employees match “{search}”.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[55vh] overflow-y-auto -mx-1 px-1">
            {filtered.map((e) => {
              // Department/designation is shown as a single meta line —
              // wraps to a second line on narrow screens instead of the
              // old single-line `truncate`, which was chopping labels
              // off mid-word ("INSPE…", "DE…") and reading as broken UI.
              const meta = [
                e.employee_id,
                e.departments?.department_name,
                e.designations?.designation_name,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {e.profile_photo ? (
                      <img
                        src={e.profile_photo}
                        alt={e.full_name}
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold flex items-center justify-center shrink-0">
                        {initials(e.full_name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {e.full_name}
                      </p>
                      <p className="text-xs text-slate-500 leading-snug break-words">
                        {meta}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(e.outdoor_checkin_enabled)}
                    aria-label={`Outdoor check-in access for ${e.full_name}`}
                    disabled={savingId === e.id}
                    onClick={() => handleToggle(e, !e.outdoor_checkin_enabled)}
                    className={`relative shrink-0 w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-200 ${
                      savingId === e.id
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer"
                    } ${
                      e.outdoor_checkin_enabled
                        ? "bg-brand-orange"
                        : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                        e.outdoor_checkin_enabled
                          ? "translate-x-4"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
