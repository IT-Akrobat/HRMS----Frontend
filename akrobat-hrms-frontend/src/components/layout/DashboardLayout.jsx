import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import BirthdayWish from "../common/Birthdaywish";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  // Mobile-only slide-in drawer state — the sidebar is fixed/off-canvas
  // below the lg breakpoint (see Sidebar.jsx) and toggled via the
  // hamburger button in the Header. Has no effect at lg and up, where
  // the sidebar is always visible exactly as before.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  // Employee dashboard on mobile paints a gradient behind the whole header
  // (top bar included). Only this route; every other page is unchanged.
  const { pathname } = useLocation();
  const cleanPath = pathname.replace(/\/$/, "");
  const overHero =
    cleanPath === "/employee/dashboard" ||
    cleanPath === "/hr-admin/me/dashboard" ||
    /^\/[^/]+(\/me)?\/profile\/(personal|my-profile)$/.test(cleanPath);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col relative">
        {overHero && (
          <div
            aria-hidden="true"
            className="lg:hidden absolute inset-x-0 top-0 z-0 h-[230px] overflow-hidden bg-gradient-to-b from-[#0e1a45] via-[#1e2552] via-40% to-[#7a5558]"
          >
            <span className="absolute -top-10 right-8 w-24 h-24 rounded-full bg-white/10" />
            <span className="absolute -bottom-3 left-4 w-20 h-20 rounded-t-xl bg-white/[0.07]" />
            <span className="absolute -bottom-3 right-4 w-24 h-28 rounded-t-2xl bg-white/[0.07]" />
          </div>
        )}
        <Header
          overHero={overHero}
          onMenuClick={() => setMobileSidebarOpen(true)}
        />
        <main className="flex-1 p-3 relative z-10">
          {/* Real, working password expiry (see Access Control >
              Password policy > Password expiry, enforced backend-side
              in app/auth/services.py::login_user against
              user_profiles.password_changed_at). There's no pre-login
              reset flow, so an expired password doesn't block sign-in —
              this banner is the enforcement: it won't go away until the
              password is actually changed via Settings > Security,
              which resets the clock. */}
          {user?.passwordExpired && (
            <div className="mb-3 flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                Your password has expired. Please update it to keep using your
                account.
              </div>
              <button
                onClick={() => navigate(`${user.redirectPath || ""}/settings`)}
                className="text-xs font-medium text-amber-900 border border-amber-300 rounded-md px-3 py-1 hover:bg-amber-100 shrink-0"
              >
                Change password
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {/* Floating "Happy Birthday" badge for the signed-in user — see
          src/components/common/Birthdaywish.jsx for the once-per-year,
          client-side date_of_birth check. No-ops (renders null) on any
          day that isn't the current user's birthday. */}
      <BirthdayWish />
    </div>
  );
}
