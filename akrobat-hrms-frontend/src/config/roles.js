// /**
//  * Normalize whatever `role_name` the backend returns into one of this
//  * frontend's ROLES values. Unknown/future roles (VIEWER, VENDOR, a
//  * custom role created through the admin screen, etc.) fall back to
//  * EMPLOYEE so the app still renders something sane instead of crashing —
//  * add a real mapping above as soon as that role gets its own frontend area.
//  */
// export function normalizeRole(backendRoleName) {
//   if (!backendRoleName) return ROLES.EMPLOYEE;
//   return BACKEND_ROLE_MAP[backendRoleName.toUpperCase()] || ROLES.EMPLOYEE;
// }
// Central place to define every role in the system.
// Add a new role here, then add its nav config + routes, and it flows through the whole app.
export const ROLES = {
  EMPLOYEE: "employee",
  MANAGER: "manager",
  HR_ADMIN: "hr_admin",
  SUPER_ADMIN: "super_admin",
};

// Fallback / default landing route per role after login
export const DEFAULT_ROUTE_BY_ROLE = {
  [ROLES.EMPLOYEE]: "/employee/dashboard",
  [ROLES.MANAGER]: "/manager/dashboard",
  // HR lands on the chooser page (My Profile / Company) after login.
  [ROLES.HR_ADMIN]: "/hr-admin/home",
  [ROLES.SUPER_ADMIN]: "/super-admin/dashboard",
};

// Base path each role's routes are nested under in App.jsx (e.g.
// employeeRoutes/managerRoutes/etc. are all mounted under one of these).
// Anything that needs to link *into* a role's area — like the header's
// "My Profile" button — should build its target path off this instead of
// hardcoding a leading "/", since an absolute path like "/profile/personal"
// won't match the nested <Route path="profile/personal"> under "/employee".
export const ROLE_BASE_PATH = {
  [ROLES.EMPLOYEE]: "/employee",
  [ROLES.MANAGER]: "/manager",
  [ROLES.HR_ADMIN]: "/hr-admin",
  [ROLES.SUPER_ADMIN]: "/super-admin",
};

// HR has two workspaces under /hr-admin:
//   My Space -> /hr-admin/me/*   (own dashboard, attendance, leave... like an employee)
//   Company  -> /hr-admin/*      (employees, reports, audit logs... HR tools)
// The active workspace is derived from the URL, so it survives refresh and
// the browser back button without any extra state.
export const HR_SELF_BASE = "/hr-admin/me";
export const HR_COMPANY_HOME = "/hr-admin/dashboard";
export const HR_HOME = "/hr-admin/home"; // post-login chooser: My Profile / Company

export function isHrSelfPath(pathname = "") {
  return pathname === HR_SELF_BASE || pathname.startsWith(HR_SELF_BASE + "/");
}

// Managers get the same two workspaces as HR:
//   My Space -> /manager/me/*   (own dashboard, attendance, leave... like an employee)
//   Company  -> /manager/*      (team members, team attendance, leave approvals...)
export const MANAGER_SELF_BASE = "/manager/me";
export const MANAGER_COMPANY_HOME = "/manager/dashboard";

// Roles that have the My Space / Company switch in the sidebar, with the
// base path of their My Space and where "Company" takes them.
export const SELF_SPACE_BY_ROLE = {
  [ROLES.HR_ADMIN]: { base: HR_SELF_BASE, companyHome: HR_COMPANY_HOME },
  [ROLES.MANAGER]: {
    base: MANAGER_SELF_BASE,
    companyHome: MANAGER_COMPANY_HOME,
  },
};

// True when `pathname` is inside this role's My Space (HR or Manager).
export function isSelfSpacePath(role, pathname = "") {
  const base = SELF_SPACE_BY_ROLE[role]?.base;
  if (!base) return false;
  return pathname === base || pathname.startsWith(base + "/");
}

// Human readable labels (e.g. for header "Role" chip)
export const ROLE_LABELS = {
  [ROLES.EMPLOYEE]: "Employee",
  [ROLES.MANAGER]: "Manager",
  [ROLES.HR_ADMIN]: "HR",
  [ROLES.SUPER_ADMIN]: "Super Admin",
};

// The backend's `roles.role_name` values (see sql/001_schema.sql /
// 010_auth_me_sidebar.sql) are things like 'HR ADMIN', 'MANAGER',
// 'OPERATIONS MANAGER', 'SUPER ADMIN', 'EMPLOYEE' — not the same
// strings this frontend uses internally. Rather than hardcoding a
// per-role switch anywhere else in the app, every place that needs a
// role does it through this single normalizer.
const BACKEND_ROLE_MAP = {
  EMPLOYEE: ROLES.EMPLOYEE,
  MANAGER: ROLES.MANAGER,
  "OPERATIONS MANAGER": ROLES.MANAGER,
  "INSPECTION MANAGER": ROLES.MANAGER,
  // HR ADMIN + HR EXECUTIVE were consolidated into a single "HR" role
  // in sql/017_consolidate_hr_role.sql, matching what the backend's
  // require_role([...]) guards already expected everywhere. The old
  // names are kept here too so this doesn't break against a database
  // that hasn't run that migration yet.
  HR: ROLES.HR_ADMIN,
  "HR ADMIN": ROLES.HR_ADMIN,
  "HR EXECUTIVE": ROLES.HR_ADMIN,
  "SUPER ADMIN": ROLES.SUPER_ADMIN,
  "TEAM LEADER": ROLES.MANAGER, // reuses the Manager area until TL gets its own frontend section
};

/**
 * Normalize whatever `role_name` the backend returns into one of this
 * frontend's ROLES values. Unknown/future roles (VIEWER, VENDOR, a
 * custom role created through the admin screen, etc.) fall back to
 * EMPLOYEE so the app still renders something sane instead of crashing —
 * add a real mapping above as soon as that role gets its own frontend area.
 */
export function normalizeRole(backendRoleName) {
  if (!backendRoleName) return ROLES.EMPLOYEE;
  return BACKEND_ROLE_MAP[backendRoleName.toUpperCase()] || ROLES.EMPLOYEE;
}
