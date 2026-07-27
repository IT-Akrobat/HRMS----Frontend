// Thin wrapper around the /reports/* endpoints (see
// app/reports/{routes,services}.py on the backend). Every endpoint returns
// the standard { success, message, data } envelope from success_response(),
// where `data` is the full array of rows (previously the backend only
// returned response.data[0] — a single row — which has been fixed
// alongside this file so these calls actually return lists).
import { apiClient } from "./apiClient";

export const reportsService = {
  dashboard: () => apiClient.get("/reports/dashboard"),
  employees: () => apiClient.get("/reports/employees"),
  attendance: () => apiClient.get("/reports/attendance"),
  leaves: () => apiClient.get("/reports/leaves"),
  payroll: () => apiClient.get("/reports/payroll"),
  projects: () => apiClient.get("/reports/projects"),
  // One employee: profile, manager, sites worked (+ hours per site), and
  // lifetime attendance totals — backs the per-row "download full report".
  employeeFull: (employeeId) =>
    apiClient.get(`/reports/employees/${employeeId}/full`),
  // One employee, one calendar month ("YYYY-MM") — daily records plus
  // the month's totals (working hours, break time, overtime, lates).
  employeeMonthlyAttendance: (employeeId, month) =>
    apiClient.get(
      `/reports/attendance/employee/${employeeId}?month=${encodeURIComponent(month)}`,
    ),
};
