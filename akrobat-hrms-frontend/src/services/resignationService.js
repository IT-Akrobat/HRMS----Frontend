import { unwrap } from "../utils/unwrap";
import { apiClient } from "./apiClient";

// All endpoints are SUPER ADMIN only (see app/resignations/routes.py).
const BASE = "/resigned-employees";

function qs(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const resignationService = {
  list: async (params) => unwrap(await apiClient.get(`${BASE}/${qs(params)}`)),
  create: async (body) => unwrap(await apiClient.post(`${BASE}/`, body)),
  get: async (id) => unwrap(await apiClient.get(`${BASE}/${id}`)),
  update: async (id, body) =>
    unwrap(await apiClient.patch(`${BASE}/${id}`, body)),
  relieve: async (id) => unwrap(await apiClient.post(`${BASE}/${id}/relieve`)),
  withdraw: async (id) =>
    unwrap(await apiClient.post(`${BASE}/${id}/withdraw`)),
  profile: async (id) => unwrap(await apiClient.get(`${BASE}/${id}/profile`)),
  attendance: async (id, params) =>
    unwrap(await apiClient.get(`${BASE}/${id}/attendance${qs(params)}`)),
  leaves: async (id) => unwrap(await apiClient.get(`${BASE}/${id}/leaves`)),
  payroll: async (id) => unwrap(await apiClient.get(`${BASE}/${id}/payroll`)),
  documents: async (id) =>
    unwrap(await apiClient.get(`${BASE}/${id}/documents`)),
  auditTrail: async (id) =>
    unwrap(await apiClient.get(`${BASE}/${id}/audit-trail`)),
};

export const REASON_CATEGORIES = [
  "Better opportunity",
  "Higher studies",
  "Relocation",
  "Personal reasons",
  "Health reasons",
  "Compensation",
  "Work environment",
  "Retirement",
  "Other",
];
