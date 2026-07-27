// ---------------------------------------------------------------------
// Reference copy of the permission model enforced by the backend's RBAC
// layer (see backend/app/core/rbac.py + sql/002_role_permissions_seed.sql
// through sql/015.sql). There is currently no endpoint that returns
// role_permissions rows (GET /roles/ only returns id/role_name/
// description/created_at — see app/roles/services.py), so the Roles page
// mirrors that seeded configuration here for *display* purposes.
//
// This is intentionally read-only: if a migration changes what a role
// can do, this file needs a matching edit until a real
// GET /roles/{id}/permissions endpoint exists to fetch it live.
//
// SUPER ADMIN is not listed per-permission below because the backend
// grants it every permission unconditionally, regardless of
// role_permissions rows (rbac.py: `if role_name == ADMIN: return user`).
// ---------------------------------------------------------------------

// Every permission in the system, grouped by module (module names match
// the `module` column on the `permissions` table).
export const PERMISSION_MODULES = [
  {
    module: "EMPLOYEE",
    label: "Employees",
    permissions: [
      { name: "CREATE_EMPLOYEE", label: "Create employees" },
      { name: "VIEW_EMPLOYEE", label: "View employees" },
      { name: "EDIT_EMPLOYEE", label: "Edit employees" },
      { name: "DELETE_EMPLOYEE", label: "Delete employees" },
    ],
  },
  {
    module: "ATTENDANCE",
    label: "Attendance",
    permissions: [
      { name: "VIEW_ATTENDANCE", label: "View attendance" },
      { name: "EDIT_ATTENDANCE", label: "Edit attendance" },
      { name: "VIEW_ALL_ATTENDANCE", label: "View company-wide attendance" },
      {
        name: "APPROVE_ATTENDANCE_CORRECTION",
        label: "Approve attendance corrections",
      },
      { name: "MANAGE_SITE_ASSIGNMENTS", label: "Manage site assignments" },
      { name: "VIEW_SITE_ASSIGNMENTS", label: "View site assignments" },
    ],
  },
  {
    module: "LEAVE",
    label: "Leave",
    permissions: [
      { name: "VIEW_LEAVE_REQUESTS", label: "View leave requests" },
      {
        name: "APPROVE_LEAVE",
        label: "Approve / reject leave",
        note: "Super Admin only — restricted company-wide by sql/012_restrict_leave_approval_to_super_admin.sql",
      },
    ],
  },
  {
    module: "OVERTIME",
    label: "Overtime",
    permissions: [{ name: "APPROVE_OVERTIME", label: "Approve overtime" }],
  },
  {
    module: "REPORTS",
    label: "Reports",
    permissions: [{ name: "VIEW_REPORTS", label: "View reports" }],
  },
  {
    module: "SETTINGS",
    label: "Settings",
    permissions: [{ name: "MANAGE_SETTINGS", label: "Manage system settings" }],
  },
  {
    module: "PAYROLL",
    label: "Payroll",
    permissions: [
      { name: "CREATE_PAYROLL", label: "Create payroll" },
      { name: "VIEW_PAYROLL", label: "View payroll" },
      { name: "EDIT_PAYROLL", label: "Edit payroll" },
      { name: "DELETE_PAYROLL", label: "Delete payroll" },
    ],
  },
  {
    module: "DOCUMENTS",
    label: "Documents",
    permissions: [
      { name: "CREATE_DOCUMENT", label: "Upload documents" },
      { name: "VIEW_DOCUMENTS", label: "View documents" },
      { name: "EDIT_DOCUMENT", label: "Edit documents" },
      { name: "DELETE_DOCUMENT", label: "Delete documents" },
    ],
  },
  {
    module: "AUDIT_LOGS",
    label: "Audit Logs",
    permissions: [
      { name: "VIEW_AUDIT_LOGS", label: "View audit logs" },
      {
        name: "MANAGE_AUDIT_LOGS",
        label: "Manage audit logs",
        note: "Not granted to any role yet — Super Admin only",
      },
    ],
  },
];

