import { Navigate, useLocation } from "react-router-dom";
import { DEFAULT_ROUTE_BY_ROLE } from "../../config/roles";
import { useAuth } from "../../context/AuthContext";

// Same spinner shown by App.jsx's RouteLoadingFallback -- kept as a tiny
// local copy (no shared import) so this file doesn't pull in App.jsx
// just for one div; see App.jsx for why this exists and why `return
// null` here was a real bug, not just a cosmetic one.
function AuthLoadingFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0b1f45] border-t-transparent" />
    </div>
  );
}

/**
 * Wrap any route element with this.
 * - allowedRoles omitted  -> any logged-in user can view it
 * - allowedRoles provided -> only those roles can view it; others get
 *   redirected to their own dashboard (not to login, since they ARE logged in)
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  // `loading` covers the initial GET /auth/me session restore, which can
  // legitimately take up to ~45s (longer with its own internal retry) on
  // a cold-starting free-tier backend -- see authService.js. This used
  // to `return null` for that whole window: a blank white screen with no
  // feedback, easy to mistake for the app being frozen, which is exactly
  // what led people to reload repeatedly instead of just waiting it out.
  if (loading) return <AuthLoadingFallback />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={DEFAULT_ROUTE_BY_ROLE[role] ?? "/login"} replace />;
  }

  return children;
}
