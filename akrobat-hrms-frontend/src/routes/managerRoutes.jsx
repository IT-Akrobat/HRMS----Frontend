// Auto-generated route list for the manager role.
// Add a page: create the component in ../pages/manager/, import it here, add a { path, element } entry.
//
// All page imports are React.lazy() so this role's pages only download
// when a manager actually navigates to them, not upfront on login.
import { lazy } from "react";
import { commonRoutes } from "./commonRoutes.jsx";

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

export const managerRoutes = [
  { path: "dashboard", element: <Dashboard /> },
  ...commonRoutes,
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
