import {
  Bell,
  Building2,
  Cake,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  History,
  MapPin,
  Megaphone,
  MoreHorizontal,
  PartyPopper,
  PlaneTakeoff,
  Settings,
  User,
  Users,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import BirthdaysCard, {
  AnniversariesCard,
  OnLeaveTodayCard,
} from "../../components/common/CelebrationsStrip";
import CheckInOutCard from "../../components/common/CheckInOutCard";
import HolidaysCalendarCard from "../../components/common/Holidayscalendarcard";
import {
  default as OutdoorCheckinAccessModal,
  default as OutdoorVisitCard,
} from "../../components/common/Outdoorcheckinaccessmodal";
import PageHeader from "../../components/common/PageHeader";
import QuoteOfDayCard from "../../components/common/Quoteofdaycard";
import SiteVisitCard from "../../components/common/SiteVisitCard";
import { useAuth } from "../../context/AuthContext";
import { useAttendanceLiveUpdates } from "../../hooks/Useattendanceliveupdates";
import { useBasePath } from "../../hooks/useBasePath";
import useOfficeFeedCounts from "../../hooks/useOfficeFeedCounts";
import { apiClient } from "../../services/apiClient";
import { parseLocalISODate } from "../../utils/date";
import { isFieldEmployee } from "../../utils/employeeType";
import { rankByCount } from "../../utils/rankCards";
import { isSiteEmployee } from "../../utils/workingLocation";

// Mobile-only "Quick Actions" row — four big tiles right under the
// Check-in card. The first three go straight to a page; "More" opens a
// bottom sheet with everything else an employee can reach from the
// sidebar (so nothing is lost on mobile, where the sidebar is hidden).
//   Leave      -> Apply Leave
//   Attendance -> My Attendance (daily in/out log)
//   Request    -> Leave History (every request I've raised + its status)
const QUICK_ACTION_TILES = [
  {
    to: "/employee/leave/apply",
    label: "Leave",
    icon: FileText,
    tint: "bg-violet-100 text-violet-600",
  },
  {
    to: "/employee/attendance",
    label: "Attendance",
    icon: Clock,
    tint: "bg-sky-100 text-sky-600",
    // Working Location = "Site" employees don't see their own attendance
    // pages (see utils/workingLocation.js) — hidden from Quick Actions.
    hideForSite: true,
  },
  {
    // Same orange as the Announcements tile.
    to: "/employee/leave/history",
    label: "Request",
    icon: ClipboardList,
    tint: "bg-orange-100 text-orange-600",
  },
];

// Contents of the "More" bottom sheet. `fieldOnly` mirrors the sidebar:
// Sites Worked is only for Inspection / Operation staff.
const MORE_LINKS = [
  {
    to: "/employee/attendance/history",
    label: "Attendance History",
    icon: History,
    hideForSite: true,
  },
  {
    to: "/employee/profile/sites",
    label: "Sites Worked",
    icon: MapPin,
    fieldOnly: true,
  },
  { to: "/employee/people/all", label: "All Employees", icon: Users },
  {
    to: "/employee/people/department",
    label: "My Department",
    icon: Building2,
  },
  { to: "/employee/profile/personal", label: "My Profile", icon: User },
  { to: "/employee/notifications", label: "Notifications", icon: Bell },
  { to: "/employee/settings", label: "Settings", icon: Settings },
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

// ---- Helpers for the mobile "Around the Office" tile previews ----
function initialsOf(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function shortDate(d) {
  return d
    ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : "";
}

// 0 -> "Today", 1 -> "Tomorrow", else "12 Oct".
function daysAwayLabel(n) {
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  return shortDate(new Date(Date.now() + n * 86400000));
}

// "+N more" suffix once a list has more than one entry.
function moreLabel(list, lead) {
  return list.length > 1 ? `${lead} · +${list.length - 1} more` : lead;
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  // "/employee/..." in the link tables above becomes "/hr-admin/me/..." when
  // HR opens this page from My Space.
  const base = useBasePath();
  const withBase = (p) => p.replace(/^\/employee/, base);
  const isFieldStaff = isFieldEmployee(user);
  const isSiteLocation = isSiteEmployee(user);
  const quickTiles = QUICK_ACTION_TILES.filter(
    (t) => !(t.hideForSite && isSiteLocation),
  );
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

  // Cards with content first (fewest items first), empty cards last --
  // used by both the mobile tiles and the desktop right column.
  const { details, ...feedCounts } = useOfficeFeedCounts();
  const rankCounts = {
    ...feedCounts,
    announcements: activeAnnouncements.length,
  };

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

  // Swipe carousel helpers — keep the active dot in sync with scroll.
  const swipeRef = useRef(null);
  // Carousel height follows the ACTIVE card only, so a shorter card
  // (Check In) doesn't leave blank space the height of the taller one.
  const [swipeH, setSwipeH] = useState(null);
  useEffect(() => {
    const el = swipeRef.current;
    if (!el) return;
    const idx = Math.max(
      0,
      mobileTabs.findIndex((t) => t.key === mobileTab),
    );
    const measure = () => {
      const pane = el.children[idx];
      if (pane) setSwipeH(pane.offsetHeight);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileTab, isFieldStaff, canOutdoorCheckin]);
  const handleSwipeScroll = (e) => {
    const el = e.currentTarget;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    const key = mobileTabs[idx]?.key;
    if (key && key !== mobileTab) setMobileTab(key);
  };
  const scrollToPane = (key) => {
    const el = swipeRef.current;
    const idx = mobileTabs.findIndex((t) => t.key === key);
    if (el && idx >= 0)
      el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
  };

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

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }, []);

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
  const officeTiles = rankByCount(
    [
      {
        key: "announcements",
        label: "Announcements",
        icon: Megaphone,
        accent: "bg-orange-100 text-orange-600",
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
        accent: "bg-pink-100 text-pink-600",
        preview: "No birthdays in the next 30 days",
        // Shows WHO is celebrating right on the tile.
        primary: details.birthdays[0]?.full_name,
        avatar: initialsOf(details.birthdays[0]?.full_name),
        secondary: details.birthdays[0]
          ? moreLabel(
              details.birthdays,
              daysAwayLabel(details.birthdays[0].days_away),
            )
          : null,
        badge: feedCounts.birthdays || null,
      },
      {
        key: "anniversaries",
        label: "Anniversaries",
        icon: PartyPopper,
        accent: "bg-purple-100 text-purple-600",
        preview: "No work anniversaries in the next 30 days",
        primary: details.anniversaries[0]?.full_name,
        avatar: initialsOf(details.anniversaries[0]?.full_name),
        secondary: details.anniversaries[0]
          ? moreLabel(
              details.anniversaries,
              `${details.anniversaries[0].years} yr · ${daysAwayLabel(details.anniversaries[0].days_away)}`,
            )
          : null,
        badge: feedCounts.anniversaries || null,
      },
      {
        key: "holidays",
        label: "Holidays",
        icon: CalendarDays,
        accent: "bg-sky-100 text-sky-600",
        preview: "No upcoming holidays",
        primary: details.holidays[0]?.holiday_name,
        secondary: details.holidays[0]
          ? moreLabel(
              details.holidays,
              shortDate(parseLocalISODate(details.holidays[0].holiday_date)),
            )
          : null,
        badge: feedCounts.holidays || null,
      },
      {
        key: "onleave",
        label: "On Leave",
        icon: PlaneTakeoff,
        accent: "bg-violet-100 text-violet-600",
        preview: "No one is out today",
        primary: details.onleave
          .slice(0, 2)
          .map((p) => p.full_name)
          .join(", "),
        secondary:
          details.onleave.length > 2
            ? `Out today · +${details.onleave.length - 2} more`
            : details.onleave.length
              ? "Out today"
              : null,
        badge: feedCounts.onleave || null,
      },
    ],
    rankCounts,
  );

  const sheetTitles = {
    announcements: "Announcements",
    birthdays: "Upcoming Birthdays",
    anniversaries: "Work Anniversaries",
    holidays: "Upcoming Holidays",
    onleave: "On Leave Today",
    recentleave: "Applied Leave Requests",
    more: "More",
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
        {/* ---------- Greeting on the full-bleed header gradient ----------
            The gradient itself is drawn by DashboardLayout (it has to sit
            behind the top bar too). Text here is white on top of it. */}
        <div className="mb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white/70">{greeting},</p>
              <h1 className="text-[26px] leading-tight font-bold text-white mt-0.5 truncate capitalize">
                {firstName.toLowerCase()}
              </h1>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                {todayLong}
              </span>
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
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors shrink-0"
            >
              <ClipboardList size={15} />
            </button>
          </div>
          {/* Spacer so the attendance card below overlaps the gradient's
              lower edge, like the reference design. */}
        </div>

        {/* ---------- Check-in / Site Visit / Meeting ----------
            Anyone with a second tab (field staff: Site Visit; office
            staff with outdoor check-in enabled: Meeting) switches
            between the two with a tab strip instead of scrolling past
            both stacked full-height — these are two different moments
            in the day, not something you read top-to-bottom together.
            Everyone else has no second tab at all, so they just get the
            plain check-in card, same as before. ---------- */}
        <div className="mb-3 -mt-2">
          {/* Swipe carousel: horizontal scroll-snap, one card per
              "page". Replaces the old tab strip — swipe left/right to
              move between Check In and Site Visit / Meeting. */}
          <div
            ref={swipeRef}
            onScroll={handleSwipeScroll}
            style={swipeH ? { height: swipeH + 32 } : undefined}
            className="flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory items-start gap-3 pb-8 transition-[height] duration-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="w-full shrink-0 snap-center">
              <div className="rounded-2xl shadow-lg shadow-slate-900/10 [&>div]:rounded-2xl [&>div]:border-0">
                <CheckInOutCard
                  ultraCompact
                  onActivityChange={loadTodayStatus}
                />
              </div>
            </div>

            {isFieldStaff && (
              <div className="w-full shrink-0 snap-center">
                <SiteVisitCard
                  checkedIn={todayStatus.checkedIn}
                  checkedOut={todayStatus.checkedOut}
                  onActivityChange={loadTodayStatus}
                />
              </div>
            )}

            {/* Ad-hoc "meeting/site" check-in — separate gate from
                isFieldStaff; only for employees HR enabled. */}
            {!isFieldStaff && canOutdoorCheckin && (
              <div className="w-full shrink-0 snap-center">
                <div className="rounded-2xl bg-gradient-to-br from-[#0B1830] via-[#132445] to-orange-500/90 p-[3px] shadow-lg shadow-slate-900/10 [&>div]:rounded-[13px]">
                  <OutdoorCheckinAccessModal
                    checkedIn={todayStatus.checkedIn}
                    checkedOut={todayStatus.checkedOut}
                    onActivityChange={loadTodayStatus}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Page dots (indicator only) */}
          {mobileTabs.length > 0 && (
            <div className="flex justify-center items-center gap-1.5 mt-1">
              {mobileTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  aria-label={tab.label}
                  onClick={() => scrollToPane(tab.key)}
                  className={`h-1.5 rounded-full transition-all ${
                    mobileTab === tab.key
                      ? "w-5 bg-orange-500"
                      : "w-1.5 bg-slate-300"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Quote of the day — moved below the attendance card now that the
            greeting sits on the gradient header. */}
        {/* <div className="mb-6">
          <QuoteOfDayCard compact />
        </div> */}

        {/* ---------- Quick Actions: one card, round icon buttons ---------- */}
        <h2 className="text-sm font-bold text-slate-800 mb-2.5 px-1">
          Quick actions
        </h2>
        <div className="rounded-3xl bg-white border border-slate-100 shadow-sm shadow-slate-200/70 px-3 py-4 mb-6">
          <div className="grid grid-cols-4 gap-1">
            {quickTiles.map(({ to, label, icon: Icon, tint }) => (
              <Link
                key={to}
                to={withBase(to)}
                className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
              >
                <span
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tint}`}
                >
                  <Icon size={22} strokeWidth={1.75} />
                </span>
                <span className="text-[11px] font-semibold text-slate-700 truncate max-w-full">
                  {label}
                </span>
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setOpenSheet("more")}
              className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
            >
              <span className="w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-100 text-slate-600">
                <MoreHorizontal size={22} strokeWidth={1.75} />
              </span>
              <span className="text-[11px] font-semibold text-slate-700">
                More
              </span>
            </button>
          </div>
        </div>

        {/* ---------- Around the Office: one list card ----------
            Each row opens the matching bottom sheet. */}
        <h2 className="text-sm font-bold text-slate-800 mb-2.5 px-1">
          Around the office
        </h2>
        <div className="rounded-3xl bg-white border border-slate-100 shadow-sm shadow-slate-200/70 overflow-hidden divide-y divide-slate-100 mb-6">
          {officeTiles.map(
            ({
              key,
              label,
              icon: Icon,
              accent,
              preview,
              primary,
              secondary,
              badge,
            }) => (
              <button
                key={key}
                type="button"
                onClick={() => setOpenSheet(key)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50 transition-colors"
              >
                <span
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}
                >
                  <Icon size={18} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">
                    {label}
                  </span>
                  <span className="block text-xs text-slate-400 truncate">
                    {primary
                      ? secondary
                        ? `${primary} · ${secondary}`
                        : primary
                      : preview}
                  </span>
                </span>
                {badge ? (
                  <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-orange-500 text-white text-[11px] font-semibold flex items-center justify-center">
                    {badge}
                  </span>
                ) : null}
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
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

            {openSheet === "anniversaries" && (
              <div className="h-72">
                <AnniversariesCard />
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

            {openSheet === "more" && (
              <div className="grid grid-cols-3 gap-2.5 pb-2">
                {MORE_LINKS.filter(
                  (l) =>
                    (!l.fieldOnly || isFieldStaff) &&
                    !(l.hideForSite && isSiteLocation),
                ).map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={withBase(to)}
                    onClick={() => setOpenSheet(null)}
                    className="rounded-2xl border border-slate-200 bg-slate-50/60 py-3.5 px-1.5 flex flex-col items-center gap-2 text-center active:scale-[0.96] transition-transform"
                  >
                    <span className="w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
                      <Icon size={18} />
                    </span>
                    <span className="text-[11px] font-medium text-slate-600 leading-tight">
                      {label}
                    </span>
                  </Link>
                ))}
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
          {/* Ranked: cards with content first (fewest items first),
              empty cards last -- see utils/rankCards.js */}
          {rankByCount(
            [
              {
                key: "announcements",
                node: (
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 h-60 sm:h-72 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Megaphone size={17} className="text-orange-500" />{" "}
                        Announcements
                      </h3>
                    </div>
                    {announcements.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        No announcements yet.
                      </p>
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
                            return (b.end_date || "").localeCompare(
                              a.end_date || "",
                            );
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
                                      (expired
                                        ? "text-slate-500"
                                        : "text-slate-800")
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
                                    (expired
                                      ? "text-slate-400"
                                      : "text-slate-500")
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
                ),
              },
              {
                key: "birthdays",
                node: (
                  <div className="h-60 sm:h-72">
                    <BirthdaysCard />
                  </div>
                ),
              },
              {
                key: "anniversaries",
                node: (
                  <div className="h-60 sm:h-72">
                    <AnniversariesCard />
                  </div>
                ),
              },
              {
                key: "holidays",
                node: (
                  <div className="h-60 sm:h-72">
                    <HolidaysCalendarCard />
                  </div>
                ),
              },
              {
                key: "onleave",
                node: (
                  <div className="h-60 sm:h-72">
                    <OnLeaveTodayCard />
                  </div>
                ),
              },
            ],
            rankCounts,
          ).map(({ key, node }) => (
            <Fragment key={key}>{node}</Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
