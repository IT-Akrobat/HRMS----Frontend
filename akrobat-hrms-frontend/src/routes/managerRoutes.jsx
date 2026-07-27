// // Auto-generated route list for the manager role.
// // Add a page: create the component in ../pages/manager/, import it here, add a { path, element } entry.
// import React from 'react';
// import Dashboard from '../pages/manager/Dashboard.jsx';
// import TeamMembers from '../pages/manager/TeamMembers.jsx';
// import TeamEmployeeDetails from '../pages/manager/TeamEmployeeDetails.jsx';
// import Attendance from '../pages/manager/Attendance.jsx';
// import AttendanceReports from '../pages/manager/AttendanceReports.jsx';
// import LeavePending from '../pages/manager/LeavePending.jsx';
// import LeaveHistory from '../pages/manager/LeaveHistory.jsx';
// import Projects from '../pages/manager/Projects.jsx';
// import ProjectsAssignTasks from '../pages/manager/ProjectsAssignTasks.jsx';
// import ProjectsProgress from '../pages/manager/ProjectsProgress.jsx';
// import ReportsPerformance from '../pages/manager/ReportsPerformance.jsx';
// import ReportsAttendance from '../pages/manager/ReportsAttendance.jsx';
// import Notifications from '../pages/manager/Notifications.jsx';
// import Settings from '../pages/manager/Settings.jsx';

// export const managerRoutes = [
//   { path: "dashboard", element: <Dashboard /> },
//   { path: "team/members", element: <TeamMembers /> },
//   { path: "team/employee-details", element: <TeamEmployeeDetails /> },
//   { path: "attendance", element: <Attendance /> },
//   { path: "attendance/reports", element: <AttendanceReports /> },
//   { path: "leave/pending", element: <LeavePending /> },
//   { path: "leave/history", element: <LeaveHistory /> },
//   { path: "projects", element: <Projects /> },
//   { path: "projects/assign-tasks", element: <ProjectsAssignTasks /> },
//   { path: "projects/progress", element: <ProjectsProgress /> },
//   { path: "reports/performance", element: <ReportsPerformance /> },
//   { path: "reports/attendance", element: <ReportsAttendance /> },
//   { path: "notifications", element: <Notifications /> },
//   { path: "settings", element: <Settings /> },
// ];
// Auto-generated route list for the manager role.
// Add a page: create the component in ../pages/manager/, import it here, add a { path, element } entry.
import Attendance from "../pages/manager/Attendance.jsx";
import AttendanceReports from "../pages/manager/AttendanceReports.jsx";
import Dashboard from "../pages/manager/Dashboard.jsx";
import LeaveHistory from "../pages/manager/LeaveHistory.jsx";
import LeavePending from "../pages/manager/LeavePending.jsx";
import OrganizationLocations from "../pages/manager/OrganizationLocations.jsx";
import Projects from "../pages/manager/Projects.jsx";
import ProjectsAssignTasks from "../pages/manager/ProjectsAssignTasks.jsx";
import ProjectsProgress from "../pages/manager/ProjectsProgress.jsx";
import ReportsAttendance from "../pages/manager/ReportsAttendance.jsx";
import ReportsPerformance from "../pages/manager/ReportsPerformance.jsx";
import TeamEmployeeDetails from "../pages/manager/TeamEmployeeDetails.jsx";
import TeamMembers from "../pages/manager/TeamMembers.jsx";
import { commonRoutes } from "./commonRoutes.jsx";

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
  { path: "projects", element: <Projects /> },
  { path: "projects/assign-tasks", element: <ProjectsAssignTasks /> },
  { path: "projects/progress", element: <ProjectsProgress /> },
  { path: "reports/performance", element: <ReportsPerformance /> },
  { path: "reports/attendance", element: <ReportsAttendance /> },
];
