// import {
//   AlertTriangle,
//   Briefcase,
//   Building2,
//   Calendar,
//   Eye,
//   Loader2,
//   Mail,
//   MapPin,
//   Pencil,
//   Phone,
//   Plus,
//   Search,
//   Trash2,
//   UserCheck,
//   Users,
//   UserX,
//   X,
// } from "lucide-react";
// import { useEffect, useMemo, useState } from "react";
// import PageHeader from "../../components/common/PageHeader";
// import StatCard from "../../components/common/StatCard";
// import { apiClient } from "../../services/apiClient";
// import { filterShiftsForSelection } from "../../utils/shiftMapping";

// // ---------------------------------------------------------------------
// // Scoped view of the Employees module: same backend, filtered down to
// // only accounts holding the HR ADMIN role.
// //
// // Wired to the real backend: GET/POST/PUT/DELETE /employees, plus
// // /departments, /designations, /shifts, /roles for the dropdowns. See
// // app/employees/{routes,services,schemas}.py for the contract this
// // mirrors — in particular:
// //   - GET /employees/?role_id=<id> filters server-side via the
// //     user_profiles table, so we first resolve the HR ADMIN role's id
// //     from GET /roles/ and then request only that slice.
// //   - EmployeeCreate requires full_name/email/password/role_id, and the
// //     backend only accepts emails on the company domain
// //     (see ALLOWED_DOMAIN in app/core/helpers/employee_helper.py). Here
// //     role_id is fixed to HR ADMIN, so the form has no role selector.
// //   - EmployeeUpdate has no role_id field (extra="forbid" on the model),
// //     so the edit form intentionally has no role selector either.
// //   - Only SUPER ADMIN / HR ADMIN may create employees; VIEW/EDIT/DELETE
// //     are permission-gated but Super Admin holds all of them.
// // ---------------------------------------------------------------------

// const STATUS_STYLES = {
//   Active: "bg-blue-50 text-blue-600",
//   Inactive: "bg-slate-100 text-slate-500",
// };

// function initials(name) {
//   if (!name) return "?";
//   const parts = name.trim().split(/\s+/);
//   return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
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

// const AVATAR_COLORS = [
//   "bg-orange-100 text-orange-600",
//   "bg-blue-100 text-blue-600",
//   "bg-blue-100 text-blue-600",
//   "bg-blue-100 text-blue-600",
//   "bg-orange-100 text-orange-600",
//   "bg-blue-100 text-blue-600",
// ];

// function avatarColor(seed) {
//   if (!seed) return AVATAR_COLORS[0];
//   let hash = 0;
//   for (let i = 0; i < seed.length; i++)
//     hash = (hash + seed.charCodeAt(i)) % AVATAR_COLORS.length;
//   return AVATAR_COLORS[hash];
// }

// function Avatar({ person, className }) {
//   return person?.profile_photo ? (
//     <img
//       src={person.profile_photo}
//       alt={person.full_name}
//       className={`${className} object-cover shrink-0`}
//     />
//   ) : (
//     <div
//       className={`${className} flex items-center justify-center font-semibold shrink-0 ${avatarColor(person?.full_name)}`}
//     >
//       {initials(person?.full_name)}
//     </div>
//   );
// }

// function Field({ label, required, error, children }) {
//   return (
//     <label className="block">
//       <span className="text-xs font-medium text-slate-600 mb-1 block">
//         {label} {required && <span className="text-orange-500">*</span>}
//       </span>
//       {children}
//       {error && (
//         <span className="text-xs text-orange-500 mt-1 block">{error}</span>
//       )}
//     </label>
//   );
// }

// const inputCls =
//   "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400";

// // ==========================================================================
// // Add / Edit modal
// // ==========================================================================

// function EmployeeFormModal({
//   mode,
//   employee,
//   refData,
//   hrAdminRoleId,
//   onClose,
//   onSaved,
// }) {
//   const isEdit = mode === "edit";
//   const { departments, designations, shifts, employees } = refData;

//   const [form, setForm] = useState(() => ({
//     full_name: employee?.full_name || "",
//     email: employee?.email || "",
//     password: "",
//     phone: employee?.phone || "",
//     department_id: employee?.department_id || "",
//     designation_id: employee?.designation_id || "",
//     manager_id: employee?.manager_id || "",
//     shift_id: employee?.shift_id || "",
//     joining_date: employee?.joining_date || "",
//     employment_status: employee?.employment_status || "Active",
//     work_location: employee?.work_location || "",
//   }));
//   const [saving, setSaving] = useState(false);
//   const [error, setError] = useState(null);

