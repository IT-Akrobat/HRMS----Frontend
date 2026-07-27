import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/auth/Login.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import ProtectedRoute from './components/common/ProtectedRoute.jsx';
import { ROLES } from './config/roles';
import { useAuth } from './context/AuthContext';
import { DEFAULT_ROUTE_BY_ROLE } from './config/roles';

import { employeeRoutes } from './routes/employeeRoutes.jsx';
import { managerRoutes } from './routes/managerRoutes.jsx';
import { hrAdminRoutes } from './routes/hrAdminRoutes.jsx';
import { superAdminRoutes } from './routes/superAdminRoutes.jsx';

// Root path sends people to their own dashboard (or to login if signed out)
function RootRedirect() {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={DEFAULT_ROUTE_BY_ROLE[role]} replace />;
}

export default function App() {
  return (
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
  );
}
