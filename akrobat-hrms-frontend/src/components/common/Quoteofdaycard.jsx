import { Quote } from "lucide-react";
import { useEffect, useState } from "react";
import { dashboardService } from "../../services/DashbaordService";
import { toLocalISODate } from "../../utils/date";

// ---------------------------------------------------------------------
// Quote of the Day — now fully backend-driven.
//
// GET /dashboard/quote-of-day (see backend app/dashboard/routes.py +
// services.get_quote_of_day) is the single source of truth. The backend
// caches today's quote in the `daily_quotes` table, so every employee
// who opens the dashboard today sees the exact same quote + background,
// and the external quote/image APIs are only ever called once per day
// (by whichever request happens to be first) — not once per page load.
//
// This component's job is just:
//   1. If today's data is already in localStorage, render it immediately
//      (no network round-trip, no flash of stale/default content).
//   2. Otherwise call the API, render what it returns, and cache it.
//   3. If the request itself fails (network down, backend unreachable),
//      fall back to a local Akrobat default — the backend already has
//      its own fallback chain (external API down -> most recent stored
//      quote -> hardcoded default) for when the *external* quote/image
//      providers fail, so this local fallback only matters if our own
//      backend can't be reached at all.
// ---------------------------------------------------------------------

const STORAGE_KEY = "quoteOfDay";

const DEFAULT_QUOTE = {
  text: "Safety today. Stronger tomorrow.",
  author: "Akrobat Team",
};

const DEFAULT_BG =
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80";

function readCachedForToday() {
  const today = toLocalISODate();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.date === today && saved?.quote && saved?.bg) {
      return saved;
    }
  } catch {
    // Corrupt/old-shape localStorage value — ignore and refetch.
  }
  return null;
}

function cacheForToday(quote, bg) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: toLocalISODate(), quote, bg }),
    );
  } catch {
    // Storage full/unavailable (e.g. private browsing) — non-fatal,
    // the card just refetches on the next load instead of caching.
  }
}

export default function QuoteOfDayCard({ compact = false } = {}) {
  const [quote, setQuote] = useState(DEFAULT_QUOTE);
  const [bg, setBg] = useState(DEFAULT_BG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = readCachedForToday();
    if (cached) {
      setQuote(cached.quote);
      setBg(cached.bg);
      setLoading(false);
      return;
    }

    let cancelled = false;

    dashboardService
      .getQuoteOfDay()
      .then((data) => {
        if (cancelled || !data) return;

        const todaysQuote = {
          text: data.quote || DEFAULT_QUOTE.text,
          author: data.author || DEFAULT_QUOTE.author,
        };
        const todaysBg = data.background_url || DEFAULT_BG;

        setQuote(todaysQuote);
        setBg(todaysBg);
        cacheForToday(todaysQuote, todaysBg);
      })
      .catch(() => {
        // Backend unreachable — keep the local Akrobat default already
        // in state. Deliberately not cached, so the next page load
        // tries the API again instead of getting stuck on the default.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (compact) {
    return (
      <div
        className="relative overflow-hidden rounded-xl w-full sm:w-[420px] shrink-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bg})` }}
      >
        <div className="absolute inset-0 bg-white/85" />
        <div className="relative z-10 flex items-center gap-2.5 pl-2.5 pr-3.5 py-2">
          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0">
            <Quote size={13} className="text-orange-500" />
          </div>
          {loading ? (
            <div className="h-2.5 bg-slate-200/70 rounded w-full animate-pulse" />
          ) : (
            <p className="min-w-0 flex-1 text-xs leading-snug text-slate-700">
              <span className="font-medium">{quote.text}</span>
              <span className="text-slate-500 italic"> — {quote.author}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="
        relative
        overflow-hidden
        rounded-xl
        h-full
        min-h-[260px]
        bg-cover
        bg-center
      "
      style={{
        backgroundImage: `url(${bg})`,
      }}
    >
      <div
        className="
          absolute inset-0
          bg-gradient-to-r
          from-white/95
          via-white/80
          to-transparent
        "
      />

      <div
        className="
          relative z-10
          p-6
          flex flex-col
          justify-center
          h-full
          max-w-md
        "
      >
        <div
          className="
            w-10 h-10
            rounded-lg
            bg-orange-100
            flex items-center justify-center
            mb-4
          "
        >
          <Quote size={22} className="text-orange-500" />
        </div>

        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-slate-200/70 rounded w-full" />
            <div className="h-4 bg-slate-200/70 rounded w-3/4" />
          </div>
        ) : (
          <p
            className="
              text-lg
              leading-relaxed
              font-semibold
              text-blue-950
            "
          >
            {quote.text}
          </p>
        )}

        <p className="mt-4 text-sm text-slate-500 italic">— {quote.author}</p>

        <div className="mt-5 flex items-center gap-2">
          <span className="h-1 w-8 rounded-full bg-orange-500" />

          <span className="text-xs text-slate-400">
            Built to support. Maintained to last.
          </span>
        </div>
      </div>
    </div>
  );
}