//   function set(key, value) {
//     setForm((f) => {
//       const next = { ...f, [key]: value };
//       if (key === "department_id") {
//         const stillValid = designations.some(
//           (d) => d.id === next.designation_id && d.department_id === value,
//         );
//         if (!stillValid) {
//           next.designation_id = "";
//           next.shift_id = "";
//         }
//       }
//       // Every designation has exactly one fixed timing (see
//       // src/utils/shiftMapping.js) — auto-fill it the moment a
//       // designation is picked; HR can still override it below.
//       if (key === "designation_id") {
//         const picked = designations.find((d) => d.id === value);
//         if (picked?.shifts?.id) next.shift_id = picked.shifts.id;
//       }
//       return next;
//     });
//   }

//   // Scope the Designation dropdown to whichever department is currently
//   // selected, same fix as the main Employees page — previously this
//   // listed every designation company-wide regardless of department.
//   const designationOptions = form.department_id
//     ? designations.filter((d) => d.department_id === form.department_id)
//     : designations;

//   // Shifts aren't tagged with a department in the schema, but every
//   // designation has exactly one fixed timing per department — so the
//   // Shift dropdown is filtered down to just that one option.
//   const selectedDepartment = departments.find(
//     (d) => d.id === form.department_id,
//   );
//   const selectedDesignation = designations.find(
//     (d) => d.id === form.designation_id,
//   );
//   const filteredShifts = filterShiftsForSelection(
//     shifts,
//     selectedDepartment?.department_name,
//     selectedDesignation?.designation_name,
//   );

//   async function handleSubmit(e) {
//     e.preventDefault();
//     setError(null);

//     if (!form.full_name.trim() || form.full_name.trim().length < 2) {
//       setError("Full name must be at least 2 characters.");
//       return;
//     }
//     if (!form.email.trim()) {
//       setError("Email is required.");
//       return;
//     }
//     if (!isEdit && form.password.length < 8) {
//       setError("Password must be at least 8 characters.");
//       return;
//     }
//     if (!isEdit && !hrAdminRoleId) {
//       setError(
//         "Could not find the HR ADMIN role. Please refresh and try again.",
//       );
//       return;
//     }

//     const orUndefined = (v) => (v ? v : undefined);

//     setSaving(true);
//     try {
//       if (isEdit) {
//         const payload = {
//           full_name: form.full_name.trim(),
//           email: form.email.trim(),
//           phone: form.phone.trim() || undefined,
//           department_id: orUndefined(form.department_id),
//           designation_id: orUndefined(form.designation_id),
//           manager_id: orUndefined(form.manager_id),
//           shift_id: orUndefined(form.shift_id),
//           joining_date: orUndefined(form.joining_date),
//           employment_status: form.employment_status,
//           work_location: form.work_location.trim() || undefined,
//         };
//         await apiClient.put(`/employees/${employee.id}`, payload);
//       } else {
//         const payload = {
//           full_name: form.full_name.trim(),
//           email: form.email.trim(),
//           password: form.password,
//           phone: form.phone.trim() || undefined,
//           department_id: orUndefined(form.department_id),
//           designation_id: orUndefined(form.designation_id),
//           manager_id: orUndefined(form.manager_id),
//           shift_id: orUndefined(form.shift_id),
//           role_id: hrAdminRoleId,
//           joining_date: orUndefined(form.joining_date),
//           employment_status: form.employment_status,
//           work_location: form.work_location.trim() || undefined,
//         };
//         await apiClient.post("/employees/", payload);
//       }
//       onSaved();
//     } catch (err) {
//       setError(err.message || "Something went wrong. Please try again.");
//     } finally {
//       setSaving(false);
//     }
//   }

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
//       <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
//         <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
//           <div>
//             <h2 className="text-lg font-bold text-slate-800">
//               {isEdit ? "Edit HR Admin" : "Add New HR Admin"}
//             </h2>
//             <p className="text-xs text-slate-500 mt-0.5">
//               {isEdit
//                 ? `Update details for ${employee?.full_name}`
//                 : "Create a new HR Admin record and account"}
//             </p>
//           </div>
//           <button
//             onClick={onClose}
//             className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
//           >
//             <X size={18} />
//           </button>
//         </div>

