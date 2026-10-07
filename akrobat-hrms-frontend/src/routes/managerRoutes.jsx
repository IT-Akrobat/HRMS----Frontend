// Auto-generated route list for the manager role.
// Add a page: create the component in ../pages/manager/, import it here, add a { path, element } entry.
//
// All page imports are React.lazy() so this role's pages only download
// when a manager actually navigates to them, not upfront on login.
import { lazy } from "react";
import { Navigate } from "react-router-dom";
import { commonRoutes, selfCommonRoutes } from "./commonRoutes.jsx";

const Attendance = lazy(() => import("../pages/manager/Attendance.jsx"));
const AttendanceReports = lazy(
  () => import("../pages/manager/AttendanceReports.jsx"),
);
const Dashboard = lazy(() => import("../pages/manager/Dashboard.jsx"));
const LeaveHistory = lazy(() => import("../pages/manager/LeaveHistory.jsx"));
const LeavePending = lazy(() => import("../pages/manager/LeavePending.jsx"));
const OrganizationLocations = lazy(
  () => import("../pages/manager/OrganizationLocations.jsx"),
);
// Projects (list / assign tasks / progress) removed -- commented out in
// navigationConfig.js, page files no longer exist under ../pages/manager/.
// Reports (performance / attendance) removed the same way.
const TeamEmployeeDetails = lazy(
  () => import("../pages/manager/TeamEmployeeDetails.jsx"),
);
const TeamMembers = lazy(() => import("../pages/manager/TeamMembers.jsx"));

// My Space (manager as an employee) -- reuses the employee pages, mounted
// under /manager/me/*. See useBasePath() for how their links stay in this
// area. Same setup as HR's My Space in hrAdminRoutes.jsx.
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

export const managerRoutes = [
  { path: "dashboard", element: <Dashboard /> },
  ...commonRoutes,
  // ---- My Space (manager as an employee) ----
  ...selfCommonRoutes,
  { path: "me", element: <Navigate to="/manager/me/dashboard" replace /> },
  { path: "me/dashboard", element: <MeDashboard /> },
  { path: "me/attendance", element: <MeAttendance /> },
  { path: "me/attendance/history", element: <MeAttendanceHistory /> },
  { path: "me/leave/history", element: <MeLeaveHistory /> },
  { path: "me/people/all", element: <MeDirectory /> },
  { path: "me/people/department", element: <MeDepartment /> },
  { path: "me/profile/sites", element: <MeSites /> },
  // ---- Company ----
  { path: "team/members", element: <TeamMembers /> },
  { path: "team/employee-details", element: <TeamEmployeeDetails /> },
  { path: "team/locations", element: <OrganizationLocations /> },
  { path: "attendance", element: <Attendance /> },
  { path: "attendance/reports", element: <AttendanceReports /> },
  { path: "leave/pending", element: <LeavePending /> },
  { path: "leave/history", element: <LeaveHistory /> },
  // { path: "projects", element: <Projects /> },
  // { path: "projects/assign-tasks", element: <ProjectsAssignTasks /> },
  // { path: "projects/progress", element: <ProjectsProgress /> },
  // { path: "reports/performance", element: <ReportsPerformance /> },
  // { path: "reports/attendance", element: <ReportsAttendance /> },
];
