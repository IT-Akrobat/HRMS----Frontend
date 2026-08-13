import { useEffect, useRef } from "react";
import { getWsTicket, wsUrl } from "../services/apiClient";

// Real-time replacement for polling GET /notifications/my on a timer.
// Opens /ws/notifications (see app/main.py), which is private per
// employee -- app/notifications/services.py::notify_employee() pushes a
// message here the instant a notification row is written, so it reaches
// the tab immediately instead of on the next poll tick. Auto-reconnects
// after a short delay if the connection drops (backend restart, network
// blip, laptop waking from sleep, phone locking/unlocking), same pattern
// as useAttendanceLiveUpdates.
//
// Auth: cookie-based, same as useAttendanceLiveUpdates -- see the
// comment there for why there's no token on the URL anymore.
//
// Usage:
//   useNotificationLiveUpdates((notification) => {
//     // notification is the raw row: { id, title, message,
//     // notification_type, is_read, created_at, ... }
//   });
export function useNotificationLiveUpdates(onNotification) {
  // Keep the latest callback in a ref so the effect below doesn't need
  // it in its dependency array -- callers usually pass an inline arrow
  // function, which would otherwise reconnect the socket every render.
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  useEffect(() => {
    let ws;
    let reconnectTimer;
    let cancelled = false;

    async function connect() {
      if (cancelled) return;

      // Same-origin deployments don't need this (the cookie rides along
      // automatically) -- but it's cheap and harmless to always fetch a
      // ticket, and it's required when the WS connects straight to a
      // different domain than the proxied API (see apiClient.js).
      const ticket = await getWsTicket();
      if (cancelled) return;

      const url = ticket
        ? `${wsUrl("/ws/notifications")}?ticket=${encodeURIComponent(ticket)}`
        : wsUrl("/ws/notifications");
      ws = new WebSocket(url);

      ws.onmessage = (event) => {
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        if (payload?.type === "notification" && payload.notification) {
          onNotificationRef.current?.(payload.notification);
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        reconnectTimer = setTimeout(connect, 5000);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);
}
