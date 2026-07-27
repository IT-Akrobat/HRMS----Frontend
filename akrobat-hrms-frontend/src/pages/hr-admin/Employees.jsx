import {
  AlertTriangle,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Contact,
  Copy,
  Eye,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import { apiClient } from "../../services/apiClient";
import { filterShiftsForSelection } from "../../utils/shiftMapping";

// ---------------------------------------------------------------------
// Company-wide Employee List for HR Admin.
//
// Layout: a three-column drill-down browser —
//   Column 1: every Department, with a headcount badge.
//   Column 2: the Designations that belong to whichever department is
//             selected in column 1.
//   Column 3: the Employees that match the column 1 / column 2
//             selection (falls back to every employee when nothing is
//             selected yet), with the existing search/status filter,
//             pagination, and Add/View/Edit/Delete actions.
//
// Wired to the real backend: GET/POST/PUT/DELETE /employees, plus
// /departments, /designations, /shifts, /roles. See
// app/employees/{routes,services,schemas}.py for the contract this
// mirrors — in particular:
//   - GET /employees/ (no filters) returns every employee HR Admin has
//     VIEW_EMPLOYEE visibility into — the department/designation
//     drill-down below is done client-side against that one list, the
//     same list that feeds the headcount badges in columns 1 and 2.
//   - EmployeeCreate requires full_name/email/password/role_id, and the
//     backend only accepts emails on the company domain
//     (see ALLOWED_DOMAIN in app/core/helpers/employee_helper.py) — the
//     Add form now includes a Role select (any role, not fixed) so it
//     covers every employee HR Admin is allowed to create, not just
//     HR ADMIN peers.
//   - EmployeeUpdate has no role_id field (extra="forbid" on the model),
//     so the edit form intentionally has no role selector.
//   - Only SUPER ADMIN / HR ADMIN may create employees; VIEW/EDIT/DELETE
//     are permission-gated but Super Admin holds all of them.
// ---------------------------------------------------------------------

const STATUS_STYLES = {
  Active: "bg-blue-50 text-blue-600",
  Inactive: "bg-slate-100 text-slate-500",
};

// Some list endpoints (/employees/, /roles/) return
// { success, message, data: [...] }; others (/departments/,
// /designations/, /shifts/) return the raw array directly. Normalize
// either shape into a plain array so a backend change on one side
// doesn't silently empty out a column.
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

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
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

// If HR left "Email" blank when creating an employee, the backend fills
// in a placeholder login email built from the employee code itself
// (e.g. "akr-hr-0002@akrobat.com.sg" — see create_employee() in
// app/employees/services.py). That's fine for Supabase auth, but it
// should never look like a real email on this form — otherwise it
// reads as "the employee code auto-appends into the Email field"
// whenever HR opens Edit on one of these employees. Treat it as blank
// here instead so HR notices there's no real email on file and can add
// one, rather than silently keeping the generated code-based address.
function isSystemGeneratedEmail(employee) {
  if (!employee?.email || !employee?.employee_id) return false;
  const localPart = employee.email.split("@")[0]?.toLowerCase();
  return localPart === employee.employee_id.toLowerCase();
}

// ==========================================================================
// Add / Edit modal
// ==========================================================================

function EmployeeFormModal({
  mode,
  employee,
  refData,
  defaultRoleId,
  onClose,
  onSaved,
}) {
  const isEdit = mode === "edit";
  const { departments, designations, shifts, employees, roles } = refData;

  const [form, setForm] = useState(() => ({
    full_name: employee?.full_name || "",
    email: isSystemGeneratedEmail(employee) ? "" : employee?.email || "",
    phone: employee?.phone || "",
    role_id: defaultRoleId || "",
    department_id: employee?.department_id || "",
    designation_id: employee?.designation_id || "",
    manager_id: employee?.manager_id || "",
    shift_id: employee?.shift_id || "",
    joining_date: employee?.joining_date || "",
    employment_status: employee?.employment_status || "Active",
    work_location: employee?.work_location || "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // Set once the employee is created -- the employee code and temporary
  // password are only ever returned by the backend on this one create
  // call (see app/employees/services.py create_employee), so they're
  // shown here once instead of being fetchable later.
  const [createdCredentials, setCreatedCredentials] = useState(null);

  function set(key, value) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "department_id") {
        const stillValid = designations.some(
          (d) => d.id === next.designation_id && d.department_id === value,
        );
        if (!stillValid) {
          next.designation_id = "";
          next.shift_id = "";
        }
      }
      if (key === "designation_id") {
        const picked = designations.find((d) => d.id === value);
        if (picked?.shifts?.id) next.shift_id = picked.shifts.id;
      }
      return next;
    });
  }

  const designationOptions = form.department_id
    ? designations.filter((d) => d.department_id === form.department_id)
    : designations;

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
    if (!isEdit && !form.role_id) {
      setError("Please select a role for this employee.");
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
        onSaved();
      } else {
        // No `password` field anymore -- the employee code (based on
        // department) and login password are both generated
        // server-side. See app/employees/services.py create_employee().
        const payload = {
          full_name: form.full_name.trim(),
          email: orUndefined(form.email.trim()),
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
        const response = await apiClient.post("/employees/", payload);
        const created = response?.data || response;
        // Show the generated employee code + password once, instead of
        // closing straight away -- this is the only place HR can see
        // the password, since it's never stored in plaintext.
        setCreatedCredentials({
          full_name: created?.full_name || form.full_name.trim(),
          employee_id: created?.login_employee_id || created?.employee_id,
          password: created?.login_password,
        });
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (createdCredentials) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
          <div className="px-6 py-5 text-center border-b border-slate-100">
            <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 size={26} className="text-green-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">
              Employee Created
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Share these login details with {createdCredentials.full_name} —
              the password won't be shown again after you close this window.
            </p>
          </div>

          <div className="px-6 py-5 space-y-3">
            <div className="rounded-lg border border-slate-200 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Contact size={12} /> Employee Code
                </p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">
                  {createdCredentials.employee_id || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard?.writeText(
                    createdCredentials.employee_id || "",
                  )
                }
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="Copy"
              >
                <Copy size={14} />
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <KeyRound size={12} /> Temporary Password
                </p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5 font-mono">
                  {createdCredentials.password || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard?.writeText(
                    createdCredentials.password || "",
                  )
                }
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="Copy"
              >
                <Copy size={14} />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              The employee signs in with this code and password on the login
              screen, and can change the password afterwards from Settings.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
            <button
              onClick={() => {
                setCreatedCredentials(null);
                onSaved();
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
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
                <div className="col-span-2 flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 text-xs px-3 py-2">
                  <Contact size={14} className="mt-0.5 shrink-0" />
                  <span>
                    The employee code (based on department) and a login password
                    will be generated automatically once you save — you'll see
                    them on the next screen to share with the employee.
                  </span>
                </div>
              )}
              {!isEdit && (
                <Field label="Role" required>
                  <select
                    className={inputCls}
                    value={form.role_id}
                    onChange={(e) => set("role_id", e.target.value)}
                  >
                    <option value="">Select role</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.role_name}
                      </option>
                    ))}
                  </select>
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
                <select
                  className={inputCls}
                  value={form.department_id}
                  onChange={(e) => set("department_id", e.target.value)}
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.department_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Designation">
                <select
                  className={inputCls}
                  value={form.designation_id}
                  onChange={(e) => set("designation_id", e.target.value)}
                >
                  <option value="">
                    {form.department_id
                      ? "Select designation"
                      : "Select a department first"}
                  </option>
                  {designationOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.designation_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reporting Manager">
                <select
                  className={inputCls}
                  value={form.manager_id}
                  onChange={(e) => set("manager_id", e.target.value)}
                >
                  <option value="">None</option>
                  {employees
                    .filter((e) => e.id !== employee?.id)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name} ({e.employee_id})
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Shift">
                <select
                  className={inputCls}
                  value={form.shift_id}
                  onChange={(e) => set("shift_id", e.target.value)}
                >
                  <option value="">Select shift</option>
                  {filteredShifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shift_name}
                    </option>
                  ))}
                </select>
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
                <select
                  className={inputCls}
                  value={form.employment_status}
                  onChange={(e) => set("employment_status", e.target.value)}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </Field>
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

