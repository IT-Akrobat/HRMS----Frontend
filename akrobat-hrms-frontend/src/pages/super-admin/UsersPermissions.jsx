import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Crown,
  Eye,
  KeyRound,
  Lock,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { permissionsService } from "../../services/PermissionService";

// ---------------------------------------------------------------------
// Backend contract (app/permissions/routes.py — SUPER ADMIN only):
//   GET  /permissions/matrix        -> { roles, permissions, grants }
//     roles:       [{ id, role_name, description, is_super_admin }]
//     permissions: [{ id, permission_name, module }]
//     grants:      [{ role_id, permission_id }]  — one row per wire.
//     SUPER ADMIN's edges are synthesized server-side (it implicitly
//     holds every permission — see app/core/rbac.py) so it always shows
//     up fully wired without real role_permissions rows.
//   POST   /permissions/grant                -> { role_id, permission_id }
//   DELETE /permissions/revoke/{role}/{perm}
// A role node is selected first; clicking a permission node then wires
// or unwires that one connection immediately (each click is its own
// request — no separate "save").
// ---------------------------------------------------------------------

const MODULE_COLORS = [
  { dot: "bg-orange-500", text: "text-orange-600" },
  { dot: "bg-sky-500", text: "text-sky-600" },
  { dot: "bg-emerald-500", text: "text-emerald-600" },
  { dot: "bg-violet-500", text: "text-violet-600" },
  { dot: "bg-rose-500", text: "text-rose-600" },
  { dot: "bg-amber-500", text: "text-amber-600" },
  { dot: "bg-cyan-500", text: "text-cyan-600" },
  { dot: "bg-fuchsia-500", text: "text-fuchsia-600" },
];

function moduleColor(module, index) {
  return MODULE_COLORS[index % MODULE_COLORS.length];
}

function roleIcon(roleName = "") {
  const n = roleName.toUpperCase();
  if (n === "SUPER ADMIN") return Crown;
  if (n.includes("HR")) return ShieldCheck;
  if (n.includes("MANAGER")) return Users;
  if (n === "EMPLOYEE") return User;
  if (n === "VIEWER") return Eye;
  return Shield;
}

function edgeKey(roleId, permissionId) {
  return `${roleId}:${permissionId}`;
}

