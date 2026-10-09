import { useEffect, useState } from "react";
import { countUpcomingHolidays } from "../components/common/Holidayscalendarcard";
import { apiClient } from "../services/apiClient";

// Lightweight counts for the Birthdays / Holidays / On Leave cards so a
// dashboard can rank them (see utils/rankCards.js) WITHOUT mounting the
// cards themselves -- on mobile the cards live inside closed sheets /
// accordions. Each value is null until its request finishes.
//
// Announcements are not fetched here: every dashboard already has them
// in state, so pass that count to rankByCount() yourself.
export default function useOfficeFeedCounts() {
  const [counts, setCounts] = useState({
    onleave: null,
    birthdays: null,
    holidays: null,
  });

  useEffect(() => {
    let cancelled = false;
    const set = (key, value) => {
      if (!cancelled) setCounts((c) => ({ ...c, [key]: value }));
    };

    function load() {
      apiClient
        .get("/dashboard/on-leave-today")
        .then((res) => set("onleave", (res?.employees || []).length))
        .catch(() => set("onleave", 0));
      apiClient
        .get("/dashboard/celebrations?days=30")
        .then((res) =>
          set(
            "birthdays",
            (res?.birthdays || []).length + (res?.anniversaries || []).length,
          ),
        )
        .catch(() => set("birthdays", 0));
      apiClient
        .get("/holidays/")
        .then((res) => set("holidays", countUpcomingHolidays(res?.data)))
        .catch(() => set("holidays", 0));
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

  return counts;
}
