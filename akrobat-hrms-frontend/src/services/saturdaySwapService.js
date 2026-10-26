// Saturday Swap -- backend: app/saturday_swaps/routes.py
//   GET  /saturday-swaps/options     Saturdays this employee can pick from:
//                                    { working_saturdays, off_saturdays, same_month_required }
//   POST /saturday-swaps/            { work_date, off_date, reason }
//   GET  /saturday-swaps/my          own requests
//   GET  /saturday-swaps/team        requests where the caller is the approver
//   PUT  /saturday-swaps/{id}        { status: "Approved" | "Rejected", comments }
//   PUT  /saturday-swaps/{id}/cancel employee cancels own request
import { apiClient } from "./apiClient";

export const saturdaySwapService = {
  async getOptions() {
    const res = await apiClient.get("/saturday-swaps/options");
    return res?.data || { working_saturdays: [], off_saturdays: [] };
  },
  async apply({ workDate, offDate, reason }) {
    return apiClient.post("/saturday-swaps/", {
      work_date: workDate,
      off_date: offDate,
      reason,
    });
  },
  async getMine() {
    const res = await apiClient.get("/saturday-swaps/my");
    return res?.data || [];
  },
  async getTeam() {
    const res = await apiClient.get("/saturday-swaps/team");
    return res?.data || [];
  },
  decide(id, status, comments) {
    return apiClient.put(`/saturday-swaps/${id}`, { status, comments });
  },
  cancel(id) {
    return apiClient.put(`/saturday-swaps/${id}/cancel`, {});
  },
};
