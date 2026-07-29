// Wraps app/access_control/routes.py (backend). SUPER ADMIN only — every
// call here 403s for any other role, matching require_role(["SUPER ADMIN"])
// on the backend.
//
//   GET  /access-control/                -> {
//     require_2fa, session_timeout_minutes,
//     password_min_length, password_require_complexity, password_expiry_days,
//     lockout_attempts, lockout_duration_minutes,
//     restrict_to_office, allowed_ip_ranges: string[]
//   }
//   PUT  /access-control/                -> same shape, partial body accepted
//   POST /access-control/force-logout-all -> { signed_out, targeted }
//
// These settings are actually enforced at login (see
// app/auth/services.py::login_user): IP allowlist + lockout are checked
// before a sign-in attempt, require_2fa comes back as `mfa_required` on
// the /auth/login response. There's no OTP challenge screen yet, so
// require_2fa currently only surfaces that flag — it doesn't block login.

import { apiClient } from "./apiClient";

export const accessControlService = {
  getSettings: () => apiClient.get("/access-control/"),

  updateSettings: (partial) => apiClient.put("/access-control/", partial),

  forceLogoutAll: () => apiClient.post("/access-control/force-logout-all"),
};
