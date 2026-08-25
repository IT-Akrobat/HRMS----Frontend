import { normalizeRole } from "../config/roles";
import { apiClient, clearSession } from "./apiClient";

// Real backend wiring for POST /auth/login + GET /auth/me.
// /auth/login sets the access/refresh tokens as httpOnly cookies (see
// app/core/cookies.py) -- this file never sees or stores a raw token,
// on purpose: JS on this page (including any future XSS bug) can no
// longer read a live session out of localStorage the way it used to.
// Everything about "who is this user and what can they see" still comes
// from GET /auth/me, same as before.

// Some hosting (e.g. Render's free tier) spins the backend down after a
// period of inactivity and takes 20-50s to cold-start on the next
// request. That's exactly the situation restoreSession() runs into most:
// someone closes the app for a while, reopens it, and this is the very
// first request that has to wake the backend up. A short timeout here
// would wrongly look identical to "session expired" and bounce the
// person to the login screen even though they're still logged in -- so
// restoreSession uses a longer budget than ordinary requests.
const RESTORE_TIMEOUT_MS = 45000;

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
      // Also clears the standalone-PWA fallback refresh token, if any
      // (see apiClient.js) -- a manual logout has to end the session on
      // this device even if the server call itself failed.
      clearSession();
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
  async _restoreSessionOnce() {
    const [meEnvelope] = await Promise.all([
      apiClient.get("/auth/me", { timeoutMs: RESTORE_TIMEOUT_MS }),
      apiClient
        .get("/auth/csrf", { timeoutMs: RESTORE_TIMEOUT_MS })
        .catch((e) => {
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
  },

  async restoreSession() {
    try {
      return await this._restoreSessionOnce();
    } catch (e) {
      // A genuine 401 means the backend actually rejected the session
      // (cookie missing/expired/force-logged-out elsewhere) -- that's a
      // real "please log in again", so give up immediately.
      if (e.status === 401) return null;

      // Anything else (timeout, offline, cold-starting backend, CORS
      // hiccup, ...) never got a real answer from the server at all --
      // it is NOT evidence the session is invalid, just that this
      // attempt didn't complete. Worth one retry after a short pause
      // (e.g. the backend may still be waking up) before giving up.
      console.warn("Session restore failed, retrying once:", e);
      try {
        return await this._restoreSessionOnce();
      } catch (e2) {
        if (e2.status === 401) return null;
        // Still couldn't reach the backend after a retry. Returning
        // null here would show the login screen for someone who's
        // actually still logged in -- surface this as a distinct
        // "couldn't connect" case instead so the caller can show a
        // retry option rather than silently signing them out.
        console.error("Session restore failed after retry:", e2);
        const err = new Error(
          "Could not reach the server to restore your session.",
        );
        err.isConnectionError = true;
        throw err;
      }
    }
  },
};
