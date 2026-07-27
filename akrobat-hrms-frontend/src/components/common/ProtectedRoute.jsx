import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DEFAULT_ROUTE_BY_ROLE } from '../../config/roles';

/**
 * Wrap any route element with this.
 * - allowedRoles omitted  -> any logged-in user can view it
 * - allowedRoles provided -> only those roles can view it; others get
 *   redirected to their own dashboard (not to login, since they ARE logged in)
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  if (loading) return null; // could render a splash/spinner here

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={DEFAULT_ROUTE_BY_ROLE[role] ?? '/login'} replace />;
  }

  return children;
}