//         <form
//           onSubmit={handleSubmit}
//           className="overflow-y-auto px-6 py-5 space-y-6"
//         >
//           {error && (
//             <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-100 text-orange-600 text-sm px-3 py-2">
//               <AlertTriangle size={16} className="mt-0.5 shrink-0" />
//               <span>{error}</span>
//             </div>
//           )}

//           <div>
//             <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
//               Basic Information
//             </h3>
//             <div className="grid grid-cols-2 gap-4">
//               <Field label="Full Name" required>
//                 <input
//                   className={inputCls}
//                   value={form.full_name}
//                   onChange={(e) => set("full_name", e.target.value)}
//                   placeholder="John Doe"
//                 />
//               </Field>
//               <Field label="Email Address" required>
//                 <input
//                   type="email"
//                   className={inputCls}
//                   value={form.email}
//                   onChange={(e) => set("email", e.target.value)}
//                   placeholder="john.doe@akrobat.com.sg"
//                 />
//               </Field>
//               <Field label="Phone Number">
//                 <input
//                   className={inputCls}
//                   value={form.phone}
//                   onChange={(e) => set("phone", e.target.value)}
//                   placeholder="+65 9123 4567"
//                 />
//               </Field>
//               {!isEdit && (
//                 <Field label="Password" required>
//                   <input
//                     type="password"
//                     className={inputCls}
//                     value={form.password}
//                     onChange={(e) => set("password", e.target.value)}
//                     placeholder="Minimum 8 characters"
//                   />
//                 </Field>
//               )}
//             </div>
//           </div>

//           <div>
//             <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
//               Work Details
//             </h3>
//             <div className="grid grid-cols-2 gap-4">
//               <Field label="Department">
//                 <select
//                   className={inputCls}
//                   value={form.department_id}
//                   onChange={(e) => set("department_id", e.target.value)}
//                 >
//                   <option value="">Select department</option>
//                   {departments.map((d) => (
//                     <option key={d.id} value={d.id}>
//                       {d.department_name}
//                     </option>
//                   ))}
//                 </select>
//               </Field>
//               <Field label="Designation">
//                 <select
//                   className={inputCls}
//                   value={form.designation_id}
//                   onChange={(e) => set("designation_id", e.target.value)}
//                 >
//                   <option value="">
//                     {form.department_id
//                       ? "Select designation"
//                       : "Select a department first"}
//                   </option>
//                   {designationOptions.map((d) => (
//                     <option key={d.id} value={d.id}>
//                       {d.designation_name}
//                     </option>
//                   ))}
//                 </select>
//               </Field>
//               <Field label="Reporting Manager">
//                 <select
//                   className={inputCls}
//                   value={form.manager_id}
//                   onChange={(e) => set("manager_id", e.target.value)}
//                 >
//                   <option value="">None</option>
//                   {employees
//                     .filter((e) => e.id !== employee?.id)
//                     .map((e) => (
//                       <option key={e.id} value={e.id}>
//                         {e.full_name} ({e.employee_id})
//                       </option>
//                     ))}
//                 </select>
//               </Field>
//               <Field label="Shift">
//                 <select
//                   className={inputCls}
//                   value={form.shift_id}
//                   onChange={(e) => set("shift_id", e.target.value)}
//                 >
//                   <option value="">Select shift</option>
//                   {filteredShifts.map((s) => (
//                     <option key={s.id} value={s.id}>
//                       {s.shift_name}
//                     </option>
//                   ))}
//                 </select>
//                 {selectedDesignation?.shifts && (
//                   <span className="text-xs text-slate-400 mt-1 block">
//                     Auto-set to {selectedDesignation.shifts.shift_name}'s timing
//                     for this designation.
//                   </span>
//                 )}
//               </Field>
//               <Field label="Joining Date">
//                 <input
//                   type="date"
//                   className={inputCls}
//                   value={form.joining_date || ""}
//                   onChange={(e) => set("joining_date", e.target.value)}
//                 />
//               </Field>
//               <Field label="Work Location">
//                 <input
//                   className={inputCls}
//                   value={form.work_location}
//                   onChange={(e) => set("work_location", e.target.value)}
//                   placeholder="Singapore Office"
//                 />
//               </Field>
//               <Field label="Employment Status">
//                 <select
//                   className={inputCls}
//                   value={form.employment_status}
//                   onChange={(e) => set("employment_status", e.target.value)}
//                 >
//                   <option value="Active">Active</option>
//                   <option value="Inactive">Inactive</option>
//                 </select>
//               </Field>
//             </div>
//             {!isEdit && (
//               <p className="text-xs text-slate-400 mt-3">
//                 Role is fixed to <span className="font-medium">HR ADMIN</span>{" "}
//                 for accounts created from this page.
//               </p>
//             )}
//           </div>
//         </form>

