import { useEffect, useRef } from "react";
import { getWsTicket, wsUrl } from "../services/apiClient";

// Shared by every role's dashboard/list page so none of them have to
// poll on a timer to see another employee's check-in/check-out/break,
// a leave being applied for/approved/rejected, or an announcement
// change show up. Opens /ws/dashboard (see app/main.py) and calls
// `onEvent(event)` for every message received, where `event` is the
// parsed payload (e.g. {type: "attendance_event", action: "check_in",
// employee_id} or {type: "announcement_event", action: "created"}) —
// the caller decides what that means for it (e.g. "refetch my team's
// status", "refetch my own attendance record", or ignore events it
// doesn't care about, filtering on event.type/event.action if a
// refetch is expensive). Auto-reconnects after a short delay if the
// connection drops (backend restart, network blip, laptop waking from
// sleep) instead of going silently stale for the rest of the session.
//
// Auth: the browser attaches the httpOnly access-token cookie to the WS
// handshake automatically (same as it does for fetch() with
// credentials:"include" -- see app/core/cookies.py), so there's no
// token to read or append to the URL here anymore. The backend closes
// the socket with code 4401 if the cookie's missing/invalid, which the
// onclose handler below just treats as "retry shortly" like any other
// drop -- a fresh login will re-establish it.
//
// Usage (blanket refetch, ignoring event contents):
//   useAttendanceLiveUpdates(() => {
//     loadStats();
//     loadLogs();
//   });
//
// Usage (filtering on event type/action, e.g. to skip an expensive
// refetch that only one kind of event actually affects):
//   useAttendanceLiveUpdates((event) => {
//     if (event?.type === "leave_event" && event?.action === "approved") {
//       loadBalances();
//     }
//   });
export function useAttendanceLiveUpdates(onEvent) {
  // Keep the latest callback in a ref so the effect below doesn't need
  // `onEvent` in its dependency array — callers usually pass an inline
  // arrow function, which would otherwise reconnect the socket on every
  // render.
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let ws;
    let reconnectTimer;
    let cancelled = false;

    async function connect() {
      if (cancelled) return;

      // See the matching comment in useNotificationLiveUpdates.jsx -- the
      // ticket is required when this WS connects to a different domain
      // than the proxied API, harmless otherwise.
      const ticket = await getWsTicket();
      if (cancelled) return;

      const url = ticket
        ? `${wsUrl("/ws/dashboard")}?ticket=${encodeURIComponent(ticket)}`
        : wsUrl("/ws/dashboard");
      ws = new WebSocket(url);

      ws.onmessage = (msg) => {
        let event = null;
        try {
          event = JSON.parse(msg.data);
        } catch {
          // Malformed/non-JSON payload -- still let callers that ignore
          // their argument (the common case) know something happened.
        }
        onEventRef.current?.(event);
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
