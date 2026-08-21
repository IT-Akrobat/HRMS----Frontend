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

// --- Standalone (installed home-screen) PWA refresh-token fallback ---
//
// iOS's WKWebView, which powers "Add to Home Screen" apps, doesn't
// reliably flush httpOnly cookies to disk before the OS kills a
// backgrounded/swiped-away app process -- SameSite=None cookies (what
// we use in production) are especially prone to this. The refresh
// cookie's 30-day Max-Age is correct, but on iOS standalone the cookie
// itself can simply be gone on next launch even though nothing expired,
// which shows up as "closing the app logs me out."
//
// The backend already supports a non-cookie fallback for exactly this
// (see app/auth/schemas.py::RefreshRequest.refresh_token / the `or
// data.refresh_token` in app/auth/routes.py::refresh) -- it just wasn't
// wired up here. localStorage, unlike the WKWebView cookie store, is
// explicitly exempted from iOS's inactive-site data purge for installed
// PWAs (Apple, iOS 13.4 release notes), so it's the more durable place
// to keep this specific value.
//
// Deliberate scope: ONLY the refresh token, ONLY in standalone mode.
// This does put a token back into JS-readable storage, which is the
// exact tradeoff the httpOnly cookie migration was meant to avoid (see
// app/core/cookies.py) -- but it's a bounded, documented exception for
// a real platform limitation, not a reversion of that decision.
const STANDALONE_REFRESH_TOKEN_KEY = "akrobat_standalone_refresh_token";

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true // iOS Safari's own flag
  );
}

export function getStandaloneRefreshToken() {
  if (!isStandalone()) return null;
  try {
    return window.localStorage.getItem(STANDALONE_REFRESH_TOKEN_KEY);
  } catch {
    // Private mode / storage disabled -- fall back to cookie-only.
    return null;
  }
}

export function setStandaloneRefreshToken(token) {
  if (!isStandalone()) return;
  try {
    if (token) {
      window.localStorage.setItem(STANDALONE_REFRESH_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(STANDALONE_REFRESH_TOKEN_KEY);
    }
  } catch {
    // Nothing we can do if storage is unavailable -- cookie-only auth
    // still applies, this is only ever a fallback.
  }
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
  // Login and refresh also hand back the current refresh_token, purely
  // as the standalone-PWA fallback described above. Only ever persisted
  // when actually running standalone (setStandaloneRefreshToken no-ops
  // otherwise) -- every other client just ignores this field.
  if (
    data &&
    typeof data === "object" &&
    typeof data.refresh_token === "string"
  ) {
    setStandaloneRefreshToken(data.refresh_token);
  }
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// De-dupes concurrent 401s (e.g. a dashboard firing 6 requests at once)
// into a single refresh call instead of 6.
let refreshInFlight = null;

async function refreshAccessToken() {
  if (!refreshInFlight) {
    // Cookie is still the primary mechanism for everyone. The stored
    // value here is only ever non-null in standalone mode, and only
    // matters as a fallback for the case the cookie didn't survive
    // (see getStandaloneRefreshToken's comment) -- the backend prefers
    // its own cookie and only falls back to this body field if that
    // cookie is missing (see app/auth/routes.py::refresh).
    const standaloneRefreshToken = getStandaloneRefreshToken();

    refreshInFlight = fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        [CSRF_HEADER_NAME]: getCsrfToken() || "",
      },
      body: JSON.stringify(
        standaloneRefreshToken ? { refresh_token: standaloneRefreshToken } : {},
      ),
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
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

export function clearSession() {
  // Cookies are httpOnly, so only the server can remove those (see
  // authService.logout(), which calls POST /auth/logout). The in-memory
  // CSRF token and the standalone-PWA fallback token are the two things
  // that *do* live here, so drop both -- otherwise either could linger
  // and get echoed on a future request for a different session.
  clearCsrfToken();
  setStandaloneRefreshToken(null);
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

  // Picks up csrf_token wherever it appears (login, refresh-via-retry,
  // GET /auth/csrf) so nothing has to special-case which call it came
  // from -- see the comment on captureCsrfToken above.
  captureCsrfToken(data);

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
