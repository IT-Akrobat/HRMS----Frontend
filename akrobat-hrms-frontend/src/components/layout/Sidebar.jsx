import {
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import logo from "../../assets/images/akrobat-logo.png";
import { NAVIGATION_CONFIG } from "../../config/navigationConfig";
import { useAuth } from "../../context/AuthContext";
import { isFieldEmployee } from "../../utils/employeeType";

function isChildActive(children, pathname) {
  // EXACT match only - NO startsWith
  return children?.some((c) => {
    return pathname === c.path || pathname === c.path + "/";
  });
}

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile = () => {},
}) {
  const { role, user } = useAuth();
  const location = useLocation();
  // Items flagged `fieldOnly` (e.g. "Sites Worked") are shown only to
  // Inspection / Operation department staff.
  const showFieldOnly = isFieldEmployee(user);
  // Memoised so `items` keeps a stable identity between renders. Previously
  // it was rebuilt on every render, which re-triggered the effect below each
  // time a group was clicked and snapped the menu back to the active group.
  const items = useMemo(
    () =>
      (NAVIGATION_CONFIG[role] ?? []).map((item) =>
        item.children
          ? {
              ...item,
              children: item.children.filter(
                (c) => !c.fieldOnly || showFieldOnly,
              ),
            }
          : item,
      ),
    [role, showFieldOnly],
  );

  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    let foundActive = false;
    items.forEach((item) => {
      if (item.children && isChildActive(item.children, location.pathname)) {
        initial[item.label] = true;
        foundActive = true;
      }
    });
    if (!foundActive && items.length > 0 && items[0].children) {
      initial[items[0].label] = true;
    }
    return initial;
  });

  // Auto-open the group that owns the current route -- only when the route
  // changes. Manual clicks on a group header must NOT re-run this, otherwise
  // the active group fights with the one the user just opened (the glitch).
  useEffect(() => {
    const activeItem = items.find(
      (item) =>
        item.children && isChildActive(item.children, location.pathname),
    );
    if (!activeItem) return;
    setOpenGroups((prev) => {
      // Already the only open group -> keep same state object (no re-render)
      const alreadyOk = items.every(
        (i) =>
          !i.children || !!prev[i.label] === (i.label === activeItem.label),
      );
      if (alreadyOk) return prev;
      const next = {};
      items.forEach((i) => {
        if (i.children) next[i.label] = i.label === activeItem.label;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleGroup = (label) => {
    setOpenGroups((prev) => {
      if (prev[label]) {
        return { ...prev, [label]: false };
      }
      const newState = {};
      items.forEach((item) => {
        if (item.children) {
          newState[item.label] = false;
        }
      });
      newState[label] = true;
      return newState;
    });
  };

  // The desktop icon-rail "collapsed" toggle has no meaning inside the
  // mobile drawer (it's always full-width there) — whenever the drawer
  // is actually open, force labels on regardless of the desktop state.
  const effectiveCollapsed = mobileOpen ? false : collapsed;

  // EXACT match - only ONE child will match
  const isExactChildActive = (childPath) => {
    return (
      location.pathname === childPath || location.pathname === childPath + "/"
    );
  };

  return (
    <>
      {/* Backdrop — mobile only, closes the drawer on tap outside */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`h-screen flex flex-col bg-sidebar text-slate-200 transition-all duration-200 fixed inset-y-0 left-0 z-40 w-[240px] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:sticky lg:top-0 lg:z-auto ${
          collapsed ? "lg:w-[64px]" : "lg:w-[212px]"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between gap-2 px-3 h-14 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Akrobat"
              className={`object-contain shrink-0 transition-all ${
                effectiveCollapsed ? "w-9 h-8" : "w-9 h-9"
              }`}
            />
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden text-slate-300 hover:text-white p-1"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto sidebar-scroll py-2 px-1.5">
          {items.map((item) => {
            const Icon = item.icon;
            const hasChildren = !!item.children;
            const isChildActiveNow =
              hasChildren && isChildActive(item.children, location.pathname);
            const isParentActive = hasChildren
              ? isChildActiveNow
              : location.pathname === item.path ||
                location.pathname === item.path + "/";
            const isOpen = openGroups[item.label];

            if (!hasChildren) {
              return (
                <NavLink
                  key={item.label}
                  to={item.path}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2.5 py-2 my-0.5 rounded-md hrms-sidebar-item ${
                      isActive
                        ? "bg-orange-500/20 text-orange-400"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`
                  }
                >
                  <Icon size={16} className="shrink-0" />
                  {!effectiveCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </NavLink>
              );
            }

            return (
              <div key={item.label} className="my-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.label)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hrms-sidebar-item ${
                    isParentActive
                      ? "bg-orange-500/10 text-orange-400"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                  {!effectiveCollapsed && (
                    <>
                      <span className="flex-1 text-left truncate">
                        {item.label}
                      </span>
                      {isOpen ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                    </>
                  )}
                </button>

                {!effectiveCollapsed && isOpen && (
                  <div className="ml-5 mt-0.5 border-l border-white/10 pl-0 flex flex-col gap-0.5">
                    {item.children.map((child) => {
                      // EXACT match - this is the key fix!
                      const isChildActive = isExactChildActive(child.path);

                      return (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          onClick={onCloseMobile}
                          // DON'T use the isActive from NavLink for styling
                          // Use our own exact match check
                          className={`relative px-3 py-1.5 rounded-md hrms-sidebar-subitem truncate transition-colors flex items-center ${
                            isChildActive
                              ? "text-orange-400 font-medium"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {/* Vertical line indicator - only for exact match */}
                          <span
                            className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full transition-all ${
                              isChildActive ? "bg-orange-500" : "bg-transparent"
                            }`}
                          />
                          {child.label}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden lg:flex items-center gap-2 px-3 h-10 border-t border-white/10 text-slate-400 hover:text-white hrms-sidebar-item shrink-0"
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </aside>
    </>
  );
}
