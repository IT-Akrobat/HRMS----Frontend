// Auto-generated route list for the hr-admin role.
// Add a page: create the component in ../pages/hr-admin/, import it here, add a { path, element } entry.
//
// All page imports are React.lazy() so this role's pages only download
// when an HR admin actually navigates to them, not upfront on login.
import { lazy } from "react";
import { commonRoutes } from "./commonRoutes.jsx";

const Attendance = lazy(() => import("../pages/hr-admin/Attendance.jsx"));
const AttendanceReports = lazy(
  () => import("../pages/hr-admin/AttendanceReports.jsx"),
);
// const AttendanceShifts = lazy(() => import("../pages/hr-admin/AttendanceShifts.jsx"));
const AuditLogs = lazy(() => import("../pages/hr-admin/Auditlogs.jsx"));
const Dashboard = lazy(() => import("../pages/hr-admin/Dashboard.jsx"));
const Documents = lazy(() => import("../pages/hr-admin/Documents.jsx"));

const Employees = lazy(() => import("../pages/hr-admin/Employees.jsx"));
// const EmployeesAdd = lazy(() => import("../pages/hr-admin/EmployeesAdd.jsx"));
// const EmployeesProfile = lazy(() => import("../pages/hr-admin/EmployeesProfile.jsx"));
const LeaveBalance = lazy(() => import("../pages/hr-admin/LeaveBalance.jsx"));
const LeaveRequests = lazy(() => import("../pages/hr-admin/LeaveRequests.jsx"));
const LiveTracking = lazy(() => import("../pages/hr-admin/LiveTracking.jsx"));
// Organization (Departments / Designations / Locations) was removed from
// the HR sidebar and routes on purpose — HR no longer gets a "create
// site/location" or org-structure screen. Super Admin still owns that
// under src/pages/super-admin/Organization*.jsx / superAdminRoutes.jsx.
// const OrganizationDepartments = lazy(() => import("../pages/hr-admin/OrganizationDepartments.jsx"));
// const OrganizationDesignations = lazy(() => import("../pages/hr-admin/OrganizationDesignations.jsx"));
// const OrganizationLocations = lazy(() => import("../pages/hr-admin/OrganizationLocations.jsx"));

const ReportsHr = lazy(() => import("../pages/hr-admin/ReportsHr.jsx"));

export const hrAdminRoutes = [
  { path: "dashboard", element: <Dashboard /> },
  ...commonRoutes,
  { path: "employees", element: <Employees /> },
  // { path: "employees/add", element: <EmployeesAdd /> },
  // { path: "employees/profile", element: <EmployeesProfile /> },
  // { path: "organization/departments", element: <OrganizationDepartments /> },
  // { path: "organization/designations", element: <OrganizationDesignations /> },
  // { path: "organization/locations", element: <OrganizationLocations /> },
  { path: "attendance", element: <Attendance /> },
  // { path: "attendance/shifts", element: <AttendanceShifts /> },
  { path: "attendance/reports", element: <AttendanceReports /> },
  { path: "attendance/live-tracking", element: <LiveTracking /> },
  { path: "leave/requests", element: <LeaveRequests /> },
  // { path: "leave/policies", element: <LeavePolicies /> },
  { path: "leave/balance", element: <LeaveBalance /> },

  { path: "documents", element: <Documents /> },

  { path: "security/audit-logs", element: <AuditLogs /> },
  { path: "reports/hr", element: <ReportsHr /> },
];
