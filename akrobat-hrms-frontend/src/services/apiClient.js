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

// In production BASE_URL is a relative "/api" path (see .env.example) so
// that normal fetch()/apiClient calls are same-origin through the Vercel
// rewrite proxy -- that's what lets the httpOnly auth cookie actually
// get stored on iOS/Safari. WebSockets can't go through that proxy
// (Vercel doesn't proxy persistent WS upgrades to an external host), so
// they need the backend's real address. VITE_WS_BASE_URL supplies that;
// if it's not set (e.g. local dev, where BASE_URL is already an absolute
// http://localhost:8000 URL) we just derive ws(s):// from BASE_URL like
// before.
const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL || BASE_URL.replace(/^http/, "ws");

// Double-submit CSRF cookie (see app/core/csrf.py). It's deliberately
// NOT httpOnly -- that's the whole point of the pattern -- reading it
// with document.cookie would be fine for XSS purposes (an XSS payload on
// this page could read it too either way).
//
// BUT: frontend and backend here are deployed on separate domains
// (Vercel/localhost + onrender.com -- see VITE_API_BASE_URL). A cookie
// set by the backend's Set-Cookie header is stored under the backend's
// domain; document.cookie on *this* page only ever exposes cookies set
// for this page's own domain, regardless of SameSite/Secure. So reading
// the CSRF cookie via document.cookie silently returns nothing for that
// deployment shape -- every mutating request goes out with no
// X-CSRF-Token header and the backend 403s with "CSRF token missing".
//
// Fix: the backend also returns the token in the JSON body of
// POST /auth/login, POST /auth/refresh, and GET /auth/csrf (see
// app/auth/routes.py). We cache it here in memory instead. It resets on
// a full page reload, which is why AuthContext calls GET /auth/csrf
// alongside GET /auth/me on app start -- see authService.restoreSession.
const CSRF_COOKIE_NAME = "akrobat_csrf_token";
const CSRF_HEADER_NAME = "X-CSRF-Token";

let inMemoryCsrfToken = null;

export function setCsrfToken(token) {
  inMemoryCsrfToken = token || null;
}

export function clearCsrfToken() {
  inMemoryCsrfToken = null;
}

function readCsrfCookie() {
  // Kept as a fallback for same-domain / same-origin deployments (e.g.
  // frontend and backend both on localhost, or proxied behind one
  // domain in production) where the cookie read still works fine.
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function getCsrfToken() {
  return inMemoryCsrfToken || readCsrfCookie();
}

// Any JSON response can carry a fresh csrf_token (login/refresh/csrf
// endpoints do) -- pick it up automatically wherever it appears instead
// of every caller having to remember to do it.
function captureCsrfToken(data) {
  if (data && typeof data === "object" && typeof data.csrf_token === "string") {
    inMemoryCsrfToken = data.csrf_token;
  }
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Mobile-specific failure mode this guards against: the phone locks, or
// switches from WiFi to cellular, or the signal drops out, right in the
// middle of a fetch. Without a timeout, that fetch's promise just never
// settles -- it doesn't resolve, doesn't reject, doesn't throw. Any code
// awaiting it (most importantly AuthContext's restoreSession(), which
// gates the app's initial `loading` screen) hangs forever, and the only
// way out is force-closing and reopening the app. This timeout guarantees
// every request settles one way or another within REQUEST_TIMEOUT_MS.
const REQUEST_TIMEOUT_MS = 15000;

// ---------------------------------------------------------------------
// Lightweight "something just happened" signal for parts of the app
// that want to react to ordinary API traffic without running their own
// setInterval poll -- see src/services/notificationFallback.js. This is
// deliberately generic (not notification-specific) so any successful
// request can double as a trigger, and deliberately cheap (a Set of
// callbacks, no payload) so it costs nothing when nobody's listening.
// ---------------------------------------------------------------------
const activityListeners = new Set();

export function onApiActivity(fn) {
  activityListeners.add(fn);
  return () => activityListeners.delete(fn);
}

function notifyActivity() {
  for (const fn of activityListeners) {
    try {
      fn();
    } catch {
      // A listener throwing should never break the request that
      // triggered it.
    }
  }
}

// De-dupes concurrent 401s (e.g. a dashboard firing 6 requests at once)
// into a single refresh call instead of 6.
let refreshInFlight = null;

async function refreshAccessToken() {
  if (!refreshInFlight) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
      signal: controller.signal,
    })
      .then(async (res) => {
        // Supabase rotates the refresh token (and this route re-issues
        // the CSRF cookie) on every call -- pick up the new csrf_token
        // here too, or every request after a silent refresh would go
        // out with the stale one and get 403'd.
        const data = await res.json().catch(() => null);
        captureCsrfToken(data);
        return res.ok;
      })
      .catch(() => false)
      .finally(() => {
        clearTimeout(timeoutId);
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

export function clearSession() {
  // Cookies are httpOnly, so only the server can remove those (see
  // authService.logout(), which calls POST /auth/logout). The in-memory
  // CSRF token is the one thing that *does* live here, so drop it too --
  // otherwise a stale token could linger and get echoed on a future
  // request for a different session.
  clearCsrfToken();
}

async function request(
  path,
  {
    method = "GET",
    body,
    auth = true,
    headers = {},
    _retried = false,
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = {},
) {
  const finalHeaders = { "Content-Type": "application/json", ...headers };

  if (auth && MUTATING_METHODS.has(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) finalHeaders[CSRF_HEADER_NAME] = csrfToken;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: finalHeaders,
      credentials: "include", // send/receive the httpOnly + CSRF cookies
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (networkErr) {
    // AbortError => our own timeout fired, not a real network failure --
    // worth a distinct message/flag so callers (restoreSession
    // especially) can tell "server hasn't answered yet, maybe still
    // waking up" apart from an actual rejection, instead of treating
    // both the same way.
    if (networkErr.name === "AbortError") {
      const err = new Error(
        "The server took too long to respond. Please try again.",
      );
      err.isTimeout = true;
      throw err;
    }
    // Backend down / CORS blocked / wrong URL
    throw new Error(
      "Could not reach the server. Please check your connection and try again.",
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const data = isJson ? await response.json().catch(() => null) : null;

  // Picks up csrf_token wherever it appears (login, refresh-via-retry,
  // GET /auth/csrf) so nothing has to special-case which call it came
  // from -- see the comment on captureCsrfToken above.
  captureCsrfToken(data);

  // Skip the /notifications endpoints themselves -- otherwise the
  // fallback poll's own GET /notifications/my would trigger another
  // activity tick, which could schedule another check, etc.
  if (response.ok && !path.startsWith("/notifications")) {
    notifyActivity();
  }

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
  return `${WS_BASE_URL}${path}`;
}

// The WS connection hits the backend's own domain directly (see
// WS_BASE_URL above), so on iOS/Safari it can't rely on the httpOnly
// cookie -- that cookie was only ever stored for the *proxied* /api
// origin. This fetches a short-lived, single-use ticket over the normal
// (proxied, cookie-authed) apiClient connection instead; the caller
// appends it as ?ticket= on the WS URL. See
// app/auth/routes.py::get_ws_ticket and app/core/ws_tickets.py on the
// backend. Same-origin deployments still work fine -- the backend falls
// back to the cookie automatically when there's no ticket.
export async function getWsTicket() {
  try {
    const data = await request("/auth/ws-ticket", { method: "GET" });
    return data?.ticket || null;
  } catch {
    return null;
  }
}

export { BASE_URL };
