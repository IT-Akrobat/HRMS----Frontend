// Documents — self-service upload (Employee / Manager / HR Admin / Super
// Admin, always against the caller's OWN record) and file download.
//
// apiClient.js only does JSON in/out, so this talks to fetch() directly
// for the two things it can't do: multipart file upload, and streaming a
// binary (file / zip) response back out as a browser download. Auth
// cookies are httpOnly (see app/core/cookies.py), so every call here
// still needs credentials:"include" to send them, and every
// mutating (POST/DELETE) call needs the CSRF header (see
// app/core/csrf.py) -- withCredentialsAndCsrf() from apiClient.js does
// both consistently instead of each fetch() reinventing it.
//
// Backend: app/documents/routes.py
//   GET  /documents/                    -> every document, company-wide,
//                                          paginated (requires VIEW_DOCUMENTS
//                                          — HR ADMIN / HR EXECUTIVE hold it,
//                                          see sql/006_document_permissions_seed.sql)
//   POST /documents/my                  -> self-service upload (multipart)
//   GET  /documents/{id}/file           -> download one document's file
//                                          (owner, or HR/Admin via VIEW_DOCUMENTS)
//   GET  /documents/download-all        -> SUPER ADMIN ONLY, zip of every
//                                          employee's documents
//   GET  /documents/employee/{id}       -> one employee's documents
//                                          (HR/Admin via VIEW_DOCUMENTS, or
//                                          that employee viewing their own —
//                                          Super Admin always qualifies)

import { apiClient, BASE_URL, withCredentialsAndCsrf } from "./apiClient";

// Keep in sync with ALLOWED_DOCUMENT_TYPES in app/documents/services.py.
export const ACCEPTED_DOCUMENT_TYPES =
  ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png";

export const DOCUMENT_TYPE_OPTIONS = [
  "ID Proof",
  "Address Proof",
  "Educational Certificate",
  "Offer Letter / Contract",
  "Resume",
  "Certification",
  "Other",
];

async function parseErrorMessage(response) {
  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  if (!isJson) return `Request failed (${response.status})`;
  const data = await response.json().catch(() => null);
  return data?.message || data?.detail || `Request failed (${response.status})`;
}

function triggerBlobDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// Best-effort filename extension sniff from the response headers, since
// the caller only knows the document's display name (no extension).
function filenameFromResponse(response, fallback) {
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match ? match[1] : fallback;
}

export const documentsService = {
  // HR Admin (VIEW_DOCUMENTS) / Super Admin — every document uploaded
  // company-wide, regardless of which employee it belongs to, paginated.
  // Used by the HR "Documents" screen (pages/hr-admin/Documents.jsx) —
  // the same company-wide visibility Super Admin has, just as a browsable
  // list here instead of per-employee via the Users drawer.
  async getAll({ page = 1, limit = 20 } = {}) {
    const res = await apiClient.get(`/documents/?page=${page}&limit=${limit}`);
    return res?.data || { records: [], total: 0, page, limit };
  },

  // Employee / Manager / HR Admin / Super Admin — upload a document
  // against their OWN employee record only.
  async uploadMy({ file, documentName, documentType, expiryDate, remarks }) {
    const form = new FormData();
    form.append("file", file);
    form.append("document_name", documentName);
    form.append("document_type", documentType);
    if (expiryDate) form.append("expiry_date", expiryDate);
    if (remarks) form.append("remarks", remarks);

    const response = await fetch(`${BASE_URL}/documents/my`, {
      method: "POST",
      // no Content-Type — browser sets the multipart boundary
      ...withCredentialsAndCsrf("POST"),
      body: form,
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    return response.json();
  },

  // Any owner of the document, or HR/Admin with VIEW_DOCUMENTS — download
  // one document's actual file.
  async downloadFile(documentId, suggestedName) {
    const response = await fetch(`${BASE_URL}/documents/${documentId}/file`, {
      ...withCredentialsAndCsrf("GET"),
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    const blob = await response.blob();
    triggerBlobDownload(
      blob,
      filenameFromResponse(response, suggestedName || "document"),
    );
  },

  // Employee / Manager / HR Admin / Super Admin — delete a document
  // against their OWN employee record only (backend also enforces this
  // ownership check server-side).
  async deleteMy(documentId) {
    const response = await fetch(`${BASE_URL}/documents/my/${documentId}`, {
      method: "DELETE",
      ...withCredentialsAndCsrf("DELETE"),
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    return response.json();
  },

  // HR/Admin (via VIEW_DOCUMENTS) or the employee themself — every
  // document uploaded against ONE specific employee record. Used by
  // Super Admin's "Users" screen to show what a given user has
  // uploaded, with a per-document download button (see UserViewModal
  // in pages/super-admin/Users.jsx).
  async getForEmployee(employeeId) {
    const response = await fetch(
      `${BASE_URL}/documents/employee/${employeeId}`,
      { ...withCredentialsAndCsrf("GET") },
    );

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    const data = await response.json();
    return data?.data || data || [];
  },

  // SUPER ADMIN ONLY — every employee's uploaded documents as one zip.
  // Non-Super-Admins get a 403 from the backend even if this is called
  // directly; the "Download All" button itself is only rendered for
  // SUPER ADMIN in MyProfile.jsx.
  async downloadAll() {
    const response = await fetch(`${BASE_URL}/documents/download-all`, {
      ...withCredentialsAndCsrf("GET"),
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    const blob = await response.blob();
    triggerBlobDownload(
      blob,
      filenameFromResponse(response, "all-employee-documents.zip"),
    );
  },
};
