// import {
//   AlertTriangle,
//   ArrowRight,
//   KeyRound,
//   Loader2,
//   Search,
//   Shield,
//   ShieldCheck,
//   Users as UsersIcon,
// } from "lucide-react";
// import { useEffect, useMemo, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import Modal from "../../components/common/Modal";
// import PageHeader from "../../components/common/PageHeader";
// import StatCard from "../../components/common/StatCard";
// import {
//   TOTAL_PERMISSIONS_COUNT,
//   permissionsForRole,
// } from "../../config/Rolepermissionsreference ";
// import { apiClient } from "../../services/apiClient";

// // ---------------------------------------------------------------------
// // Read-only Roles view under Users > Roles.
// //
// // Scope is intentionally narrow: this page is about role IDENTITY (what
// // roles exist, who's in each one) — not about what each role can DO.
// // That's the Users > Permissions page's job (the role<->permission
// // wiring matrix), so this page doesn't duplicate a permission checklist
// // — it just shows a permission *count* per role and links out to
// // Permissions for the detail, to avoid two screens answering the same
// // question two different ways.
// //
// // Wired to the real backend for the roles list and per-role user counts:
// //   - GET /roles/ -> every row in the `roles` table (id, role_name,
// //     description, created_at). See app/roles/{routes,services}.py.
// //   - GET /employees/?role_id=<id> once per role, same technique
// //     Users.jsx already uses, to get a live "N users" count per role.
// //
// // The permission COUNT shown per role comes from
// // config/rolePermissionsReference.js, a reference copy of the seeded
// // role_permissions grants (there's no live endpoint for that data yet —
// // see that file's header comment). No create/edit here either: the
// // backend doesn't expose those actions for roles yet.
// // ---------------------------------------------------------------------

// const ROLE_BADGE_MAP = {
//   "SUPER ADMIN": "bg-violet-50 text-violet-600",
//   "HR ADMIN": "bg-blue-50 text-blue-600",
//   "HR EXECUTIVE": "bg-sky-50 text-sky-600",
//   MANAGER: "bg-emerald-50 text-emerald-600",
//   "OPERATIONS MANAGER": "bg-emerald-50 text-emerald-600",
//   "INSPECTION MANAGER": "bg-emerald-50 text-emerald-600",
//   "TEAM LEADER": "bg-teal-50 text-teal-600",
//   EMPLOYEE: "bg-slate-100 text-slate-600",
//   VIEWER: "bg-amber-50 text-amber-600",
// };
// const ROLE_BADGE_FALLBACK = [
//   "bg-orange-50 text-orange-600",
//   "bg-blue-50 text-blue-600",
//   "bg-emerald-50 text-emerald-600",
//   "bg-violet-50 text-violet-600",
// ];

// function roleBadgeStyle(roleName) {
//   if (!roleName) return "bg-slate-100 text-slate-500";
//   const key = roleName.trim().toUpperCase();
//   if (ROLE_BADGE_MAP[key]) return ROLE_BADGE_MAP[key];
//   let hash = 0;
//   for (let i = 0; i < key.length; i++)
//     hash = (hash + key.charCodeAt(i)) % ROLE_BADGE_FALLBACK.length;
//   return ROLE_BADGE_FALLBACK[hash];
// }

// function formatDate(value) {
//   if (!value) return "—";
//   const d = new Date(value);
//   if (Number.isNaN(d.getTime())) return "—";
//   return d.toLocaleDateString(undefined, {
//     year: "numeric",
//     month: "short",
//     day: "2-digit",
//   });
// }

// function isSuperAdmin(roleName) {
//   return (roleName || "").trim().toUpperCase() === "SUPER ADMIN";
// }

// // ==========================================================================
// // Role details modal — identity only (name, description, who's in it).
// // Permissions live on the dedicated Permissions page; this just links out.
// // ==========================================================================

// function RoleDetailsModal({ role, userCount, onClose, onViewPermissions }) {
//   if (!role) return null;
//   const superAdmin = isSuperAdmin(role.role_name);
//   const permCount = superAdmin
//     ? TOTAL_PERMISSIONS_COUNT
//     : permissionsForRole(role.role_name).length;

//   return (
//     <Modal
//       open={!!role}
//       onClose={onClose}
//       title={role.role_name}
//       subtitle={role.description || "No description provided."}
//       footer={
//         <>
//           <button
//             onClick={onClose}
//             className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
//           >
//             Close
//           </button>
//           <button
//             onClick={onViewPermissions}
//             className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
//           >
//             View permissions
//             <ArrowRight size={14} />
//           </button>
//         </>
//       }
//     >
//       <div className="grid grid-cols-2 gap-3">
//         <div className="rounded-lg border border-slate-100 p-3">
//           <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
//             <UsersIcon size={13} />
//             Users
//           </div>
//           <div className="text-lg font-semibold text-slate-800">
//             {userCount === null || userCount === undefined ? "—" : userCount}
//           </div>
//         </div>
//         <div className="rounded-lg border border-slate-100 p-3">
//           <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
//             <KeyRound size={13} />
//             Permissions
//           </div>
//           <div className="text-lg font-semibold text-slate-800">
//             {superAdmin ? "All" : permCount}
//           </div>
//         </div>
//       </div>

//       {superAdmin && (
//         <div className="mt-3 flex items-start gap-2 rounded-lg bg-violet-50 px-3 py-2.5 text-xs text-violet-700">
//           <ShieldCheck size={14} className="mt-0.5 shrink-0" />
//           <span>
//             Super Admin bypasses permission checks entirely and always has full
//             access, regardless of individual grants.
//           </span>
//         </div>
//       )}

