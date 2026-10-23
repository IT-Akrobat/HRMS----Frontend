// MC (medical certificate) calls -- backend: app/leaves/routes.py
//   POST /leaves/{id}/medical-certificate  (multipart: file + end_date) employee attaches the
//                                          certificate and the end date printed on it; the
//                                          days are calculated from that date
//   GET  /leaves/{id}/medical-certificate  short-lived link (owner / leave manager / HR / Super Admin)
//   PUT  /leaves/{id}/mc-validate          HR / Super Admin validates the leave as MC
import { apiClient, BASE_URL, withCredentialsAndCsrf } from "./apiClient";

// Keep in sync with ALLOWED_DOCUMENT_TYPES in app/documents/services.py.
export const MC_ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png";

export const leaveMcService = {
  async uploadCertificate(leaveId, file, endDate) {
    const form = new FormData();
    form.append("file", file);
    if (endDate) form.append("end_date", endDate); // YYYY-MM-DD
    const response = await fetch(
      `${BASE_URL}/leaves/${leaveId}/medical-certificate`,
      {
        method: "POST",
        // no Content-Type -- the browser sets the multipart boundary
        ...withCredentialsAndCsrf("POST"),
        body: form,
      },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.message || "Unable to upload the certificate.");
    }
    return body;
  },

  async getCertificateUrl(leaveId) {
    const res = await apiClient.get(`/leaves/${leaveId}/medical-certificate`);
    return res?.data?.url;
  },

  validate(leaveId) {
    return apiClient.put(`/leaves/${leaveId}/mc-validate`, {});
  },
};