//         <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
//           <button
//             onClick={onClose}
//             className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
//           >
//             Cancel
//           </button>
//           <button
//             onClick={handleSubmit}
//             disabled={saving}
//             className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 flex items-center gap-2"
//           >
//             {saving && <Loader2 size={14} className="animate-spin" />}
//             {isEdit ? "Save Changes" : "Create Employee"}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ==========================================================================
// // View drawer
// // ==========================================================================

// function EmployeeViewModal({ employee, onClose, onEdit }) {
//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
//       <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl">
//         <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
//           <div className="flex items-center gap-3">
//             <Avatar person={employee} className="w-12 h-12 rounded-full" />
//             <div>
//               <h2 className="text-base font-bold text-slate-800">
//                 {employee.full_name}
//               </h2>
//               <p className="text-xs text-slate-500">{employee.employee_id}</p>
//             </div>
//           </div>
//           <button
//             onClick={onClose}
//             className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
//           >
//             <X size={18} />
//           </button>
//         </div>

//         <div className="px-6 py-5 space-y-3 text-sm">
//           <span
//             className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
//               STATUS_STYLES[employee.employment_status] ||
//               "bg-slate-100 text-slate-500"
//             }`}
//           >
//             {employee.employment_status}
//           </span>

//           <div className="grid grid-cols-2 gap-3 pt-2">
//             <div className="flex items-center gap-2 text-slate-600">
//               <Mail size={14} className="text-slate-400" />
//               <span className="truncate">{employee.email || "—"}</span>
//             </div>
//             <div className="flex items-center gap-2 text-slate-600">
//               <Phone size={14} className="text-slate-400" />
//               <span>{employee.phone || "—"}</span>
//             </div>
//             <div className="flex items-center gap-2 text-slate-600">
//               <Building2 size={14} className="text-slate-400" />
//               <span>{employee.departments?.department_name || "—"}</span>
//             </div>
//             <div className="flex items-center gap-2 text-slate-600">
//               <Briefcase size={14} className="text-slate-400" />
//               <span>{employee.designations?.designation_name || "—"}</span>
//             </div>
//             <div className="flex items-center gap-2 text-slate-600">
//               <MapPin size={14} className="text-slate-400" />
//               <span>{employee.work_location || "—"}</span>
//             </div>
//             <div className="flex items-center gap-2 text-slate-600">
//               <Calendar size={14} className="text-slate-400" />
//               <span>Joined {formatDate(employee.joining_date)}</span>
//             </div>
//           </div>
//         </div>

//         <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
//           <button
//             onClick={onClose}
//             className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
//           >
//             Close
//           </button>
//           <button
//             onClick={onEdit}
//             className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 flex items-center gap-2"
//           >
//             <Pencil size={14} />
//             Edit
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ==========================================================================
// // Delete confirm
// // ==========================================================================

// function DeleteConfirmModal({ employee, onClose, onConfirm, deleting, error }) {
//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
//       <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
//         <div className="w-11 h-11 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mb-4">
//           <Trash2 size={18} />
//         </div>
//         <h2 className="text-base font-bold text-slate-800 mb-1">
//           Remove HR Admin?
//         </h2>
//         <p className="text-sm text-slate-500 mb-4">
//           This will permanently delete{" "}
//           <span className="font-medium text-slate-700">
//             {employee.full_name}
//           </span>{" "}
//           and revoke their HR Admin login access. This action cannot be undone.
//         </p>
//         {error && (
//           <div className="text-xs text-orange-500 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 mb-4">
//             {error}
//           </div>
//         )}
//         <div className="flex items-center justify-end gap-2">
//           <button
//             onClick={onClose}
//             className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
//           >
//             Cancel
//           </button>
//           <button
//             onClick={onConfirm}
//             disabled={deleting}
//             className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 flex items-center gap-2"
//           >
//             {deleting && <Loader2 size={14} className="animate-spin" />}
//             Delete
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ==========================================================================
// // Main page
// // ==========================================================================

