import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { apiClient } from "../../services/apiClient";
import { toLocalISODate } from "../../utils/date";

// Akrobat is HQ'd in Singapore with staff in India (see
// sql/012_holiday_country_and_employee_dob.sql for the seeded 2026
// calendars) — so this widget shows both, tab-switched, instead of one
// merged list. Backend filters by `country` (GET /holidays/?country=SG),
// see app/holidays/routes.py.

const COUNTRIES = [
  { code: "SG", label: "Singapore" },
  { code: "IN", label: "India" },
];

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
  const [country, setCountry] = useState("SG");
  const [holidaysByCountry, setHolidaysByCountry] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all(
      COUNTRIES.map((c) =>
        apiClient
          .get(`/holidays/?country=${c.code}`)
          .then((res) => [c.code, res.data || []])
          .catch(() => [c.code, []]),
      ),
    ).then((entries) => {
      if (cancelled) return;
      setHolidaysByCountry(Object.fromEntries(entries));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const today = toLocalISODate();
  const list = (holidaysByCountry[country] || [])
    .filter((h) => h.holiday_date >= today)
    .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <CalendarDays size={17} className="text-orange-500" /> Upcoming
          Holidays
        </h3>
        {/* <Link
          to="holidays"
          className="text-xs text-orange-600 font-medium shrink-0"
        >
          View Calendar
        </Link> */}
      </div>

      {/* Country tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-3 w-fit">
        {COUNTRIES.map((c) => (
          <button
            key={c.code}
            onClick={() => setCountry(c.code)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              country === c.code
                ? "bg-white text-orange-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {c.label}
          </button>
        ))}
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
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-400">
          No upcoming holidays for {country === "SG" ? "Singapore" : "India"}.
        </p>
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
