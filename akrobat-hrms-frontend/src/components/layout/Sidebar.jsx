import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/images/akrobat-logo.png";
import {
  NAVIGATION_CONFIG,
  SELF_NAVIGATION_BY_ROLE,
} from "../../config/navigationConfig";
import {
  isSelfSpacePath,
  LEAVE_REQUEST_VIEWER_ROLES,
  ROLE_BASE_PATH,
  ROLES,
  SELF_SPACE_BY_ROLE,
} from "../../config/roles";
import { useAuth } from "../../context/AuthContext";
import { useIsDesktop } from "../../hooks/useBasePath";
import { isFieldEmployee } from "../../utils/employeeType";
import { isSiteEmployee } from "../../utils/workingLocation";

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
  // Navy sidebar theme for every role. To limit it to some roles, use e.g.
  // `const blue = role === ROLES.SUPER_ADMIN;`
  const blue = true;
  const location = useLocation();
  const navigate = useNavigate();
  // HR and Managers have two workspaces: "My Space" (employee-style menu
  // for their own attendance/leave/profile) and "Company" (the HR admin /
  // manager menu). Which one is active comes straight from the URL, so
  // refresh/back just work.
  const selfSpace = SELF_SPACE_BY_ROLE[role];
  const hasSwitch = !!selfSpace;
  const inMySpace = hasSwitch && isSelfSpacePath(role, location.pathname);
  // Items flagged `fieldOnly` (e.g. "Sites Worked") are shown only to
  // Inspection / Operation department staff.
  const showFieldOnly = isFieldEmployee(user);
  // Items flagged `hideForSite` (the Attendance tab) are hidden for
  // employees whose Working Location is exactly "Site".
  const siteEmployee = isSiteEmployee(user);
  // Memoised so `items` keeps a stable identity between renders. Previously
  // it was rebuilt on every render, which re-triggered the effect below each
  // time a group was clicked and snapped the menu back to the active group.
  // "Leave Requests" menu:
  //  - reporting managers (profile.is_reporting_manager, any role) see it
  //    AND can approve/reject their team's requests;
  //  - Manager / HR Admin / Super Admin always see it, but only as a
  //    viewer -- Approve/Reject buttons appear per request only where the
  //    backend sends can_decide = true (they are that employee's reporting
  //    manager), and update_leave_status enforces the same server-side.
  const isReportingManager = !!user?.profile?.is_reporting_manager;
  const canSeeLeaveRequests =
    isReportingManager || LEAVE_REQUEST_VIEWER_ROLES.includes(role);
  const isDesktop = useIsDesktop();
  const items = useMemo(
    () =>
      (inMySpace
        ? (SELF_NAVIGATION_BY_ROLE[role] ?? [])
        : (NAVIGATION_CONFIG[role] ?? [])
      )
        .filter((item) => !(item.hideForSite && siteEmployee))
        // Web-only dashboard tabs replace these items on desktop.
        .filter((item) => !(item.mobileOnly && isDesktop))
        .map((item) => {
          if (!item.children) return item;
          const children = item.children.filter(
            (c) =>
              (!c.fieldOnly || showFieldOnly) && !(c.mobileOnly && isDesktop),
          );
          // "Leave Requests" lives INSIDE the leave group (only when
          // canSeeLeaveRequests, see above):
          //  - Manager / HR Admin / Super Admin: first entry of "Leave
          //    Management", Company view only (never in My Space).
          //  - Employee: last entry of their own "Leave" group.
          const isCompanyLeaveGroup =
            !inMySpace &&
            role !== ROLES.EMPLOYEE &&
            item.label === "Leave Management";
          const isEmployeeLeaveGroup =
            role === ROLES.EMPLOYEE && item.label === "Leave";
          const leaveRequests = {
            label: "Leave Requests",
            path:
              role === ROLES.MANAGER
                ? "/manager/leave/pending"
                : `${ROLE_BASE_PATH[role]}/team-leave-requests`,
          };
          // HR and Super Admin already have "All Leave Requests" (company-wide,
          // with the MC tab) in their own nav, so the team-only link is not
          // added for them.
          if (
            !canSeeLeaveRequests ||
            role === ROLES.HR_ADMIN ||
            role === ROLES.SUPER_ADMIN
          )
            return { ...item, children };
          return {
            ...item,
            children: isCompanyLeaveGroup
              ? [leaveRequests, ...children]
              : isEmployeeLeaveGroup
                ? [...children, leaveRequests]
                : children,
          };
        }),
    [
      role,
      inMySpace,
      showFieldOnly,
      siteEmployee,
      canSeeLeaveRequests,
      selfSpace,
      isDesktop,
    ],
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
    // Route belongs to no dropdown group (Reports, Dashboard, Settings...)
    // -> collapse every open group instead of leaving the old one open.
    if (!activeItem) {
      setOpenGroups((prev) => {
        if (!Object.values(prev).some(Boolean)) return prev;
        const closed = {};
        items.forEach((i) => {
          if (i.children) closed[i.label] = false;
        });
        return closed;
      });
      return;
    }
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

  // Sidebar search: filters the menu by label (parent or sub-item).
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visibleItems = useMemo(() => {
    if (!q) return items;
    return items.flatMap((item) => {
      if (item.label.toLowerCase().includes(q)) return [item];
      if (!item.children) return [];
      const kids = item.children.filter((c) =>
        c.label.toLowerCase().includes(q),
      );
      return kids.length ? [{ ...item, children: kids }] : [];
    });
  }, [items, q]);

  // The desktop icon-rail "collapsed" toggle has no meaning inside the
  // mobile drawer (it's always full-width there) — whenever the drawer
  // is actually open, force labels on regardless of the desktop state.
  const effectiveCollapsed = mobileOpen ? false : collapsed;

  // Clicking a group (My Profile, Attendance, Leave, Team...):
  //  - it opens the group's FIRST page straight away and opens its submenu,
  //    so one click is enough (no extra click on the sub-item);
  //  - if the group is already open and you're on one of its pages, the
  //    click just collapses it, so it can still be closed;
  //  - on the collapsed icon rail it also expands the sidebar.
  const handleGroupClick = (item) => {
    const first = item.children?.[0];
    const isOpenNow = !!openGroups[item.label];
    const onOwnPage = isChildActive(item.children, location.pathname);

    if (!effectiveCollapsed && isOpenNow && onOwnPage) {
      toggleGroup(item.label);
      return;
    }

    if (first?.path) navigate(first.path);
    setOpenGroups(() => {
      const next = {};
      items.forEach((i) => {
        if (i.children) next[i.label] = i.label === item.label;
      });
      return next;
    });
    if (effectiveCollapsed && collapsed) onToggleCollapse?.();
    onCloseMobile?.();
  };

  // EXACT match - only ONE child will match
  const isExactChildActive = (childPath) => {
    return (
      location.pathname === childPath || location.pathname === childPath + "/"
    );
  };

  const itemBase = `flex items-center gap-3.5 py-2.5 my-1 rounded-r-full hrms-sidebar-item transition-colors ${
    effectiveCollapsed ? "justify-center px-0" : "pl-6 pr-4"
  }`;
  const itemActive = blue
    ? "bg-gradient-to-r from-orange-400 to-orange-600 text-white shadow-[0_6px_16px_rgba(0,0,0,0.25)]"
    : "bg-gradient-to-r from-orange-400 to-orange-600 text-white shadow-[0_6px_14px_rgba(245,115,11,0.35)]";
  const itemIdle = blue
    ? "text-blue-100/90 hover:bg-white/10 hover:text-white"
    : "text-slate-500 hover:bg-orange-50 hover:text-orange-600";

  // My Space / Company options, shared by the web circles (next to the logo)
  // and the pill (mobile drawer + collapsed rail).
  const switchOptions = hasSwitch
    ? [
        {
          key: "me",
          label: "My Space",
          short: "PROF",
          icon: User,
          active: inMySpace,
          to: `${selfSpace.base}/dashboard`,
        },
        {
          key: "company",
          label: "Company",
          short: "CMPY",
          icon: Building2,
          active: !inMySpace,
          to: selfSpace.companyHome,
        },
      ]
    : [];

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
        className={`h-screen flex flex-col ${
          blue
            ? "bg-[#0b1f45] text-blue-100 shadow-[6px_0_30px_rgba(11,31,69,0.35)]"
            : "bg-white text-slate-500 shadow-[6px_0_30px_rgba(11,24,48,0.10)]"
        } rounded-r-[2.5rem] transition-all duration-200 fixed inset-y-0 left-0 z-40 w-[240px] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:sticky lg:top-0 lg:z-30 ${
          collapsed ? "lg:w-[72px]" : "lg:w-[240px]"
        }`}
      >
        {/* Logo */}
        <div
          className={`flex items-center justify-between gap-2 shrink-0 ${
            effectiveCollapsed
              ? "justify-center px-2 pt-6 pb-4"
              : "px-6 pt-6 pb-4"
          }`}
        >
          <span className="contents">
            <img
              src={logo}
              alt="Akrobat"
              className={`object-contain shrink-0 transition-all ${
                effectiveCollapsed
                  ? "w-10 h-10"
                  : blue
                    ? "h-20 w-auto max-w-[170px]"
                    : "h-12 w-auto max-w-[150px]"
              }`}
            />
          </span>
          {/* WEB (lg+, expanded sidebar): My Space / Company as two small
              overlapping circles on the right of the logo. The active one
              sits on top. Mobile drawer + collapsed rail keep the pill. */}
          {hasSwitch && !effectiveCollapsed && (
            <div className="hidden lg:flex items-center shrink-0 pl-2">
              {switchOptions.map(({ key, label, short, active, to }, i) => (
                <button
                  key={key}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-pressed={active}
                  onClick={() => {
                    if (!active) navigate(to);
                    onCloseMobile();
                  }}
                  className={`h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold tracking-wide transition-all ${
                    i > 0 ? "-ml-3" : ""
                  } ${
                    active
                      ? "z-10 bg-white text-orange-600 ring-2 ring-orange-500 shadow-md"
                      : blue
                        ? "bg-[#1a3566] text-blue-100 ring-2 ring-[#0b1f45] hover:text-white"
                        : "bg-slate-100 text-slate-500 ring-2 ring-white hover:text-slate-700"
                  }`}
                >
                  {short}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={onCloseMobile}
            className={`lg:hidden p-1 ${blue ? "text-blue-100 hover:text-white" : "text-slate-400 hover:text-slate-700"}`}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Collapse toggle -- round orange button sitting on the right edge */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden lg:flex absolute -right-3.5 top-24 h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-white shadow-md hover:bg-orange-600 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* HR + Manager: switch between My Space (own employee-style menu)
            and Company (HR admin / manager menu). Collapsed rail shows just
            the icons. */}
        {hasSwitch && (
          <div
            className={`shrink-0 mx-4 mb-2 p-1 rounded-full ${blue ? "bg-white/10" : "bg-slate-100"} ${
              effectiveCollapsed
                ? "flex flex-col gap-1"
                : "flex gap-1 lg:hidden"
            }`}
          >
            {switchOptions.map(
              ({ key, label, icon: SwitchIcon, active, to }) => (
                <button
                  key={key}
                  type="button"
                  title={label}
                  aria-pressed={active}
                  onClick={() => {
                    if (!active) navigate(to);
                    onCloseMobile();
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-white text-orange-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <SwitchIcon size={14} className="shrink-0" />
                  {!effectiveCollapsed && <span>{label}</span>}
                </button>
              ),
            )}
          </div>
        )}

        {/* Search */}
        <div className={effectiveCollapsed ? "px-0" : "px-6"}>
          {effectiveCollapsed ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Search menu"
              className={`w-full flex justify-center py-2.5 ${blue ? "text-blue-100 hover:text-white" : "text-slate-400 hover:text-orange-600"}`}
            >
              <Search size={20} strokeWidth={1.75} />
            </button>
          ) : (
            <label className="flex items-center gap-3.5 py-2.5 cursor-text">
              <Search
                size={20}
                strokeWidth={1.75}
                className={`shrink-0 ${blue ? "text-blue-100" : "text-slate-400"}`}
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className={`w-full min-w-0 bg-transparent border-0 p-0 text-sm outline-none focus:outline-none focus:ring-0 ${
                  blue
                    ? "text-white placeholder-blue-200/80"
                    : "text-slate-600 placeholder-slate-400"
                }`}
              />
            </label>
          )}
          <div
            className={`border-b ${blue ? "border-white/15" : "border-slate-100"}`}
          />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto sidebar-scroll py-2 pr-3">
          {visibleItems.length === 0 && !effectiveCollapsed && (
            <p
              className={`px-6 py-3 text-xs ${blue ? "text-blue-200" : "text-slate-400"}`}
            >
              No results
            </p>
          )}
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = !!item.children;
            const isChildActiveNow =
              hasChildren && isChildActive(item.children, location.pathname);
            const isParentActive = hasChildren
              ? isChildActiveNow
              : location.pathname === item.path ||
                location.pathname === item.path + "/";
            const isOpen = q ? true : openGroups[item.label];

            if (!hasChildren) {
              return (
                <NavLink
                  key={item.label}
                  to={item.path}
                  // "Users" (/users) must not stay active on its sibling
                  // "User Permissions" (/users/permissions): match exactly
                  // when another item's path sits under this one.
                  end={visibleItems.some(
                    (o) =>
                      o !== item &&
                      o.path &&
                      o.path.startsWith(item.path + "/"),
                  )}
                  title={effectiveCollapsed ? item.label : undefined}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    `${itemBase} ${isActive ? itemActive : itemIdle}`
                  }
                >
                  <Icon size={20} strokeWidth={1.75} className="shrink-0" />
                  {!effectiveCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </NavLink>
              );
            }

            return (
              <div key={item.label}>
                <button
                  type="button"
                  title={effectiveCollapsed ? item.label : undefined}
                  onClick={() => handleGroupClick(item)}
                  className={`w-full ${itemBase} ${
                    isParentActive ? itemActive : itemIdle
                  }`}
                >
                  <Icon size={20} strokeWidth={1.75} className="shrink-0" />
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
                  <div
                    className={`ml-[2.1rem] mt-0.5 mb-1 border-l pl-0 flex flex-col gap-0.5 ${blue ? "border-white/25" : "border-slate-200"}`}
                  >
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
                          className={`relative px-4 py-1.5 rounded-md hrms-sidebar-subitem truncate transition-colors flex items-center ${
                            isChildActive
                              ? blue
                                ? "text-orange-300 font-semibold"
                                : "text-orange-600 font-medium"
                              : blue
                                ? "text-blue-100/80 hover:text-white"
                                : "text-slate-500 hover:text-orange-600"
                          }`}
                        >
                          {/* Vertical line indicator - only for exact match */}
                          <span
                            className={`absolute -left-px top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full transition-all ${
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

        <div className="h-4 shrink-0" />
      </aside>
    </>
  );
}