// export default function EmployeesHrAdmins() {
//   const [employees, setEmployees] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [loadError, setLoadError] = useState(null);

//   const [departments, setDepartments] = useState([]);
//   const [designations, setDesignations] = useState([]);
//   const [shifts, setShifts] = useState([]);

//   // Roles aren't shown as a picker here (this page only ever deals with
//   // the HR ADMIN role), but we still need the role's id to scope the
//   // GET /employees/?role_id= call and to stamp onto new accounts.
//   const [hrAdminRoleId, setHrAdminRoleId] = useState(null);
//   const [roleLoading, setRoleLoading] = useState(true);
//   const [roleError, setRoleError] = useState(null);

//   const [search, setSearch] = useState("");
//   const [deptFilter, setDeptFilter] = useState("");
//   const [statusFilter, setStatusFilter] = useState("");
//   const [page, setPage] = useState(1);
//   const pageSize = 10;

//   const [formState, setFormState] = useState(null); // { mode: 'add'|'edit', employee }
//   const [viewing, setViewing] = useState(null);
//   const [deleteTarget, setDeleteTarget] = useState(null);
//   const [deleting, setDeleting] = useState(false);
//   const [deleteError, setDeleteError] = useState(null);

//   function loadEmployees(roleId) {
//     if (!roleId) return;
//     setLoading(true);
//     setLoadError(null);
//     return apiClient
//       .get(`/employees/?role_id=${roleId}`)
//       .then((res) => setEmployees(res.data || []))
//       .catch((err) => {
//         setEmployees([]);
//         setLoadError(err.message || "Could not load HR Admins.");
//       })
//       .finally(() => setLoading(false));
//   }

//   useEffect(() => {
//     apiClient
//       .get("/departments/")
//       .then((res) => setDepartments(res || []))
//       .catch(() => setDepartments([]));
//     apiClient
//       .get("/designations/")
//       .then((res) => setDesignations(res || []))
//       .catch(() => setDesignations([]));
//     apiClient
//       .get("/shifts/")
//       .then((res) => setShifts(res || []))
//       .catch(() => setShifts([]));

//     setRoleLoading(true);
//     apiClient
//       .get("/roles/")
//       .then((res) => {
//         const match = (res.data || []).find(
//           (r) => r.role_name?.trim().toUpperCase() === "HR ADMIN",
//         );
//         if (!match) {
//           setRoleError("Could not find the HR ADMIN role.");
//           setLoading(false);
//           return;
//         }
//         setHrAdminRoleId(match.id);
//         loadEmployees(match.id);
//       })
//       .catch(() => {
//         setRoleError("Could not load roles.");
//         setLoading(false);
//       })
//       .finally(() => setRoleLoading(false));
//   }, []);

//   const filtered = useMemo(() => {
//     const q = search.trim().toLowerCase();
//     return employees.filter((emp) => {
//       if (q) {
//         const haystack =
//           `${emp.full_name} ${emp.employee_id} ${emp.email}`.toLowerCase();
//         if (!haystack.includes(q)) return false;
//       }
//       if (deptFilter && emp.department_id !== deptFilter) return false;
//       if (statusFilter && emp.employment_status !== statusFilter) return false;
//       return true;
//     });
//   }, [employees, search, deptFilter, statusFilter]);

//   const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
//   const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

//   useEffect(() => {
//     setPage(1);
//   }, [search, deptFilter, statusFilter]);

//   const stats = useMemo(() => {
//     const active = employees.filter(
//       (e) => e.employment_status === "Active",
//     ).length;
//     const inactive = employees.length - active;
//     const deptCount = new Set(
//       employees.map((e) => e.department_id).filter(Boolean),
//     ).size;
//     return { total: employees.length, active, inactive, deptCount };
//   }, [employees]);

//   const refData = { departments, designations, shifts, employees };

