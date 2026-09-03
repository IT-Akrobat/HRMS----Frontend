import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { apiClient } from "../../services/apiClient";
import { toLocalISODate } from "../../utils/date";

// Akrobat is HQ'd in Singapore with staff in India (see
// sql/012_holiday_country_and_employee_dob.sql for the seeded 2026
// calendars).
//
// Earlier versions of this card tried to guess which single calendar
// (SG or IN) each employee should see -- first with a manual tab
// (anyone could flip to the other country's list), then keyed off
// employees.nationality (wrong signal: nationality != which office/
// country someone actually works out of, and there's no reliable
// "which country is this person based in" field anywhere in the data
// model -- work_location is free text, not a country).
//
// Simpler, correct-by-construction approach: show ONE merged list to
// everyone, with each holiday tagged by which country observes it. A
// date that's a holiday in both countries needs no tag at all (it's a
// holiday for everyone that day, so there's nothing to disambiguate);
// a date that's a holiday in only one country is tagged with that
// country's name so nobody mistakes "this is a leave day in India" for
// "this is a leave day for me in Singapore" (or vice versa). This
// sidesteps ever needing to know which country a given employee
// belongs to.
//
// Backend filters by `country` (GET /holidays/?country=SG|IN), see
// app/holidays/routes.py.

const COUNTRY_LABEL = { SG: "Singapore", IN: "India" };

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

// Merge the SG + IN rows into one list, one entry per date. Dates that
// are a holiday in both countries get no country tag; dates that are
// a holiday in only one country get tagged with that country's name.
function mergeByDate(sgHolidays, inHolidays) {
  const byDate = new Map();

  for (const h of sgHolidays) {
    if (!byDate.has(h.holiday_date)) byDate.set(h.holiday_date, []);
    byDate.get(h.holiday_date).push({ ...h, country: "SG" });
  }
  for (const h of inHolidays) {
    if (!byDate.has(h.holiday_date)) byDate.set(h.holiday_date, []);
    byDate.get(h.holiday_date).push({ ...h, country: "IN" });
  }

  return Array.from(byDate.entries()).map(([date, entries]) => {
    const countries = new Set(entries.map((e) => e.country));
    const isCommonToBoth = countries.has("SG") && countries.has("IN");
    // Same date can carry different names in each country's sheet
    // (e.g. "Deepavali" vs "Diwali") — de-dupe identical names, but
    // keep distinct ones so nothing gets silently dropped.
    const names = [...new Set(entries.map((e) => e.holiday_name))];

    return {
      id: entries[0].id,
      date,
      names,
      // null = common to both, no tag needed. Otherwise the single
      // country this date belongs to.
      tagCountry: isCommonToBoth ? null : entries[0].country,
    };
  });
}

export default function HolidaysCalendarCard() {
  const [merged, setMerged] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      apiClient.get("/holidays/?country=SG").catch(() => ({ data: [] })),
      apiClient.get("/holidays/?country=IN").catch(() => ({ data: [] })),
    ]).then(([sgRes, inRes]) => {
      if (cancelled) return;
      setMerged(mergeByDate(sgRes.data || [], inRes.data || []));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const today = toLocalISODate();
  const list = merged
    .filter((h) => h.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

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
        <p className="text-sm text-slate-400">No upcoming holidays.</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-y-auto max-h-64">
          {list.map((h) => (
            <li key={h.id} className="flex items-center gap-3 py-2.5">
              <span className="text-xl shrink-0">{emojiFor(h.names[0])}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {h.names.join(" / ")}
                  {h.tagCountry && (
                    <span className="ml-2 inline-block align-middle text-[10px] font-medium text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-2 py-0.5">
                      {COUNTRY_LABEL[h.tagCountry]}
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  {formatDate(h.date)} · {formatWeekday(h.date)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
