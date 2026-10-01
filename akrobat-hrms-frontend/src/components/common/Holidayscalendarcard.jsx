import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../services/apiClient";
import { parseLocalISODate, toLocalISODate } from "../../utils/date";

// Akrobat is HQ'd in Singapore with staff in India (see
// sql/012_holiday_country_and_employee_dob.sql for the seeded 2026
// calendars -- only SG and IN currently have rows).
//
// Each employee sees ONLY their own country's holidays, worked out
// from their profile rather than a merged "everyone's holidays" list
// (an India-based employee shouldn't have to scroll past Singapore's
// Hari Raya to find Diwali, and vice versa). Two profile fields can
// signal country, checked in order:
//   1. Nationality (employees.nationality) -- the intentional, HR-set
//      country picker (see UserformModal's COUNTRIES list).
//   2. Work Location (employees.work_location) -- free text, so this
//      is only a fallback for older records where Nationality was
//      still a free-text field (pre this change) and may hold values
//      like "Indian" rather than "India", or be blank entirely.
// Matching is a case-insensitive "does this text mention the country"
// check rather than an exact match, so "Indian", "INDIA" and
// "India " all resolve the same way. If neither field mentions a
// supported country, we show a "not available" note rather than
// guessing or falling back to a merged list -- it falls back to
// DEFAULT_COUNTRY_CODE below instead, so the card is never empty just
// because the profile fields were left blank.
//
// Backend filters by `country` (GET /holidays/?country=SG|IN), see
// app/holidays/routes.py. Only Singapore and India have seeded
// calendars right now.
const COUNTRY_HINTS = [
  { code: "IN", pattern: /india|indian/i },
  { code: "SG", pattern: /singapore|singaporean/i },
];

// Used when neither Nationality nor Work Location mentions a supported
// country (e.g. both left blank) -- so the card still shows a calendar
// instead of "not available". Change this to "SG" to default to Singapore.
const DEFAULT_COUNTRY_CODE = "IN";

function detectCountryCode(user) {
  const nationality = user?.profile?.nationality || "";
  const workLocation = user?.profile?.work_location || "";
  for (const text of [nationality, workLocation]) {
    const hit = COUNTRY_HINTS.find(({ pattern }) => pattern.test(text));
    if (hit) return hit.code;
  }
  return DEFAULT_COUNTRY_CODE;
}

// A light emoji per common holiday name, purely decorative. Order matters:
// the first match wins, so specific names ("Chinese New Year", "Tamil New
// Year") must come BEFORE the generic ones ("New Year").
//
// There is deliberately NO generic "📅" fallback: on Android that emoji
// renders as Google's "July 17" calendar, so every unrecognised holiday
// ended up with the same misleading "17 July" picture. Unknown names get
// the themed CalendarDays icon instead (see HolidayIcon below).
const EMOJI_BY_KEYWORD = [
  [/chinese new year/i, "🧧"],
  [/tamil new year|puthandu|vishu|ugadi|gudi padwa/i, "🌸"],
  [/new year/i, "🎉"],
  [/pongal|sankranti|lohri|bihu/i, "🌾"],
  [/hari raya puasa|eid al-fitr|eid-ul-fitr|ramzan|ramadan/i, "🌙"],
  [/hari raya haji|eid al-adha|bakrid|bakri id/i, "🕌"],
  [/muharram/i, "🌙"],
  [/good friday/i, "✝️"],
  [/easter/i, "🐣"],
  [/labour day|labor day|may day/i, "🛠️"],
  [/ayutha|ayudha|ayudh/i, "🛠️"],
  [/vesak|buddha/i, "🪷"],
  [/national day/i, "🎊"],
  [/deepavali|diwali/i, "🪔"],
  [/christmas/i, "🎄"],
  [/republic day|independence day/i, "🇮🇳"],
  [/\bholi\b/i, "🎨"],
  [/ram navami|rama navami/i, "🙏"],
  [/raksha bandhan/i, "🧵"],
  [/ganesh chaturthi|vinayaka/i, "🐘"],
  [/gandhi jayanti|gandhi jayanthi/i, "🕊️"],
  [/vijaya ?dasami|vijaya ?dashami|dussehra|dasara|navratri|saraswati/i, "🏹"],
  [/janmashtami|krishna jayanth/i, "🦚"],
  [/maha ?shivaratri/i, "🔱"],
  [/onam/i, "🌼"],
  [/thai poosam|thaipusam/i, "🔱"],
  [/mahavir|guru nanak|gurpurab/i, "🙏"],
];

