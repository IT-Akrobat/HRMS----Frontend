import { apiClient, onApiActivity } from "./apiClient";

// ---------------------------------------------------------------------
// Fallback notification delivery: piggybacks on ordinary API traffic
// instead of using its own dedicated channel.
//
// There are already two real-time paths in this app:
//   - useNotificationLiveUpdates -- a WebSocket (/ws/notifications)
//   - pushService.js / sw.js -- true Web Push via VAPID, works even
//     with the tab/browser closed
// Both are the *right* long-term answer, but both have failure modes
// that are entirely outside this app's control: a WS upgrade blocked or
// dropped by a proxy/firewall, or Web Push needing HTTPS (or localhost)
// plus correctly-configured VAPID keys on the backend (see
// app/core/push.py) -- if either of those is off, the person sees
// "I granted permission but nothing arrives" with no error in the UI to
// explain why.
//
// This module is the safety net under both: it doesn't open any
// connection of its own. It rides along on whatever API calls the app
// is already making (loading a page, clicking a button) and, at most
// once every MIN_INTERVAL_MS, asks GET /notifications/my whether
// anything new has shown up. Works anywhere apiClient itself works --
// no WS, no service worker, no HTTPS requirement, no separate
// permission prompt beyond the same Notification.permission the rest of
// the app already asks for.
// ---------------------------------------------------------------------

const MIN_INTERVAL_MS = 15000;

let lastCheck = 0;
let checking = false;
let seenIds = new Set();
let primed = false;
let initialized = false;
// Was a single `deliver` function -- fine when only Header.jsx's bell
// used this module. Now that the Notifications list page (see
// Notificationpage.jsx) also wants live updates while it's open, a
// second initNotificationFallback() call would just overwrite the
// first caller's handler and silently cut off its fallback delivery
// (still fine via WebSocket, but not via this fallback) for as long as
// both were mounted -- and leave a stale reference behind after the
// second one unmounted. A Set of subscribers lets every registered
// listener hear every genuinely-new row, same as the WebSocket path
// already does (each caller opens its own socket).
const subscribers = new Set();

async function checkNow() {
  if (checking) return;
  checking = true;
  try {
    const res = await apiClient.get("/notifications/my");
    const rows = res?.data || [];

    if (!primed) {
      // First check this session -- record what's already there instead
      // of "delivering" someone's whole inbox as if it just arrived.
      primed = true;
      for (const n of rows) seenIds.add(n.id);
      return;
    }

    for (const n of rows) {
      if (seenIds.has(n.id)) continue;
      seenIds.add(n.id);
      for (const deliver of subscribers) {
        try {
          deliver(n);
        } catch {
          // One subscriber throwing shouldn't stop the others from
          // getting this row.
        }
      }
    }
  } catch {
    // Best-effort -- the next activity tick just tries again.
  } finally {
    checking = false;
  }
}

/**
 * Wire the fallback up. `onNew(notification)` is called for every
 * genuinely-new row this fallback discovers -- pass it the same handler
 * used for the WebSocket path (see Header.jsx / Notificationpage.jsx)
 * so toast / sound / the OS-level popup / the list all go through one
 * place and stay de-duplicated against each other, regardless of which
 * channel actually delivered a given notification first. Safe to call
 * from more than one component at once -- each gets its own
 * subscription. Returns an unsubscribe function; callers that mount and
 * unmount (like the Notifications page) should call it on cleanup so a
 * stale handler doesn't keep firing after the component's gone.
 */
export function initNotificationFallback(onNew) {
  subscribers.add(onNew);

  if (!initialized) {
    initialized = true;
    onApiActivity(() => {
      const now = Date.now();
      if (now - lastCheck < MIN_INTERVAL_MS) return;
      lastCheck = now;
      checkNow();
    });
  }

  return () => subscribers.delete(onNew);
}

// Call on logout so a shared/kiosk device doesn't keep delivering the
// previous employee's notifications to whoever logs in next, and so the
// next login starts clean instead of skipping their real first batch.
export function resetNotificationFallback() {
  seenIds = new Set();
  primed = false;
  lastCheck = 0;
}
