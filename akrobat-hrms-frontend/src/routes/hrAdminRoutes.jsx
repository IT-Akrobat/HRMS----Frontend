// // Auto-generated route list for the hr-admin role.
// // Add a page: create the component in ../pages/hr-admin/, import it here, add a { path, element } entry.
// import React from 'react';
// import Dashboard from '../pages/hr-admin/Dashboard.jsx';
// import Employees from '../pages/hr-admin/Employees.jsx';
// import EmployeesAdd from '../pages/hr-admin/EmployeesAdd.jsx';
// import EmployeesProfile from '../pages/hr-admin/EmployeesProfile.jsx';
// import OrganizationDepartments from '../pages/hr-admin/OrganizationDepartments.jsx';
// import OrganizationDesignations from '../pages/hr-admin/OrganizationDesignations.jsx';
// import OrganizationLocations from '../pages/hr-admin/OrganizationLocations.jsx';
// import Attendance from '../pages/hr-admin/Attendance.jsx';
// import AttendanceShifts from '../pages/hr-admin/AttendanceShifts.jsx';
// import AttendanceReports from '../pages/hr-admin/AttendanceReports.jsx';
// import LeaveRequests from '../pages/hr-admin/LeaveRequests.jsx';
// import LeavePolicies from '../pages/hr-admin/LeavePolicies.jsx';
// import LeaveBalance from '../pages/hr-admin/LeaveBalance.jsx';
// import PayrollSalaryStructure from '../pages/hr-admin/PayrollSalaryStructure.jsx';
// import PayrollGeneratePayslip from '../pages/hr-admin/PayrollGeneratePayslip.jsx';
// import PayrollReports from '../pages/hr-admin/PayrollReports.jsx';
// import Documents from '../pages/hr-admin/Documents.jsx';
// import DocumentsTemplates from '../pages/hr-admin/DocumentsTemplates.jsx';
// import ReportsHr from '../pages/hr-admin/ReportsHr.jsx';
// import ReportsAnalytics from '../pages/hr-admin/ReportsAnalytics.jsx';
// import Notifications from '../pages/hr-admin/Notifications.jsx';
// import Settings from '../pages/hr-admin/Settings.jsx';

// export const hrAdminRoutes = [
//   { path: "dashboard", element: <Dashboard /> },
//   { path: "employees", element: <Employees /> },
//   { path: "employees/add", element: <EmployeesAdd /> },
//   { path: "employees/profile", element: <EmployeesProfile /> },
//   { path: "organization/departments", element: <OrganizationDepartments /> },
//   { path: "organization/designations", element: <OrganizationDesignations /> },
//   { path: "organization/locations", element: <OrganizationLocations /> },
//   { path: "attendance", element: <Attendance /> },
//   { path: "attendance/shifts", element: <AttendanceShifts /> },
//   { path: "attendance/reports", element: <AttendanceReports /> },
//   { path: "leave/requests", element: <LeaveRequests /> },
//   { path: "leave/policies", element: <LeavePolicies /> },
//   { path: "leave/balance", element: <LeaveBalance /> },
//   { path: "payroll/salary-structure", element: <PayrollSalaryStructure /> },
//   { path: "payroll/generate-payslip", element: <PayrollGeneratePayslip /> },
//   { path: "payroll/reports", element: <PayrollReports /> },
//   { path: "documents", element: <Documents /> },
//   { path: "documents/templates", element: <DocumentsTemplates /> },
//   { path: "reports/hr", element: <ReportsHr /> },
//   { path: "reports/analytics", element: <ReportsAnalytics /> },
//   { path: "notifications", element: <Notifications /> },
//   { path: "settings", element: <Settings /> },
// ];
// Auto-generated route list for the hr-admin role.
// Add a page: create the component in ../pages/hr-admin/, import it here, add a { path, element } entry.
import Attendance from "../pages/hr-admin/Attendance.jsx";
import AttendanceReports from "../pages/hr-admin/AttendanceReports.jsx";
import AttendanceShifts from "../pages/hr-admin/AttendanceShifts.jsx";
import Dashboard from "../pages/hr-admin/Dashboard.jsx";
import Documents from "../pages/hr-admin/Documents.jsx";
import DocumentsTemplates from "../pages/hr-admin/DocumentsTemplates.jsx";
import Employees from "../pages/hr-admin/Employees.jsx";
// import EmployeesAdd from "../pages/hr-admin/EmployeesAdd.jsx";
// import EmployeesProfile from "../pages/hr-admin/EmployeesProfile.jsx";
import LeaveBalance from "../pages/hr-admin/LeaveBalance.jsx";
import LeavePolicies from "../pages/hr-admin/LeavePolicies.jsx";
import LeaveRequests from "../pages/hr-admin/LeaveRequests.jsx";
import OrganizationDepartments from "../pages/hr-admin/OrganizationDepartments.jsx";
import OrganizationDesignations from "../pages/hr-admin/OrganizationDesignations.jsx";
import OrganizationLocations from "../pages/hr-admin/OrganizationLocations.jsx";
import PayrollGeneratePayslip from "../pages/hr-admin/PayrollGeneratePayslip.jsx";
import PayrollReports from "../pages/hr-admin/PayrollReports.jsx";
import PayrollSalaryStructure from "../pages/hr-admin/PayrollSalaryStructure.jsx";
import ReportsAnalytics from "../pages/hr-admin/ReportsAnalytics.jsx";
import ReportsHr from "../pages/hr-admin/ReportsHr.jsx";
import { commonRoutes } from "./commonRoutes.jsx";

export const hrAdminRoutes = [
  { path: "dashboard", element: <Dashboard /> },
  ...commonRoutes,
  { path: "employees", element: <Employees /> },
  // { path: "employees/add", element: <EmployeesAdd /> },
  // { path: "employees/profile", element: <EmployeesProfile /> },
  { path: "organization/departments", element: <OrganizationDepartments /> },
  { path: "organization/designations", element: <OrganizationDesignations /> },
  { path: "organization/locations", element: <OrganizationLocations /> },
  { path: "attendance", element: <Attendance /> },
  { path: "attendance/shifts", element: <AttendanceShifts /> },
  { path: "attendance/reports", element: <AttendanceReports /> },
  { path: "leave/requests", element: <LeaveRequests /> },
  { path: "leave/policies", element: <LeavePolicies /> },
  { path: "leave/balance", element: <LeaveBalance /> },
  { path: "payroll/salary-structure", element: <PayrollSalaryStructure /> },
  { path: "payroll/generate-payslip", element: <PayrollGeneratePayslip /> },
  { path: "payroll/reports", element: <PayrollReports /> },
  { path: "documents", element: <Documents /> },
  { path: "documents/templates", element: <DocumentsTemplates /> },
  { path: "reports/hr", element: <ReportsHr /> },
  { path: "reports/analytics", element: <ReportsAnalytics /> },
];
