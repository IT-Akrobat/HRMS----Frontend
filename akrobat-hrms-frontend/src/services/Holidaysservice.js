// Public holidays — read (any authenticated user, see the Holidays
// calendar card on the dashboards) and manage (HR Admin / HR Executive
// / Super Admin, who hold EDIT_EMPLOYEE — see
// sql/002_role_permissions_seed.sql).
//
// apiClient.js only does JSON in/out, so the Excel upload here talks to
// fetch() directly, same pattern as documentsService.js's uploadMy().
//
// Backend: app/holidays/routes.py
//   GET    /holidays/?country=SG          -> list (optionally filtered)
//   POST   /holidays/                     -> create one holiday
//   PUT    /holidays/{id}                 -> edit one holiday
//   DELETE /holidays/{id}                 -> delete one holiday
//   POST   /holidays/bulk-import/excel    -> upload an .xlsx of holidays
//   POST   /holidays/bulk-import          -> same, as a JSON body (not
//                                            used by this page, kept for
//                                            scripted/API imports)

import { apiClient, BASE_URL, withCredentialsAndCsrf } from "./apiClient";

async function parseErrorMessage(response) {
  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  if (!isJson) return `Request failed (${response.status})`;
  const data = await response.json().catch(() => null);
  return data?.message || data?.detail || `Request failed (${response.status})`;
}

export const holidaysService = {
  async getAll({ country } = {}) {
    const qs = country ? `?country=${encodeURIComponent(country)}` : "";
    const res = await apiClient.get(`/holidays/${qs}`);
    return res?.data || [];
  },

  async create({ holidayName, holidayDate, description, country }) {
    return apiClient.post("/holidays/", {
      holiday_name: holidayName,
      holiday_date: holidayDate,
      description: description || null,
      country: country || "SG",
    });
  },

  async update(holidayId, data) {
    return apiClient.put(`/holidays/${holidayId}`, data);
  },

  async remove(holidayId) {
    return apiClient.delete(`/holidays/${holidayId}`);
  },

  // Uploads an .xlsx with columns Holiday Name / Date / Description
  // (optional) / Country (optional). `country` is the fallback applied
  // to any row that doesn't have its own Country column. Returns
  // { imported: [...], errors: ["Row 4: ...", ...] } — a partial
  // success (some rows imported, some skipped) is not an exception, so
  // callers should check `errors.length` rather than only catching.
  async uploadExcel(file, { country = "SG" } = {}) {
    const form = new FormData();
    form.append("file", file);

    const response = await fetch(
      `${BASE_URL}/holidays/bulk-import/excel?country=${encodeURIComponent(country)}`,
      {
        method: "POST",
        // no Content-Type — browser sets the multipart boundary
        ...withCredentialsAndCsrf("POST"),
        body: form,
      },
    );

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    const body = await response.json();
    return body?.data || { imported: [], errors: [] };
  },
};