//       <div className="mt-3 text-xs text-slate-400">
//         Added {formatDate(role.created_at)}
//       </div>
//     </Modal>
//   );
// }

// // ==========================================================================
// // Main page
// // ==========================================================================

// export default function UsersRoles() {
//   const navigate = useNavigate();
//   const [roles, setRoles] = useState([]);
//   const [userCounts, setUserCounts] = useState({}); // role_id -> count
//   const [loading, setLoading] = useState(true);
//   const [loadError, setLoadError] = useState(null);
//   const [search, setSearch] = useState("");
//   const [selectedRole, setSelectedRole] = useState(null);

//   useEffect(() => {
//     let cancelled = false;

//     async function load() {
//       setLoading(true);
//       setLoadError(null);
//       try {
//         const rolesRes = await apiClient.get("/roles/");
//         const rolesList = rolesRes.data || [];
//         if (cancelled) return;
//         setRoles(rolesList);

//         const counts = await Promise.all(
//           rolesList.map((role) =>
//             apiClient
//               .get(`/employees/?role_id=${role.id}`)
//               .then((res) => [role.id, (res.data || []).length])
//               .catch(() => [role.id, null]),
//           ),
//         );
//         if (cancelled) return;
//         setUserCounts(Object.fromEntries(counts));
//       } catch (err) {
//         if (!cancelled) setLoadError(err.message || "Could not load roles.");
//       } finally {
//         if (!cancelled) setLoading(false);
//       }
//     }

//     load();
//     return () => {
//       cancelled = true;
//     };
//   }, []);

//   const filtered = useMemo(() => {
//     const q = search.trim().toLowerCase();
//     if (!q) return roles;
//     return roles.filter(
//       (r) =>
//         r.role_name?.toLowerCase().includes(q) ||
//         r.description?.toLowerCase().includes(q),
//     );
//   }, [roles, search]);

//   const stats = useMemo(() => {
//     const totalUsers = Object.values(userCounts).reduce(
//       (sum, c) => sum + (c || 0),
//       0,
//     );
//     return { totalRoles: roles.length, totalUsers };
//   }, [roles, userCounts]);

//   function goToPermissions(role) {
//     // Roles page just points at the Permissions page for the detail —
//     // it's the one place role<->permission grants are actually shown
//     // and (once wired up) edited.
//     navigate("/super-admin/users/permissions", {
//       state: role ? { roleId: role.id, roleName: role.role_name } : undefined,
//     });
//   }

//   return (
//     <div>
//       <PageHeader
//         title="Roles"
//         subtitle="Every role in the system and who's assigned to it."
//       />

//       {loadError && (
//         <div className="mb-4 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
//           <AlertTriangle size={16} />
//           {loadError}
//         </div>
//       )}

//       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
//         <StatCard
//           icon={Shield}
//           label="Total Roles"
//           value={stats.totalRoles}
//           color="orange"
//           loading={loading}
//         />
//         <StatCard
//           icon={UsersIcon}
//           label="Users Assigned"
//           value={stats.totalUsers}
//           color="blue"
//           loading={loading}
//         />
//       </div>

//       <div className="relative mb-4 max-w-sm">
//         <Search
//           size={16}
//           className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
//         />
//         <input
//           value={search}
//           onChange={(e) => setSearch(e.target.value)}
//           placeholder="Search roles…"
//           className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
//         />
//       </div>

//       {loading ? (
//         <div className="flex items-center justify-center py-20 text-slate-400">
//           <Loader2 size={22} className="animate-spin" />
//         </div>
//       ) : filtered.length === 0 ? (
//         <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
//           No roles match your search.
//         </div>
//       ) : (
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//           {filtered.map((role) => {
//             const superAdmin = isSuperAdmin(role.role_name);
//             const permCount = superAdmin
//               ? TOTAL_PERMISSIONS_COUNT
//               : permissionsForRole(role.role_name).length;
//             const userCount = userCounts[role.id];

//             return (
//               <div
//                 key={role.id}
//                 className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3 hover:border-orange-200 hover:shadow-sm transition-shadow"
//               >
//                 <button
//                   onClick={() => setSelectedRole(role)}
//                   className="text-left flex flex-col gap-3"
//                 >
//                   <span
//                     className={`self-start inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${roleBadgeStyle(role.role_name)}`}
//                   >
//                     {superAdmin ? (
//                       <ShieldCheck size={12} />
//                     ) : (
//                       <Shield size={12} />
//                     )}
//                     {role.role_name}
//                   </span>

//                   <p className="text-sm text-slate-500 line-clamp-2 min-h-[2.5rem]">
//                     {role.description || "No description provided."}
//                   </p>

//                   <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
//                     <span className="flex items-center gap-1">
//                       <UsersIcon size={13} />
//                       {userCount === null || userCount === undefined
//                         ? "—"
//                         : `${userCount} ${userCount === 1 ? "user" : "users"}`}
//                     </span>
//                     <span className="flex items-center gap-1">
//                       <KeyRound size={13} />
//                       {superAdmin ? "Full access" : `${permCount} permissions`}
//                     </span>
//                   </div>
//                 </button>

//                 <button
//                   onClick={() => goToPermissions(role)}
//                   className="flex items-center justify-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 pt-1"
//                 >
//                   View permissions
//                   <ArrowRight size={12} />
//                 </button>
//               </div>
//             );
//           })}
//         </div>
//       )}

//       <RoleDetailsModal
//         role={selectedRole}
//         userCount={selectedRole ? (userCounts[selectedRole.id] ?? "—") : "—"}
//         onClose={() => setSelectedRole(null)}
//         onViewPermissions={() => goToPermissions(selectedRole)}
//       />
//     </div>
//   );
// }
