import {
  AlertTriangle,
  Briefcase,
  ChevronDown,
  Loader2,
  Shield,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../../services/apiClient";
import { filterShiftsForSelection } from "../../utils/shiftMapping";

// ---------------------------------------------------------------------
// Shared "Add / Edit user" modal — originally lived only inside
// src/pages/super-admin/Users.jsx, pulled out here so the Super Admin
// dashboard's "Add New User" quick action can open the exact same form
// in a popup instead of navigating to the Users page. Behavior,
// validation, and the POST /employees/ (create) / PUT /employees/{id}
// (edit) calls are unchanged — see Users.jsx for the full backend
// contract notes.
//
// `refData` shape: { departments, designations, shifts, roles, users }.
// Callers own fetching these (Users.jsx already did; Dashboard.jsx now
// fetches its own copy on open) and pass `onSaved` to refresh their own
// list/state after a create or edit.
// ---------------------------------------------------------------------

export const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400";

export function Field({ label, required, error, children }) {
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

// ==========================================================================
// Reusable searchable-looking dropdown (fixed-height option list, always
// loads every option rather than a truncated subset).
// ==========================================================================

export function FilterDropdown({
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

// Previously, if no real email was ever set for this employee, the
// backend filled in a placeholder login email built from the employee
// code itself (e.g. "akr-ins-cw-0002@akrobat.com.sg"). That's been
// removed -- email is now required on create (see
// app/employees/schemas.py EmployeeCreate / create_employee() in
// app/employees/services.py), so the backend never appends the
// employee code into the email field.
//
// isSystemGeneratedEmail() is kept for older records that still carry
// one of those legacy code-based addresses from before this change --
// it's treated as blank when prefilling Edit so it isn't resubmitted
// as if it were real.
function isSystemGeneratedEmail(candidateUser) {
  if (!candidateUser?.email || !candidateUser?.employee_id) return false;
  const localPart = candidateUser.email.split("@")[0]?.toLowerCase();
  return localPart === candidateUser.employee_id.toLowerCase();
}

// Roles that should never appear in the "Reporting Manager" picker --
// only managerial/admin-type roles belong there (see managerCandidates
// below). Matches the role_name values seeded in sql/001_schema.sql.
const NON_MANAGER_ROLES = ["EMPLOYEE", "VIEWER"];

// ==========================================================================
// Add / Edit modal
// ==========================================================================

export default function UserFormModal({
  mode,
  user,
  refData,
  onClose,
  onSaved,
}) {
  const isEdit = mode === "edit";
  const { departments, designations, shifts, roles, users } = refData;

  // SUPER ADMIN is deliberately excluded from the *assignable* role
  // list on create -- it's not selectable here even for a Super Admin
  // caller. The one fixed Super Admin login (IT@akrobat.com.sg) is
  // bootstrapped exclusively via scripts/create_super_admin.py, run
  // from the backend terminal. `roles` itself (unfiltered) is still
  // used elsewhere in this app -- e.g. the Users list's filter-by-role
  // dropdown -- since existing Super Admin accounts still need to be
  // filterable/visible there. The backend also rejects
  // role_id=SUPER ADMIN on POST /employees/ regardless of this list, so
  // this is UX, not the actual guard.
  const assignableRoles = roles.filter(
    (r) => r.role_name?.trim().toUpperCase() !== "SUPER ADMIN",
  );

  const [form, setForm] = useState(() => ({
    full_name: user?.full_name || "",
    email: isSystemGeneratedEmail(user) ? "" : user?.email || "",
    phone: user?.phone || "",
    department_id: user?.department_id || "",
    designation_id: user?.designation_id || "",
    manager_id: user?.manager_id || "",
    shift_id: user?.shift_id || "",
    role_id: "",
    joining_date: user?.joining_date || "",
    employment_status: user?.employment_status || "Active",
    work_location: user?.work_location || "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Password and employee code are both auto-generated by the backend
  // (see app/employees/services.py create_employee) — never typed in by
  // HR. The code preview below just mirrors what the server will assign
  // so HR can see it before hitting Save; `credentials` holds the real
  // values returned once the account is actually created.
  const [codePreview, setCodePreview] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [credentials, setCredentials] = useState(null);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Re-fetch the employee-code preview every time department or
  // designation changes, so picking a department immediately shows the
  // code HR can expect (e.g. AKR-HR-0001, then AKR-HR-EXE-0001 once a
  // designation is also picked).
  useEffect(() => {
    if (isEdit) return;
    if (!form.department_id && !form.designation_id) {
      setCodePreview("");
      return;
    }
    let cancelled = false;
    setCodeLoading(true);
    const params = new URLSearchParams();
    if (form.department_id) params.set("department_id", form.department_id);
    if (form.designation_id) params.set("designation_id", form.designation_id);
    apiClient
      .get(`/employees/preview-code?${params.toString()}`)
      .then((res) => {
        if (!cancelled) setCodePreview(res?.data?.employee_id || "");
      })
      .catch(() => {
        if (!cancelled) setCodePreview("");
      })
      .finally(() => {
        if (!cancelled) setCodeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.department_id, form.designation_id, isEdit]);

  // Reporting Manager should only offer people who actually manage
  // others -- SUPER ADMIN / HR / MANAGER-type roles -- not regular
  // Employee or read-only Viewer accounts. `users` entries only carry
  // role_name when they came from a per-role fetch (see Users.jsx's
  // loadUsers() and the Dashboard "Create User" quick action) --
  // callers that don't tag it will just see an empty list here rather
  // than silently falling back to "everyone".
  const managerCandidates = useMemo(
    () =>
      users.filter(
        (u) =>
          u.id !== user?.id &&
          !NON_MANAGER_ROLES.includes((u.role_name || "").trim().toUpperCase()),
      ),
    [users, user?.id],
  );

  // Designations belong to exactly one department (designations.department_id),
  // so once a department is picked, only show designations under it.
  const filteredDesignations = useMemo(() => {
    if (!form.department_id) return designations;
    return designations.filter((d) => d.department_id === form.department_id);
  }, [designations, form.department_id]);

  // Each designation carries its own default "timing" (designations.default_shift_id,
  // joined back as `shifts` by GET /designations/) — that's the shift a new hire in
  // that designation should default to.
  const selectedDesignation = useMemo(
    () => designations.find((d) => d.id === form.designation_id),
    [designations, form.designation_id],
  );

  // Shifts aren't tagged with a department in the schema, but every
  // designation has exactly one fixed timing per department (see
  // src/utils/shiftMapping.js) — so the Shift dropdown is filtered down
  // to just that one option, e.g. picking INSPECTION only shows
  // Inspection Site's timing, not Office/Work Shop/Operation Site.
  const filteredShifts = useMemo(() => {
    const dept = departments.find((d) => d.id === form.department_id);
    return filterShiftsForSelection(
      shifts,
      dept?.department_name,
      selectedDesignation?.designation_name,
    );
  }, [shifts, departments, form.department_id, selectedDesignation]);

  // If the currently-picked designation no longer belongs to the newly-picked
  // department, clear it (and its shift) rather than leaving a stale mismatch.
  const didMountDept = useRef(false);
  useEffect(() => {
    if (!didMountDept.current) {
      didMountDept.current = true;
      return;
    }
    setForm((f) => {
      const stillValid =
        !f.designation_id ||
        designations.some(
          (d) =>
            d.id === f.designation_id && d.department_id === f.department_id,
        );
      return stillValid ? f : { ...f, designation_id: "", shift_id: "" };
    });
  }, [form.department_id, designations]);

  // Auto-fill the shift/timing from the designation's own default whenever the
  // designation changes (HR can still override it via the Shift dropdown).
  const didMountDesig = useRef(false);
  useEffect(() => {
    if (!didMountDesig.current) {
      didMountDesig.current = true;
      return;
    }
    if (selectedDesignation?.shifts?.id) {
      setForm((f) => ({ ...f, shift_id: selectedDesignation.shifts.id }));
    }
  }, [form.designation_id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.full_name.trim() || form.full_name.trim().length < 2) {
      setError("Full name must be at least 2 characters.");
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
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          department_id: orUndefined(form.department_id),
          designation_id: orUndefined(form.designation_id),
          manager_id: orUndefined(form.manager_id),
          shift_id: orUndefined(form.shift_id),
          joining_date: orUndefined(form.joining_date),
          employment_status: form.employment_status,
          work_location: form.work_location.trim() || undefined,
        };
        await apiClient.put(`/employees/${user.id}`, payload);
        onSaved();
      } else {
        // No `password` here — the backend generates it (and the
        // employee code) itself; both come back in the create response
        // for HR to share with the new hire (see credentials modal
        // below).
        const payload = {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
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
        const res = await apiClient.post("/employees/", payload);
        setCredentials({
          employee_id: res?.data?.login_employee_id,
          password: res?.data?.login_password,
        });
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Shown once, right after a successful create — the generated
  // employee code + password only ever come back in this one response
  // (see app/employees/services.py create_employee), so this is HR's
  // only chance to see/copy them before the list reloads.
  if (credentials) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800">User Created</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Share these login details with the new user securely — the
              password won't be shown again.
            </p>
          </div>
          <div className="px-6 py-5 space-y-3">
            <div>
              <span className="text-xs font-medium text-slate-600 mb-1 block">
                Employee Code
              </span>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                {credentials.employee_id}
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-600 mb-1 block">
                Password
              </span>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                {credentials.password}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
            <button
              onClick={onSaved}
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
              {isEdit ? "Edit User" : "Add New User"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit
                ? `Update details for ${user?.full_name}`
                : "Create a new account with any role"}
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
              Role & Access
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {!isEdit ? (
                <Field label="Role" required>
                  <FilterDropdown
                    fullWidth
                    showAllOption={false}
                    allLabel="Select role"
                    value={form.role_id}
                    onChange={(v) => set("role_id", v)}
                    options={assignableRoles}
                    getKey={(r) => r.id}
                    getLabel={(r) => r.role_name}
                  />
                </Field>
              ) : (
                <Field label="Role">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <Shield size={14} className="text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-600">
                      {user?.role_name || "—"}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 mt-1 block">
                    Role can only be set when the account is created.
                  </span>
                </Field>
              )}
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
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Department & Designation
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
                      : "Select department first"
                  }
                  value={form.designation_id}
                  onChange={(v) => set("designation_id", v)}
                  options={filteredDesignations}
                  getKey={(d) => d.id}
                  getLabel={(d) => d.designation_name}
                />
              </Field>
              {!isEdit && (form.department_id || form.designation_id) && (
                <Field label="Employee Code">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <Briefcase size={14} className="text-slate-400 shrink-0" />
                    <span className="text-sm font-medium text-slate-600">
                      {codeLoading ? "Generating…" : codePreview || "—"}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 mt-1 block">
                    Auto-generated from the department and designation.
                  </span>
                </Field>
              )}
            </div>
          </div>

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
                  placeholder="Optional"
                />
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
                <Field label="Password">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-sm text-slate-400">
                      Auto-generated on save
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 mt-1 block">
                    A secure password is generated automatically and shown once
                    the account is created.
                  </span>
                </Field>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Work Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Reporting Manager">
                <FilterDropdown
                  fullWidth
                  allLabel="None"
                  value={form.manager_id}
                  onChange={(v) => set("manager_id", v)}
                  options={managerCandidates}
                  getKey={(u) => u.id}
                  getLabel={(u) => `${u.full_name} (${u.employee_id})`}
                />
              </Field>
              <Field label="Shift">
                <FilterDropdown
                  fullWidth
                  allLabel={
                    form.department_id
                      ? "Select shift"
                      : "Select department first"
                  }
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
            {isEdit ? "Save Changes" : "Create User"}
          </button>
        </div>
      </div>
    </div>
  );
}
