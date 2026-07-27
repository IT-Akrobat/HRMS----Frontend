import {
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
  Users
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
  const [notice, setNotice] = useState(null);

  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [grants, setGrants] = useState([]);

  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [hoveredRoleId, setHoveredRoleId] = useState(null);
  const [selectedPermissionId, setSelectedPermissionId] = useState(null);
  const [pendingEdgeKey, setPendingEdgeKey] = useState(null);

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");

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
  }, [notice]);

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
      setNotice(
        `${permission.permission_name} ${isGranted ? "disconnected from" : "wired to"} ${selectedRole.role_name}`,
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
      setError(e.message || "Could not update that connection.");
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
      <div className="bg-[#0B1830] rounded-2xl border border-[#152847] overflow-hidden">
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

      {/* Toast */}
      {notice && (
        <div className="fixed bottom-5 right-5 bg-[#0B1830] text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg border border-white/10 z-50">
          {notice}
        </div>
      )}

      <style>{`
        .wire-flow {
          animation: wire-flow-dash 0.9s linear infinite;
        }
        @keyframes wire-flow-dash {
          to { stroke-dashoffset: -22; }
        }
      `}</style>
    </div>
  );
}
