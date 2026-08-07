// Service worker for Web Push. Registered by src/services/pushService.js
// on app load. This file must live at the site root (not under /src) so
// its default scope covers the whole app -- see MDN's notes on service
// worker scope, a worker registered at /foo/sw.js can only control pages
// under /foo/.
//
// Deliberately plain JS, no build step: this runs in the browser's
// service worker thread, completely separate from the React app, so it
// can't import anything from src/ anyway.

self.addEventListener("install", () => {
  // Activate immediately instead of waiting for all existing tabs to
  // close -- there's no old cached content here to conflict with, so
  // there's nothing gained by waiting.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Fired when a push message arrives from the browser's push service
// (Chrome/Firefox's servers), which the backend sent via
// app/core/push.py::send_push(). Payload shape matches what that
// function sends: { title, body, url }.
self.addEventListener("push", (event) => {
  let payload = { title: "Akrobat HRMS", body: "You have a new notification." };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    // Payload wasn't JSON (shouldn't happen given send_push always
    // sends JSON) -- fall back to the default text above rather than
    // showing nothing.
  }

  const options = {
    body: payload.body,
    icon: "/akrobat-logo.png",
    badge: "/akrobat-logo.png",
    data: { url: payload.url || "/" },
    // Notifications with the same tag replace each other instead of
    // stacking -- prevents a burst of the same alert (e.g. several
    // celebration notifications) from flooding the tray at once.
    tag: payload.tag || "akrobat-notification",
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// Fired when the user taps the notification. Focuses an already-open
// Akrobat tab if one exists, otherwise opens a new one -- same
// "tap the notification, land in the app" behaviour as WhatsApp.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
