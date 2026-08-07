// import { Megaphone } from "lucide-react";
// import { useEffect, useState } from "react";
// import BirthdaysCard, {
//   OnLeaveTodayCard,
// } from "../../components/common/CelebrationsStrip";
// import CheckInOutCard from "../../components/common/CheckInOutCard";
// import HolidaysCalendarCard from "../../components/common/Holidayscalendarcard ";
// import PageHeader from "../../components/common/PageHeader";
// import QuoteOfDayCard from "../../components/common/Quoteofdaycard ";
// import SiteVisitCard from "../../components/common/SiteVisitCard";

// import { useAuth } from "../../context/AuthContext";
// import { apiClient } from "../../services/apiClient";
// import { isFieldEmployee } from "../../utils/employeeType";

// // Everything here is scoped to "me" (or, for Holidays/Celebrations,
// // company-wide but non-sensitive) — /announcements/active, /holidays,
// // /dashboard/celebrations. No org-wide headcount/attrition numbers
// // belong on this page; an Employee has no VIEW_EMPLOYEE /
// // VIEW_ATTENDANCE permission (see the permission matrix), so those
// // endpoints would 403 anyway.
// //
// // Layout:
// //   Good Morning header
// //   Row 1: Check-in/out            | Quote of the Day
// //   Row 2: Upcoming Holidays (SG/IN tabs) | Announcements
// //   Row 3: On Leave Today | Upcoming Birthdays — same two-card row
// //          pattern as Row 2 above.

// export default function EmployeeDashboard() {
//   const { user } = useAuth();
//   const isFieldStaff = isFieldEmployee(user);

//   const [announcements, setAnnouncements] = useState([]);

//   // Only field staff (Inspection/Operation) need today's checked-in/out
//   // state here — it's what SiteVisitCard needs to decide whether to show
//   // itself at all (nothing to log before check-in, nothing left to log
//   // after check-out). Office staff never fetch this; CheckInOutCard below
//   // already tracks its own status independently for the button itself.
//   const [todayStatus, setTodayStatus] = useState({
//     checkedIn: false,
//     checkedOut: false,
//   });

//   function loadTodayStatus() {
//     if (!isFieldStaff) return;
//     const today = new Date().toISOString().slice(0, 10);
//     apiClient
//       .get(`/attendance/timeline/${today}`)
//       .then((res) =>
//         setTodayStatus({
//           checkedIn: !!res?.data?.check_in_time,
//           checkedOut: !!res?.data?.check_out_time,
//         }),
//       )
//       .catch(() => setTodayStatus({ checkedIn: false, checkedOut: false }));
//   }

//   useEffect(() => {
//     apiClient
//       .get("/announcements/active")
//       .then((res) => setAnnouncements(res.data || []))
//       .catch(() => setAnnouncements([]));

//     loadTodayStatus();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   return (
//     <div className="overflow-x-hidden">
//       {/* ---------- Desktop/tablet header (lg and up) — unchanged ---------- */}
//       <div className="hidden lg:block">
//         <PageHeader
//           title={`Good Morning, ${user?.name?.split(" ")[0] || "there"} 👋`}
//           subtitle="Welcome back! Here's what's happening today."
//           actions={<QuoteOfDayCard compact />}
//         />
//       </div>

//       {/* ---------- Mobile header (below lg) ----------
//           Greeting first, Quote of the Day stacked full-width right below
//           it, then a wrapping (not scrolling) row of at-a-glance chips —
//           today's date, active announcement count, and, for field staff,
//           today's check-in status. All from data this page already
//           fetches, no extra calls. No subtitle line here; the quote card
//           already fills that "what's happening today" role. */}
//       <div className="lg:hidden mb-4">
//         <h1 className="text-2xl font-bold text-slate-800 mb-3">
//           Good Morning, {user?.name?.split(" ")[0] || "there"} 👋
//         </h1>

//         <QuoteOfDayCard compact />

