// Routes that are the same for every role, defined once here and mounted
// under each role's path in App.jsx -- the same way config/navigationConfig.js
// is one shared file that Sidebar.jsx reads per-role, instead of copying
// sidebar entries into every role's file.
//
// Add a page here: create the component in ../pages/shared/, import it,
// add a { path, element } entry -- it will automatically be available
// under /employee, /manager, /hr-admin AND /super-admin.
//
// Lazy-loaded like the role-specific route files -- these are mounted
// under every role, so eagerly importing them would mean they load on
// every login regardless of role, same problem as before just at a
// smaller scale.
import { lazy } from "react";
import { Navigate } from "react-router-dom";
import {
  DEFAULT_ROUTE_BY_ROLE,
  LEAVE_REQUEST_VIEWER_ROLES,
} from "../config/roles";
import { useAuth } from "../context/AuthContext";

// "Leave Requests" page: reporting managers (profile.is_reporting_manager,
// from GET /auth/me, any role) plus Manager / HR Admin / Super Admin, who
// get it as viewers. Approve/Reject is NOT decided here -- the page only
// shows those buttons where the backend says can_decide, i.e. the user is
// that employee's reporting manager. Anyone else who types the URL by hand
// is sent back to their own dashboard.
export function RequireReportingManager({ children }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0b1f45] border-t-transparent" />
      </div>
    );
  }

  if (
    !user?.profile?.is_reporting_manager &&
    !LEAVE_REQUEST_VIEWER_ROLES.includes(role)
  ) {
    return <Navigate to={DEFAULT_ROUTE_BY_ROLE[role] ?? "/login"} replace />;
  }
  return children;
}

const LeaveApply = lazy(() => import("../pages/shared/LeaveApply.jsx"));
const SaturdaySwap = lazy(() => import("../pages/shared/SaturdaySwap.jsx"));
const LeavePending = lazy(() => import("../pages/manager/LeavePending.jsx"));
const MyProfile = lazy(() => import("../pages/shared/MyProfile.jsx"));
const Notifications = lazy(() => import("../pages/shared/Notifications.jsx"));
const Settings = lazy(() => import("../pages/shared/Settings.jsx"));
// Settings and Notifications used to be duplicated per role (Employee had
// a real implementation of each; Manager/HR Admin/Super Admin mostly had
// empty PlaceholderPage stand-ins). Neither page is actually role-specific
// -- account settings and the notification inbox work the same way for any
// logged-in user -- so they're defined once here, same as My Profile, and
// mounted under every role automatically.
//
// Apply Leave moved here for the same reason: HR Admin and Manager users
// are employees too and previously had no self-service way to apply for
// their own leave (Replacement Leave included) -- only view/approve
// pages for their team. It now lives at ../pages/shared/LeaveApply.jsx
// and builds its own role-aware "back to Leave History" link instead of
// assuming /employee.
export const commonRoutes = [
  { path: "profile/personal", element: <MyProfile /> },
  { path: "profile/my-profile", element: <MyProfile /> },
  { path: "settings", element: <Settings /> },
  { path: "notifications", element: <Notifications /> },
  { path: "leave/apply", element: <LeaveApply /> },
  // Skip a regular working Saturday, work an off Saturday instead. Also where
  // a reporting manager approves/rejects their team's swap requests.
  { path: "leave/saturday-swap", element: <SaturdaySwap /> },
  // "Leave Requests": reporting managers only.
  {
    path: "team-leave-requests",
    element: (
      <RequireReportingManager>
        <LeavePending />
      </RequireReportingManager>
    ),
  },
];

// HR's "My Space" workspace (/hr-admin/me/*) needs the same self-service
// pages, so they are mounted a second time under the "me/" prefix.
export const selfCommonRoutes = commonRoutes.map((r) => ({
  ...r,
  path: `me/${r.path}`,
}));
