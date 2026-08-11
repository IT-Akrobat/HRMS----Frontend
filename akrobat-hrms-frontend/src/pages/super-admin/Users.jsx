import {
  AlertTriangle,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Download,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users as UsersIcon,
  UserX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import UserFormModal, {
  FilterDropdown,
} from "../../components/common/UserformModal ";
import { apiClient } from "../../services/apiClient";
import { documentsService } from "../../services/documentsService";

// ---------------------------------------------------------------------
// Master account list across EVERY role (Super Admin, HR Admin, HR
// Executive, Manager and its variants, Team Leader, Employee, Viewer,
// ...) — as opposed to Employees.jsx / EmployeesHrAdmins.jsx which are
// each scoped to one role. This is the "Users" screen under
// User Management in the sidebar (see navigationConfig.js), separate
// from the "Employees" section.
//
// Wired to the real backend. There is no single "list every account
// with its role" endpoint, so this mirrors the technique
// EmployeesHrAdmins.jsx already uses for one role and extends it to
// all of them:
//   - GET /roles/ to get every role.
//   - GET /employees/?role_id=<id> once per role (the backend filters
//     employees server-side via the user_profiles table — see
//     app/employees/services.get_employees). Each employee belongs to
//     exactly one role, so the per-role results union into the full
//     account list with no duplicates, and each record gets tagged
//     with the role it was fetched under.
//   - POST /employees/ to create a user of ANY role: EmployeeCreate
//     requires full_name/email/password/role_id, and the backend only
//     accepts emails on the company domain (see ALLOWED_DOMAIN in
//     app/core/helpers/employee_helper.py). Only SUPER ADMIN / HR ADMIN
//     may call this (app/employees/routes.py hard role-checks it) —
//     Super Admin always can.
//   - PUT /employees/{id} to edit. EmployeeUpdate has no role_id field
//     (extra="forbid" on the model), so role can only be set at
//     creation — the edit form shows it read-only.
//   - DELETE /employees/{id} to remove a user; the backend also tears
//     down their Supabase auth login and user_profiles row.
// ---------------------------------------------------------------------

const STATUS_STYLES = {
  Active: "bg-blue-50 text-blue-600",
  Inactive: "bg-slate-100 text-slate-500",
};

const ROLE_BADGE_MAP = {
  "SUPER ADMIN": "bg-violet-50 text-violet-600",
  "HR ADMIN": "bg-blue-50 text-blue-600",
  "HR EXECUTIVE": "bg-sky-50 text-sky-600",
  MANAGER: "bg-emerald-50 text-emerald-600",
  "OPERATIONS MANAGER": "bg-emerald-50 text-emerald-600",
  "INSPECTION MANAGER": "bg-emerald-50 text-emerald-600",
  "TEAM LEADER": "bg-teal-50 text-teal-600",
  EMPLOYEE: "bg-slate-100 text-slate-600",
  VIEWER: "bg-amber-50 text-amber-600",
};
const ROLE_BADGE_FALLBACK = [
  "bg-orange-50 text-orange-600",
  "bg-blue-50 text-blue-600",
  "bg-emerald-50 text-emerald-600",
  "bg-violet-50 text-violet-600",
];

function roleBadgeStyle(roleName) {
  if (!roleName) return "bg-slate-100 text-slate-500";
  const key = roleName.trim().toUpperCase();
  if (ROLE_BADGE_MAP[key]) return ROLE_BADGE_MAP[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++)
    hash = (hash + key.charCodeAt(i)) % ROLE_BADGE_FALLBACK.length;
  return ROLE_BADGE_FALLBACK[hash];
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

function UserViewModal({ user, users, onClose, onEdit }) {
  const [show, setShow] = useState(false);
  const [activeSection, setActiveSection] = useState("details");

  // ---- Documents uploaded by this user (Super Admin view only) ----
  // GET /documents/employee/{employee_id} — Super Admin always has
  // VIEW_DOCUMENTS implicitly, so this returns every document this
  // specific employee has uploaded, regardless of who's viewing.
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState("");
  const [downloadingDocId, setDownloadingDocId] = useState(null);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setDocsLoading(true);
    setDocsError("");
    documentsService
      .getForEmployee(user.id)
      .then((docs) => {
        if (!cancelled) setDocuments(docs || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setDocuments([]);
          setDocsError(err.message || "Could not load documents.");
        }
      })
      .finally(() => {
        if (!cancelled) setDocsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  async function handleDownloadDocument(doc) {
    setDownloadError("");
    setDownloadingDocId(doc.id);
    try {
      await documentsService.downloadFile(doc.id, doc.document_name);
    } catch (err) {
      setDownloadError(err.message || "Could not download that document.");
    } finally {
      setDownloadingDocId(null);
    }
  }

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

  const manager = (users || []).find((u) => u.id === user.manager_id);

  return (
    <div className="fixed inset-0 z-50">
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/50 transition-opacity duration-200 ${
          show ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        className={`absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-200 ease-out ${
          show ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar person={user} className="w-12 h-12 rounded-full" />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-800 truncate">
                {user.full_name}
              </h2>
              <p className="text-xs text-slate-500">{user.employee_id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onEdit}
              title="Edit"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-orange-50 hover:text-orange-500"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${roleBadgeStyle(user.role_name)}`}
            >
              <ShieldCheck size={12} />
              {user.role_name || "—"}
            </span>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                STATUS_STYLES[user.employment_status] ||
                "bg-slate-100 text-slate-500"
              }`}
            >
              {user.employment_status}
            </span>
            {/* Clicking this switches the drawer body to a dedicated
                Documents section instead of navigating away — see
                activeSection below. */}
            <button
              onClick={() =>
                setActiveSection((s) =>
                  s === "documents" ? "details" : "documents",
                )
              }
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                activeSection === "documents"
                  ? "bg-orange-500 border-orange-500 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <FileText size={12} />
              Documents
              {!docsLoading && documents.length > 0 && (
                <span
                  className={`ml-0.5 text-[10px] font-semibold ${
                    activeSection === "documents"
                      ? "text-white/90"
                      : "text-slate-400"
                  }`}
                >
                  {documents.length}
                </span>
              )}
            </button>
          </div>

          {activeSection === "details" ? (
            <>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-5 mb-1">
                  Contact
                </h3>
                <div className="divide-y divide-slate-50">
                  <DetailRow icon={Mail} label="Email" value={user.email} />
                  <DetailRow icon={Phone} label="Phone" value={user.phone} />
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
                    value={user.departments?.department_name}
                  />
                  <DetailRow
                    icon={Briefcase}
                    label="Designation"
                    value={user.designations?.designation_name}
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
                    value={user.shifts?.shift_name}
                  />
                  <DetailRow
                    icon={MapPin}
                    label="Work Location"
                    value={user.work_location}
                  />
                  <DetailRow
                    icon={Calendar}
                    label="Joining Date"
                    value={formatDate(user.joining_date)}
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-5 mb-1"></h3>

              {downloadError && (
                <div className="mt-2 mb-1 text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span>{downloadError}</span>
                  <button
                    onClick={() => setDownloadError("")}
                    className="text-orange-400 hover:text-orange-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {docsLoading ? (
                <div className="h-14 mt-2 bg-slate-50 rounded-lg animate-pulse" />
              ) : docsError ? (
                <p className="text-sm text-slate-400 py-2">{docsError}</p>
              ) : documents.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">
                  No documents uploaded yet.
                </p>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {documents.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-3 py-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                        <FileText size={14} className="text-slate-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-slate-700 truncate">
                          {doc.document_name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {doc.document_type}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadDocument(doc)}
                        disabled={downloadingDocId === doc.id}
                        title="Download"
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-60"
                      >
                        {downloadingDocId === doc.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Download size={15} />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// Delete confirm
// ==========================================================================

function DeleteConfirmModal({ user, onClose, onConfirm, deleting, error }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <div className="w-11 h-11 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mb-4">
          <Trash2 size={18} />
        </div>
        <h2 className="text-base font-bold text-slate-800 mb-1">
          Remove user?
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          This will permanently delete{" "}
          <span className="font-medium text-slate-700">{user.full_name}</span> (
          <span className="font-medium text-slate-700">{user.role_name}</span>)
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

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [rolesReady, setRolesReady] = useState(false);
  const [rolesError, setRolesError] = useState(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [formState, setFormState] = useState(null); // { mode: 'add'|'edit', user }
  const [viewing, setViewing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Every account belongs to exactly one role, so fetching
  // /employees/?role_id=<id> for each role and unioning the results
  // gives the full account list, each record tagged with its role.
  async function loadUsers(rolesList) {
    if (!rolesList || rolesList.length === 0) return;
    setLoading(true);
    setLoadError(null);
    try {
      const perRole = await Promise.all(
        rolesList.map((role) =>
          apiClient
            .get(`/employees/?role_id=${role.id}`)
            .then((res) =>
              (res.data || []).map((emp) => ({
                ...emp,
                role_id: role.id,
                role_name: role.role_name,
              })),
            )
            .catch(() => []),
        ),
      );
      setUsers(perRole.flat());
    } catch (err) {
      setUsers([]);
      setLoadError(err.message || "Could not load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
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
      .then((res) => {
        const list = res.data || [];
        setRoles(list);
        setRolesReady(true);
        loadUsers(list);
      })
      .catch((err) => {
        setRolesError(err.message || "Could not load roles.");
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const haystack =
          `${u.full_name} ${u.employee_id} ${u.email}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (roleFilter && u.role_id !== roleFilter) return false;
      if (deptFilter && u.department_id !== deptFilter) return false;
      if (designationFilter && u.designation_id !== designationFilter)
        return false;
      if (statusFilter && u.employment_status !== statusFilter) return false;
      return true;
    });
  }, [users, search, roleFilter, deptFilter, designationFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, deptFilter, designationFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = users.filter((u) => u.employment_status === "Active").length;
    const inactive = users.length - active;
    return { total: users.length, active, inactive, roleCount: roles.length };
  }, [users, roles]);

  const refData = { departments, designations, shifts, roles, users };

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/employees/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadUsers(roles);
    } catch (err) {
      setDeleteError(err.message || "Could not delete this user.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage every account in the system, across all roles."
        actions={
          <button
            onClick={() => setFormState({ mode: "add" })}
            disabled={!rolesReady}
            title={rolesError || (!rolesReady ? "Loading roles…" : undefined)}
            className="px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={15} />
            Add User
          </button>
        }
      />

      {rolesError && (
        <div className="flex items-center gap-2 text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-4 py-3 text-sm mb-4">
          <AlertTriangle size={16} />
          {rolesError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <StatCard
          icon={UsersIcon}
          label="Total Users"
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
          icon={Shield}
          label="Roles"
          color="purple"
          loading={loading}
          value={stats.roleCount}
        />
      </div>

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
          allLabel="All Roles"
          value={roleFilter}
          onChange={setRoleFilter}
          options={roles}
          getKey={(r) => r.id}
          getLabel={(r) => r.role_name}
        />

        <FilterDropdown
          allLabel="All Departments"
          value={deptFilter}
          onChange={setDeptFilter}
          options={departments}
          getKey={(d) => d.id}
          getLabel={(d) => d.department_name}
        />

        <FilterDropdown
          allLabel="All Designations"
          value={designationFilter}
          onChange={setDesignationFilter}
          options={designations}
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
        {(search ||
          roleFilter ||
          deptFilter ||
          designationFilter ||
          statusFilter) && (
          <button
            onClick={() => {
              setSearch("");
              setRoleFilter("");
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
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Employee ID</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Department</th>
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
                    No users found.
                  </td>
                </tr>
              ) : (
                pageItems.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setViewing(u)}
                    className="border-b border-slate-50 hover:bg-slate-50/60 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          person={u}
                          className="w-9 h-9 rounded-full text-xs"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 truncate">
                            {u.full_name}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.employee_id}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleBadgeStyle(u.role_name)}`}
                      >
                        {u.role_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.departments?.department_name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          STATUS_STYLES[u.employment_status] ||
                          "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {u.employment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(u.joining_date)}
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewing(u)}
                          title="View"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          {/* <Eye size={15} /> */}
                        </button>
                        <button
                          onClick={() =>
                            setFormState({ mode: "edit", user: u })
                          }
                          title="Edit"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-orange-50 hover:text-orange-500"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(u);
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
              users
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

      {viewing && (
        <UserViewModal
          user={viewing}
          users={users}
          onClose={() => setViewing(null)}
          onEdit={() => {
            // Keep the view drawer open behind the edit popup — only
            // the edit form should appear on top, not replace it.
            setFormState({ mode: "edit", user: viewing });
          }}
        />
      )}

      {/* Rendered AFTER the view drawer so that when both are open
          (editing from within the view drawer) the edit popup stacks
          on top of it — both share the same z-50, and later markup
          wins the stacking order. */}
      {formState && (
        <UserFormModal
          mode={formState.mode}
          user={formState.user}
          refData={refData}
          onClose={() => setFormState(null)}
          onSaved={() => {
            setFormState(null);
            loadUsers(roles);
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          user={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
