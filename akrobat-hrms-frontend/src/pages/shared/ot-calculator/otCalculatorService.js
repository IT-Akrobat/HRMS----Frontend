import { apiClient } from "../../../services/apiClient";

// Backend: app/ot_calculator/routes.py
export const otCalculatorService = {
  // One month of OT for every OT-eligible employee (or one employee).
  getMonth: (month, employeeId) => {
    const params = new URLSearchParams({ month });
    if (employeeId) params.set("employee_id", employeeId);
    return apiClient.get(`/ot-calculator/month?${params.toString()}`);
  },

  // items: [{ employee_id, attendance_date, manual_ot_hours|null, note }]
  saveAdjustments: (items) =>
    apiClient.put("/ot-calculator/adjustments", { items }),
};
