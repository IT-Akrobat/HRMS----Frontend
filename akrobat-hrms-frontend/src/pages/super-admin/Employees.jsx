import {
  AlertTriangle,
  Briefcase,
  Building2,
  Calendar,
  ChevronDown,
  Clock,
  Eye,
  Loader2,
  Mail,
  MapPin,
  MapPinned,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import { apiClient } from "../../services/apiClient";
import { parseLocalISODate } from "../../utils/date";
import { filterShiftsForSelection } from "../../utils/shiftMapping";
import { unwrap } from "../../utils/unwrap";

// Field staff (Inspection/Operation) rotate between assigned sites — see
// app/core/helpers/employee_helper.py::get_field_employee_ids(), which
// treats any department whose name starts with INSPECTION/OPERATION as
// "field". Mirrored here (rather than trusting a boolean from the API)
// so the site-history table only renders for the departments that
// actually have GET /site-assignments/employee/{id} data.
function isFieldDepartment(departmentName) {
  const n = (departmentName || "").toUpperCase();
  return n.startsWith("INSPECTION") || n.startsWith("OPERATION");
}

// assigned_from/assigned_to are DATE columns ("YYYY-MM-DD"), so these are
// parsed with parseLocalISODate (not `new Date(str)`) to avoid the same
// UTC-shift-by-a-day bug documented in utils/date.js.
function formatDuration(fromStr, toStr) {
  const from = parseLocalISODate(fromStr);
  if (!from) return "—";
  const to = toStr ? parseLocalISODate(toStr) : new Date();
  const days = Math.max(
    0,
    Math.round((to.getTime() - from.getTime()) / 86400000),
  );
  if (days < 1) return "Today";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30);
  const remDays = days % 30;
  if (months < 12)
    return remDays > 0 ? `${months} mo ${remDays} d` : `${months} mo`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths > 0 ? `${years} yr ${remMonths} mo` : `${years} yr`;
}

// ---------------------------------------------------------------------
// Wired to the real backend: GET/POST/PUT/DELETE /employees, plus
// /departments, /designations, /shifts, /roles for the dropdowns. See
// app/employees/{routes,services,schemas}.py for the contract this
// mirrors — in particular:
//   - EmployeeCreate requires full_name/email/password/role_id, and the
//     backend only accepts emails on the company domain
//     (see ALLOWED_DOMAIN in app/core/helpers/employee_helper.py).
//   - EmployeeUpdate has no role_id field (extra="forbid" on the model),
//     so the edit form intentionally has no role selector.
//   - Only SUPER ADMIN / HR ADMIN may create employees; VIEW/EDIT/DELETE
//     are permission-gated but Super Admin holds all of them.
// ---------------------------------------------------------------------

const STATUS_STYLES = {
  Active: "bg-blue-50 text-blue-600",
  Inactive: "bg-slate-100 text-slate-500",
};

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

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

const AVATAR_COLORS = [
  "bg-orange-100 text-orange-600",
  "bg-blue-100 text-blue-600",
  "bg-blue-100 text-blue-600",
  "bg-blue-100 text-blue-600",
  "bg-orange-100 text-orange-600",
  "bg-blue-100 text-blue-600",
];

function avatarColor(seed) {
  if (!seed) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = (hash + seed.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
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
      className={`${className} flex items-center justify-center font-semibold shrink-0 ${avatarColor(person?.full_name)}`}
    >
      {initials(person?.full_name)}
    </div>
  );
}