export default function UsersPermissions() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Unified success/error banner. `noticeId` increments on every call so
  // the auto-dismiss timer and slide-in animation always restart, even
  // if the same message fires twice in a row.
  const [notice, setNotice] = useState(null);
  const [noticeType, setNoticeType] = useState("success");
  const [noticeId, setNoticeId] = useState(0);

  const showNotice = useCallback((message, type = "success") => {
    setNotice(message);
    setNoticeType(type);
    setNoticeId((id) => id + 1);
  }, []);

  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [grants, setGrants] = useState([]);

  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [hoveredRoleId, setHoveredRoleId] = useState(null);
  const [selectedPermissionId, setSelectedPermissionId] = useState(null);
  const [pendingEdgeKey, setPendingEdgeKey] = useState(null);

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");

  // Mobile-only: which module accordions are collapsed. Purely a view
  // concern (desktop graph has no equivalent), so it's kept local here
  // rather than alongside the shared role/permission state above.
  const [collapsedModules, setCollapsedModules] = useState(new Set());

  const containerRef = useRef(null);
  const roleNodeRefs = useRef(new Map());
  const permNodeRefs = useRef(new Map());
  const [edges, setEdges] = useState([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });

  // ---------------------------------------------------------------------
  // Load the graph
  // ---------------------------------------------------------------------

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await permissionsService.getMatrix();
      setRoles(res.data.roles || []);
      setPermissions(res.data.permissions || []);
      setGrants(res.data.grants || []);
    } catch (e) {
      setError(e.message || "Could not load the permissions graph.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [noticeId]);

  // ---------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------

  const superAdmin = useMemo(
    () => roles.find((r) => r.is_super_admin),
    [roles],
  );

  const grantSet = useMemo(
    () => new Set(grants.map((g) => edgeKey(g.role_id, g.permission_id))),
    [grants],
  );

  const modules = useMemo(
    () => [...new Set(permissions.map((p) => p.module || "OTHER"))].sort(),
    [permissions],
  );

  const permissionsByModule = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = permissions.filter((p) => {
      if (moduleFilter && (p.module || "OTHER") !== moduleFilter) return false;
      if (q && !p.permission_name.toLowerCase().includes(q)) return false;
      return true;
    });

    const groups = new Map();
    for (const p of filtered) {
      const key = p.module || "OTHER";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions, search, moduleFilter]);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) || null,
    [roles, selectedRoleId],
  );

  const selectedRoleGrantedCount = useMemo(() => {
    if (!selectedRoleId) return 0;
    return grants.filter((g) => g.role_id === selectedRoleId).length;
  }, [grants, selectedRoleId]);

  const activeConnections = useMemo(
    () => grants.filter((g) => g.role_id !== superAdmin?.id).length,
    [grants, superAdmin],
  );

  // ---------------------------------------------------------------------
  // Wire geometry — recompute node port positions relative to the graph
  // container whenever the visible node set or container size changes.
  // ---------------------------------------------------------------------

  const recalc = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();

    const next = [];
    for (const g of grants) {
      const roleEl = roleNodeRefs.current.get(g.role_id);
      const permEl = permNodeRefs.current.get(g.permission_id);
      if (!roleEl || !permEl) continue;
      const rRect = roleEl.getBoundingClientRect();
      const pRect = permEl.getBoundingClientRect();

      next.push({
        key: edgeKey(g.role_id, g.permission_id),
        role_id: g.role_id,
        permission_id: g.permission_id,
        x1: rRect.right - cRect.left,
        y1: rRect.top - cRect.top + rRect.height / 2,
        x2: pRect.left - cRect.left,
        y2: pRect.top - cRect.top + pRect.height / 2,
      });
    }
    setEdges(next);
    setSvgSize({ w: cRect.width, h: cRect.height });
  }, [grants]);

  useLayoutEffect(() => {
    const raf = requestAnimationFrame(recalc);
    return () => cancelAnimationFrame(raf);
  }, [recalc, permissionsByModule, roles, loading]);

  useEffect(() => {
    function onResize() {
      recalc();
    }
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(() => recalc());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
    };
  }, [recalc]);

  // ---------------------------------------------------------------------
  // Interactions
  // ---------------------------------------------------------------------

  function handleRoleClick(role) {
    setSelectedPermissionId(null);
    setSelectedRoleId((prev) => (prev === role.id ? null : role.id));
  }

  async function togglePermission(permission) {
    if (!selectedRole) {
      setSelectedPermissionId((prev) =>
        prev === permission.id ? null : permission.id,
      );
      return;
    }
    if (selectedRole.is_super_admin) return;
    if (pendingEdgeKey) return;

    const key = edgeKey(selectedRole.id, permission.id);
    const isGranted = grantSet.has(key);
    setPendingEdgeKey(key);

    setGrants((prev) =>
      isGranted
        ? prev.filter(
            (g) =>
              !(
                g.role_id === selectedRole.id &&
                g.permission_id === permission.id
              ),
          )
        : [...prev, { role_id: selectedRole.id, permission_id: permission.id }],
    );

    try {
      if (isGranted) {
        await permissionsService.revoke(selectedRole.id, permission.id);
      } else {
        await permissionsService.grant(selectedRole.id, permission.id);
      }
      showNotice(
        `${permission.permission_name} ${isGranted ? "disconnected from" : "wired to"} ${selectedRole.role_name}`,
        "success",
      );
    } catch (e) {
      // rollback optimistic update
      setGrants((prev) =>
        isGranted
          ? [
              ...prev,
              { role_id: selectedRole.id, permission_id: permission.id },
            ]
          : prev.filter(
              (g) =>
                !(
                  g.role_id === selectedRole.id &&
                  g.permission_id === permission.id
                ),
            ),
      );
      const message = e.message || "Could not update that connection.";
      setError(message);
      showNotice(message, "error");
    } finally {
      setPendingEdgeKey(null);
    }
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  const focusRoleId = selectedRoleId || hoveredRoleId || null;

  return (
    <div>
      {/* <PageHeader
        title="Permissions"
        subtitle="Wire roles to what they're allowed to do — click a role, then click permissions to connect or disconnect them."
        actions={
          <button
            onClick={loadMatrix}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      /> */}

      {/* {error && (
        <div className="mb-4 flex items-start gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-4 py-2.5">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-orange-400 hover:text-orange-600"
          >
            <X size={14} />
          </button>
        </div>
      )} */}

      {/* <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Users}
          label="Roles"
          value={roles.length}
          loading={loading}
        />
        <StatCard
          icon={KeyRound}
          label="Permissions"
          value={permissions.length}
          loading={loading}
          color="blue"
        />
        <StatCard
          icon={Layers}
          label="Modules"
          value={modules.length}
          loading={loading}
          color="purple"
        />
        <StatCard
          icon={Plug}
          label="Active connections"
          value={activeConnections}
          loading={loading}
          color="slate"
        />
      </div> */}

      {/* ================= GRAPH PANEL ================= */}
      <div className="hidden sm:block bg-[#0B1830] rounded-2xl border border-[#152847] overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
              <Sparkles size={15} className="text-orange-400" />
            </div>
            <div className="min-w-0">
              {selectedRole ? (
                <p className="text-sm text-white truncate">
                  <span className="font-semibold">
                    {selectedRole.role_name}
                  </span>{" "}
                  <span className="text-slate-400">
                    — {selectedRoleGrantedCount} connected · click a permission
                    to wire or unwire it
                  </span>
                </p>
              ) : (
                <p className="text-sm text-slate-300">
                  Select a role on the left to edit its connections
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedRoleId && (
              <button
                onClick={() => setSelectedRoleId(null)}
                className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20"
              >
                Clear selection
              </button>
            )}
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search permissions"
                className="pl-7 pr-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-400/60 w-40"
              />
            </div>
          </div>
        </div>

        {/* Module filter chips */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10 overflow-x-auto">
          <button
            onClick={() => setModuleFilter("")}
            className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              moduleFilter === ""
                ? "bg-orange-500 border-orange-500 text-white"
                : "bg-transparent border-white/15 text-slate-300 hover:border-white/30"
            }`}
          >
            All modules
          </button>
          {modules.map((m, i) => {
            const c = moduleColor(m, i);
            return (
              <button
                key={m}
                onClick={() => setModuleFilter((prev) => (prev === m ? "" : m))}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  moduleFilter === m
                    ? "bg-white/10 border-white/30 text-white"
                    : "bg-transparent border-white/10 text-slate-400 hover:border-white/25"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                {m.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>

        {selectedRole?.is_super_admin && (
          <div className="mx-5 mt-4 flex items-center gap-2 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
            <Lock size={13} className="shrink-0" />
            Super Admin has every permission by default and can't be edited
            here.
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="px-5 py-16 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
            <RefreshCw size={18} className="animate-spin" />
            Loading the permissions graph…
          </div>
        )}

        {/* Graph */}
        {!loading && (
          <div className="overflow-x-auto">
            <div
              ref={containerRef}
              className="relative flex gap-10 px-6 py-8"
              style={{ minWidth: 880 }}
            >
              {/* Wires */}
              <svg
                className="absolute inset-0 pointer-events-none"
                width={svgSize.w}
                height={svgSize.h}
                style={{ zIndex: 0 }}
              >
                {edges.map((edge) => {
                  const isSuperAdminEdge = edge.role_id === superAdmin?.id;
                  const isFocused = focusRoleId && edge.role_id === focusRoleId;
                  const isPermFocused =
                    !focusRoleId &&
                    selectedPermissionId &&
                    edge.permission_id === selectedPermissionId;
                  const isPending = pendingEdgeKey === edge.key;
                  const anyFocus = focusRoleId || selectedPermissionId;

                  const mid = (edge.x1 + edge.x2) / 2;
                  const d = `M ${edge.x1} ${edge.y1} C ${mid} ${edge.y1}, ${mid} ${edge.y2}, ${edge.x2} ${edge.y2}`;

                  let stroke = "#64748b";
                  let opacity = 0.1;
                  let width = 1.25;
                  let dash = "0";

                  if (isSuperAdminEdge) {
                    stroke = "#fbbf24";
                    opacity = isFocused ? 0.55 : 0.05;
                  }

                  if (isFocused || isPermFocused) {
                    stroke = isSuperAdminEdge ? "#fbbf24" : "#F5730B";
                    opacity = 0.9;
                    width = 2.25;
                    dash = "6 5";
                  } else if (anyFocus) {
                    opacity = 0.035;
                  }

                  if (isPending) {
                    stroke = "#F5730B";
                    opacity = 0.9;
                    width = 2.25;
                  }

                  return (
                    <path
                      key={edge.key}
                      d={d}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={width}
                      strokeOpacity={opacity}
                      strokeDasharray={dash}
                      strokeLinecap="round"
                      className={
                        isFocused || isPermFocused ? "wire-flow" : undefined
                      }
                    />
                  );
                })}
              </svg>

              {/* Role nodes */}
              <div
                className="flex flex-col gap-2.5 shrink-0 relative"
                style={{ width: 250, zIndex: 1 }}
              >
                <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase mb-0.5">
                  Roles
                </p>
                {roles.map((role) => {
                  const Icon = roleIcon(role.role_name);
                  const count = grants.filter(
                    (g) => g.role_id === role.id,
                  ).length;
                  const isSelected = selectedRoleId === role.id;
                  return (
                    <button
                      key={role.id}
                      ref={(el) =>
                        el
                          ? roleNodeRefs.current.set(role.id, el)
                          : roleNodeRefs.current.delete(role.id)
                      }
                      onClick={() => handleRoleClick(role)}
                      onMouseEnter={() =>
                        !selectedRoleId && setHoveredRoleId(role.id)
                      }
                      onMouseLeave={() => setHoveredRoleId(null)}
                      className={`relative text-left rounded-xl px-3.5 py-2.5 border transition-all ${
                        isSelected
                          ? "bg-orange-500/10 border-orange-400/60 shadow-[0_0_0_1px_rgba(245,115,11,0.3)]"
                          : role.is_super_admin
                            ? "bg-amber-400/5 border-amber-400/20 hover:border-amber-400/40"
                            : "bg-white/[0.03] border-white/10 hover:border-white/25 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            role.is_super_admin
                              ? "bg-amber-400/15 text-amber-300"
                              : isSelected
                                ? "bg-orange-500/20 text-orange-300"
                                : "bg-white/5 text-slate-300"
                          }`}
                        >
                          <Icon size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate">
                            {role.role_name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {role.is_super_admin
                              ? "Full access"
                              : `${count} permission${count === 1 ? "" : "s"}`}
                          </p>
                        </div>
                      </div>
                      {/* connection port */}
                      <span
                        className={`absolute top-1/2 -right-[5px] -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-[#0B1830] ${
                          role.is_super_admin
                            ? "bg-amber-400"
                            : isSelected
                              ? "bg-orange-400"
                              : "bg-slate-500"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Permission nodes, grouped by module */}
              <div
                className="flex-1 flex flex-col gap-5 relative"
                style={{ zIndex: 1 }}
              >
                <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase mb-0.5">
                  Permissions
                </p>

                {permissionsByModule.length === 0 && (
                  <p className="text-sm text-slate-500 py-8 text-center">
                    No permissions match your search.
                  </p>
                )}

                {permissionsByModule.map(([mod, perms]) => {
                  const c = moduleColor(mod, modules.indexOf(mod));
                  return (
                    <div key={mod}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                        <p
                          className={`text-[11px] font-semibold tracking-wide ${c.text}`}
                        >
                          {mod.replace(/_/g, " ")}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {perms.map((perm) => {
                          const isConnected =
                            !!selectedRoleId &&
                            grantSet.has(edgeKey(selectedRoleId, perm.id));
                          const isPending =
                            pendingEdgeKey ===
                            edgeKey(selectedRoleId || "", perm.id);
                          const isPermSelected =
                            !selectedRoleId && selectedPermissionId === perm.id;
                          const connectedRoleCount = grants.filter(
                            (g) => g.permission_id === perm.id,
                          ).length;

                          return (
                            <button
                              key={perm.id}
                              ref={(el) =>
                                el
                                  ? permNodeRefs.current.set(perm.id, el)
                                  : permNodeRefs.current.delete(perm.id)
                              }
                              onClick={() => togglePermission(perm)}
                              disabled={isPending}
                              title={
                                selectedRole
                                  ? selectedRole.is_super_admin
                                    ? "Super Admin already has this"
                                    : isConnected
                                      ? `Disconnect from ${selectedRole.role_name}`
                                      : `Connect to ${selectedRole.role_name}`
                                  : `Used by ${connectedRoleCount} role${connectedRoleCount === 1 ? "" : "s"}`
                              }
                              className={`relative flex items-center gap-1.5 pl-3.5 pr-3 py-1.5 rounded-full text-[11px] font-medium border transition-all ${
                                isConnected
                                  ? "bg-orange-500/15 border-orange-400/50 text-orange-200"
                                  : isPermSelected
                                    ? "bg-white/10 border-white/30 text-white"
                                    : "bg-white/[0.03] border-white/10 text-slate-300 hover:border-white/25"
                              } ${
                                selectedRole?.is_super_admin
                                  ? "opacity-50 cursor-not-allowed"
                                  : "cursor-pointer"
                              }`}
                            >
                              <span
                                className={`absolute top-1/2 -left-[5px] -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-[#0B1830] ${
                                  isConnected ? "bg-orange-400" : "bg-slate-600"
                                }`}
                              />
                              {isPending ? (
                                <RefreshCw size={11} className="animate-spin" />
                              ) : (
                                <KeyRound size={11} className="opacity-70" />
                              )}
                              {perm.permission_name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= MOBILE PERMISSIONS UI =================
          The desktop panel above is a wired SVG graph with a fixed
          880px min-width -- fundamentally a desktop interaction, not
          something that can just be resized. Mobile gets its own flow
          instead: tap a role, then toggle its permissions in a plain
          list, grouped by module. Same state/handlers as the desktop
          graph (selectedRoleId, togglePermission, grantSet, etc.) so
          both stay in sync -- this is purely a different view of the
          same data. ================= */}
      <div className="sm:hidden">
        {loading && (
          <div className="flex flex-col gap-3">
            <div className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-2xl bg-slate-100 animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && error && roles.length === 0 && (
          <div className="flex flex-col items-center text-center py-14 px-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
              <AlertCircle size={18} className="text-red-500" />
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-1">
              Couldn't load roles &amp; permissions
            </p>
            <p className="text-xs text-slate-400 mb-4 max-w-[240px]">{error}</p>
            <button
              onClick={loadMatrix}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-orange-500 text-white active:bg-orange-600"
            >
              <RefreshCw size={13} />
              Try again
            </button>
          </div>
        )}

        {!loading && !error && !selectedRoleId && (
          <>
            {/* Overview card — mirrors the desktop panel's navy/orange
                identity so mobile doesn't feel like a stripped-down
                fallback. */}
            <div className="relative overflow-hidden rounded-2xl bg-[#0B1830] px-4 py-4 mb-4">
              <div className="absolute -right-8 -top-10 w-32 h-32 rounded-full bg-orange-500/10 blur-2xl" />
              <div className="relative flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
                  <Sparkles size={15} className="text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    Roles &amp; Permissions
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Tap a role to manage its access
                  </p>
                </div>
              </div>
              <div className="relative grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-2 text-center">
                  <p className="text-base font-semibold text-white tabular-nums">
                    {roles.length}
                  </p>
                  <p className="text-[10px] text-slate-400">Roles</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-2 text-center">
                  <p className="text-base font-semibold text-white tabular-nums">
                    {permissions.length}
                  </p>
                  <p className="text-[10px] text-slate-400">Permissions</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-2 text-center">
                  <p className="text-base font-semibold text-white tabular-nums">
                    {activeConnections}
                  </p>
                  <p className="text-[10px] text-slate-400">Connected</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {roles.map((role) => {
                const Icon = roleIcon(role.role_name);
                const count = grants.filter(
                  (g) => g.role_id === role.id,
                ).length;
                const pct = permissions.length
                  ? Math.round((count / permissions.length) * 100)
                  : 0;
                return (
                  <button
                    key={role.id}
                    onClick={() => handleRoleClick(role)}
                    className={`w-full flex items-center gap-3 text-left rounded-2xl px-4 py-3.5 border transition-all active:scale-[0.98] ${
                      role.is_super_admin
                        ? "bg-gradient-to-br from-amber-50 to-white border-amber-200"
                        : "bg-white border-slate-200 active:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        role.is_super_admin
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Icon size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {role.role_name}
                        </p>
                        {!role.is_super_admin && (
                          <span className="shrink-0 text-[10px] font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 tabular-nums">
                            {count}
                          </span>
                        )}
                      </div>
                      {role.is_super_admin ? (
                        <p className="text-[11px] font-medium text-amber-700">
                          Full access to every module
                        </p>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-orange-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                            {pct}%
                          </span>
                        </div>
                      )}
                    </div>
                    <ChevronRight
                      size={18}
                      className="text-slate-300 shrink-0"
                    />
                  </button>
                );
              })}
            </div>
          </>
        )}

        {!loading && selectedRoleId && selectedRole && (
          <>
            {/* Sticky role header + search + filters — stays put above
                the permission list while scrolling. Offset below the
                app's own sticky top bar (h-16). */}
            <div className="sticky top-16 z-10 -mx-3 px-3 bg-slate-50/95 backdrop-blur-sm pb-3">
              <button
                onClick={() => setSelectedRoleId(null)}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 pt-3 pb-2.5"
              >
                <ChevronRight size={14} className="rotate-180" aria-hidden />
                All roles
              </button>

              <div className="flex items-center gap-3 mb-3 bg-white rounded-xl px-3.5 py-3 border border-slate-200">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    selectedRole.is_super_admin
                      ? "bg-amber-100 text-amber-700"
                      : "bg-orange-100 text-orange-600"
                  }`}
                >
                  {(() => {
                    const Icon = roleIcon(selectedRole.role_name);
                    return <Icon size={16} />;
                  })()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {selectedRole.role_name}
                  </p>
                  {selectedRole.is_super_admin ? (
                    <p className="text-xs text-amber-700 mt-0.5">Full access</p>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 max-w-[110px] h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-orange-500 transition-all"
                          style={{
                            width: `${
                              permissions.length
                                ? Math.round(
                                    (selectedRoleGrantedCount /
                                      permissions.length) *
                                      100,
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {selectedRoleGrantedCount} of {permissions.length}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {selectedRole.is_super_admin && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 mb-3">
                  <Lock size={13} className="shrink-0" />
                  Super Admin has every permission by default and can't be
                  edited here.
                </div>
              )}

              {/* Search */}
              <div className="relative mb-2.5">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search permissions"
                  className="w-full pl-8 pr-8 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-orange-400"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Module filter chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                <button
                  onClick={() => setModuleFilter("")}
                  className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                    moduleFilter === ""
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "bg-white border-slate-200 text-slate-500"
                  }`}
                >
                  All modules
                </button>
                {modules.map((m, i) => {
                  const c = moduleColor(m, i);
                  return (
                    <button
                      key={m}
                      onClick={() =>
                        setModuleFilter((prev) => (prev === m ? "" : m))
                      }
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        moduleFilter === m
                          ? "bg-slate-800 border-slate-800 text-white"
                          : "bg-white border-slate-200 text-slate-500"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                      {m.replace(/_/g, " ")}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Permissions, grouped by module as collapsible sections */}
            {permissionsByModule.length === 0 && (
              <div className="flex flex-col items-center text-center py-10">
                <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <Search size={16} className="text-slate-400" />
                </div>
                <p className="text-sm text-slate-500">
                  No permissions match your search.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-1">
              {permissionsByModule.map(([mod, perms]) => {
                const c = moduleColor(mod, modules.indexOf(mod));
                const grantedInModule = perms.filter((p) =>
                  grantSet.has(edgeKey(selectedRoleId, p.id)),
                ).length;
                const allGranted =
                  selectedRole.is_super_admin ||
                  grantedInModule === perms.length;
                const isCollapsed = collapsedModules.has(mod);
                return (
                  <div
                    key={mod}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setCollapsedModules((prev) => {
                          const next = new Set(prev);
                          if (next.has(mod)) next.delete(mod);
                          else next.add(mod);
                          return next;
                        })
                      }
                      className="w-full flex items-center justify-between gap-2 px-4 py-3"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`}
                        />
                        <p
                          className={`text-[11px] font-semibold tracking-wide truncate ${c.text}`}
                        >
                          {mod.replace(/_/g, " ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-semibold rounded-full px-2 py-0.5 tabular-nums ${
                            allGranted
                              ? "bg-orange-50 text-orange-600"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {selectedRole.is_super_admin
                            ? perms.length
                            : grantedInModule}
                          /{perms.length}
                        </span>
                        <ChevronDown
                          size={15}
                          className={`text-slate-400 transition-transform ${
                            isCollapsed ? "" : "rotate-180"
                          }`}
                        />
                      </div>
                    </button>
                    {!isCollapsed && (
                      <div className="divide-y divide-slate-100 border-t border-slate-100">
                        {perms.map((perm) => {
                          const isConnected = grantSet.has(
                            edgeKey(selectedRoleId, perm.id),
                          );
                          const isPending =
                            pendingEdgeKey === edgeKey(selectedRoleId, perm.id);
                          const disabled =
                            selectedRole.is_super_admin || isPending;
                          return (
                            <button
                              key={perm.id}
                              onClick={() => togglePermission(perm)}
                              disabled={disabled}
                              className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left ${
                                disabled ? "opacity-60" : "active:bg-slate-50"
                              }`}
                            >
                              <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">
                                {perm.permission_name}
                              </span>
                              {isPending ? (
                                <RefreshCw
                                  size={16}
                                  className="animate-spin text-slate-400 shrink-0"
                                />
                              ) : (
                                <span
                                  className={`shrink-0 relative w-10 h-6 rounded-full transition-colors ${
                                    isConnected || selectedRole.is_super_admin
                                      ? "bg-orange-500"
                                      : "bg-slate-200"
                                  }`}
                                >
                                  <span
                                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                      isConnected || selectedRole.is_super_admin
                                        ? "translate-x-4"
                                        : "translate-x-0.5"
                                    }`}
                                  />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Notification banner — success or error, slides down from the
          top like a native push notification, with a shrinking timer
          bar and tap-to-dismiss. Replaces the old bottom-right toast,
          which never rendered anything on failure (see catch blocks
          above — this is now the single place both paths report to). */}
      {notice && (
        <div
          key={noticeId}
          className="fixed z-50 inset-x-3 top-[calc(4.25rem+env(safe-area-inset-top))] sm:inset-x-auto sm:right-5 sm:top-5 sm:w-80 animate-[banner-in_0.25s_cubic-bezier(0.16,1,0.3,1)]"
        >
          <div
            className={`relative overflow-hidden rounded-2xl border shadow-lg backdrop-blur-sm ${
              noticeType === "error"
                ? "bg-red-50/95 border-red-100"
                : "bg-white/95 border-slate-200"
            }`}
          >
            <button
              onClick={() => setNotice(null)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  noticeType === "error"
                    ? "bg-red-100 text-red-600"
                    : "bg-orange-100 text-orange-600"
                }`}
              >
                {noticeType === "error" ? (
                  <AlertCircle size={15} />
                ) : (
                  <CheckCircle2 size={15} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs font-semibold ${
                    noticeType === "error" ? "text-red-700" : "text-slate-800"
                  }`}
                >
                  {noticeType === "error" ? "Couldn't update" : "Updated"}
                </p>
                <p className="text-[11px] text-slate-500 leading-snug">
                  {notice}
                </p>
              </div>
              <X size={14} className="text-slate-400 shrink-0 mt-0.5" />
            </button>
            <div
              key={`${noticeId}-bar`}
              className={`h-0.5 origin-left animate-[banner-shrink_3s_linear_forwards] ${
                noticeType === "error" ? "bg-red-400" : "bg-orange-400"
              }`}
            />
          </div>
        </div>
      )}

      <style>{`
        .wire-flow {
          animation: wire-flow-dash 0.9s linear infinite;
        }
        @keyframes wire-flow-dash {
          to { stroke-dashoffset: -22; }
        }
        @keyframes banner-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes banner-shrink {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
}
