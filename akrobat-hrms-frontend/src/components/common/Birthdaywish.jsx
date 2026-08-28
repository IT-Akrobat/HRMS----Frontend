import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";

// ---------------------------------------------------------------------
// Mounted once in DashboardLayout. On every app open, checks the
// signed-in user's date_of_birth (from GET /auth/me -> user.profile,
// see AuthContext) against today's date. If it's their birthday, this
// "bursts" open like a party popper -- a ring shockwave from the center
// of the screen plus a shower of falling confetti paper, with a
// "Happy Birthday" card popping in on top. After a few seconds (or on
// click/tap), everything "washes out": the confetti accelerates down
// and fades, and the card dissolves away. Exactly once per birthday
// (not once per app open/tab that day) via a localStorage flag keyed
// to this user + this year.
//
// Purely client-side -- no backend endpoint for this. date_of_birth is
// stored as "YYYY-MM-DD"; only month/day are compared, year is ignored.
// ---------------------------------------------------------------------

const AUTO_DISMISS_MS = 6000;
const WASH_OUT_MS = 900;
const CONFETTI_COUNT = 60;

const CONFETTI_COLORS = [
  "bg-brand-orange",
  "bg-pink-400",
  "bg-purple-400",
  "bg-blue-400",
  "bg-amber-400",
  "bg-emerald-400",
];

function seenKey(userId, year) {
  return `birthday_wish_seen:${userId}:${year}`;
}

// Randomized per-piece look (position, color, size, spin, drift, timing)
// so the shower reads as organic paper confetti rather than a repeating
// pattern -- generated fresh each time the wish fires, not on every
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
  const [phase, setPhase] = useState("idle"); // idle | burst | washing
  const [firstName, setFirstName] = useState("");
  const [confetti, setConfetti] = useState([]);
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
    const key = seenKey(user.id, year);
    if (localStorage.getItem(key)) return; // already wished this year

    setFirstName((user.name || "").split(" ")[0] || "there");
    setConfetti(makeConfetti(CONFETTI_COUNT));
    setPhase("burst");
    localStorage.setItem(key, "1");
  }, [user]);

  useEffect(() => {
    if (phase !== "burst") return;
    dismissTimer.current = setTimeout(handleDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(dismissTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function handleDismiss() {
    clearTimeout(dismissTimer.current);
    setPhase((p) => (p === "burst" ? "washing" : p));
    setTimeout(() => setPhase("idle"), WASH_OUT_MS);
  }

  if (phase === "idle") return null;

  const washing = phase === "washing";

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      {/* Shockwave ring -- the "bomb burst" from the center of the screen */}
      {!washing && (
        <div className="absolute left-1/2 top-1/2 w-3 h-3 rounded-full bg-brand-orange/60 animate-birthday-burst-ring" />
      )}

      {/* Falling confetti paper */}
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
