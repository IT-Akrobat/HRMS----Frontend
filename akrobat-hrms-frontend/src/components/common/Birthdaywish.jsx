import { Cake, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

// ---------------------------------------------------------------------
// Mounted once in DashboardLayout. On every app open, checks the
// signed-in user's date_of_birth (from GET /auth/me -> user.profile,
// see AuthContext) against today's date. If it's their birthday, shows
// a floating circular badge (brand orange, pulsing ring) in the
// bottom-right corner with a speech-bubble message next to it --
// deliberately NOT the usual rectangular ToastContext card, since this
// is meant to feel like a one-off celebratory moment, not a
// notification. Exactly once per birthday (not once per app open/tab
// that day) via a localStorage flag keyed to this user + this year.
//
// Purely client-side -- no backend endpoint for this. date_of_birth is
// stored as "YYYY-MM-DD"; only month/day are compared, year is ignored.
// ---------------------------------------------------------------------

const AUTO_DISMISS_MS = 8000;
const FADE_OUT_MS = 250;

function seenKey(userId, year) {
  return `birthday_wish_seen:${userId}:${year}`;
}

export default function BirthdayWish() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    const dob = user?.profile?.date_of_birth;
    if (!user?.id || !dob) return;

    // Parse "YYYY-MM-DD" manually rather than `new Date(dob)` -- that
    // constructor treats a plain date string as UTC midnight, which can
    // roll to the previous/next day once compared against the
    // browser's local "today" depending on timezone. We only need
    // month/day here, so pull them straight out of the string.
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
    if (!match) return;
    const [, , dobMonth, dobDay] = match;

    const today = new Date();
    const todayMonth = String(today.getMonth() + 1).padStart(2, "0");
    const todayDay = String(today.getDate()).padStart(2, "0");

    if (dobMonth !== todayMonth || dobDay !== todayDay) return;

    const year = today.getFullYear();
    const key = seenKey(user.id, year);
    if (localStorage.getItem(key)) return; // already wished this year

    setFirstName((user.name || "").split(" ")[0] || "there");
    setVisible(true);
    localStorage.setItem(key, "1");
  }, [user]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => handleDismiss(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function handleDismiss() {
    setClosing(true);
    setTimeout(() => setVisible(false), FADE_OUT_MS);
  }

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-5 right-5 z-[100] flex items-end gap-0 pointer-events-none ${
        closing ? "animate-birthday-out" : "animate-birthday-in"
      }`}
    >
      {/* Speech-bubble message */}
      <div
        className="pointer-events-auto relative z-10 -mr-1.5 mb-2 max-w-[190px] rounded-2xl rounded-br-md bg-brand-orange px-3.5 py-2.5 text-white shadow-lg cursor-pointer"
        onClick={handleDismiss}
      >
        <p className="text-xs font-medium leading-tight">
          Happy Birthday, {firstName}! 🎉
        </p>
        <p className="text-[11px] text-white/85 mt-0.5 leading-tight">
          Have a wonderful day ahead
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          aria-label="Dismiss"
          className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-white text-brand-orange flex items-center justify-center shadow-sm hover:bg-slate-50"
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      </div>

      {/* Floating circular badge with pulsing ring */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Happy Birthday"
        className="pointer-events-auto relative w-[52px] h-[52px] shrink-0 cursor-pointer"
      >
        <span className="absolute inset-0 rounded-full bg-brand-orange animate-birthday-pulse" />
        <span className="absolute inset-0 rounded-full bg-brand-orange flex items-center justify-center shadow-lg">
          <Cake size={22} className="text-white" />
        </span>
      </button>
    </div>
  );
}
