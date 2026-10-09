import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { apiClient } from "../../services/apiClient";
import { parseLocalISODate, toLocalISODate } from "../../utils/date";

// Akrobat is HQ'd in Singapore with staff in India (see
// sql/029.sql for the seeded calendars -- SG and IN currently have rows).
//
// EVERY employee sees EVERY holiday, regardless of nationality or work
// location: Singapore staff see India's holidays and vice versa, merged
// into one date-ordered list. A holiday that exists in only ONE country's
// calendar gets a small SG / IN tag; a holiday shared by both (merged into
// a single entry) gets no tag.
//
// Because both calendars are merged, the same holiday often exists twice
// (e.g. SG "Christmas Day" and IN "Christmas" on 25 Dec). Rows that share
// a date and the same holiday name are collapsed into ONE entry -- see
// dedupeHolidays() below.
//
// Backend: GET /holidays/ with no `country` param returns all rows
// (see app/holidays/routes.py).

// Rows may carry the country as a code ("SG") or spelled out
// ("Singapore", "INDIA") when they came from an Excel upload.
function countryCode(raw) {
  const text = String(raw || "")
    .trim()
    .toLowerCase();
  if (!text) return null;
  if (/^(sg|sgp|singapore|singaporean)$/.test(text)) return "SG";
  if (/^(in|ind|india|indian)$/.test(text)) return "IN";
  return text.toUpperCase().slice(0, 3);
}

// Words that don't change which holiday it is, so "Christmas" and
// "Christmas Day" compare equal. "diwali" is folded into "deepavali"
// (same festival, different spelling per country).
const NAME_NOISE = new Set(["day", "public", "holiday", "the", "of"]);

function nameTokens(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !NAME_NOISE.has(t))
    .map((t) => (t === "diwali" ? "deepavali" : t));
}

// Same holiday if one name's words are all contained in the other's
// ("good friday" vs "good friday").
function sameHolidayName(a, b) {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return small.every((t) => big.includes(t));
}

// Keeps one row per (date, holiday). When two rows match, the one with the
// longer/more descriptive name wins ("Christmas Day" over "Christmas").
function dedupeHolidays(rows) {
  const kept = [];
  rows.forEach((h) => {
    const code = countryCode(h.country);
    const idx = kept.findIndex(
      (k) =>
        k.holiday_date === h.holiday_date &&
        sameHolidayName(k.holiday_name, h.holiday_name),
    );
    if (idx === -1) {
      kept.push({ ...h, _countries: new Set(code ? [code] : []) });
      return;
    }
    if (code) kept[idx]._countries.add(code);
    if ((h.holiday_name || "").length > (kept[idx].holiday_name || "").length) {
      kept[idx] = { ...h, _countries: kept[idx]._countries };
    }
  });
  return kept;
}

// Tag only when the holiday belongs to exactly one country.
function singleCountryTag(h) {
  return h._countries && h._countries.size === 1 ? [...h._countries][0] : null;
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

export default function HolidaysCalendarCard({ onCount } = {}) {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  // Only exists to force a re-render so `today` below is recalculated.
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    function fetchHolidays(showSpinner) {
      if (showSpinner) setLoading(true);
      apiClient
        .get("/holidays/")
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
  }, []);

  const today = toLocalISODate();
  const list = dedupeHolidays(
    holidays
      .filter((h) => h.holiday_date >= today)
      .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)),
  );

  // Optional: report the row count to the parent (see OnLeaveTodayCard).
  useEffect(() => {
    if (!loading) onCount?.(list.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, list.length]);

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
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-400">No upcoming holidays.</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-y-auto max-h-64 flex-1 min-h-0">
          {list.map((h) => (
            <li key={h.id} className="flex items-center gap-3 py-2.5">
              <HolidayIcon name={h.holiday_name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate flex items-center gap-1.5">
                  <span className="truncate">{h.holiday_name}</span>
                  {singleCountryTag(h) && (
                    <span className="shrink-0 text-[10px] font-semibold leading-none px-1.5 py-1 rounded bg-slate-100 text-slate-500">
                      {singleCountryTag(h)}
                    </span>
                  )}
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