//   async function handleDelete() {
//     if (!deleteTarget) return;
//     setDeleting(true);
//     setDeleteError(null);
//     try {
//       await apiClient.delete(`/employees/${deleteTarget.id}`);
//       setDeleteTarget(null);
//       loadEmployees(hrAdminRoleId);
//     } catch (err) {
//       setDeleteError(err.message || "Could not delete this HR Admin.");
//     } finally {
//       setDeleting(false);
//     }
//   }

//   return (
//     <div>
//       <PageHeader
//         title="HR Admins"
//         subtitle="Manage HR Admin accounts across your organization."
//         actions={
//           <button
//             onClick={() => setFormState({ mode: "add" })}
//             disabled={roleLoading || !hrAdminRoleId}
//             title={
//               roleError ||
//               (roleLoading ? "Resolving HR ADMIN role…" : undefined)
//             }
//             className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
//           >
//             <Plus size={16} />
//             Add HR Admin
//           </button>
//         }
//       />

//       {roleError && (
//         <div className="flex items-center gap-2 text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-4 py-3 text-sm mb-4">
//           <AlertTriangle size={16} />
//           {roleError}
//         </div>
//       )}

//       {/* Stats */}
//       <div className="grid grid-cols-4 gap-4 mb-6">
//         <StatCard
//           icon={Users}
//           label="Total HR Admins"
//           color="orange"
//           loading={loading}
//           value={stats.total}
//         />
//         <StatCard
//           icon={UserCheck}
//           label="Active"
//           color="green"
//           loading={loading}
//           value={stats.active}
//         />
//         <StatCard
//           icon={UserX}
//           label="Inactive"
//           color="red"
//           loading={loading}
//           value={stats.inactive}
//         />
//         <StatCard
//           icon={Building2}
//           label="Departments"
//           color="blue"
//           loading={loading}
//           value={stats.deptCount}
//         />
//       </div>

//       {/* Filters */}
//       <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3">
//         <div className="relative flex-1 min-w-[220px]">
//           <Search
//             size={16}
//             className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
//           />
//           <input
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//             placeholder="Search by name, email or employee ID..."
//             className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
//           />
//         </div>
//         <select
//           value={deptFilter}
//           onChange={(e) => setDeptFilter(e.target.value)}
//           className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-100"
//         >
//           <option value="">All Departments</option>
//           {departments.map((d) => (
//             <option key={d.id} value={d.id}>
//               {d.department_name}
//             </option>
//           ))}
//         </select>
//         <select
//           value={statusFilter}
//           onChange={(e) => setStatusFilter(e.target.value)}
//           className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-100"
//         >
//           <option value="">All Status</option>
//           <option value="Active">Active</option>
//           <option value="Inactive">Inactive</option>
//         </select>
//         {(search || deptFilter || statusFilter) && (
//           <button
//             onClick={() => {
//               setSearch("");
//               setDeptFilter("");
//               setStatusFilter("");
//             }}
//             className="text-sm text-orange-600 hover:underline"
//           >
//             Clear filters
//           </button>
//         )}
//       </div>

//       {/* Table */}
//       <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
//         {loadError && (
//           <div className="flex items-center gap-2 text-orange-600 bg-orange-50 border-b border-orange-100 px-4 py-3 text-sm">
//             <AlertTriangle size={16} />
//             {loadError}
//           </div>
//         )}

