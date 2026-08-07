import { useEffect, useRef } from "react";
import { getAuthToken, wsUrl } from "../services/apiClient";

// Shared by every role's dashboard (super-admin, hr-admin, manager,
// employee) so none of them have to poll on a timer to see another
// employee's check-in/check-out/break show up. Opens /ws/dashboard (see
// app/main.py) and calls `onEvent` for every message received — the
// caller decides what that means for it (e.g. "refetch my team's status",
// "refetch my own attendance record"). Auto-reconnects after a short
// delay if the connection drops (backend restart, network blip, laptop
// waking from sleep) instead of going silently stale for the rest of the
// session.
//
// Usage:
//   useAttendanceLiveUpdates(() => {
//     loadStats();
//     loadLogs();
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

    function connect() {
      const token = getAuthToken();
      if (!token || cancelled) return;

      ws = new WebSocket(`${wsUrl("/ws/dashboard")}?token=${token}`);

      ws.onmessage = () => {
        onEventRef.current?.();
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
