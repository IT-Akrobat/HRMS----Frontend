import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";

// ---------------------------------------------------------------------
// Mounted once in DashboardLayout. On every app open, checks the
// signed-in user's date_of_birth (from GET /auth/me -> user.profile,
// see AuthContext) against today's date. If it's their birthday:
//
//   1. "waiting"  -- a small ticking bomb sits bottom-right for
//                    WAIT_MS (20s), shaking with a flickering fuse
//                    spark. Tapping it lights the fuse early.
//   2. "burst"    -- the bomb "explodes": a shockwave ring from the
//                    center of the screen, a shower of falling
//                    confetti paper, and a "Happy Birthday" card
//                    popping in on top.
//   3. "washing"  -- after a few seconds (or on tap), everything
//                    washes out: confetti accelerates down and
//                    fades, the card dissolves away.
//
// Fires up to MAX_WISHES times per birthday (once per app open/login,
// e.g. reload the app 3 times on your birthday and you get the full
// bomb -> burst -> wash-out sequence 3 times) via a localStorage
// counter keyed to this user + this year -- the 4th+ open that day
// (and every day after) stays silent.
//
// Purely client-side -- no backend endpoint for this. date_of_birth is
// stored as "YYYY-MM-DD"; only month/day are compared, year is ignored.
// ---------------------------------------------------------------------

const WAIT_MS = 2000; // bomb ticks this long before it bursts on its own
const AUTO_DISMISS_MS = 6000; // burst stays up this long before washing out
const WASH_OUT_MS = 900;
const CONFETTI_COUNT = 60;
const MAX_WISHES = 1;

const CONFETTI_COLORS = [
  "bg-brand-orange",
  "bg-pink-400",
  "bg-purple-400",
  "bg-blue-400",
  "bg-amber-400",
  "bg-emerald-400",
];

function countKey(userId, year) {
  return `birthday_wish_count:${userId}:${year}`;
}

// Randomized per-piece look (position, color, size, spin, drift, timing)
// so the shower reads as organic paper confetti rather than a repeating
// pattern -- generated fresh each time the bomb bursts, not on every
// render.
function makeConfetti(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100, // vw %
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    width: 6 + Math.random() * 5,
    height: 10 + Math.random() * 8,
    round: Math.random() > 0.6,
    rotate: Math.random() * 360,
    spin: 480 + Math.random() * 480,
    drift: (Math.random() - 0.5) * 160,
    delay: Math.random() * 0.5,
    duration: 2.6 + Math.random() * 1.8,
  }));
}

export default function BirthdayWish() {
  const { user } = useAuth();
  const [phase, setPhase] = useState("idle"); // idle | waiting | burst | washing
  const [firstName, setFirstName] = useState("");
  const [confetti, setConfetti] = useState([]);
  const waitTimer = useRef(null);
  const dismissTimer = useRef(null);

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
    const key = countKey(user.id, year);
    const shownCount = Number(localStorage.getItem(key) || 0);
    if (shownCount >= MAX_WISHES) return; // already wished 3 times this year

    setFirstName((user.name || "").split(" ")[0] || "there");
    setPhase("waiting"); // bomb sits and ticks first
    localStorage.setItem(key, String(shownCount + 1));
  }, [user]);

  // Bomb ticks for WAIT_MS, then bursts on its own.
  useEffect(() => {
    if (phase !== "waiting") return;
    waitTimer.current = setTimeout(() => {
      setConfetti(makeConfetti(CONFETTI_COUNT));
      setPhase("burst");
    }, WAIT_MS);
    return () => clearTimeout(waitTimer.current);
  }, [phase]);

  // Burst stays up for AUTO_DISMISS_MS, then washes out on its own.
  useEffect(() => {
    if (phase !== "burst") return;
    dismissTimer.current = setTimeout(handleDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(dismissTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Tapping the bomb lights the fuse early instead of waiting out the
  // full WAIT_MS.
  function handleBombTap() {
    clearTimeout(waitTimer.current);
    setConfetti(makeConfetti(CONFETTI_COUNT));
    setPhase("burst");
  }

  function handleDismiss() {
    clearTimeout(waitTimer.current);
    clearTimeout(dismissTimer.current);
    setPhase((p) => (p === "burst" ? "washing" : p));
    setTimeout(() => setPhase("idle"), WASH_OUT_MS);
  }

  if (phase === "idle") return null;

  if (phase === "waiting") {
    return (
      <button
        type="button"
        onClick={handleBombTap}
        aria-label="Happy Birthday -- tap to celebrate"
        className="fixed bottom-6 right-6 z-[100] w-14 h-14 flex items-center justify-center cursor-pointer animate-birthday-bomb-shake"
      >
        <span className="text-4xl leading-none select-none">💣</span>
        <span className="absolute -top-1 right-1 text-base select-none animate-birthday-fuse-spark">
          ✨
        </span>
      </button>
    );
  }

  const washing = phase === "washing";

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      {/* Shockwave ring -- the bomb's blast from the center of the screen */}
      {!washing && (
        <div className="absolute left-1/2 top-1/2 w-3 h-3 rounded-full bg-brand-orange/60 animate-birthday-burst-ring" />
      )}

      {/* Falling confetti paper -- the burst bomb's "paper" */}
      {confetti.map((c) => (
        <span
          key={c.id}
          className={`absolute top-[-24px] ${c.color} ${
            c.round ? "rounded-full" : "rounded-[2px]"
          } ${washing ? "animate-birthday-wash" : "animate-birthday-confetti"}`}
          style={{
            left: `${c.left}%`,
            width: c.width,
            height: c.round ? c.width : c.height,
            "--rotate-start": `${c.rotate}deg`,
            "--spin": `${c.spin}deg`,
            "--drift": `${c.drift}px`,
            animationDelay: washing ? "0s" : `${c.delay}s`,
            animationDuration: washing ? `${WASH_OUT_MS}ms` : `${c.duration}s`,
          }}
        />
      ))}

      {/* Center "Happy Birthday" card */}
      <div
        className={`pointer-events-auto absolute left-1/2 top-1/2 flex flex-col items-center text-center cursor-pointer px-6 ${
          washing
            ? "animate-birthday-message-out"
            : "animate-birthday-message-in"
        }`}
        onClick={handleDismiss}
      >
        <div className="w-16 h-16 rounded-full bg-brand-orange flex items-center justify-center shadow-xl mb-3 animate-birthday-glow">
          <span className="text-3xl leading-none">🎉</span>
        </div>
        <p className="text-xl sm:text-2xl font-heading font-bold text-brand-navy drop-shadow-sm">
          Happy Birthday, {firstName}! 🎂
        </p>
        <p className="text-sm text-slate-500 mt-1">
          Have a wonderful day ahead
        </p>
      </div>
    </div>
  );
}