//         <div className="mt-3 flex flex-wrap gap-2">
//           {/* <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600">
//             <CalendarDays size={13} className="text-orange-500" />
//             {new Date().toLocaleDateString(undefined, {
//               weekday: "short",
//               month: "short",
//               day: "numeric",
//             })}
//           </div> */}

//           {/* <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600">
//             <Megaphone size={13} className="text-orange-500" />
//             {announcements.length} announcement
//             {announcements.length === 1 ? "" : "s"}
//           </div> */}

//           {/* {isFieldStaff && (
//             <div
//               className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border ${
//                 todayStatus.checkedIn && !todayStatus.checkedOut
//                   ? "bg-green-50 border-green-200 text-green-700"
//                   : todayStatus.checkedOut
//                     ? "bg-slate-100 border-slate-200 text-slate-600"
//                     : "bg-orange-50 border-orange-200 text-orange-700"
//               }`}
//             >
//               <CheckCircle2 size={13} />
//               {todayStatus.checkedOut
//                 ? "Checked out"
//                 : todayStatus.checkedIn
//                   ? "Checked in"
//                   : "Not checked in"}
//             </div>
//           )} */}
//         </div>
//       </div>

//       {/* ---------- Two-column body ----------
//           Left (65%):  Check-in/out -> Site Visits (field staff only)
//           Right (35%): Announcements -> Upcoming Birthdays -> Upcoming
//                        Holidays -> On Leave Today. Every card below is a
//                        fixed height with its own hidden-scrollbar overflow
//                        so extra items scroll inside the card instead of
//                        growing the row.
//       ---------------------------------------------------------------- */}
//       <div className="grid grid-cols-1 lg:grid-cols-[65%_1fr] gap-4 sm:gap-6 items-start min-w-0">
//         {/* ================= Left column (65%) ================= */}
//         <div className="flex flex-col gap-4 sm:gap-6 min-w-0">
//           <CheckInOutCard compact onActivityChange={loadTodayStatus} />

//           {isFieldStaff && (
//             <SiteVisitCard
//               checkedIn={todayStatus.checkedIn}
//               checkedOut={todayStatus.checkedOut}
//               onActivityChange={loadTodayStatus}
//             />
//           )}
//         </div>

//         {/* ================= Right column (35%) =================
//             Fixed height + its own vertical scroll, so this column never
//             grows taller than the viewport / left column — it scrolls
//             independently instead of pushing the page down. */}
//         <div className="flex flex-col gap-4 sm:gap-6 min-w-0 lg:h-[calc(100vh-6rem)] lg:sticky lg:top-4 lg:overflow-y-auto lg:pr-1 scrollbar-hide">
//           {/* ---------- Announcements ---------- */}
//           <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 h-60 sm:h-72 flex flex-col">
//             <div className="flex items-center justify-between mb-4">
//               <h3 className="font-semibold text-slate-800 flex items-center gap-2">
//                 <Megaphone size={17} className="text-orange-500" />{" "}
//                 Announcements
//               </h3>
//             </div>
//             {announcements.length === 0 ? (
//               <p className="text-sm text-slate-400">No active announcements.</p>
//             ) : (
//               <div className="space-y-3 overflow-y-auto scrollbar-hide flex-1">
//                 {announcements.slice(0, 4).map((a) => (
//                   <div
//                     key={a.id}
//                     className="bg-orange-50 border border-orange-100 rounded-lg p-3"
//                   >
//                     <p className="text-sm font-medium text-slate-800">
//                       {a.title}
//                     </p>
//                     <p className="text-xs text-slate-500 mt-0.5">
//                       {a.description}
//                     </p>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>

//           {/* ---------- Upcoming Birthdays ---------- */}
//           <div className="h-60 sm:h-72">
//             <BirthdaysCard />
//           </div>

//           {/* ---------- Upcoming Holidays ---------- */}
//           <div className="h-60 sm:h-72">
//             <HolidaysCalendarCard />
//           </div>

