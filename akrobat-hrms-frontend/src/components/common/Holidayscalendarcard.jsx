import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../services/apiClient";
import { toLocalISODate } from "../../utils/date";

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
// guessing or falling back to a merged list.
//
// Backend filters by `country` (GET /holidays/?country=SG|IN), see
// app/holidays/routes.py. Only Singapore and India have seeded
// calendars right now.
const COUNTRY_HINTS = [
  { code: "IN", pattern: /india|indian/i },
  { code: "SG", pattern: /singapore|singaporean/i },
];

function detectCountryCode(user) {
  const nationality = user?.profile?.nationality || "";
  const workLocation = user?.profile?.work_location || "";
  for (const text of [nationality, workLocation]) {
    const hit = COUNTRY_HINTS.find(({ pattern }) => pattern.test(text));
    if (hit) return hit.code;
  }
  return null;
}

// A light emoji per common holiday name, purely decorative — falls
// back to the calendar icon for anything not in the list, so this
// never breaks for a holiday name we haven't seen.
const EMOJI_BY_KEYWORD = [
  [/new year/i, "🎉"],
  [/chinese new year/i, "🧧"],
  [/hari raya puasa|eid al-fitr/i, "🌙"],
  [/hari raya haji|eid al-adha/i, "🕌"],
  [/good friday/i, "✝️"],
  [/labour day|labor day/i, "🛠️"],
  [/vesak/i, "🪷"],
  [/national day/i, "🎊"],
  [/deepavali|diwali/i, "🪔"],
  [/christmas/i, "🎄"],
  [/republic day/i, "🇮🇳"],
  [/independence day/i, "🇮🇳"],
  [/holi/i, "🎨"],
  [/ram navami/i, "🙏"],
  [/raksha bandhan/i, "🧵"],
  [/ganesh chaturthi/i, "🐘"],
  [/gandhi jayanti/i, "🕊️"],
  [/dussehra/i, "🏹"],
];

function emojiFor(name) {
  const match = EMOJI_BY_KEYWORD.find(([re]) => re.test(name || ""));
  return match ? match[1] : "📅";
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatWeekday(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long" });
}

export default function HolidaysCalendarCard() {
  const { user } = useAuth();
  const countryCode = detectCountryCode(user);

  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);

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
    setLoading(true);

    apiClient
      .get(`/holidays/?country=${countryCode}`)
      .then((res) => {
        if (cancelled) return;
        setHolidays(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setHolidays([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
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
        <ul className="divide-y divide-slate-100 overflow-y-auto max-h-64">
          {list.map((h) => (
            <li key={h.id} className="flex items-center gap-3 py-2.5">
              <span className="text-xl shrink-0">
                {emojiFor(h.holiday_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {h.holiday_name}
                </p>
                <p className="text-xs text-slate-400">
                  {formatDate(h.holiday_date)} · {formatWeekday(h.holiday_date)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
