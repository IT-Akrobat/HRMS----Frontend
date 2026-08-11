import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

// ---------------------------------------------------------------------
// "Install this app?" banner.
//
// Why this is needed at all: having a valid manifest.json + a service
// worker with a fetch handler (see public/manifest.json, public/sw.js)
// makes the site *installable*, but Chromium will NOT pop up a native
// install dialog by itself the moment someone opens the link. Instead:
//   - It fires a `beforeinstallprompt` event on the window, once, and
//     ONLY after its own engagement heuristics are satisfied (the user
//     has interacted with the page for a bit / this isn't their first
//     ever visit in some cases). Nothing visible happens unless code
//     is listening for that event.
//   - By default that event just unlocks a small install icon in the
//     address bar (desktop) — it does not interrupt the user.
//   - Calling `event.prompt()` from OUR OWN click handler is what
//     actually opens the native "Install app?" dialog. That call MUST
//     happen inside a user gesture (e.g. this component's button),
//     which is exactly what this banner exists to provide.
//   - Firefox desktop does not support installable PWAs at all (no
//     `beforeinstallprompt`), and iOS Safari never fires it either —
//     there, "Add to Home Screen" can only be done manually from the
//     Share sheet and can't be triggered by any script. Those two
//     cases are the ones "it doesn't work" reports usually turn out
//     to be — this banner simply won't appear there, which is
//     expected, not broken.
// ---------------------------------------------------------------------

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true // iOS Safari's own flag
  );
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("installPromptDismissed") === "1",
  );

  useEffect(() => {
    if (isStandalone()) return; // already installed / running as an app

    function onBeforeInstallPrompt(event) {
      // Stop Chrome's own mini-infobar from also trying to show —
      // we're taking over with our own UI.
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    }

    function onAppInstalled() {
      setVisible(false);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); // opens the real native "Install app?" dialog
    await deferredPrompt.userChoice; // resolves once the user accepts/dismisses it
    // A captured prompt event can only be used once.
    setDeferredPrompt(null);
    setVisible(false);
  }

  function handleDismiss() {
    setVisible(false);
    // Don't nag again this tab session; the browser will still offer
    // its own address-bar install icon regardless.
    sessionStorage.setItem("installPromptDismissed", "1");
    setDismissed(true);
  }

  if (!visible || dismissed) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-96 z-[100] bg-white border border-slate-200 rounded-xl shadow-2xl p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
        <Download size={18} className="text-orange-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">
          Install Akrobat HRMS
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          Add it to your device for faster, app-like access.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-500 text-white hover:bg-orange-600"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-500 hover:bg-slate-50"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="text-slate-300 hover:text-slate-500 shrink-0"
        title="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
