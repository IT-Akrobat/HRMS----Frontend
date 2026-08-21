import { Navigate, Route, Routes } from "react-router-dom";

import InstallPrompt from "./components/common/InstallPrompt.jsx";
import ProtectedRoute from "./components/common/ProtectedRoute.jsx";
import DashboardLayout from "./components/layout/DashboardLayout.jsx";
import { DEFAULT_ROUTE_BY_ROLE, ROLES } from "./config/roles";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/auth/Login.jsx";

import { employeeRoutes } from "./routes/employeeRoutes.jsx";
import { hrAdminRoutes } from "./routes/hrAdminRoutes.jsx";
import { managerRoutes } from "./routes/managerRoutes.jsx";
import { superAdminRoutes } from "./routes/superAdminRoutes.jsx";

// Root path sends people to their own dashboard (or to login if signed out)
function RootRedirect() {
  const { isAuthenticated, role, loading } = useAuth();
  // Same reasoning as ProtectedRoute: on first mount, restoreSession()
  // hasn't resolved yet, so `user` (and therefore isAuthenticated) is
  // still its default `false`. Without this check, "/" -- which is
  // exactly where an installed PWA's start_url lands on every launch --
  // was bouncing straight to /login before the cookie/refresh-token
  // check even ran, regardless of whether the session was actually
  // still valid. Login.jsx has no logic to notice `user` becoming
  // truthy afterwards and send you back, so it looked like a real
  // logout every single time, not an occasional storage hiccup.
  if (loading) return null; // could render a splash/spinner here
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={DEFAULT_ROUTE_BY_ROLE[role]} replace />;
}

export default function App() {
  return (
    <>
      {/* Mounted once, outside <Routes>, so the "Install app" banner
          can appear on the login page itself -- right when someone
          opens the deploy link -- not just after signing in. */}
      <InstallPrompt />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RootRedirect />} />

        {/* Employee */}
        <Route
          path="/employee"
          element={
            <ProtectedRoute allowedRoles={[ROLES.EMPLOYEE]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {employeeRoutes.map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
        </Route>

        {/* Manager */}
        <Route
          path="/manager"
          element={
            <ProtectedRoute allowedRoles={[ROLES.MANAGER]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {managerRoutes.map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
        </Route>

        {/* HR Admin */}
        <Route
          path="/hr-admin"
          element={
            <ProtectedRoute allowedRoles={[ROLES.HR_ADMIN]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {hrAdminRoutes.map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
        </Route>

        {/* Super Admin */}
        <Route
          path="/super-admin"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {superAdminRoutes.map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
