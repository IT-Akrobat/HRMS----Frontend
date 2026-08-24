// Auto-generated route list for the employee role.
// Add a page: create the component in ../pages/employee/, import it here, add a { path, element } entry.
//
// All page imports are React.lazy() so this role's ~12 pages (and their
// deps -- jspdf, xlsx-js-style, react-datepicker, etc.) only download
// when an employee actually navigates to one, not as part of the
// initial bundle that has to load before the Login screen can paint.
import { lazy } from "react";
import { Navigate } from "react-router-dom";
import { commonRoutes } from "./commonRoutes.jsx";

const Attendance = lazy(() => import("../pages/employee/Attendance.jsx"));
const AttendanceHistory = lazy(
  () => import("../pages/employee/AttendanceHistory.jsx"),
);
const Dashboard = lazy(() => import("../pages/employee/Dashboard.jsx"));
// Documents / Documents Download were removed (see navigationConfig.js,
// where the "My Documents" nav group is commented out) -- pages no
// longer exist under ../pages/employee/, so the routes are dropped too.
const LeaveHistory = lazy(() => import("../pages/employee/LeaveHistory.jsx"));
// Payroll (Payslips / Salary Details) was removed the same way -- the nav
// group is commented out in navigationConfig.js and the page files are gone.
const ProfileSites = lazy(() => import("../pages/employee/ProfileSite.jsx"));
// Projects / Tasks were removed too -- commented out in navigationConfig.js,
// page files no longer exist under ../pages/employee/.

export const employeeRoutes = [
  { path: "dashboard", element: <Dashboard /> },
  ...commonRoutes,
  // Employment Details is now the "Job Details" tab on the merged
  // Personal Details page (see src/pages/shared/MyProfile.jsx) -- this
  // keeps any old bookmarked/linked "profile/employment" URLs working
  // instead of 404ing.
  {
    path: "profile/employment",
    element: <Navigate to="/employee/profile/personal" replace />,
  },
  { path: "profile/sites", element: <ProfileSites /> },
  { path: "attendance", element: <Attendance /> },
  { path: "attendance/history", element: <AttendanceHistory /> },
  { path: "leave/history", element: <LeaveHistory /> },
  // { path: "leave/balance", element: <LeaveBalance /> },
  // { path: "documents", element: <Documents /> },
  // { path: "documents/download", element: <DocumentsDownload /> },
  // { path: "payroll/payslips", element: <PayrollPayslips /> },
  // { path: "payroll/salary-details", element: <PayrollSalaryDetails /> },
  // { path: "projects", element: <Projects /> },
  // { path: "projects/tasks", element: <ProjectsTasks /> },
];
