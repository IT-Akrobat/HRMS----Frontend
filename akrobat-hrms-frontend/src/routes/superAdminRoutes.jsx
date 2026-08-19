// // Auto-generated route list for the super-admin role.
// // Add a page: create the component in ../pages/super-admin/, import it here, add a { path, element } entry.
// import React from 'react';
// import Dashboard from '../pages/super-admin/Dashboard.jsx';
// import Users from '../pages/super-admin/Users.jsx';
// import UsersRoles from '../pages/super-admin/UsersRoles.jsx';
// import UsersPermissions from '../pages/super-admin/UsersPermissions.jsx';
// import OrganizationCompanyProfile from '../pages/super-admin/OrganizationCompanyProfile.jsx';
// import OrganizationDepartments from '../pages/super-admin/OrganizationDepartments.jsx';
// import OrganizationLocations from '../pages/super-admin/OrganizationLocations.jsx';
// import Employees from '../pages/super-admin/Employees.jsx';
// import EmployeesHrAdmins from '../pages/super-admin/EmployeesHrAdmins.jsx';
// import EmployeesManagers from '../pages/super-admin/EmployeesManagers.jsx';
// import SecurityLoginActivity from '../pages/super-admin/SecurityLoginActivity.jsx';
// import SecurityAuditLogs from '../pages/super-admin/SecurityAuditLogs.jsx';
// import SecurityAccessControl from '../pages/super-admin/SecurityAccessControl.jsx';
// import SystemSettingsConfigurations from '../pages/super-admin/SystemSettingsConfigurations.jsx';
// import SystemSettingsIntegrations from '../pages/super-admin/SystemSettingsIntegrations.jsx';
// import Reports from '../pages/super-admin/Reports.jsx';
// import Notifications from '../pages/super-admin/Notifications.jsx';

// export const superAdminRoutes = [
//   { path: "dashboard", element: <Dashboard /> },
//   { path: "users", element: <Users /> },
//   { path: "users/roles", element: <UsersRoles /> },
//   { path: "users/permissions", element: <UsersPermissions /> },
//   { path: "organization/company-profile", element: <OrganizationCompanyProfile /> },
//   { path: "organization/departments", element: <OrganizationDepartments /> },
//   { path: "organization/locations", element: <OrganizationLocations /> },
//   { path: "employees", element: <Employees /> },
//   { path: "employees/hr-admins", element: <EmployeesHrAdmins /> },
//   { path: "employees/managers", element: <EmployeesManagers /> },
//   { path: "security/login-activity", element: <SecurityLoginActivity /> },
//   { path: "security/audit-logs", element: <SecurityAuditLogs /> },
//   { path: "security/access-control", element: <SecurityAccessControl /> },
//   { path: "system-settings/configurations", element: <SystemSettingsConfigurations /> },
//   { path: "system-settings/integrations", element: <SystemSettingsIntegrations /> },
//   { path: "reports", element: <Reports /> },
//   { path: "notifications", element: <Notifications /> },
// ];
// Auto-generated route list for the super-admin role.
// Add a page: create the component in ../pages/super-admin/, import it here, add a { path, element } entry.
import Dashboard from "../pages/super-admin/Dashboard.jsx";
import LeaveRequests from "../pages/super-admin/LeaveRequests.jsx";
import LiveTracking from "../pages/super-admin/LiveTracking.jsx";
import OrganizationDepartments from "../pages/super-admin/OrganizationDepartments.jsx";
import Reports from "../pages/super-admin/Reports.jsx";
import SecurityAccessControl from "../pages/super-admin/SecurityAccessControl.jsx";
import SecurityAuditLogs from "../pages/super-admin/SecurityAuditLogs.jsx";
import SecurityLoginActivity from "../pages/super-admin/SecurityLoginActivity.jsx";
import SystemSettingsConfigurations from "../pages/super-admin/SystemSettingsConfigurations.jsx";
import SystemSettingsIntegrations from "../pages/super-admin/SystemSettingsIntegrations.jsx";
import Users from "../pages/super-admin/Users.jsx";
import UsersPermissions from "../pages/super-admin/UsersPermissions.jsx";
import { commonRoutes } from "./commonRoutes.jsx";

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
  {
    path: "system-settings/integrations",
    element: <SystemSettingsIntegrations />,
  },
  { path: "reports", element: <Reports /> },
];
