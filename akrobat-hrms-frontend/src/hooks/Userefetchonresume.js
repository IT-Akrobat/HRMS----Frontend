import { useEffect, useRef } from "react";

// Mobile PWAs don't get torn down and reloaded when the phone is locked
// or the user switches apps -- the page just sits frozen in the
// background, however long that lasts. Any data a page loaded once on
// mount can be stale by the time the person looks at it again (checked-in
// status, today's attendance, a manager's pending-approvals count, etc.).
//
// This fires `onResume` whenever the tab/PWA becomes visible again after
// having been hidden, so a page can silently refetch instead of showing
// old data until the user manually pulls to refresh. It debounces bursts
// (Android in particular can fire visibilitychange more than once for a
// single resume) with MIN_INTERVAL_MS, same pattern as the notification
// fallback poll in Notificationfallback.js.
//
// Usage:
//   useRefetchOnResume(() => loadDashboardData());
const MIN_INTERVAL_MS = 5000;

export function useRefetchOnResume(onResume) {
  const onResumeRef = useRef(onResume);
  onResumeRef.current = onResume;
  const lastFireRef = useRef(0);

  useEffect(() => {
    function fireIfDue() {
      const now = Date.now();
      if (now - lastFireRef.current < MIN_INTERVAL_MS) return;
      lastFireRef.current = now;
      onResumeRef.current?.();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") fireIfDue();
    }

    // visibilitychange covers switching apps / locking the phone.
    // pageshow (with persisted true) covers the bfcache restore case on
    // some mobile browsers, which doesn't always also fire
    // visibilitychange.
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", fireIfDue);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", fireIfDue);
    };
  }, []);
}
