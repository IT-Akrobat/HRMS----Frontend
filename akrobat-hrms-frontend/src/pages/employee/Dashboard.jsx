import {
  Cake,
  CalendarDays,
  ClipboardList,
  Clock,
  Megaphone,
  Palmtree,
  PlaneTakeoff,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import BirthdaysCard, {
  OnLeaveTodayCard,
} from "../../components/common/CelebrationsStrip";
import CheckInOutCard from "../../components/common/CheckInOutCard";
import HolidaysCalendarCard from "../../components/common/Holidayscalendarcard";
import MobileQuickActions from "../../components/common/MobileQuickActions";
import {
  default as OutdoorCheckinAccessModal,
  default as OutdoorVisitCard,
} from "../../components/common/Outdoorcheckinaccessmodal";
import PageHeader from "../../components/common/PageHeader";
import QuoteOfDayCard from "../../components/common/Quoteofdaycard";
import SiteVisitCard from "../../components/common/SiteVisitCard";
import { useAuth } from "../../context/AuthContext";
import { useAttendanceLiveUpdates } from "../../hooks/Useattendanceliveupdates";
import { apiClient } from "../../services/apiClient";
import { isFieldEmployee } from "../../utils/employeeType";

// Mobile-only dashboard shortcuts (see MobileQuickActions) — icons match
// what these same destinations use in config/navigationConfig.js:
// "My Attendance" -> Attendance group (Clock), "Sites Worked" -> My
// Profile group (User), "Apply Leave" -> Leave group (Palmtree).
const EMPLOYEE_QUICK_ACTIONS = [
  { to: "/employee/attendance", label: "My Attendance", icon: Clock },
  { to: "/employee/profile/sites", label: "Sites Worked", icon: User },
  { to: "/employee/leave/apply", label: "Apply Leave", icon: Palmtree },
];

const LEAVE_STATUS_STYLES = {
  Approved: "bg-blue-50 text-blue-600",
  Pending: "bg-orange-50 text-orange-600",
  Rejected: "bg-orange-50 text-orange-500",
};

// Everything here is scoped to "me" (or, for Holidays/Celebrations,
// company-wide but non-sensitive) — /announcements/active, /holidays,
// /dashboard/celebrations. No org-wide headcount/attrition numbers
// belong on this page; an Employee has no VIEW_EMPLOYEE /
// VIEW_ATTENDANCE permission (see the permission matrix), so those
// endpoints would 403 anyway.
//
// Layout:
//   Good Morning header
//   Row 1: Check-in/out            | Quote of the Day
//   Row 2: Upcoming Holidays (SG/IN tabs) | Announcements
//   Row 3: On Leave Today | Upcoming Birthdays — same two-card row
//          pattern as Row 2 above.

// An announcement is "expired" once today is past its end_date. The
// Announcements panel keeps showing these (greyed out) instead of hiding
// them the moment /announcements/active would stop returning them.
function isAnnouncementExpired(a) {
  if (!a?.end_date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return a.end_date < today;
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const isFieldStaff = isFieldEmployee(user);
  // Off for everyone until HR enables it for a specific person on the
  // Employee edit screen — see app/auth/services.py::get_me and
  // sql/030.sql. Not a role/department check on purpose.
  const canOutdoorCheckin = Boolean(user?.profile?.outdoor_checkin_enabled);

  const [announcements, setAnnouncements] = useState([]);

  // Mobile only (see the "Around the Office" tile below) — expired
  // announcements are excluded entirely here instead of greyed-out like
  // the desktop panel still does with the full `announcements` array.
  // Desktop is untouched.
  const activeAnnouncements = useMemo(
    () => announcements.filter((a) => !isAnnouncementExpired(a)),
    [announcements],
  );

  // ---- Mobile-only dashboard state ----
  // Which "Around the Office" bento tile has its bottom sheet open.
  // Desktop/tablet (lg and up) keeps the original always-visible
  // stacked cards untouched — this only drives the lg:hidden layout.
  const [openSheet, setOpenSheet] = useState(null);

  // Which mobile tab is active for the Check-In / Site Visit pair below
  // — replaces the old always-stacked-both-cards layout so field staff
  // aren't scrolling past a second full card just to get to Site
  // Visits. Irrelevant (and unused) for office staff, who never see the
  // tab strip at all since there's nothing to switch to.
  const [mobileTab, setMobileTab] = useState("checkin");

  // Which tabs (if any) the mobile Check-In row shows, alongside what
  // each key means for THIS employee. Field staff get Check In / Site
  // Visit; office staff with outdoor check-in enabled get Check In /
  // Meeting instead — same reasoning as the field-staff case: these are
  // two different moments in the day, not something to stack and
  // scroll past. Office staff without outdoor check-in enabled get no
  // tabs at all, same as before.
  const mobileTabs = isFieldStaff
    ? [
        { key: "checkin", label: "Check In" },
        { key: "sitevisit", label: "Site Visit" },
      ]
    : canOutdoorCheckin
      ? [
          { key: "checkin", label: "Check In" },
          { key: "meeting", label: "Meeting" },
        ]
      : [];

  // Recent leave requests (for the small icon next to "Hi, {firstName}")
  // — fetched from /leaves/my, same endpoint LeaveApply.jsx uses for its
  // own "Recent Requests" panel. null = not fetched yet.
  const [recentLeaves, setRecentLeaves] = useState(null);

  // Only field staff (Inspection/Operation) need today's checked-in/out
  // state here — it's what SiteVisitCard needs to decide whether to show
  // itself at all (nothing to log before check-in, nothing left to log
  // after check-out). Office staff never fetch this; CheckInOutCard below
  // already tracks its own status independently for the button itself.
  const [todayStatus, setTodayStatus] = useState({
    checkedIn: false,
    checkedOut: false,
  });

  function loadTodayStatus() {
    if (!isFieldStaff) return;
    const today = new Date().toISOString().slice(0, 10);
    apiClient
      .get(`/attendance/timeline/${today}`)
      .then((res) =>
        setTodayStatus({
          checkedIn: !!res?.data?.check_in_time,
          checkedOut: !!res?.data?.check_out_time,
        }),
      )
      .catch(() => setTodayStatus({ checkedIn: false, checkedOut: false }));
  }

  function loadAnnouncements() {
    apiClient
      // Fetch every announcement (not just /active) so expired ones stay
      // visible here, greyed out, instead of vanishing the moment their
      // end_date passes — matches Super Admin's Announcements panel.
      .get("/announcements/")
      .then((res) => setAnnouncements(res.data || []))
      .catch(() => setAnnouncements([]));
  }

  // Only matters for field staff (loadTodayStatus no-ops otherwise), but
  // harmless to call either way — keeps SiteVisitCard's checked-in/out
  // gating correct if this employee's own check-in/out came through a
  // different tab or device rather than this page's own CheckInOutCard.
  // Also refetches announcements (a new one just went out, or one this
  // employee is looking at just got edited/expired), and — if the
  // "Applied Leave Requests" sheet has already been opened once this
  // session — the recent-leaves list, so an approval/rejection shows up
  // immediately instead of needing the sheet reopened.
  useAttendanceLiveUpdates(() => {
    loadTodayStatus();
    loadAnnouncements();
    if (recentLeaves !== null) {
      apiClient
        .get("/leaves/my")
        .then((res) => setRecentLeaves((res.data || []).slice(0, 5)))
        .catch(() => {});
    }
  });

  useEffect(() => {
    loadAnnouncements();
    loadTodayStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstName = user?.name?.split(" ")[0] || "there";

  const initials = useMemo(() => {
    const parts = (user?.name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [user?.name]);

  const todayLong = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  // Tiles for the mobile "Around the Office" bento grid. Each tile opens
  // the matching bottom sheet on tap instead of a plain stacked card —
  // reuses the exact same components/data as desktop, just a different
  // entry interaction.
  const officeTiles = [
    {
      key: "announcements",
      label: "Announcements",
      icon: Megaphone,
      wide: true,
      accent: "from-orange-50 to-white border-orange-100 text-orange-500",
      preview:
        activeAnnouncements.length === 0
          ? "No active announcements"
          : activeAnnouncements[0].title,
      badge: activeAnnouncements.length || null,
    },
    {
      key: "birthdays",
      label: "Birthdays",
      icon: Cake,
      accent: "from-pink-50 to-white border-pink-100 text-pink-500",
      preview: "Tap to see who's celebrating",
    },
    {
      key: "holidays",
      label: "Holidays",
      icon: CalendarDays,
      accent: "from-sky-50 to-white border-sky-100 text-sky-500",
      preview: "Tap to view the calendar",
    },
    {
      key: "onleave",
      label: "On Leave",
      icon: PlaneTakeoff,
      accent: "from-violet-50 to-white border-violet-100 text-violet-500",
      preview: "Tap to see who's out today",
    },
  ];

  const sheetTitles = {
    announcements: "Announcements",
    birthdays: "Upcoming Birthdays",
    holidays: "Upcoming Holidays",
    onleave: "On Leave Today",
    recentleave: "Applied Leave Requests",
  };

  return (
    <div className="overflow-x-hidden">
      {/* ---------- Desktop/tablet header (lg and up) — unchanged ---------- */}
      <div className="hidden lg:block">
        <PageHeader
          title={`Good Morning, ${user?.name?.split(" ")[0] || "there"} 👋`}
          subtitle="Welcome back! Here's what's happening today."
          actions={<QuoteOfDayCard compact />}
        />
      </div>

      {/* =================================================================
          MOBILE-ONLY DASHBOARD (below lg)
          A different pattern from the desktop grid on purpose: a plain
          (non-boxed) greeting instead of a hero banner, Check-in front
          and center, and the secondary content — Announcements,
          Birthdays, Holidays, On Leave — as a tappable bento grid that
          opens a bottom sheet, instead of stacked cards or tabs. Same
          data/components as desktop; only the interaction changes.
      ================================================================= */}
      <div className="lg:hidden">
        {/* ---------- Plain greeting (no card/banner) ---------- */}
        <div className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-orange-500">{todayLong}</p>
              <h1 className="text-2xl font-extrabold text-slate-800 mt-0.5 truncate">
                Hi, {firstName} 👋
              </h1>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpenSheet("recentleave");
                if (recentLeaves === null) {
                  apiClient
                    .get("/leaves/my")
                    .then((res) =>
                      setRecentLeaves((res.data || []).slice(0, 5)),
                    )
                    .catch(() => setRecentLeaves([]));
                }
              }}
              title="Applied Leave Requests"
              aria-label="Applied Leave Requests"
              className="w-8 h-8 rounded-full bg-orange-50 hover:bg-orange-500 text-orange-500 hover:text-white flex items-center justify-center transition-colors shrink-0"
            >
              <ClipboardList size={15} />
            </button>
          </div>
          <div className="mt-3">
            <QuoteOfDayCard compact />
          </div>
          <MobileQuickActions actions={EMPLOYEE_QUICK_ACTIONS} />
        </div>

        {/* ---------- Check-in / Site Visit / Meeting ----------
            Anyone with a second tab (field staff: Site Visit; office
            staff with outdoor check-in enabled: Meeting) switches
            between the two with a tab strip instead of scrolling past
            both stacked full-height — these are two different moments
            in the day, not something you read top-to-bottom together.
            Everyone else has no second tab at all, so they just get the
            plain check-in card, same as before. ---------- */}
        <div className="mb-6">
          {mobileTabs.length > 0 && (
            <div className="flex gap-1.5 mb-3 bg-slate-100 rounded-xl p-1">
              {mobileTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setMobileTab(tab.key)}
                  className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-colors ${
                    mobileTab === tab.key
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {(mobileTabs.length === 0 || mobileTab === "checkin") && (
            <div className="rounded-2xl bg-gradient-to-br from-[#0B1830] via-[#132445] to-orange-500/90 p-[3px] shadow-lg shadow-slate-900/10 [&>div]:rounded-[13px]">
              <CheckInOutCard ultraCompact onActivityChange={loadTodayStatus} />
            </div>
          )}

          {isFieldStaff && mobileTab === "sitevisit" && (
            <div className="rounded-2xl bg-gradient-to-br from-[#0B1830] via-[#132445] to-orange-500/90 p-[3px] shadow-lg shadow-slate-900/10 [&>div]:rounded-[13px]">
              <SiteVisitCard
                checkedIn={todayStatus.checkedIn}
                checkedOut={todayStatus.checkedOut}
                onActivityChange={loadTodayStatus}
              />
            </div>
          )}

          {/* Ad-hoc "meeting/site" check-in — completely separate gate
              from isFieldStaff above. Renders only for the specific
              employees HR has individually enabled, regardless of
              their department or role, and only on its own "Meeting"
              tab now rather than stacked below Check In. */}
          {!isFieldStaff && canOutdoorCheckin && mobileTab === "meeting" && (
            <div className="rounded-2xl bg-gradient-to-br from-[#0B1830] via-[#132445] to-orange-500/90 p-[3px] shadow-lg shadow-slate-900/10 [&>div]:rounded-[13px]">
              <OutdoorCheckinAccessModal
                checkedIn={todayStatus.checkedIn}
                checkedOut={todayStatus.checkedOut}
                onActivityChange={loadTodayStatus}
              />
            </div>
          )}
        </div>

        {/* ---------- Around the Office: tappable bento grid ----------
            A wide Announcements tile up top, three square tiles below.
            Tapping any tile slides up a bottom sheet with the full card
            — nothing is stacked full-height in the page flow. */}
        <div className="flex items-center gap-2 mb-2 px-0.5">
          <span className="h-1.5 w-4 rounded-full bg-orange-500" />
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Around the Office
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {officeTiles.map(
            ({ key, label, icon: Icon, wide, accent, preview, badge }) => (
              <button
                key={key}
                type="button"
                onClick={() => setOpenSheet(key)}
                className={`${
                  wide ? "col-span-2" : ""
                } text-left rounded-2xl border bg-gradient-to-br p-4 active:scale-[0.97] transition-transform ${accent}`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <Icon size={18} />
                  {badge ? (
                    <span className="rounded-full bg-white/70 px-1.5 text-[10px] font-semibold">
                      {badge}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs font-semibold text-slate-700">{label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                  {preview}
                </p>
              </button>
            ),
          )}
        </div>
      </div>

      {/* ---------- Bottom sheet (mobile only) ----------
          Slides up over the page for whichever tile was tapped. Reuses
          the same components as desktop, just presented one at a time
          in an overlay instead of inline in the page. */}
      {openSheet && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex items-end justify-center"
          onClick={() => setOpenSheet(null)}
        >
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-white rounded-t-3xl p-4 pb-6 max-h-[75vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200 mb-4" />
            <h3 className="font-semibold text-slate-800 mb-3 px-0.5">
              {sheetTitles[openSheet]}
            </h3>

            {openSheet === "announcements" &&
              (activeAnnouncements.length === 0 ? (
                <p className="text-sm text-slate-400 px-0.5 pb-2">
                  No active announcements.
                </p>
              ) : (
                <div className="space-y-2.5 pb-2">
                  {/* Expired announcements are dropped entirely here —
                      mobile only shows what's still active, no greyed-out
                      "Expired" entries to scroll past. */}
                  {[...activeAnnouncements]
                    .sort((a, b) =>
                      (b.end_date || "").localeCompare(a.end_date || ""),
                    )
                    .map((a) => (
                      <div
                        key={a.id}
                        className="rounded-lg p-3 border bg-orange-50 border-orange-100"
                      >
                        <p className="text-sm font-medium text-slate-800">
                          {a.title}
                        </p>
                        <p className="text-xs mt-0.5 text-slate-500">
                          {a.description}
                        </p>
                      </div>
                    ))}
                </div>
              ))}

            {openSheet === "birthdays" && (
              <div className="h-72">
                <BirthdaysCard />
              </div>
            )}

            {openSheet === "holidays" && (
              <div className="h-72">
                <HolidaysCalendarCard />
              </div>
            )}

            {openSheet === "onleave" && (
              <div className="h-72">
                <OnLeaveTodayCard />
              </div>
            )}

            {openSheet === "recentleave" &&
              (recentLeaves === null ? (
                <div className="space-y-2 pb-2">
                  <div className="h-10 bg-slate-100 rounded animate-pulse" />
                  <div className="h-10 bg-slate-100 rounded animate-pulse" />
                </div>
              ) : recentLeaves.length === 0 ? (
                <p className="text-sm text-slate-400 px-0.5 pb-2">
                  No leave requests yet.
                </p>
              ) : (
                <ul className="space-y-3 pb-2">
                  {recentLeaves.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div>
                        <p className="text-slate-700 font-medium">
                          {r.leave_types?.leave_name || "Leave"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(r.start_date).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                          {" – "}
                          {new Date(r.end_date).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          LEAVE_STATUS_STYLES[r.status] ||
                          "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {r.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ))}
          </div>
        </div>
      )}
      {/* ================= END MOBILE-ONLY DASHBOARD ================= */}

      {/* ---------- Two-column body (lg and up) — unchanged ----------
          Left (65%):  Check-in/out -> Site Visits (field staff only)
          Right (35%): Announcements -> Upcoming Birthdays -> Upcoming
                       Holidays -> On Leave Today. Every card below is a
                       fixed height with its own hidden-scrollbar overflow
                       so extra items scroll inside the card instead of
                       growing the row.
      ---------------------------------------------------------------- */}
      <div className="hidden lg:grid lg:grid-cols-[65%_1fr] gap-4 sm:gap-6 items-start min-w-0">
        {/* ================= Left column (65%) ================= */}
        <div className="flex flex-col gap-4 sm:gap-6 min-w-0">
          <CheckInOutCard compact onActivityChange={loadTodayStatus} />

          {isFieldStaff && (
            <SiteVisitCard
              checkedIn={todayStatus.checkedIn}
              checkedOut={todayStatus.checkedOut}
              onActivityChange={loadTodayStatus}
            />
          )}

          {!isFieldStaff && canOutdoorCheckin && (
            <OutdoorVisitCard
              checkedIn={todayStatus.checkedIn}
              checkedOut={todayStatus.checkedOut}
              onActivityChange={loadTodayStatus}
            />
          )}
        </div>

        {/* ================= Right column (35%) =================
            Fixed height + its own vertical scroll, so this column never
            grows taller than the viewport / left column — it scrolls
            independently instead of pushing the page down. */}
        <div className="flex flex-col gap-4 sm:gap-6 min-w-0 lg:h-[calc(100vh-6rem)] lg:sticky lg:top-4 lg:overflow-y-auto lg:pr-1 scrollbar-hide">
          {/* ---------- Announcements ---------- */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 h-60 sm:h-72 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Megaphone size={17} className="text-orange-500" />{" "}
                Announcements
              </h3>
            </div>
            {announcements.length === 0 ? (
              <p className="text-sm text-slate-400">No announcements yet.</p>
            ) : (
              <div className="space-y-3 overflow-y-auto scrollbar-hide flex-1">
                {/* Active announcements first, then expired ones (most
                    recently ended first) — expired stay visible, just
                    greyed out, instead of disappearing. */}
                {[...announcements]
                  .sort((a, b) => {
                    const aExpired = isAnnouncementExpired(a);
                    const bExpired = isAnnouncementExpired(b);
                    if (aExpired !== bExpired) return aExpired ? 1 : -1;
                    return (b.end_date || "").localeCompare(a.end_date || "");
                  })
                  .map((a) => {
                    const expired = isAnnouncementExpired(a);
                    return (
                      <div
                        key={a.id}
                        className={
                          "rounded-lg p-3 border " +
                          (expired
                            ? "bg-slate-50 border-slate-200 opacity-60"
                            : "bg-orange-50 border-orange-100")
                        }
                      >
                        <div className="flex items-center gap-1.5">
                          <p
                            className={
                              "text-sm font-medium " +
                              (expired ? "text-slate-500" : "text-slate-800")
                            }
                          >
                            {a.title}
                          </p>
                          {expired && (
                            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-400 bg-slate-200 rounded px-1.5 py-0.5">
                              Expired
                            </span>
                          )}
                        </div>
                        <p
                          className={
                            "text-xs mt-0.5 " +
                            (expired ? "text-slate-400" : "text-slate-500")
                          }
                        >
                          {a.description}
                        </p>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* ---------- Upcoming Birthdays ---------- */}
          <div className="h-60 sm:h-72">
            <BirthdaysCard />
          </div>

          {/* ---------- Upcoming Holidays ---------- */}
          <div className="h-60 sm:h-72">
            <HolidaysCalendarCard />
          </div>

          {/* ---------- On Leave Today ---------- */}
          <div className="h-60 sm:h-72">
            <OnLeaveTodayCard />
          </div>
        </div>
      </div>
    </div>
  );
}
