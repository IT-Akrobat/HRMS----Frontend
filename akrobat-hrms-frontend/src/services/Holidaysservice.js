// Holidays — company holiday calendar.
//
// GET /holidays/?country=SG|IN is already used read-only by
// components/common/HolidaysCalendarCard.jsx. This file adds the
// write side: bulk-importing a country's calendar from an Excel file,
// used by the "Holidays" tab in pages/shared/Settings.jsx (HR Admin /
// Super Admin only — see canManageHolidays there, backed by the
// EDIT_EMPLOYEE permission).
//
// apiClient.js only does JSON in/out, so — same pattern as
// documentsService.js — this talks to fetch() directly for the
// multipart upload, using withCredentialsAndCsrf() from apiClient.js
// so it still sends the httpOnly auth cookie and the CSRF header
// consistently with every other request.
//
// Backend: app/holidays/routes.py
//   POST /holidays/bulk-import/excel  -> multipart upload, requires
//                                        EDIT_EMPLOYEE (see
//                                        sql/002_role_permissions_seed.sql)
//
// Expected file columns match the `holidays` table's own column names
// (see app/holidays/services.py::import_holidays_from_excel):
//   holiday_name, holiday_date, description (optional), country
//   (optional — a row without its own country falls back to the
//   `country` field sent alongside the file). A Sunday date is
//   auto-shifted to the following Monday, same as adding one by hand.

import { BASE_URL, withCredentialsAndCsrf } from "./apiClient";

async function parseErrorMessage(response) {
  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  if (!isJson) return `Request failed (${response.status})`;
  const data = await response.json().catch(() => null);
  return data?.message || data?.detail || `Request failed (${response.status})`;
}

export const holidaysService = {
  // country is the fallback applied to any row in the file that
  // doesn't specify its own `country` column — see Settings.jsx's
  // SG/IN picker, which is exactly this value. Returns
  // { imported: [...], errors: [...] } (Settings.jsx renders both
  // lists directly), tolerant of the backend omitting either key.
  async uploadExcel(file, { country } = {}) {
    const form = new FormData();
    form.append("file", file);
    if (country) form.append("country", country);

    const response = await fetch(`${BASE_URL}/holidays/bulk-import/excel`, {
      method: "POST",
      // no Content-Type — browser sets the multipart boundary
      ...withCredentialsAndCsrf("POST"),
      body: form,
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    const data = await response.json().catch(() => null);
    const payload = data?.data || data || {};
    return {
      imported: payload.imported || [],
      errors: payload.errors || [],
    };
  },
};