function EmployeeViewModal({ employee, onClose, onEdit }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl">
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar person={employee} className="w-12 h-12 rounded-full" />
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {employee.full_name}
              </h2>
              <p className="text-xs text-slate-500">{employee.employee_id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3 text-sm">
          <span
            className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
              STATUS_STYLES[employee.employment_status] ||
              "bg-slate-100 text-slate-500"
            }`}
          >
            {employee.employment_status}
          </span>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="flex items-center gap-2 text-slate-600">
              <Mail size={14} className="text-slate-400" />
              <span className="truncate">{employee.email || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Phone size={14} className="text-slate-400" />
              <span>{employee.phone || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Building2 size={14} className="text-slate-400" />
              <span>{employee.departments?.department_name || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Briefcase size={14} className="text-slate-400" />
              <span>{employee.designations?.designation_name || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <MapPin size={14} className="text-slate-400" />
              <span>{employee.work_location || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar size={14} className="text-slate-400" />
              <span>Joined {formatDate(employee.joining_date)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
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
          Remove Employee?
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          This will permanently delete{" "}
          <span className="font-medium text-slate-700">
            {employee.full_name}
          </span>{" "}
          and revoke their login access. This action cannot be undone.
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
// Drill-down column row (departments / designations lists)
// ==========================================================================

function DrilldownRow({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
        active
          ? "bg-orange-50 text-orange-700 font-medium"
          : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="flex items-center gap-1.5 shrink-0">
        <span
          className={`text-xs px-1.5 py-0.5 rounded-full ${
            active
              ? "bg-orange-100 text-orange-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {count}
        </span>
        <ChevronRight
          size={14}
          className={active ? "text-orange-400" : "text-slate-300"}
        />
      </span>
    </button>
  );
}

