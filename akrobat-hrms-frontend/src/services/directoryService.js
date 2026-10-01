import { unwrap } from "../utils/unwrap";
import { apiClient } from "./apiClient";

// GET /employees/directory -- safe, read-only list (name, employee code,
// photo, designation, department, work location) of every Active employee.
// Open to any signed-in user, unlike GET /employees/ which needs
// VIEW_EMPLOYEE and returns full records.
export async function fetchEmployeeDirectory() {
  const res = await apiClient.get("/employees/directory");
  return unwrap(res) || [];
}
