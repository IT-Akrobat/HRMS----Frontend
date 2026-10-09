import { useEffect, useState } from "react";
import { getUpcomingHolidays } from "../components/common/Holidayscalendarcard";
import { apiClient } from "../services/apiClient";

// Counts + the first few rows for the Birthdays / Holidays / On Leave
// cards, so a dashboard can rank them (see utils/rankCards.js) and show
// real names/dates on a tile WITHOUT mounting the cards themselves -- on
// mobile the cards live inside closed sheets / accordions.
//
// Returns { onleave, birthdays, holidays, details }.
//   - the three counts are null until their request finishes
//   - details.onleave   -> [{ full_name, ... }]
//   - details.birthdays -> [{ full_name, days_away, ... }] (birthdays first,
//                          then anniversaries, same order as the card)
//   - details.holidays  -> [{ holiday_name, holiday_date, ... }] upcoming
//
// Announcements are not fetched here: every dashboard already has them
// in state, so pass that count to rankByCount() yourself.
export default function useOfficeFeedCounts() {
  const [state, setState] = useState({
    onleave: null,
    birthdays: null,
    holidays: null,
    details: { onleave: [], birthdays: [], holidays: [] },
  });

  useEffect(() => {
    let cancelled = false;
    const set = (key, list) => {
      if (cancelled) return;
      setState((s) => ({
        ...s,
        [key]: list.length,
        details: { ...s.details, [key]: list },
      }));
    };

    function load() {
      apiClient
        .get("/dashboard/on-leave-today")
        .then((res) => set("onleave", res?.employees || []))
        .catch(() => set("onleave", []));
      apiClient
        .get("/dashboard/celebrations?days=30")
        .then((res) =>
          set("birthdays", [
            ...(res?.birthdays || []),
            ...(res?.anniversaries || []),
          ]),
        )
        .catch(() => set("birthdays", []));
      apiClient
        .get("/holidays/")
        .then((res) => set("holidays", getUpcomingHolidays(res?.data)))
        .catch(() => set("holidays", []));
    }

    load();
    // Dashboard can stay open for days -- refresh when the tab returns.
    function onVisible() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return state;
}