//         <table className="w-full text-sm">
//           <thead>
//             <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
//               <th className="px-4 py-3 font-medium">Employee</th>
//               <th className="px-4 py-3 font-medium">Employee ID</th>
//               <th className="px-4 py-3 font-medium">Department</th>
//               <th className="px-4 py-3 font-medium">Designation</th>
//               <th className="px-4 py-3 font-medium">Status</th>
//               <th className="px-4 py-3 font-medium">Joined</th>
//               <th className="px-4 py-3 font-medium text-right">Actions</th>
//             </tr>
//           </thead>
//           <tbody>
//             {loading ? (
//               [...Array(5)].map((_, i) => (
//                 <tr key={i} className="border-b border-slate-50">
//                   <td colSpan={7} className="px-4 py-4">
//                     <div className="h-4 bg-slate-100 rounded animate-pulse" />
//                   </td>
//                 </tr>
//               ))
//             ) : pageItems.length === 0 ? (
//               <tr>
//                 <td
//                   colSpan={7}
//                   className="px-4 py-12 text-center text-slate-400 text-sm"
//                 >
//                   No HR Admins found.
//                 </td>
//               </tr>
//             ) : (
//               pageItems.map((emp) => (
//                 <tr
//                   key={emp.id}
//                   className="border-b border-slate-50 hover:bg-slate-50/60"
//                 >
//                   <td className="px-4 py-3">
//                     <div className="flex items-center gap-3">
//                       <Avatar
//                         person={emp}
//                         className="w-9 h-9 rounded-full text-xs"
//                       />
//                       <div className="min-w-0">
//                         <div className="font-medium text-slate-800 truncate">
//                           {emp.full_name}
//                         </div>
//                         <div className="text-xs text-slate-500 truncate">
//                           {emp.email}
//                         </div>
//                       </div>
//                     </div>
//                   </td>
//                   <td className="px-4 py-3 text-slate-600">
//                     {emp.employee_id}
//                   </td>
//                   <td className="px-4 py-3 text-slate-600">
//                     {emp.departments?.department_name || "—"}
//                   </td>
//                   <td className="px-4 py-3 text-slate-600">
//                     {emp.designations?.designation_name || "—"}
//                   </td>
//                   <td className="px-4 py-3">
//                     <span
//                       className={`px-2.5 py-1 rounded-full text-xs font-medium ${
//                         STATUS_STYLES[emp.employment_status] ||
//                         "bg-slate-100 text-slate-500"
//                       }`}
//                     >
//                       {emp.employment_status}
//                     </span>
//                   </td>
//                   <td className="px-4 py-3 text-slate-600">
//                     {formatDate(emp.joining_date)}
//                   </td>
//                   <td className="px-4 py-3">
//                     <div className="flex items-center justify-end gap-1">
//                       <button
//                         onClick={() => setViewing(emp)}
//                         title="View"
//                         className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
//                       >
//                         <Eye size={15} />
//                       </button>
//                       <button
//                         onClick={() =>
//                           setFormState({ mode: "edit", employee: emp })
//                         }
//                         title="Edit"
//                         className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-orange-50 hover:text-orange-500"
//                       >
//                         <Pencil size={15} />
//                       </button>
//                       <button
//                         onClick={() => {
//                           setDeleteError(null);
//                           setDeleteTarget(emp);
//                         }}
//                         title="Delete"
//                         className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-orange-50 hover:text-orange-500"
//                       >
//                         <Trash2 size={15} />
//                       </button>
//                     </div>
//                   </td>
//                 </tr>
//               ))
//             )}
//           </tbody>
//         </table>

//         {!loading && filtered.length > 0 && (
//           <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
//             <span>
//               Showing {(page - 1) * pageSize + 1}–
//               {Math.min(page * pageSize, filtered.length)} of {filtered.length}{" "}
//               employees
//             </span>
//             <div className="flex items-center gap-1">
//               <button
//                 disabled={page === 1}
//                 onClick={() => setPage((p) => Math.max(1, p - 1))}
//                 className="px-2.5 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
//               >
//                 Prev
//               </button>
//               <span className="px-2">
//                 {page} / {totalPages}
//               </span>
//               <button
//                 disabled={page === totalPages}
//                 onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
//                 className="px-2.5 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
//               >
//                 Next
//               </button>
//             </div>
//           </div>
//         )}
//       </div>

//       {formState && (
//         <EmployeeFormModal
//           mode={formState.mode}
//           employee={formState.employee}
//           refData={refData}
//           hrAdminRoleId={hrAdminRoleId}
//           onClose={() => setFormState(null)}
//           onSaved={() => {
//             setFormState(null);
//             loadEmployees(hrAdminRoleId);
//           }}
//         />
//       )}

//       {viewing && (
//         <EmployeeViewModal
//           employee={viewing}
//           onClose={() => setViewing(null)}
//           onEdit={() => {
//             const emp = viewing;
//             setViewing(null);
//             setFormState({ mode: "edit", employee: emp });
//           }}
//         />
//       )}

//       {deleteTarget && (
//         <DeleteConfirmModal
//           employee={deleteTarget}
//           deleting={deleting}
//           error={deleteError}
//           onClose={() => setDeleteTarget(null)}
//           onConfirm={handleDelete}
//         />
//       )}
//     </div>
//   );
// }
