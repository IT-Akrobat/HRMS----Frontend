import { normalizeRole } from "../config/roles";
import { apiClient, clearCsrfToken } from "./apiClient";

// Real backend wiring for POST /auth/login + GET /auth/me.
// /auth/login sets the access/refresh tokens as httpOnly cookies (see
// app/core/cookies.py) -- this file never sees or stores a raw token,
// on purpose: JS on this page (including any future XSS bug) can no
// longer read a live session out of localStorage the way it used to.
// Everything about "who is this user and what can they see" still comes
// from GET /auth/me, same as before.

export const authService = {
  async login(employeeCode, password) {
    const loginData = await apiClient.post(
      "/auth/login",
      { employee_code: employeeCode, password },
      { auth: false },
    );
    // loginData: { user_id, mfa_required, password_expired } -- no
    // tokens in the body anymore, they arrived as Set-Cookie headers.

    const meEnvelope = await apiClient.get("/auth/me");
    const me = meEnvelope.data;

    const user = {
      id: me.id,
      name: me.name,
      email: me.email,
      role: normalizeRole(me.role), // frontend-internal role key, e.g. 'hr_admin'
      backendRole: me.role, // raw role_name from DB, kept in case it's needed
      redirectPath: me.redirect_path,
      permissions: me.permissions,
      allowedModules: me.allowed_modules,
      sidebar: me.sidebar,
      department: me.department,
      profile: me.profile,
      theme: me.theme,
      // From /auth/login (see app/access_control) -- both reflect
      // Access Control settings enforced at sign-in time.
      mfaRequired: loginData.mfa_required,
      passwordExpired: loginData.password_expired,
    };

    return { user };
  },

  async logout() {
    // Only the server can clear an httpOnly cookie -- there's nothing
    // left client-side to remove. Best-effort: if this fails (offline,
    // etc.) the caller still clears local UI state, it just means the
    // cookie sticks around until it naturally expires or the next
    // successful logout call.
    try {
      await apiClient.post("/auth/logout", {});
    } catch (e) {
      console.warn("Logout request failed:", e);
    } finally {
      clearCsrfToken();
    }
  },

  // Called on app load to rehydrate the session. There's no client-side
  // token to check anymore, so this just asks the backend "is the
  // cookie on this request still valid?" -- a 401 means no (or expired,
  // or force-logged-out), which the caller treats as logged-out.
  //
  // Also re-primes the in-memory CSRF token (see apiClient.js) by
  // calling GET /auth/csrf alongside /auth/me: a page reload wipes that
  // in-memory value, and it can't be recovered from document.cookie
  // (frontend and backend are on separate domains). Without this, the
  // session would still restore fine via the httpOnly cookie, but the
  // very next check-in / leave request would 403 with "CSRF token
  // missing" until something else happened to refresh it.
  async restoreSession() {
    try {
      const [meEnvelope] = await Promise.all([
        apiClient.get("/auth/me"),
        apiClient.get("/auth/csrf").catch((e) => {
          console.warn("Could not refresh CSRF token:", e);
          return null;
        }),
      ]);
      const me = meEnvelope.data;
      return {
        id: me.id,
        name: me.name,
        email: me.email,
        role: normalizeRole(me.role),
        backendRole: me.role,
        redirectPath: me.redirect_path,
        permissions: me.permissions,
        allowedModules: me.allowed_modules,
        sidebar: me.sidebar,
        department: me.department,
        profile: me.profile,
        theme: me.theme,
      };
    } catch (e) {
      return null;
    }
  },
};
