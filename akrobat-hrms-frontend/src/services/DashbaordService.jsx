import { apiClient } from "./apiClient";

// GET /dashboard/quote-of-day (see backend app/dashboard/routes.py +
// services.get_quote_of_day). The backend itself caches today's quote in
// the `daily_quotes` table — one row per day, first request of the day
// fetches from external APIs, everyone after that reads the cached row —
// so every employee sees the same quote and background for the day.
//
// Response shape (unwrapped from the {success, message, data} envelope —
// see app/core/responses.py):
//   { id, date, quote, author, background_url, source }
// `source` is 'cached' | 'api' | 'fallback' — informational only, not
// required by the UI, but useful if you ever want to show a subtle
// "offline content" indicator.

export const dashboardService = {
  async getQuoteOfDay() {
    const envelope = await apiClient.get("/dashboard/quote-of-day");
    return envelope?.data;
  },
};
