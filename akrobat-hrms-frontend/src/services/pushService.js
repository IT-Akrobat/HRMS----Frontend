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

// Byte-for-byte comparison -- used to detect a subscription that was
// created under a VAPID key pair that's since been rotated. Browsers
// expose the key actually used at subscribe-time via
// subscription.options.applicationServerKey (an ArrayBuffer); if that
// doesn't match the key the backend is serving right now, the
// subscription is permanently dead (the push service will reject every
// send with "VAPID credentials ... do not correspond", forever -- see
// app/core/push.py) and must be replaced, not reused.
function sameKey(existingKeyBuffer, currentKeyBytes) {
  if (!existingKeyBuffer) return false;
  const existingBytes = new Uint8Array(existingKeyBuffer);
  if (existingBytes.length !== currentKeyBytes.length) return false;
  return existingBytes.every((b, i) => b === currentKeyBytes[i]);
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

    // Fetch the CURRENT key up front (not just when creating a brand
    // new subscription) -- we need it either way, to check whether any
    // existing subscription still matches it.
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
    const currentKeyBytes = urlBase64ToUint8Array(data.public_key);

    // IMPORTANT: a subscription object already existing in the browser
    // is NOT proof the backend can actually use it. Two distinct ways
    // that can be false:
    //  1. The POST below (which saves it server-side) failed at some
    //     point in the past -- slow network, backend cold-starting, a
    //     CSRF timing hiccup, app closed mid-call -- so the browser kept
    //     the subscription, but push_subscriptions never got the row.
    //  2. VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY were rotated on the backend
    //     AFTER this subscription was created. A subscription is
    //     cryptographically bound to whatever key was used at
    //     subscribe-time -- once the backend's key changes, that
    //     subscription can never succeed again, no matter how many
    //     times it's resent, and just re-saving it (case 1's fix) does
    //     nothing here because the browser-side object itself is the
    //     stale part, not just the database row.
    // Case 1 is handled by re-POSTing below regardless. Case 2 needs the
    // old subscription actually torn down and replaced.
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const opts = subscription.options || {};
      if (!sameKey(opts.applicationServerKey, currentKeyBytes)) {
        // Stale key -- this subscription will never work again. Tear it
        // down so the code below creates a fresh one against the
        // current key instead of quietly resaving a dead endpoint.
        await subscription.unsubscribe().catch(() => {});
        subscription = null;
      }
    }

    if (!subscription) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return { enabled: false, reason: "denied" };
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: currentKeyBytes,
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