//           {/* ---------- On Leave Today ---------- */}
//           <div className="h-60 sm:h-72">
//             <OnLeaveTodayCard />
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
import { Megaphone } from "lucide-react";
import { useEffect, useState } from "react";
import BirthdaysCard, {
  OnLeaveTodayCard,
} from "../../components/common/CelebrationsStrip";
import CheckInOutCard from "../../components/common/CheckInOutCard";
import HolidaysCalendarCard from "../../components/common/Holidayscalendarcard ";
import PageHeader from "../../components/common/PageHeader";
import QuoteOfDayCard from "../../components/common/Quoteofdaycard ";
import SiteVisitCard from "../../components/common/SiteVisitCard";

import { useAuth } from "../../context/AuthContext";
import { useAttendanceLiveUpdates } from "../../hooks/Useattendanceliveupdates ";
import { apiClient } from "../../services/apiClient";
import { isFieldEmployee } from "../../utils/employeeType";

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

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const isFieldStaff = isFieldEmployee(user);

  const [announcements, setAnnouncements] = useState([]);

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

  // Only matters for field staff (loadTodayStatus no-ops otherwise), but
  // harmless to call either way — keeps SiteVisitCard's checked-in/out
  // gating correct if this employee's own check-in/out came through a
  // different tab or device rather than this page's own CheckInOutCard.
  useAttendanceLiveUpdates(() => {
    loadTodayStatus();
  });

  useEffect(() => {
    apiClient
      .get("/announcements/active")
      .then((res) => setAnnouncements(res.data || []))
      .catch(() => setAnnouncements([]));

    loadTodayStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      {/* ---------- Mobile header (below lg) ----------
          Greeting first, Quote of the Day stacked full-width right below
          it, then a wrapping (not scrolling) row of at-a-glance chips —
          today's date, active announcement count, and, for field staff,
          today's check-in status. All from data this page already
          fetches, no extra calls. No subtitle line here; the quote card
          already fills that "what's happening today" role. */}
      <div className="lg:hidden mb-4">
        <h1 className="text-2xl font-bold text-slate-800 mb-3">
          Good Morning, {user?.name?.split(" ")[0] || "there"} 👋
        </h1>

        <QuoteOfDayCard compact />

        <div className="mt-3 flex flex-wrap gap-2">
          {/* <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600">
            <CalendarDays size={13} className="text-orange-500" />
            {new Date().toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </div> */}

          {/* <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600">
            <Megaphone size={13} className="text-orange-500" />
            {announcements.length} announcement
            {announcements.length === 1 ? "" : "s"}
          </div> */}

          {/* {isFieldStaff && (
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border ${
                todayStatus.checkedIn && !todayStatus.checkedOut
                  ? "bg-green-50 border-green-200 text-green-700"
                  : todayStatus.checkedOut
                    ? "bg-slate-100 border-slate-200 text-slate-600"
                    : "bg-orange-50 border-orange-200 text-orange-700"
              }`}
            >
              <CheckCircle2 size={13} />
              {todayStatus.checkedOut
                ? "Checked out"
                : todayStatus.checkedIn
                  ? "Checked in"
                  : "Not checked in"}
            </div>
          )} */}
        </div>
      </div>

      {/* ---------- Two-column body ----------
          Left (65%):  Check-in/out -> Site Visits (field staff only)
          Right (35%): Announcements -> Upcoming Birthdays -> Upcoming
                       Holidays -> On Leave Today. Every card below is a
                       fixed height with its own hidden-scrollbar overflow
                       so extra items scroll inside the card instead of
                       growing the row.
      ---------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-[65%_1fr] gap-4 sm:gap-6 items-start min-w-0">
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
              <p className="text-sm text-slate-400">No active announcements.</p>
            ) : (
              <div className="space-y-3 overflow-y-auto scrollbar-hide flex-1">
                {announcements.slice(0, 4).map((a) => (
                  <div
                    key={a.id}
                    className="bg-orange-50 border border-orange-100 rounded-lg p-3"
                  >
                    <p className="text-sm font-medium text-slate-800">
                      {a.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {a.description}
                    </p>
                  </div>
                ))}
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
