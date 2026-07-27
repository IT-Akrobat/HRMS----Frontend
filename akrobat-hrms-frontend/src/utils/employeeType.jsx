// ---------------------------------------------------------------------
// Mirrors the backend's get_field_employee_ids() / is_field_employee()
// (app/core/helpers/employee_helper.py): anyone whose department name
// starts with INSPECTION or OPERATION visits multiple sites in a day and
// gets the "field staff" dashboard treatment (live site tracking) instead
// of the plain office check-in/out view.
//
// GET /auth/me already returns `department: { id, department_name }` on
// the user object (see app/auth/services.py -> get_me()), so this is a
// same-request, no-extra-fetch check — just read what's already in
// AuthContext's `user`.
// ---------------------------------------------------------------------

export function isFieldEmployee(user) {
  const departmentName = user?.department?.department_name || "";
  return /^(INSPECTION|OPERATION)/i.test(departmentName.trim());
}
