// Wraps app/permissions/routes.py (backend). SUPER ADMIN only — every
// call here 403s for any other role, matching require_role(["SUPER ADMIN"])
// on the backend.
//
//   GET    /permissions/matrix          -> { roles, permissions, grants }
//   GET    /permissions/                -> [ { id, permission_name, module } ]
//   POST   /permissions/grant           -> { role_id, permission_id }
//   DELETE /permissions/revoke/{r}/{p}
//   PUT    /permissions/roles/{role_id} -> { permission_ids: [...] }
//
// `grants` is a flat list of { role_id, permission_id } pairs — one per
// edge on the graph. SUPER ADMIN's edges are synthesized server-side
// (it implicitly holds every permission) so the graph can render it
// fully connected without real role_permissions rows.

import { apiClient } from "./apiClient";

export const permissionsService = {
  getMatrix: () => apiClient.get("/permissions/matrix"),

  getAllPermissions: () => apiClient.get("/permissions/"),

  grant: (roleId, permissionId) =>
    apiClient.post("/permissions/grant", {
      role_id: roleId,
      permission_id: permissionId,
    }),

  revoke: (roleId, permissionId) =>
    apiClient.delete(`/permissions/revoke/${roleId}/${permissionId}`),

  setRolePermissions: (roleId, permissionIds) =>
    apiClient.put(`/permissions/roles/${roleId}`, {
      permission_ids: permissionIds,
    }),
};
