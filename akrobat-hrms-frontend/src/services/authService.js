import { normalizeRole } from "../config/roles";
import { apiClient } from "./apiClient";

// Real backend wiring for POST /auth/login + GET /auth/me.
// /auth/login only returns tokens (see backend app/auth/routes.py) —
// role, permissions, sidebar, redirect_path all come from /auth/me,
// which is the backend's single source of truth for "who is this user
// and what can they see" (see app/auth/services.get_me). Nothing about
// roles is decided here; this file just stores what the backend says.

const TOKEN_KEY = "akrobat_token";
const USER_KEY = "akrobat_user";

export const authService = {
  async login(employeeCode, password) {
    const loginData = await apiClient.post(
      "/auth/login",
      { employee_code: employeeCode, password },
      { auth: false },
    );
    // loginData: { access_token, refresh_token, user_id }

    localStorage.setItem(TOKEN_KEY, loginData.access_token);
    if (loginData.refresh_token) {
      localStorage.setItem("akrobat_refresh_token", loginData.refresh_token);
    }

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

    localStorage.setItem(USER_KEY, JSON.stringify(user));

    return { token: loginData.access_token, user };
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("akrobat_refresh_token");
    localStorage.removeItem(USER_KEY);
  },

  getStoredUser() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  setStoredUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
};