export const TOTAL_PERMISSIONS_COUNT = PERMISSION_MODULES.reduce(
  (sum, m) => sum + m.permissions.length,
  0,
);

// role_name (as stored in the `roles` table) -> granted permission names,
// current as of the latest migration (sql/016.sql). Empty/omitted roles
// fall back to no explicit grants.
export const ROLE_PERMISSIONS_MAP = {
  "HR ADMIN": [
    "CREATE_EMPLOYEE",
    "VIEW_EMPLOYEE",
    "EDIT_EMPLOYEE",
    "DELETE_EMPLOYEE",
    "VIEW_ATTENDANCE",
    "EDIT_ATTENDANCE",
    "VIEW_ALL_ATTENDANCE",
    "APPROVE_ATTENDANCE_CORRECTION",
    "MANAGE_SITE_ASSIGNMENTS",
    "VIEW_SITE_ASSIGNMENTS",
    "VIEW_LEAVE_REQUESTS",
    "APPROVE_OVERTIME",
    "VIEW_REPORTS",
    "MANAGE_SETTINGS",
    "CREATE_PAYROLL",
    "VIEW_PAYROLL",
    "EDIT_PAYROLL",
    "DELETE_PAYROLL",
    "CREATE_DOCUMENT",
    "VIEW_DOCUMENTS",
    "EDIT_DOCUMENT",
    "DELETE_DOCUMENT",
    "VIEW_AUDIT_LOGS",
  ],
  "HR EXECUTIVE": [
    "CREATE_EMPLOYEE",
    "VIEW_EMPLOYEE",
    "EDIT_EMPLOYEE",
    "VIEW_ATTENDANCE",
    "EDIT_ATTENDANCE",
    "VIEW_ALL_ATTENDANCE",
    "MANAGE_SITE_ASSIGNMENTS",
    "VIEW_SITE_ASSIGNMENTS",
    "VIEW_LEAVE_REQUESTS",
    "VIEW_REPORTS",
    "CREATE_DOCUMENT",
    "VIEW_DOCUMENTS",
    "EDIT_DOCUMENT",
  ],
  MANAGER: [
    "VIEW_EMPLOYEE",
    "VIEW_ATTENDANCE",
    "APPROVE_ATTENDANCE_CORRECTION",
    "MANAGE_SITE_ASSIGNMENTS",
    "VIEW_SITE_ASSIGNMENTS",
    "VIEW_LEAVE_REQUESTS",
    "APPROVE_OVERTIME",
    "VIEW_REPORTS",
  ],
  "OPERATIONS MANAGER": [
    "VIEW_EMPLOYEE",
    "VIEW_ATTENDANCE",
    "APPROVE_ATTENDANCE_CORRECTION",
    "MANAGE_SITE_ASSIGNMENTS",
    "VIEW_SITE_ASSIGNMENTS",
    "VIEW_LEAVE_REQUESTS",
    "APPROVE_OVERTIME",
    "VIEW_REPORTS",
  ],
  "INSPECTION MANAGER": ["VIEW_EMPLOYEE", "VIEW_ATTENDANCE", "VIEW_REPORTS"],
  "TEAM LEADER": [
    "VIEW_EMPLOYEE",
    "VIEW_ATTENDANCE",
    "APPROVE_ATTENDANCE_CORRECTION",
  ],
  EMPLOYEE: ["VIEW_ATTENDANCE"],
  VIEWER: ["VIEW_EMPLOYEE", "VIEW_ATTENDANCE", "VIEW_REPORTS"],
};

/**
 * Returns the set of permission names granted to a role. SUPER ADMIN is
 * special-cased to hold every permission, matching
 * rbac.get_permissions_for_role on the backend.
 */
export function permissionsForRole(roleName) {
  if (!roleName) return [];
  const key = roleName.trim().toUpperCase();
  if (key === "SUPER ADMIN") {
    return PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => p.name));
  }
  return ROLE_PERMISSIONS_MAP[key] || [];
}