function emojiFor(name) {
  const match = EMOJI_BY_KEYWORD.find(([re]) => re.test(name || ""));
  return match ? match[1] : null;
}

// Fixed-size slot so every row's text lines up, whether the holiday got
// an emoji or the CalendarDays fallback.
function HolidayIcon({ name }) {
  const emoji = emojiFor(name);
  return (
    <span className="w-9 h-9 shrink-0 rounded-full bg-orange-50 flex items-center justify-center text-lg leading-none">
      {emoji ? emoji : <CalendarDays size={17} className="text-orange-500" />}
    </span>
  );
}

// holiday_date arrives as a bare "YYYY-MM-DD". `new Date("YYYY-MM-DD")`
// parses that as UTC midnight, which then renders as the PREVIOUS day for
// anyone whose timezone is behind UTC (see utils/date.js) -- so parse it
// as a local date instead, and the date/weekday shown always match the
// calendar day stored.
function formatDate(iso) {
  const d = parseLocalISODate(iso);
  if (!d) return iso || "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatWeekday(iso) {
  const d = parseLocalISODate(iso);
  return d ? d.toLocaleDateString("en-GB", { weekday: "long" }) : "";
}

// A holiday that really falls on a Sunday is observed on the Monday
// (holiday_date = observed day, raw_holiday_date = the real calendar
// date). Without a hint, the card shows a Monday date that doesn't match
// the festival's actual date and looks wrong -- so say so.
function actualDateNote(h) {
  if (!h.raw_holiday_date || h.raw_holiday_date === h.holiday_date) return "";
  const raw = parseLocalISODate(h.raw_holiday_date);
  if (!raw) return "";
  const short = raw.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `Observed — falls on ${short}`;
}

export default function HolidaysCalendarCard() {
  const { user } = useAuth();
  const countryCode = detectCountryCode(user);

  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  // Only exists to force a re-render so `today` below is recalculated.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!countryCode) {
      // No seeded calendar for this nationality -- nothing to fetch,
      // and definitely don't fall back to showing every country's
      // holidays just to have something on screen.
      setHolidays([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    function fetchHolidays(showSpinner) {
      if (showSpinner) setLoading(true);
      apiClient
        .get(`/holidays/?country=${countryCode}`)
        .then((res) => {
          if (cancelled) return;
          setHolidays(res.data || []);
        })
        .catch(() => {
          // Keep whatever is already on screen on a background refresh;
          // only the first load falls back to an empty list.
          if (!cancelled && showSpinner) setHolidays([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    fetchHolidays(true);

    // The dashboard can stay open for days: when the tab becomes visible
    // again, re-fetch (picks up newly uploaded holidays) and bump `tick`
    // so "today" is recomputed (drops a holiday that has now passed).
    function handleVisible() {
      if (document.visibilityState === "visible") {
        fetchHolidays(false);
        setTick((t) => t + 1);
      }
    }
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [countryCode]);

  const today = toLocalISODate();
  const list = holidays
    .filter((h) => h.holiday_date >= today)
    .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <CalendarDays size={17} className="text-orange-500" /> Upcoming
          Holidays
        </h3>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-10 bg-slate-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : !countryCode ? (
        <p className="text-sm text-slate-400">
          Holiday calendar not available for your country yet.
        </p>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-400">No upcoming holidays.</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-y-auto max-h-64 flex-1 min-h-0">
          {list.map((h) => (
            <li key={h.id} className="flex items-center gap-3 py-2.5">
              <HolidayIcon name={h.holiday_name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {h.holiday_name}
                </p>
                <p className="text-xs text-slate-400">
                  {formatDate(h.holiday_date)} · {formatWeekday(h.holiday_date)}
                </p>
                {actualDateNote(h) && (
                  <p className="text-[11px] text-slate-400/80 mt-0.5">
                    {actualDateNote(h)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
