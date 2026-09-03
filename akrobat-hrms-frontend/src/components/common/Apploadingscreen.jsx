import { useEffect, useState } from "react";

// Shown while AuthContext is restoring the session on cold app open
// (see AuthContext.restoreSession / authService._restoreSessionOnce).
// That call can legitimately take 20-90s when the backend has to
// cold-start (Render free tier spins the instance down after a period
// of inactivity -- see authService.js's RESTORE_TIMEOUT_MS comment).
//
// Previously RootRedirect/ProtectedRoute just rendered `null` for the
// entire `loading` window, i.e. a blank white screen with zero
// feedback. Users reasonably assumed the app had frozen and refreshed
// repeatedly -- which does not help (it just restarts the same 20-90s
// wake-up wait from scratch) and is the #1 reported "app takes forever
// / need to refresh 10 times" complaint.
//
// Fix: always show a spinner immediately, and if it's taking a while,
// say so explicitly and ask the person to wait instead of reloading.
const SLOW_HINT_DELAY_MS = 4000;

export default function AppLoadingScreen() {
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSlowHint(true), SLOW_HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0b1f45] border-t-transparent" />
      {showSlowHint && (
        <div className="max-w-xs text-sm text-gray-500">
          <p className="font-medium text-gray-700">Still loading…</p>
          <p className="mt-1">
            The server can take up to a minute to wake up after being idle. No
            need to refresh — this page will continue automatically as soon as
            it's ready.
          </p>
        </div>
      )}
    </div>
  );
}
