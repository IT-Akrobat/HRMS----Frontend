// Auto-generated route list for the super-admin role.
// Add a page: create the component in ../pages/super-admin/, import it here, add a { path, element } entry.
//
// All page imports are React.lazy() so this role's pages only download
// when a super admin actually navigates to them, not upfront on login.
import { lazy } from "react";
import { commonRoutes } from "./commonRoutes.jsx";

const Dashboard = lazy(() => import("../pages/super-admin/Dashboard.jsx"));
const LeaveRequests = lazy(
  () => import("../pages/super-admin/LeaveRequests.jsx"),
);
const LiveTracking = lazy(
  () => import("../pages/super-admin/LiveTracking.jsx"),
);
const OrganizationDepartments = lazy(
  () => import("../pages/super-admin/OrganizationDepartments.jsx"),
);
const Reports = lazy(() => import("../pages/super-admin/Reports.jsx"));
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
const Users = lazy(() => import("../pages/super-admin/Users.jsx"));
const UsersPermissions = lazy(
  () => import("../pages/super-admin/UsersPermissions.jsx"),
);

export const superAdminRoutes = [
  { path: "dashboard", element: <Dashboard /> },
  ...commonRoutes,
  { path: "users", element: <Users /> },
  // { path: "users/roles", element: <UsersRoles /> },
  { path: "users/permissions", element: <UsersPermissions /> },
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
  { path: "attendance/live-tracking", element: <LiveTracking /> },
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
];