function Field({ label, required, error, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 mb-1 block">
        {label} {required && <span className="text-orange-500">*</span>}
      </span>
      {children}
      {error && (
        <span className="text-xs text-orange-500 mt-1 block">{error}</span>
      )}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400";

// If HR/Super Admin left "Email" blank when creating an employee, the
// backend fills in a placeholder login email built from the employee
// code itself (e.g. "akr-hr-0002@akrobat.com.sg" — see
// create_employee() in app/employees/services.py). That should never
// look like a real email on this form — otherwise it reads as "the
// employee code auto-appends into the Email field" whenever this Edit
// form is opened for one of these employees. Treat it as blank here so
// the real email can be added.
function isSystemGeneratedEmail(employee) {
  if (!employee?.email || !employee?.employee_id) return false;
  const localPart = employee.email.split("@")[0]?.toLowerCase();
  return localPart === employee.employee_id.toLowerCase();
}

// ==========================================================================
// Filter dropdown — custom (not native <select>) so the option list can have
// a fixed height with its own scrollbar, while still always loading every
// option (all departments / all designations), not a truncated subset.
// ==========================================================================

function FilterDropdown({
  allLabel,
  value,
  options,
  getKey,
  getLabel,
  onChange,
  fullWidth = false,
  showAllOption = true,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selected = options.find((o) => getKey(o) === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${fullWidth ? "w-full" : "w-full sm:w-48"} flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-100`}
      >
        <span className={`truncate ${!selected ? "text-slate-400" : ""}`}>
          {selected ? getLabel(selected) : allLabel}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full min-w-[200px] rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="max-h-56 overflow-y-auto py-1 scrollbar-hide">
            {showAllOption && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className={`block w-full truncate px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  !value ? "font-medium text-orange-600" : "text-slate-600"
                }`}
              >
                {allLabel}
              </button>
            )}
            {options.map((o) => (
              <button
                type="button"
                key={getKey(o)}
                onClick={() => {
                  onChange(getKey(o));
                  setOpen(false);
                }}
                className={`block w-full truncate px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  value === getKey(o)
                    ? "font-medium text-orange-600"
                    : "text-slate-600"
                }`}
              >
                {getLabel(o)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// Add / Edit modal
// ==========================================================================

function EmployeeFormModal({ mode, employee, refData, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const { departments, designations, shifts, roles, employees } = refData;

  const [form, setForm] = useState(() => ({
    full_name: employee?.full_name || "",
    email: isSystemGeneratedEmail(employee) ? "" : employee?.email || "",
    password: "",
    phone: employee?.phone || "",
    department_id: employee?.department_id || "",
    designation_id: employee?.designation_id || "",
    manager_id: employee?.manager_id || "",
    shift_id: employee?.shift_id || "",
    role_id: "",
    joining_date: employee?.joining_date || "",
    employment_status: employee?.employment_status || "Active",
    work_location: employee?.work_location || "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function set(key, value) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Designation must belong to the selected department. If the
      // department changes and the previously-picked designation no
      // longer belongs to it, clear it instead of silently keeping a
      // mismatched designation_id selected under the hood.
      if (key === "department_id") {
        const stillValid = designations.some(
          (d) => d.id === next.designation_id && d.department_id === value,
        );
        if (!stillValid) {
          next.designation_id = "";
          next.shift_id = "";
        }
      }
      // Every designation has exactly one fixed timing (see
      // src/utils/shiftMapping.js) — auto-fill it the moment a
      // designation is picked; HR can still override it below.
      if (key === "designation_id") {
        const picked = designations.find((d) => d.id === value);
        if (picked?.shifts?.id) next.shift_id = picked.shifts.id;
      }
      return next;
    });
  }

  // Designation options are scoped to whichever department is currently
  // selected — previously this dropdown always listed every designation
  // in the company regardless of department, so e.g. picking "QS
  // Department" still offered "Driver" or "Design Assistant" from other
  // departments.
  const designationOptions = form.department_id
    ? designations.filter((d) => d.department_id === form.department_id)
    : designations;

  // Shifts aren't tagged with a department in the schema, but every
  // designation has exactly one fixed timing per department — so the
  // Shift dropdown is filtered down to just that one option, e.g.
  // picking INSPECTION only shows Inspection Site's timing.
  const selectedDepartment = departments.find(
    (d) => d.id === form.department_id,
  );
  const selectedDesignation = designations.find(
    (d) => d.id === form.designation_id,
  );
  const filteredShifts = filterShiftsForSelection(
    shifts,
    selectedDepartment?.department_name,
    selectedDesignation?.designation_name,
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.full_name.trim() || form.full_name.trim().length < 2) {
      setError("Full name must be at least 2 characters.");
      return;
    }
    if (!isEdit && form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!isEdit && !form.role_id) {
      setError("Please select a role.");
      return;
    }

    const orUndefined = (v) => (v ? v : undefined);

    setSaving(true);
    try {
      if (isEdit) {
        const payload = {
          full_name: form.full_name.trim(),
          email: orUndefined(form.email.trim()),
          phone: form.phone.trim() || undefined,
          department_id: orUndefined(form.department_id),
          designation_id: orUndefined(form.designation_id),
          manager_id: orUndefined(form.manager_id),
          shift_id: orUndefined(form.shift_id),
          joining_date: orUndefined(form.joining_date),
          employment_status: form.employment_status,
          work_location: form.work_location.trim() || undefined,
        };
        await apiClient.put(`/employees/${employee.id}`, payload);
      } else {
        const payload = {
          full_name: form.full_name.trim(),
          email: orUndefined(form.email.trim()),
          password: form.password,
          phone: form.phone.trim() || undefined,
          department_id: orUndefined(form.department_id),
          designation_id: orUndefined(form.designation_id),
          manager_id: orUndefined(form.manager_id),
          shift_id: orUndefined(form.shift_id),
          role_id: form.role_id,
          joining_date: orUndefined(form.joining_date),
          employment_status: form.employment_status,
          work_location: form.work_location.trim() || undefined,
        };
        await apiClient.post("/employees/", payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {isEdit ? "Edit Employee" : "Add New Employee"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit
                ? `Update details for ${employee?.full_name}`
                : "Create a new employee record and account"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto px-6 py-5 space-y-6"
        >
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-100 text-orange-600 text-sm px-3 py-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name" required>
                <input
                  className={inputCls}
                  value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                  placeholder="John Doe"
                />
              </Field>
              <Field label="Email Address">
                <input
                  type="email"
                  className={inputCls}
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="john.doe@akrobat.com.sg"
                />
                {isEdit && isSystemGeneratedEmail(employee) && (
                  <span className="text-xs text-slate-400 mt-1 block">
                    No real email was set for this employee — the login email
                    shown was auto-generated from their employee code. Add their
                    actual email here.
                  </span>
                )}
              </Field>
              <Field label="Phone Number">
                <input
                  className={inputCls}
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+65 9123 4567"
                />
              </Field>
              {!isEdit && (
                <Field label="Password" required>
                  <input
                    type="password"
                    className={inputCls}
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    placeholder="Minimum 8 characters"
                  />
                </Field>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Work Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Department">
                <FilterDropdown
                  fullWidth
                  allLabel="Select department"
                  value={form.department_id}
                  onChange={(v) => set("department_id", v)}
                  options={departments}
                  getKey={(d) => d.id}
                  getLabel={(d) => d.department_name}
                />
              </Field>
              <Field label="Designation">
                <FilterDropdown
                  fullWidth
                  allLabel={
                    form.department_id
                      ? "Select designation"
                      : "Select a department first"
                  }
                  value={form.designation_id}
                  onChange={(v) => set("designation_id", v)}
                  options={designationOptions}
                  getKey={(d) => d.id}
                  getLabel={(d) => d.designation_name}
                />
              </Field>
              <Field label="Reporting Manager">
                <FilterDropdown
                  fullWidth
                  allLabel="None"
                  value={form.manager_id}
                  onChange={(v) => set("manager_id", v)}
                  options={employees.filter((e) => e.id !== employee?.id)}
                  getKey={(e) => e.id}
                  getLabel={(e) => `${e.full_name} (${e.employee_id})`}
                />
              </Field>
              <Field label="Shift">
                <FilterDropdown
                  fullWidth
                  allLabel="Select shift"
                  value={form.shift_id}
                  onChange={(v) => set("shift_id", v)}
                  options={filteredShifts}
                  getKey={(s) => s.id}
                  getLabel={(s) => s.shift_name}
                />
                {selectedDesignation?.shifts && (
                  <span className="text-xs text-slate-400 mt-1 block">
                    Auto-set to {selectedDesignation.shifts.shift_name}'s timing
                    for this designation.
                  </span>
                )}
              </Field>
              <Field label="Joining Date">
                <input
                  type="date"
                  className={inputCls}
                  value={form.joining_date || ""}
                  onChange={(e) => set("joining_date", e.target.value)}
                />
              </Field>
              <Field label="Work Location">
                <input
                  className={inputCls}
                  value={form.work_location}
                  onChange={(e) => set("work_location", e.target.value)}
                  placeholder="Singapore Office"
                />
              </Field>
              <Field label="Employment Status">
                <FilterDropdown
                  fullWidth
                  showAllOption={false}
                  allLabel="Select status"
                  value={form.employment_status}
                  onChange={(v) => set("employment_status", v)}
                  options={["Active", "Inactive"]}
                  getKey={(s) => s}
                  getLabel={(s) => s}
                />
              </Field>
              {!isEdit && (
                <Field label="Role" required>
                  <FilterDropdown
                    fullWidth
                    showAllOption={false}
                    allLabel="Select role"
                    value={form.role_id}
                    onChange={(v) => set("role_id", v)}
                    options={roles}
                    getKey={(r) => r.id}
                    getLabel={(r) => r.role_name}
                  />
                </Field>
              )}
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? "Save Changes" : "Create Employee"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// View drawer
// ==========================================================================

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={14} className="text-slate-400" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-sm text-slate-700 truncate">{value || "—"}</div>
      </div>
    </div>
  );
}

function EmployeeViewModal({ employee, employees, onClose, onEdit }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const manager = (employees || []).find((e) => e.id === employee.manager_id);

  const isField = isFieldDepartment(employee.departments?.department_name);
  const [siteHistory, setSiteHistory] = useState(null); // null = loading
  const [siteHistoryError, setSiteHistoryError] = useState(null);

  useEffect(() => {
    if (!isField) return;
    let cancelled = false;
    setSiteHistory(null);
    setSiteHistoryError(null);
    apiClient
      .get(`/site-assignments/employee/${employee.id}`)
      .then((res) => {
        if (!cancelled) setSiteHistory(unwrap(res) || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setSiteHistoryError(err?.message || "Unable to load site history.");
          setSiteHistory([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [employee.id, isField]);

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/50 transition-opacity duration-200 ${
          show ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Right-side sliding panel */}
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
            className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
              STATUS_STYLES[employee.employment_status] ||
              "bg-slate-100 text-slate-500"
            }`}
          >
            {employee.employment_status}
          </span>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-5 mb-1">
              Contact
            </h3>
            <div className="divide-y divide-slate-50">
              <DetailRow icon={Mail} label="Email" value={employee.email} />
              <DetailRow icon={Phone} label="Phone" value={employee.phone} />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-5 mb-1">
              Work Details
            </h3>
            <div className="divide-y divide-slate-50">
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
                icon={UserCheck}
                label="Reporting Manager"
                value={
                  manager
                    ? `${manager.full_name} (${manager.employee_id})`
                    : "—"
                }
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
                value={formatDate(employee.joining_date)}
              />
            </div>
          </div>

          {isField && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-5 mb-2 flex items-center gap-1.5">
                <MapPinned size={12} />
                Site History
              </h3>

              {siteHistory === null && (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                  <Loader2 size={14} className="animate-spin" />
                  Loading site history…
                </div>
              )}

              {siteHistory !== null && siteHistoryError && (
                <p className="text-sm text-orange-500 py-2">
                  {siteHistoryError}
                </p>
              )}

              {siteHistory !== null &&
                !siteHistoryError &&
                siteHistory.length === 0 && (
                  <p className="text-sm text-slate-400 py-2">
                    No sites assigned yet.
                  </p>
                )}

              {siteHistory !== null &&
                !siteHistoryError &&
                siteHistory.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-slate-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                          <th className="px-3 py-2">Site</th>
                          <th className="px-3 py-2">From</th>
                          <th className="px-3 py-2">To</th>
                          <th className="px-3 py-2">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {siteHistory.map((row) => (
                          <tr key={row.id}>
                            <td className="px-3 py-2 align-top">
                              <div className="font-medium text-slate-700">
                                {row.locations?.location_name || "—"}
                              </div>
                              {row.locations?.address && (
                                <div className="text-xs text-slate-400">
                                  {row.locations.address}
                                </div>
                              )}
                              {row.is_active && (
                                <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600">
                                  Current
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 align-top text-slate-600 whitespace-nowrap">
                              {formatDate(row.assigned_from)}
                            </td>
                            <td className="px-3 py-2 align-top text-slate-600 whitespace-nowrap">
                              {row.assigned_to
                                ? formatDate(row.assigned_to)
                                : "Present"}
                            </td>
                            <td className="px-3 py-2 align-top text-slate-600 whitespace-nowrap">
                              {formatDuration(
                                row.assigned_from,
                                row.assigned_to,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
          <button
            onClick={onEdit}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 flex items-center gap-2"
          >
            <Pencil size={14} />
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// Delete confirm
// ==========================================================================

function DeleteConfirmModal({ employee, onClose, onConfirm, deleting, error }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <div className="w-11 h-11 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mb-4">
          <Trash2 size={18} />
        </div>
        <h2 className="text-base font-bold text-slate-800 mb-1">
          Remove employee?
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          This will permanently delete{" "}
          <span className="font-medium text-slate-700">
            {employee.full_name}
          </span>{" "}
          and their login access. This action cannot be undone.
        </p>
        {error && (
          <div className="text-xs text-orange-500 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 flex items-center gap-2"
          >
            {deleting && <Loader2 size={14} className="animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// Main page
// ==========================================================================

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [roles, setRoles] = useState([]);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [formState, setFormState] = useState(null); // { mode: 'add'|'edit', employee }
  const [viewing, setViewing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function loadEmployees() {
    setLoading(true);
    setLoadError(null);
    return apiClient
      .get("/employees/")
      .then((res) => setEmployees(res.data || []))
      .catch((err) => {
        setEmployees([]);
        setLoadError(err.message || "Could not load employees.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadEmployees();
    apiClient
      .get("/departments/")
      .then((res) => setDepartments(res || []))
      .catch(() => setDepartments([]));
    apiClient
      .get("/designations/")
      .then((res) => setDesignations(res || []))
      .catch(() => setDesignations([]));
    apiClient
      .get("/shifts/")
      .then((res) => setShifts(res || []))
      .catch(() => setShifts([]));
    apiClient
      .get("/roles/")
      .then((res) => setRoles(res.data || []))
      .catch(() => setRoles([]));
  }, []);

  // Designation filter options are scoped to whichever department is
  // currently selected in the Department filter — previously this list
  // always showed every designation company-wide, so picking e.g. "QS
  // Department" still let you filter by a Design or Operation designation
  // that no QS employee could ever have.
  const designationFilterOptions = deptFilter
    ? designations.filter((d) => d.department_id === deptFilter)
    : designations;

  function handleDeptFilterChange(nextDeptId) {
    setDeptFilter(nextDeptId);
    const stillValid = designations.some(
      (d) => d.id === designationFilter && d.department_id === nextDeptId,
    );
    if (nextDeptId && !stillValid) setDesignationFilter("");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((emp) => {
      if (q) {
        const haystack =
          `${emp.full_name} ${emp.employee_id} ${emp.email}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (deptFilter && emp.department_id !== deptFilter) return false;
      if (designationFilter && emp.designation_id !== designationFilter)
        return false;
      if (statusFilter && emp.employment_status !== statusFilter) return false;
      return true;
    });
  }, [employees, search, deptFilter, designationFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, deptFilter, designationFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = employees.filter(
      (e) => e.employment_status === "Active",
    ).length;
    const inactive = employees.length - active;
    const deptCount = new Set(
      employees.map((e) => e.department_id).filter(Boolean),
    ).size;
    return { total: employees.length, active, inactive, deptCount };
  }, [employees]);

  const refData = { departments, designations, shifts, roles, employees };

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/employees/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadEmployees();
    } catch (err) {
      setDeleteError(err.message || "Could not delete this employee.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Manage all employees across your organization."
        actions={
          <button
            onClick={() => setFormState({ mode: "add" })}
            className="px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium flex items-center gap-1.5"
          >
            <Plus size={15} />
            Add Employee
          </button>
        }
      />

      {/* Stats */}
      {/* <div className="grid grid-cols-3 gap-4 mb-4">
        <StatCard
          icon={UserCheck}
          label="Active"
          color="green"
          loading={loading}
          value={stats.active}
        />
        <StatCard
          icon={UserX}
          label="Inactive"
          color="red"
          loading={loading}
          value={stats.inactive}
        />
        <StatCard
          icon={Building2}
          label="Departments"
          color="blue"
          loading={loading}
          value={stats.deptCount}
        />
      </div> */}

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 mb-3 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or employee ID..."
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
          />
        </div>

        <FilterDropdown
          allLabel="All Departments"
          value={deptFilter}
          onChange={handleDeptFilterChange}
          options={departments}
          getKey={(d) => d.id}
          getLabel={(d) => d.department_name}
        />

        <FilterDropdown
          allLabel="All Designations"
          value={designationFilter}
          onChange={setDesignationFilter}
          options={designationFilterOptions}
          getKey={(d) => d.id}
          getLabel={(d) => d.designation_name}
        />

        <FilterDropdown
          allLabel="All Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={["Active", "Inactive"]}
          getKey={(s) => s}
          getLabel={(s) => s}
        />
        {(search || deptFilter || designationFilter || statusFilter) && (
          <button
            onClick={() => {
              setSearch("");
              setDeptFilter("");
              setDesignationFilter("");
              setStatusFilter("");
            }}
            className="text-sm text-orange-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loadError && (
          <div className="flex items-center gap-2 text-orange-600 bg-orange-50 border-b border-orange-100 px-4 py-3 text-sm">
            <AlertTriangle size={16} />
            {loadError}
          </div>
        )}

        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Employee ID</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Designation</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-400 text-sm"
                  >
                    No employees found.
                  </td>
                </tr>
              ) : (
                pageItems.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={() => setViewing(emp)}
                    className="border-b border-slate-50 hover:bg-slate-50/60 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          person={emp}
                          className="w-9 h-9 rounded-full text-xs"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 truncate">
                            {emp.full_name}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {emp.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {emp.employee_id}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {emp.departments?.department_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {emp.designations?.designation_name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          STATUS_STYLES[emp.employment_status] ||
                          "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {emp.employment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(emp.joining_date)}
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewing(emp)}
                          title="View"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() =>
                            setFormState({ mode: "edit", employee: emp })
                          }
                          title="Edit"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-orange-50 hover:text-orange-500"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(emp);
                          }}
                          title="Delete"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-orange-50 hover:text-orange-500"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, filtered.length)} of {filtered.length}{" "}
              employees
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                Prev
              </button>
              <span className="px-2">
                {page} / {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {formState && (
        <EmployeeFormModal
          mode={formState.mode}
          employee={formState.employee}
          refData={refData}
          onClose={() => setFormState(null)}
          onSaved={() => {
            setFormState(null);
            loadEmployees();
          }}
        />
      )}

      {viewing && (
        <EmployeeViewModal
          employee={viewing}
          employees={employees}
          onClose={() => setViewing(null)}
          onEdit={() => {
            const emp = viewing;
            setViewing(null);
            setFormState({ mode: "edit", employee: emp });
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          employee={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
