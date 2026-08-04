// import { AlertTriangle } from "lucide-react";
// import { useState } from "react";
// import { Outlet, useNavigate } from "react-router-dom";
// import { useAuth } from "../../context/AuthContext";
// import Header from "./Header";
// import Sidebar from "./Sidebar";

// export default function DashboardLayout() {
//   const [collapsed, setCollapsed] = useState(false);
//   const { user } = useAuth();
//   const navigate = useNavigate();

//   return (
//     <div className="flex min-h-screen bg-slate-50">
//       <Sidebar
//         collapsed={collapsed}
//         onToggleCollapse={() => setCollapsed((c) => !c)}
//       />
//       <div className="flex-1 min-w-0 flex flex-col">
//         <Header />
//         <main className="flex-1 p-3">
//           {/* Real, working password expiry (see Access Control >
//               Password policy > Password expiry, enforced backend-side
//               in app/auth/services.py::login_user against
//               user_profiles.password_changed_at). There's no pre-login
//               reset flow, so an expired password doesn't block sign-in —
//               this banner is the enforcement: it won't go away until the
//               password is actually changed via Settings > Security,
//               which resets the clock. */}
//           {user?.passwordExpired && (
//             <div className="mb-3 flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800">
//               <div className="flex items-center gap-2">
//                 <AlertTriangle size={15} className="shrink-0" />
//                 Your password has expired. Please update it to keep using your
//                 account.
//               </div>
//               <button
//                 onClick={() => navigate(`${user.redirectPath || ""}/settings`)}
//                 className="text-xs font-medium text-amber-900 border border-amber-300 rounded-md px-3 py-1 hover:bg-amber-100 shrink-0"
//               >
//                 Change password
//               </button>
//             </div>
//           )}
//           <Outlet />
//         </main>
//       </div>
//     </div>
//   );
// }
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
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

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 p-3">
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
    </div>
  );
}
