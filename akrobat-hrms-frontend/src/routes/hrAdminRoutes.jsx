// Auto-generated route list for the hr-admin role.
// Add a page: create the component in ../pages/hr-admin/, import it here, add a { path, element } entry.
//
// All page imports are React.lazy() so this role's pages only download
// when an HR admin actually navigates to them, not upfront on login.
import { lazy } from "react";
import { Navigate } from "react-router-dom";
import { useIsDesktop } from "../hooks/useBasePath";
import { commonRoutes, selfCommonRoutes } from "./commonRoutes.jsx";

// On web (lg+) these pages live inside the Dashboard tabs, so their old URLs
// redirect to the matching tab. On mobile they stay normal pages.
function WebTabRedirect({ tab, children }) {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return <Navigate to={`/hr-admin/dashboard?tab=${tab}`} replace />;
  }
  return children;
}

const Attendance = lazy(() => import("../pages/hr-admin/Attendance.jsx"));
const OtCalculator = lazy(
  () => import("../pages/shared/ot-calculator/OtCalculator.jsx"),
);
const AttendanceReports = lazy(
  () => import("../pages/hr-admin/AttendanceReports.jsx"),
);
// const AttendanceShifts = lazy(() => import("../pages/hr-admin/AttendanceShifts.jsx"));
const AuditLogs = lazy(() => import("../pages/hr-admin/Auditlogs.jsx"));
// Dashboard page = 4 tabs (Overview / Employees / OT Calculator / Live Site
// Tracking). On mobile it renders the original Overview with no tabs.
const Dashboard = lazy(() => import("../pages/hr-admin/DashboardTabs.jsx"));
const Documents = lazy(() => import("../pages/hr-admin/Documents.jsx"));

const Employees = lazy(() => import("../pages/hr-admin/Employees.jsx"));
// const EmployeesAdd = lazy(() => import("../pages/hr-admin/EmployeesAdd.jsx"));
// const EmployeesProfile = lazy(() => import("../pages/hr-admin/EmployeesProfile.jsx"));
const LeaveBalance = lazy(() => import("../pages/hr-admin/LeaveBalance.jsx"));
const LeaveRequests = lazy(() => import("../pages/hr-admin/LeaveRequests.jsx"));
const LiveTracking = lazy(
  () => import("../pages/shared/live-tracking/LiveTracking.jsx"),
);
// Organization (Departments / Designations / Locations) was removed from
// the HR sidebar and routes on purpose — HR no longer gets a "create
// site/location" or org-structure screen. Super Admin still owns that
// under src/pages/super-admin/Organization*.jsx / superAdminRoutes.jsx.
// const OrganizationDepartments = lazy(() => import("../pages/hr-admin/OrganizationDepartments.jsx"));
// const OrganizationDesignations = lazy(() => import("../pages/hr-admin/OrganizationDesignations.jsx"));
// const OrganizationLocations = lazy(() => import("../pages/hr-admin/OrganizationLocations.jsx"));

// My Space (HR as an employee) -- reuses the employee pages, mounted under
// /hr-admin/me/*. See useBasePath() for how their links stay in this area.
const MeDashboard = lazy(() => import("../pages/employee/Dashboard.jsx"));
const MeAttendance = lazy(() => import("../pages/employee/Attendance.jsx"));
const MeAttendanceHistory = lazy(
  () => import("../pages/employee/AttendanceHistory.jsx"),
);
const MeLeaveHistory = lazy(() => import("../pages/employee/LeaveHistory.jsx"));
const MeDirectory = lazy(
  () => import("../pages/employee/EmployeeDirectory.jsx"),
);
const MeDepartment = lazy(() => import("../pages/employee/MyDepartment.jsx"));
const MeSites = lazy(() => import("../pages/employee/ProfileSite.jsx"));

const ReportsHr = lazy(() => import("../pages/hr-admin/ReportsHr.jsx"));

export const hrAdminRoutes = [
  { path: "dashboard", element: <Dashboard /> },
  ...commonRoutes,
  // ---- My Space (HR as an employee) ----
  ...selfCommonRoutes,
  { path: "me", element: <Navigate to="/hr-admin/me/dashboard" replace /> },
  { path: "me/dashboard", element: <MeDashboard /> },
  { path: "me/attendance", element: <MeAttendance /> },
  { path: "me/attendance/history", element: <MeAttendanceHistory /> },
  { path: "me/leave/history", element: <MeLeaveHistory /> },
  { path: "me/people/all", element: <MeDirectory /> },
  { path: "me/people/department", element: <MeDepartment /> },
  { path: "me/profile/sites", element: <MeSites /> },
  // ---- Company ----
  {
    path: "employees",
    element: (
      <WebTabRedirect tab="employees">
        <Employees />
      </WebTabRedirect>
    ),
  },
  // { path: "employees/add", element: <EmployeesAdd /> },
  // { path: "employees/profile", element: <EmployeesProfile /> },
  // { path: "organization/departments", element: <OrganizationDepartments /> },
  // { path: "organization/designations", element: <OrganizationDesignations /> },
  // { path: "organization/locations", element: <OrganizationLocations /> },
  { path: "attendance", element: <Attendance /> },
  // { path: "attendance/shifts", element: <AttendanceShifts /> },
  { path: "attendance/reports", element: <AttendanceReports /> },
  {
    path: "attendance/ot-calculator",
    element: (
      <WebTabRedirect tab="ot-calculator">
        <OtCalculator />
      </WebTabRedirect>
    ),
  },
  {
    path: "attendance/live-tracking",
    element: (
      <WebTabRedirect tab="live-tracking">
        <LiveTracking />
      </WebTabRedirect>
    ),
  },
  { path: "leave/requests", element: <LeaveRequests /> },
  // { path: "leave/policies", element: <LeavePolicies /> },
  { path: "leave/balance", element: <LeaveBalance /> },

  { path: "documents", element: <Documents /> },

  { path: "security/audit-logs", element: <AuditLogs /> },
  { path: "reports/hr", element: <ReportsHr /> },
];
