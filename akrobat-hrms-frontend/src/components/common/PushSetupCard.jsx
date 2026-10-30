import { BellRing, CheckCircle2, Share, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import {
  enablePushNotifications,
  getPushStatus,
  sendTestPush,
} from "../../services/pushService";

// Lets the user turn on phone notifications with a real tap. iOS only
// shows the permission prompt when it comes straight from a user gesture,
// so this must be an onClick, not something that runs after login.
export default function PushSetupCard({ onlyWhenNeeded = false }) {
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [status, setStatus] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getPushStatus().then(setStatus);
  }, []);

  async function handleEnable() {
    setBusy(true);
    setFailed(false);
    // Called first, with no await before it, to keep the tap gesture.
    const result = await enablePushNotifications();
    setFailed(!result.enabled);
    setStatus(await getPushStatus());
    setBusy(false);
  }

  async function handleTest() {
    setTesting(true);
    setTestMsg("");
    try {
      const r = await sendTestPush();
      if (!r.configured) {
        setTestMsg(
          "Server has no VAPID keys configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).",
        );
      } else if (r.devices === 0) {
        setTestMsg(
          "No device is saved for your account on the server. Turn notifications off and on again, or log out and log in.",
        );
      } else {
        const bad = r.results.filter((x) => !x.ok);
        setTestMsg(
          bad.length === 0
            ? `Sent to ${r.devices} device(s). Close the app now and it should pop up.`
            : `Failed on ${bad.length}/${r.devices}: ` +
                bad
                  .map(
                    (x) =>
                      `${x.push_service} ${x.status ?? ""} ${x.detail ?? ""}`,
                  )
                  .join(" | "),
        );
      }
    } catch {
      setTestMsg("Could not reach the server.");
    } finally {
      setTesting(false);
    }
  }

  if (status === "loading") return null;
  if (onlyWhenNeeded && (status === "enabled" || status === "unsupported"))
    return null;

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 shrink-0 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
          {status === "enabled" ? (
            <CheckCircle2 size={20} />
          ) : (
            <BellRing size={20} />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-semibold text-slate-800">
            Phone notifications
          </h3>

          {status === "enabled" && (
            <p className="text-sm text-slate-500 mt-1">
              On. You will get alerts on this device even when the app is
              closed.
            </p>
          )}
          {status === "enabled" && (
            <>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="mt-3 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
              >
                {testing ? "Sending..." : "Send test notification"}
              </button>
              {testMsg && (
                <p className="text-sm text-slate-600 mt-2 break-words">
                  {testMsg}
                </p>
              )}
            </>
          )}

          {status === "ready" && (
            <>
              <p className="text-sm text-slate-500 mt-1">
                Get alerts on this device even when the app is closed.
              </p>
              <button
                type="button"
                onClick={handleEnable}
                disabled={busy}
                className="mt-3 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold disabled:opacity-60"
              >
                {busy ? "Enabling..." : "Enable notifications"}
              </button>
              {failed && (
                <p className="text-sm text-red-600 mt-2">
                  Could not enable. Check that notifications are allowed for
                  this app in your phone settings.
                </p>
              )}
            </>
          )}

          {status === "needs-install" && (
            <div className="text-sm text-slate-500 mt-1 space-y-1">
              <p>
                On iPhone, notifications work only after adding this app to your
                Home Screen:
              </p>
              <p className="flex items-center gap-1.5">
                <Share size={14} /> Tap Share in Safari, then{" "}
                <b>Add to Home Screen</b>.
              </p>
              <p className="flex items-center gap-1.5">
                <Smartphone size={14} /> Open the app from the new icon, then
                come back here.
              </p>
            </div>
          )}

          {status === "denied" && (
            <p className="text-sm text-slate-500 mt-1">
              Notifications are blocked. Turn them on in your phone Settings,
              Notifications, Akrobat HRMS, then reopen the app.
            </p>
          )}

          {status === "unsupported" && (
            <p className="text-sm text-slate-500 mt-1">
              This browser does not support push notifications.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
