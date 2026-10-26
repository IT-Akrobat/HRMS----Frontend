// Auto-generated route list for the super-admin role.
// Add a page: create the component in ../pages/super-admin/, import it here, add a { path, element } entry.
//
// All page imports are React.lazy() so this role's pages only download
// when a super admin actually navigates to them, not upfront on login.
import { lazy } from "react";
import { Navigate } from "react-router-dom";
import { useIsDesktop } from "../hooks/useBasePath";
import { commonRoutes } from "./commonRoutes.jsx";

// On web (lg+) these pages live inside the Dashboard tabs, so their old URLs
// redirect to the matching tab. On mobile they stay normal pages.
function WebTabRedirect({ tab, children }) {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return <Navigate to={`/super-admin/dashboard?tab=${tab}`} replace />;
  }
  return children;
}

// Dashboard page = 5 tabs (Overview / Users / Live Tracking / User
// Permissions / OT Calculator). Those pages are no longer separate sidebar routes.
const Dashboard = lazy(() => import("../pages/super-admin/DashboardTabs.jsx"));
const Users = lazy(() => import("../pages/super-admin/Users.jsx"));
const UsersPermissions = lazy(
  () => import("../pages/super-admin/UsersPermissions.jsx"),
);
const LiveTracking = lazy(
  () => import("../pages/shared/live-tracking/LiveTracking.jsx"),
);
const OtCalculator = lazy(
  () => import("../pages/shared/ot-calculator/OtCalculator.jsx"),
);
const LeaveRequests = lazy(
  () => import("../pages/super-admin/LeaveRequests.jsx"),
);
const LeaveBalance = lazy(() => import("../pages/hr-admin/LeaveBalance.jsx"));
const OrganizationDepartments = lazy(
  () => import("../pages/super-admin/OrganizationDepartments.jsx"),
);
const Reports = lazy(() => import("../pages/super-admin/Reports.jsx"));
const ResignedEmployees = lazy(
  () => import("../pages/super-admin/ResignedEmployees.jsx"),
);
const ResignedEmployeeDetail = lazy(
  () => import("../pages/super-admin/ResignedEmployeeDetail.jsx"),
);
const SecurityAccessControl = lazy(
  () => import("../pages/super-admin/SecurityAccessControl.jsx"),
);
const SecurityAuditLogs = lazy(
  () => import("../pages/super-admin/SecurityAuditLogs.jsx"),
);
const SecurityLoginActivity = lazy(
  () => import("../pages/super-admin/SecurityLoginActivity.jsx"),
);
const SystemSettingsConfigurations = lazy(
  () => import("../pages/super-admin/SystemSettingsConfigurations.jsx"),
);
// System Settings > Integrations removed -- commented out in
// navigationConfig.js, page file no longer exists under ../pages/super-admin/.

export const superAdminRoutes = [
  { path: "dashboard", element: <Dashboard /> },
  ...commonRoutes,
  {
    path: "users",
    element: (
      <WebTabRedirect tab="users">
        <Users />
      </WebTabRedirect>
    ),
  },
  // { path: "users/roles", element: <UsersRoles /> },
  // Old links still work -- they redirect to the matching dashboard tab.
  {
    path: "users/permissions",
    element: (
      <WebTabRedirect tab="permissions">
        <UsersPermissions />
      </WebTabRedirect>
    ),
  },
  // {
  //   path: "organization/company-profile",
  //   element: <OrganizationCompanyProfile />,
  // },
  {
    path: "organization/departments",
    element: <OrganizationDepartments />,
  },
  // { path: "organization/locations", element: <OrganizationLocations /> },
  // { path: "employees", element: <Employees /> },
  // { path: "employees/hr-admins", element: <EmployeesHrAdmins /> },
  // { path: "employees/managers", element: <EmployeesManagers /> },
  { path: "leave/requests", element: <LeaveRequests /> },
  { path: "leave/balance", element: <LeaveBalance /> },
  {
    path: "attendance/live-tracking",
    element: (
      <WebTabRedirect tab="live-tracking">
        <LiveTracking />
      </WebTabRedirect>
    ),
  },
  {
    path: "attendance/ot-calculator",
    element: (
      <WebTabRedirect tab="ot-calculator">
        <OtCalculator />
      </WebTabRedirect>
    ),
  },
  { path: "security/login-activity", element: <SecurityLoginActivity /> },
  { path: "security/audit-logs", element: <SecurityAuditLogs /> },
  { path: "security/access-control", element: <SecurityAccessControl /> },
  {
    path: "system-settings/configurations",
    element: <SystemSettingsConfigurations />,
  },
  // {
  //   path: "system-settings/integrations",
  //   element: <SystemSettingsIntegrations />,
  // },
  { path: "reports", element: <Reports /> },
  { path: "resigned-employees", element: <ResignedEmployees /> },
  { path: "resigned-employees/:id", element: <ResignedEmployeeDetail /> },
];
