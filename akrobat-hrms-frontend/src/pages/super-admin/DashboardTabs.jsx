import { Clock, KeyRound, LayoutDashboard, MapPin, Users } from "lucide-react";
import { Suspense, lazy, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useIsDesktop } from "../../hooks/useBasePath";

// Super Admin dashboard shell: 5 tabs inside the Dashboard page itself.
// Users / Live Tracking / Permissions / OT Calculator used to be separate sidebar
// pages -- they are now tabs here. The active tab lives in the URL
// (?tab=...) so refresh, back button and shared links keep working.
// Each tab is lazy-loaded and only the active one is mounted, so the
// Overview's live polling stops while you are on another tab.

const Overview = lazy(() => import("./Dashboard.jsx"));
const UsersPage = lazy(() => import("./Users.jsx"));
const LiveTracking = lazy(
  () => import("../shared/live-tracking/LiveTracking.jsx"),
);
const UsersPermissions = lazy(() => import("./UsersPermissions.jsx"));
const OtCalculator = lazy(
  () => import("../shared/ot-calculator/OtCalculator.jsx"),
);

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, Comp: Overview },
  { key: "users", label: "Users", icon: Users, Comp: UsersPage },
  {
    key: "permissions",
    label: "User Permissions",
    icon: KeyRound,
    Comp: UsersPermissions,
  },
  {
    key: "ot-calculator",
    label: "OT Calculator",
    icon: Clock,
    Comp: OtCalculator,
  },
  {
    key: "live-tracking",
    label: "Live Site Tracking",
    icon: MapPin,
    Comp: LiveTracking,
  },
];

export default function SuperAdminDashboardTabs() {
  const isDesktop = useIsDesktop();
  const [params, setParams] = useSearchParams();
  // Right side of the tab line. Overview portals its Create User / Create
  // Site / Leave Balance buttons into this element.
  const [actionsSlot, setActionsSlot] = useState(null);
  const active = TABS.find((t) => t.key === params.get("tab")) || TABS[0];
  const ActiveComp = active.Comp;

  function selectTab(key) {
    if (key === active.key) return;
    // Overview = clean /dashboard URL; others get ?tab=...
    setParams(key === "overview" ? {} : { tab: key }, { replace: false });
  }

  // Mobile keeps the original dashboard: no tabs (the sidebar has the
  // separate Users / Permissions / Live Tracking / OT Calculator pages).
  if (!isDesktop) {
    return (
      <Suspense
        fallback={
          <div className="py-12 text-center text-slate-500">Loading...</div>
        }
      >
        <Overview />
      </Suspense>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Dashboard sections"
          className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map(({ key, label, icon: Icon }) => {
            const isActive = key === active.key;
            return (
              <button
                key={key}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => selectTab(key)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  isActive
                    ? "border-[#0b1d45] bg-[#0b1d45] text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>
        <div
          ref={setActionsSlot}
          className="hidden shrink-0 items-center gap-2 lg:flex"
        />
      </div>

      <Suspense
        fallback={
          <div className="py-12 text-center text-slate-500">Loading...</div>
        }
      >
        <ActiveComp key={active.key} actionsSlot={actionsSlot} />
      </Suspense>
    </div>
  );
}
