// Thin fetch wrapper so every service file doesn't repeat base-URL /
// header / error-shape handling. Backend error shape (see
// app/core/responses.py -> error_response):
//   { success: false, status_code, message, errors }

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const TOKEN_KEY = "akrobat_token";
const REFRESH_KEY = "akrobat_refresh_token";

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function getRefreshToken() {
  return sessionStorage.getItem(REFRESH_KEY);
}

// Supabase access tokens are short-lived (~1hr, see app/core/security.py ->
// supabase.auth.get_user). Previously the refresh_token from login just sat
// unused in sessionStorage, so every request started failing with "Invalid
// or expired token." the moment the access token expired — the user had to
// fully log out and back in. This calls the new POST /auth/refresh once,
// swaps in the fresh tokens, and lets the caller retry.
//
// refreshInFlight de-dupes concurrent 401s (e.g. a dashboard firing 6
// requests at once) into a single refresh call instead of 6.
let refreshInFlight = null;

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshInFlight) {
    refreshInFlight = fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json().catch(() => null);
        if (!data?.access_token) return false;
        sessionStorage.setItem(TOKEN_KEY, data.access_token);
        if (data.refresh_token) {
          sessionStorage.setItem(REFRESH_KEY, data.refresh_token);
        }
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem("akrobat_user");
}

async function request(
  path,
  { method = "GET", body, auth = true, headers = {}, _retried = false } = {},
) {
  const finalHeaders = { "Content-Type": "application/json", ...headers };

  if (auth) {
    const token = getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: finalHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    // Backend down / CORS blocked / wrong URL
    throw new Error(
      "Could not reach the server. Please check your connection and try again.",
    );
  }

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const data = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    // Only ever attempt the refresh-and-retry dance once per call, and
    // never for the auth endpoints themselves (a 401 from /auth/login is a
    // wrong password, not an expired session; a 401 from /auth/refresh
    // means the refresh_token itself is dead).
    const isAuthEndpoint =
      path.startsWith("/auth/login") || path.startsWith("/auth/refresh");

    if (auth && response.status === 401 && !_retried && !isAuthEndpoint) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return request(path, { method, body, auth, headers, _retried: true });
      }
      // Refresh token is also dead — this is a real "please log in again".
      clearSession();
    }

    const message =
      data?.message || data?.detail || `Request failed (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const apiClient = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  patch: (path, body, opts) =>
    request(path, { ...opts, method: "PATCH", body }),
  delete: (path, opts) => request(path, { ...opts, method: "DELETE" }),
};

export { BASE_URL };