function DrilldownColumn({ title, icon: Icon, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl flex flex-col h-[600px] min-w-0">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 shrink-0">
        <Icon size={16} className="text-orange-500" />
        <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 min-w-0">{children}</div>
    </div>
  );
}

// ==========================================================================
// Main page
// ==========================================================================

export default function EmployeesHrAdmin() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [roles, setRoles] = useState([]);

  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [selectedDesigId, setSelectedDesigId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [formState, setFormState] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function loadEmployees() {
    setLoading(true);
    setLoadError(null);
    return apiClient
      .get("/employees/")
      .then((res) => setEmployees(asList(res)))
      .catch((err) => {
        setEmployees([]);
        setLoadError(err.message || "Could not load employees.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    apiClient
      .get("/departments/")
      .then((res) => setDepartments(asList(res)))
      .catch(() => setDepartments([]));
    apiClient
      .get("/designations/")
      .then((res) => setDesignations(asList(res)))
      .catch(() => setDesignations([]));
    apiClient
      .get("/shifts/")
      .then((res) => setShifts(asList(res)))
      .catch(() => setShifts([]));
    apiClient
      .get("/roles/")
      .then((res) => setRoles(asList(res)))
      .catch(() => setRoles([]));

    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectDept(id) {
    setSelectedDeptId((current) => (current === id ? null : id));
    setSelectedDesigId(null);
    setPage(1);
  }

  function selectDesig(id) {
    setSelectedDesigId((current) => (current === id ? null : id));
    setPage(1);
  }

  const departmentCounts = useMemo(() => {
    const counts = {};
    for (const emp of employees) {
      if (!emp.department_id) continue;
      counts[emp.department_id] = (counts[emp.department_id] || 0) + 1;
    }
    return counts;
  }, [employees]);

  const designationsForDept = useMemo(() => {
    if (!selectedDeptId) return [];
    return designations.filter((d) => d.department_id === selectedDeptId);
  }, [designations, selectedDeptId]);

  const designationCounts = useMemo(() => {
    const counts = {};
    for (const emp of employees) {
      if (!emp.designation_id) continue;
      if (selectedDeptId && emp.department_id !== selectedDeptId) continue;
      counts[emp.designation_id] = (counts[emp.designation_id] || 0) + 1;
    }
    return counts;
  }, [employees, selectedDeptId]);

  const employeesInSelectedDept = useMemo(() => {
    if (!selectedDeptId) return employees;
    return employees.filter((e) => e.department_id === selectedDeptId);
  }, [employees, selectedDeptId]);

  // Column 3 stays empty until something is picked in column 1 — it
  // doesn't default to "every employee in the company" the moment the
  // page loads.
  const scopedEmployees = useMemo(() => {
    if (selectedDesigId) {
      return employees.filter((e) => e.designation_id === selectedDesigId);
    }
    if (selectedDeptId) {
      return employees.filter((e) => e.department_id === selectedDeptId);
    }
    return [];
  }, [employees, selectedDeptId, selectedDesigId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedEmployees.filter((emp) => {
      if (q) {
        const haystack =
          `${emp.full_name} ${emp.employee_id} ${emp.email}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter && emp.employment_status !== statusFilter) return false;
      return true;
    });
  }, [scopedEmployees, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, selectedDeptId, selectedDesigId]);

  const stats = useMemo(() => {
    const active = employees.filter(
      (e) => e.employment_status === "Active",
    ).length;
    const inactive = employees.length - active;
    return {
      total: employees.length,
      active,
      inactive,
      deptCount: departments.length,
    };
  }, [employees, departments]);

  const defaultRoleId =
    roles.find((r) => r.role_name?.trim().toUpperCase() === "EMPLOYEE")?.id ||
    roles[0]?.id ||
    "";

  const refData = { departments, designations, shifts, employees, roles };

  const selectedDept = departments.find((d) => d.id === selectedDeptId);
  const selectedDesig = designations.find((d) => d.id === selectedDesigId);

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
        subtitle="Browse by department and designation, or search the full list."
        // actions={
        //   // <button
        //   //   onClick={() => setFormState({ mode: "add" })}
        //   //   className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium flex items-center gap-2"
        //   // >
        //   //   <Plus size={16} />
        //   //   Add Employee
        //   // </button>
        // }
      />

      {/* <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Users}
          label="Total Employees"
          color="orange"
          loading={loading}
          value={stats.total}
        />
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

      {loadError && (
        <div className="flex items-center gap-2 text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-4 py-3 text-sm mb-4">
          <AlertTriangle size={16} />
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[22%_22%_1fr] gap-4 items-start min-w-0">
        <DrilldownColumn title="Departments" icon={Building2}>
          <DrilldownRow
            label="All Departments"
            count={employees.length}
            active={!selectedDeptId}
            onClick={() => selectDept(null)}
          />
          {departments.map((dept) => (
            <DrilldownRow
              key={dept.id}
              label={dept.department_name}
              count={departmentCounts[dept.id] || 0}
              active={selectedDeptId === dept.id}
              onClick={() => selectDept(dept.id)}
            />
          ))}
        </DrilldownColumn>

        <DrilldownColumn title="Designations" icon={Briefcase}>
          {!selectedDeptId ? (
            <p className="text-sm text-slate-400 px-2 py-3">
              Select a department to see its designations.
            </p>
          ) : (
            <>
              <DrilldownRow
                label={`All in ${selectedDept?.department_name || "—"}`}
                count={employeesInSelectedDept.length}
                active={!selectedDesigId}
                onClick={() => selectDesig(null)}
              />
              {designationsForDept.length === 0 ? (
                <p className="text-sm text-slate-400 px-2 py-3">
                  No designations in this department yet.
                </p>
              ) : (
                designationsForDept.map((desig) => (
                  <DrilldownRow
                    key={desig.id}
                    label={desig.designation_name}
                    count={designationCounts[desig.id] || 0}
                    active={selectedDesigId === desig.id}
                    onClick={() => selectDesig(desig.id)}
                  />
                ))
              )}
            </>
          )}
        </DrilldownColumn>

        <div className="bg-white border border-slate-200 rounded-xl flex flex-col h-[600px] min-w-0">
          <div className="px-4 py-3 border-b border-slate-100 shrink-0 space-y-3">
            <div className="flex items-center gap-1.5 text-sm">
              <Users size={16} className="text-orange-500 shrink-0" />
              <span className="font-semibold text-slate-800">
                {selectedDesig
                  ? selectedDesig.designation_name
                  : selectedDept
                    ? selectedDept.department_name
                    : "Employees"}
              </span>
              {selectedDeptId && (
                <span className="text-slate-400">
                  ({filtered.length} of {scopedEmployees.length})
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email or employee ID..."
                  className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              {(search || statusFilter) && (
                <button
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("");
                  }}
                  className="text-sm text-orange-600 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-w-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50 sticky top-0">
                  <th className="px-4 py-2.5 font-medium">Employee</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Joined</th>
                  <th className="px-4 py-2.5 font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td colSpan={4} className="px-4 py-4">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : !selectedDeptId ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-12 text-center text-slate-400 text-sm"
                    >
                      Select a department, then a designation, to view
                      employees.
                    </td>
                  </tr>
                ) : pageItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-12 text-center text-slate-400 text-sm"
                    >
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((emp) => (
                    <tr
                      key={emp.id}
                      className="border-b border-slate-50 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            person={emp}
                            className="w-8 h-8 rounded-full text-xs"
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-slate-800 truncate">
                              {emp.full_name}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {emp.employee_id}
                              {!selectedDept &&
                                emp.departments?.department_name && (
                                  <> · {emp.departments.department_name}</>
                                )}
                              {!selectedDesig &&
                                emp.designations?.designation_name && (
                                  <> · {emp.designations.designation_name}</>
                                )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            STATUS_STYLES[emp.employment_status] ||
                            "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {emp.employment_status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                        {formatDate(emp.joining_date)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewing(emp)}
                            title="View"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() =>
                              setFormState({ mode: "edit", employee: emp })
                            }
                            title="Edit"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-orange-50 hover:text-orange-500"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteTarget(emp);
                            }}
                            title="Delete"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-orange-50 hover:text-orange-500"
                          >
                            <Trash2 size={14} />
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
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 text-xs text-slate-500 shrink-0">
              <span>
                Showing {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, filtered.length)} of{" "}
                {filtered.length}
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
      </div>

      {formState && (
        <EmployeeFormModal
          mode={formState.mode}
          employee={formState.employee}
          refData={refData}
          defaultRoleId={defaultRoleId}
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
