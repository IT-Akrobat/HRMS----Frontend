import { apiClient } from "./apiClient";

// ---------------------------------------------------------------------
// Real browser push notifications ("show up like WhatsApp, even with
// the tab closed"). Talks to the backend endpoints added in
// app/push_subscriptions/routes.py:
//   GET  /push-subscriptions/vapid-public-key  (public)
//   POST /push-subscriptions/subscribe
//   POST /push-subscriptions/unsubscribe
//
// Call enablePushNotifications() once, right after login (see
// AuthContext.jsx) -- it's safe to call on every login since it no-ops
// early if the browser already has an active subscription.
// ---------------------------------------------------------------------

// Web Push subscription keys arrive base64url-encoded; the browser's
// PushManager.subscribe() wants the raw applicationServerKey as a
// Uint8Array instead. Standard conversion, same as MDN's push demo.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function isPushSupported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function registerServiceWorker() {
  // Reuses an existing registration if the browser already has one for
  // this scope rather than registering a duplicate.
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

// Call this once after login. Deliberately never throws -- a user who
// denies the permission prompt, or a browser that doesn't support push
// at all (older Safari, some in-app webviews), should just silently not
// get push notifications rather than break login.
export async function enablePushNotifications() {
  if (!isPushSupported()) {
    return { enabled: false, reason: "unsupported" };
  }

  if (Notification.permission === "denied") {
    return { enabled: false, reason: "denied" };
  }

  try {
    const registration = await registerServiceWorker();

    // IMPORTANT: a subscription object already existing in the browser
    // is NOT proof the backend has it saved. subscribe() (below) creates
    // the browser-side subscription FIRST, then a separate POST saves it
    // server-side -- if that POST ever failed even once (slow network,
    // backend cold-starting, a CSRF timing hiccup, app closed mid-call),
    // the browser keeps the subscription forever, but push_subscriptions
    // never got the row. Every later call used to see `existing` here
    // and return early without ever retrying the save -- silently and
    // permanently breaking push for that device, while everything else
    // (in-app bell, email) kept working since neither depends on this
    // table. So: if a local subscription exists, re-sync it below
    // instead of trusting it -- the backend upserts on endpoint
    // (see push_subscriptions/services.py), so resending an
    // already-saved subscription is a harmless no-op.
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return { enabled: false, reason: "denied" };
      }

      const { data } = await apiClient.get(
        "/push-subscriptions/vapid-public-key",
        {
          auth: false,
        },
      );
      if (!data?.public_key) {
        // Backend hasn't configured VAPID keys yet (see
        // app/core/config.py) -- degrade silently, same as the backend
        // does for push_configured() being false.
        return { enabled: false, reason: "not-configured" };
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.public_key),
      });
    }

    const json = subscription.toJSON();
    await apiClient.post("/push-subscriptions/subscribe", {
      endpoint: json.endpoint,
      keys: json.keys,
      user_agent: navigator.userAgent,
    });

    return { enabled: true, reason: "subscribed" };
  } catch (err) {
    console.error("Push notification setup failed:", err);
    return { enabled: false, reason: "error" };
  }
}

// Call on logout so a shared/kiosk device stops receiving another
// employee's notifications after they sign out.
export async function disablePushNotifications() {
  if (!isPushSupported()) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    await apiClient
      .post("/push-subscriptions/unsubscribe", {
        endpoint: subscription.endpoint,
      })
      .catch(() => {
        // Backend call failing shouldn't block the local unsubscribe
        // below -- worst case a stale row lingers server-side until the
        // next failed push send prunes it (see app/core/push.py).
      });

    await subscription.unsubscribe();
  } catch (err) {
    console.error("Push notification teardown failed:", err);
  }
}
