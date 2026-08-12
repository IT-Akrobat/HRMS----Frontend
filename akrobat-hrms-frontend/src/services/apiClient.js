// Thin fetch wrapper so every service file doesn't repeat base-URL /
// header / error-shape handling. Backend error shape (see
// app/core/responses.py -> error_response):
//   { success: false, status_code, message, errors }
//
// Auth model: the access/refresh tokens are httpOnly cookies set by the
// backend (see app/core/cookies.py) -- this file never reads, stores, or
// attaches them itself. `credentials: "include"` on every request is
// what makes the browser send those cookies; it's the cookie-based
// equivalent of the old `Authorization: Bearer ${token}` header.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Double-submit CSRF cookie (see app/core/csrf.py). It's deliberately
// NOT httpOnly -- that's the whole point of the pattern -- so reading it
// here with document.cookie is expected, not a bug. It only protects
// against forged cross-site requests; it does nothing for XSS (an XSS
// payload running on this page could read it too), which is a separate
// problem httpOnly cookies for the *auth* tokens are there to limit.
const CSRF_COOKIE_NAME = "akrobat_csrf_token";
const CSRF_HEADER_NAME = "X-CSRF-Token";

function getCsrfToken() {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// De-dupes concurrent 401s (e.g. a dashboard firing 6 requests at once)
// into a single refresh call instead of 6.
let refreshInFlight = null;

async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        [CSRF_HEADER_NAME]: getCsrfToken() || "",
      },
      // Backend prefers the refresh_token cookie and only falls back to
      // the body if it's missing (see app/auth/routes.py::refresh) --
      // this project still needs *a* JSON body since the route always
      // parses one, even though there's nothing to put in it now.
      body: JSON.stringify({}),
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

function clearSession() {
  // Nothing client-side left to clear -- the cookies are httpOnly, so
  // only the server can remove them (see authService.logout(), which
  // calls POST /auth/refresh's sibling POST /auth/logout). This exists
  // as a hook for callers that just need to know "the session is dead,
  // update the UI" without necessarily hitting the network again.
}

async function request(
  path,
  { method = "GET", body, auth = true, headers = {}, _retried = false } = {},
) {
  const finalHeaders = { "Content-Type": "application/json", ...headers };

  if (auth && MUTATING_METHODS.has(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) finalHeaders[CSRF_HEADER_NAME] = csrfToken;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: finalHeaders,
      credentials: "include", // send/receive the httpOnly + CSRF cookies
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
      // Refresh is also dead -- this is a real "please log in again".
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

// For requests that can't go through apiClient.request (multipart
// uploads, binary downloads -- see documentsService.js): the same
// credentials + CSRF-header rules apply, just attached by hand.
export function withCredentialsAndCsrf(method, headers = {}) {
  const finalHeaders = { ...headers };
  if (MUTATING_METHODS.has(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) finalHeaders[CSRF_HEADER_NAME] = csrfToken;
  }
  return { credentials: "include", headers: finalHeaders };
}

export function wsUrl(path) {
  return `${BASE_URL.replace(/^http/, "ws")}${path}`;
}

export { BASE_URL };
