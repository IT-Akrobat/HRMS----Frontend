// // import {
// //   AlertTriangle,
// //   CheckCircle2,
// //   ChevronLeft,
// //   ChevronRight,
// //   ChevronsLeft,
// //   ChevronsRight,
// //   Clock,
// //   Coffee,
// //   Download,
// //   Eye,
// //   Filter,
// //   Info,
// //   MapPin,
// //   Moon,
// //   Search,
// //   SlidersHorizontal,
// //   Umbrella,
// //   X,
// //   XCircle
// // } from "lucide-react";
// // import { useEffect, useMemo, useState } from "react";
// // import { Link } from "react-router-dom";
// // import PageHeader from "../../components/common/PageHeader";
// // import DatePicker from "../../components/layout/DatePicker";
// // import { apiClient } from "../../services/apiClient";

// // // ---------------------------------------------------------------------
// // // Backend contract (see BACKEND_NOTES.md / attendance_history.sql that
// // // ship alongside this file for the full writeup):
// // //
// // //   GET /attendance/my?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
// // //   -> { success: true, data: [ {
// // //        id, date, status,
// // //        check_in_time, check_out_time,
// // //        check_in_latitude, check_in_longitude,
// // //        check_out_latitude, check_out_longitude,
// // //        working_minutes, break_minutes,
// // //        breaks: [{ break_start, break_end }]
// // //      }, ... ] }
// // //
// // // This mirrors the shape already returned by GET /attendance/timeline/{date}
// // // (see CheckInOutCard.jsx) and GET /attendance/team (manager dashboard) —
// // // /attendance/my is the "list, not single-day" version of the same row.
// // // If that route doesn't exist yet on the backend, this page still renders
// // // (empty state + inline notice) instead of crashing, and the query params
// // // are sent so the backend can do date filtering server-side once it exists;
// // // everything is also re-filtered client-side below as a safety net.
// // // ---------------------------------------------------------------------

// // const STATUS_STYLES = {
// //   Present: {
// //     text: "text-blue-600",
// //     bg: "bg-blue-50",
// //     icon: CheckCircle2,
// //   },
// //   Absent: { text: "text-orange-500", bg: "bg-orange-50", icon: XCircle },
// //   "Half Day": { text: "text-orange-600", bg: "bg-orange-50", icon: Clock },
// //   Late: { text: "text-orange-600", bg: "bg-orange-50", icon: AlertTriangle },
// //   "On Leave": { text: "text-blue-600", bg: "bg-blue-50", icon: Umbrella },
// //   "Weekly Off": { text: "text-slate-500", bg: "bg-slate-100", icon: Moon },
// // };

// // function statusStyle(status) {
// //   return STATUS_STYLES[status] || STATUS_STYLES["Weekly Off"];
// // }

// // function todayIso() {
// //   return new Date().toISOString().slice(0, 10);
// // }

// // function firstOfMonthIso() {
// //   const d = new Date();
// //   return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
// // }

// // function formatTime(iso) {
// //   if (!iso) return "--:--";
// //   return new Date(iso).toLocaleTimeString([], {
// //     hour: "2-digit",
// //     minute: "2-digit",
// //   });
// // }

// // function formatDuration(minutes) {
// //   if (minutes == null) return "--";
// //   const total = Math.max(0, Math.round(minutes));
// //   const h = Math.floor(total / 60);
// //   const m = total % 60;
// //   if (h === 0) return `${m}m`;
// //   if (m === 0) return `${h}h`;
// //   return `${h}h ${m}m`;
// // }

// // function formatDateBlock(dateStr) {
// //   const d = new Date(dateStr);
// //   return {
// //     month: d.toLocaleDateString([], { month: "short" }).toUpperCase(),
// //     day: d.toLocaleDateString([], { day: "2-digit" }),
// //     year: d.getFullYear(),
// //     weekday: d.toLocaleDateString([], { weekday: "short" }),
// //   };
// // }

// // // Same Haversine matching used in CheckInOutCard.jsx so the resolved
// // // location name here is consistent with what the dashboard card shows.
// // function distanceMeters(lat1, lon1, lat2, lon2) {
// //   const R = 6371000;
// //   const toRad = (d) => (d * Math.PI) / 180;
// //   const dLat = toRad(lat2 - lat1);
// //   const dLon = toRad(lon2 - lon1);
// //   const a =
// //     Math.sin(dLat / 2) ** 2 +
// //     Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
// //   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// // }

// // function nearestLocationName(lat, lon, locations) {
// //   if (lat == null || lon == null || !locations || locations.length === 0) {
// //     return null;
// //   }
// //   let best = null;
// //   for (const loc of locations) {
// //     if (loc.latitude == null || loc.longitude == null) continue;
// //     const d = distanceMeters(lat, lon, loc.latitude, loc.longitude);
// //     if (!best || d < best.distance) best = { loc, distance: d };
// //   }
// //   return best ? best.loc.location_name : null;
// // }

// // const PAGE_SIZE_OPTIONS = [10, 25, 50];

// // export default function AttendanceHistory() {
// //   const [rows, setRows] = useState([]);
// //   const [locations, setLocations] = useState([]);
// //   const [loading, setLoading] = useState(true);
// //   const [error, setError] = useState(null);
// //   const [endpointMissing, setEndpointMissing] = useState(false);

// //   // ---------- filters ----------
// //   const [dateFrom, setDateFrom] = useState(firstOfMonthIso());
// //   const [dateTo, setDateTo] = useState(todayIso());
// //   const [statusFilter, setStatusFilter] = useState("All");
// //   const [search, setSearch] = useState("");

// //   // ---------- pagination ----------
// //   const [page, setPage] = useState(1);
// //   const [pageSize, setPageSize] = useState(10);

// //   // ---------- detail modal ----------
// //   const [selected, setSelected] = useState(null);

// //   // ---------- summary panel (Present/Absent/Half Day/Weekly Off counts,
// //   // moved out of the page body and behind the info button next to
// //   // "Back to Attendance" — click it to slide the details in from the right) ----------
// //   const [statsOpen, setStatsOpen] = useState(false);

// //   function load() {
// //     setLoading(true);
// //     setError(null);
// //     setEndpointMissing(false);

// //     apiClient
// //       .get(`/attendance/my?start_date=${dateFrom}&end_date=${dateTo}`)
// //       .then((res) => setRows(res.data || []))
// //       .catch((err) => {
// //         setRows([]);
// //         if (err.status === 404) {
// //           setEndpointMissing(true);
// //         } else {
// //           setError(err.message);
// //         }
// //       })
// //       .finally(() => setLoading(false));
// //   }

// //   useEffect(() => {
// //     apiClient
// //       .get("/locations/")
// //       .then((res) => setLocations(res.data || []))
// //       .catch(() => setLocations([]));
// //     // eslint-disable-next-line react-hooks/exhaustive-deps
// //   }, []);

// //   useEffect(() => {
// //     load();
// //     setPage(1);
// //     // eslint-disable-next-line react-hooks/exhaustive-deps
// //   }, [dateFrom, dateTo]);

// //   const filtered = useMemo(() => {
// //     return rows
// //       .filter((r) => !dateFrom || r.date >= dateFrom)
// //       .filter((r) => !dateTo || r.date <= dateTo)
// //       .filter((r) => statusFilter === "All" || r.status === statusFilter)
// //       .filter((r) => {
// //         if (!search.trim()) return true;
// //         const q = search.trim().toLowerCase();
// //         const loc =
// //           nearestLocationName(
// //             r.check_in_latitude,
// //             r.check_in_longitude,
// //             locations,
// //           ) || "";
// //         return (
// //           r.date?.toLowerCase().includes(q) ||
// //           r.status?.toLowerCase().includes(q) ||
// //           loc.toLowerCase().includes(q)
// //         );
// //       })
// //       .sort((a, b) => (a.date < b.date ? 1 : -1));
// //   }, [rows, dateFrom, dateTo, statusFilter, search, locations]);

// //   const stats = useMemo(() => {
// //     const s = {
// //       total: filtered.length,
// //       present: 0,
// //       absent: 0,
// //       late: 0,
// //       halfDay: 0,
// //       workingMinutes: 0,
// //     };
// //     filtered.forEach((r) => {
// //       if (r.status === "Present") s.present += 1;
// //       if (r.status === "Absent") s.absent += 1;
// //       if (r.status === "Late") s.late += 1;
// //       if (r.status === "Half Day") s.halfDay += 1;
// //       s.workingMinutes += r.working_minutes || 0;
// //     });
// //     return s;
// //   }, [filtered]);

// //   const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
// //   const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

// //   function exportCsv() {
// //     const header = [
// //       "Date",
// //       "Check In",
// //       "Check Out",
// //       "Working Hours",
// //       "Break",
// //       "Status",
// //     ];
// //     const body = filtered.map((r) => [
// //       r.date,
// //       formatTime(r.check_in_time),
// //       formatTime(r.check_out_time),
// //       formatDuration(r.working_minutes),
// //       formatDuration(r.break_minutes),
// //       r.status,
// //     ]);
// //     const csv = [header, ...body].map((row) => row.join(",")).join("\n");
// //     const blob = new Blob([csv], { type: "text/csv" });
// //     const url = URL.createObjectURL(blob);
// //     const a = document.createElement("a");
// //     a.href = url;
// //     a.download = `attendance-history-${dateFrom}-to-${dateTo}.csv`;
// //     a.click();
// //     URL.revokeObjectURL(url);
// //   }

// //   return (
// //     <div>
// //       <PageHeader
// //         title="Attendance History"
// //         subtitle="View your daily attendance records and working hours."
// //         actions={
// //           <div className="flex items-center gap-2">
// //             <button
// //               onClick={() => setStatsOpen(true)}
// //               aria-label="View attendance summary"
// //               className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
// //             >
// //               <Info size={16} />
// //             </button>
// //             <Link
// //               to="/employee/attendance"
// //               className="flex items-center gap-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-lg"
// //             >
// //               <ChevronLeft size={15} /> Back to Attendance
// //             </Link>
// //           </div>
// //         }
// //       />

// //       {/* ---------- Filter bar ---------- */}
// //       <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap items-end gap-3">
// //         <div>
// //           <label className="block text-xs font-medium text-slate-500 mb-1">
// //             Date Range
// //           </label>
// //           <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5">
// //             <DatePicker
// //               value={new Date(dateFrom + "T00:00:00")}
// //               onSelect={(d) => setDateFrom(d.toISOString().slice(0, 10))}
// //             />
// //             <span className="text-slate-300">→</span>
// //             <DatePicker
// //               value={new Date(dateTo + "T00:00:00")}
// //               onSelect={(d) => setDateTo(d.toISOString().slice(0, 10))}
// //             />
// //           </div>
// //         </div>

// //         <div>
// //           <label className="block text-xs font-medium text-slate-500 mb-1">
// //             Status
// //           </label>
// //           <select
// //             value={statusFilter}
// //             onChange={(e) => {
// //               setStatusFilter(e.target.value);
// //               setPage(1);
// //             }}
// //             className="text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2 outline-none"
// //           >
// //             <option>All</option>
// //             <option>Present</option>
// //             <option>Absent</option>
// //             <option>Half Day</option>
// //             <option>Late</option>
// //             <option>On Leave</option>
// //             <option>Weekly Off</option>
// //           </select>
// //         </div>

// //         <div className="flex-1 min-w-[180px]">
// //           <label className="block text-xs font-medium text-slate-500 mb-1">
// //             Search
// //           </label>
// //           <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
// //             <Search size={15} className="text-slate-400" />
// //             <input
// //               value={search}
// //               onChange={(e) => {
// //                 setSearch(e.target.value);
// //                 setPage(1);
// //               }}
// //               placeholder="Search by date, status, or location..."
// //               className="text-sm text-slate-700 outline-none w-full bg-transparent"
// //             />
// //           </div>
// //         </div>

// //         <button
// //           onClick={() => {
// //             setPage(1);
// //             load();
// //           }}
// //           className="flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-lg"
// //         >
// //           <Filter size={14} /> Filter
// //         </button>

// //         <button
// //           onClick={exportCsv}
// //           disabled={filtered.length === 0}
// //           className="flex items-center gap-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-3.5 py-2 rounded-lg"
// //         >
// //           <Download size={14} /> Export
// //         </button>
// //       </div>

// //       {/* ---------- Inline notices ---------- */}
// //       {endpointMissing && (
// //         <div className="mb-4 flex items-start gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-4 py-3">
// //           <AlertTriangle size={16} className="shrink-0 mt-0.5" />
// //           <span>
// //             <strong>GET /attendance/my</strong> isn't available on the backend
// //             yet (404), so history can't load. See{" "}
// //             <code>attendance_history_backend_notes.sql</code> for the endpoint
// //             spec and query this page expects.
// //           </span>
// //         </div>
// //       )}
// //       {error && !endpointMissing && (
// //         <div className="mb-4 text-sm text-orange-500 bg-orange-50 border border-orange-100 rounded-lg px-4 py-3">
// //           {error}
// //         </div>
// //       )}

// //       {/* ---------- Table ---------- */}
// //       <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
// //         <div className="overflow-x-auto">
// //           <table className="w-full text-sm">
// //             <thead>
// //               <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
// //                 <th className="px-5 py-3 font-medium">Date</th>
// //                 <th className="px-5 py-3 font-medium">Check In</th>
// //                 <th className="px-5 py-3 font-medium">Check Out</th>
// //                 <th className="px-5 py-3 font-medium">Working Hours</th>
// //                 <th className="px-5 py-3 font-medium">Break</th>
// //                 <th className="px-5 py-3 font-medium">Status</th>
// //                 <th className="px-5 py-3 font-medium">Location</th>
// //                 <th className="px-5 py-3 font-medium text-right">Action</th>
// //               </tr>
// //             </thead>
// //             <tbody>
// //               {loading &&
// //                 Array.from({ length: 5 }).map((_, i) => (
// //                   <tr key={i} className="border-b border-slate-50">
// //                     <td colSpan={8} className="px-5 py-4">
// //                       <div className="h-4 bg-slate-100 rounded animate-pulse" />
// //                     </td>
// //                   </tr>
// //                 ))}

// //               {!loading && pageRows.length === 0 && (
// //                 <tr>
// //                   <td
// //                     colSpan={8}
// //                     className="px-5 py-10 text-center text-slate-400"
// //                   >
// //                     No attendance records found for this range.
// //                   </td>
// //                 </tr>
// //               )}

// //               {!loading &&
// //                 pageRows.map((r) => {
// //                   const db = formatDateBlock(r.date);
// //                   const st = statusStyle(r.status);
// //                   const StIcon = st.icon;
// //                   const loc = nearestLocationName(
// //                     r.check_in_latitude,
// //                     r.check_in_longitude,
// //                     locations,
// //                   );
// //                   return (
// //                     <tr
// //                       key={r.id ?? r.date}
// //                       className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
// //                     >
// //                       <td className="px-5 py-3.5">
// //                         <div className="flex items-center gap-2.5">
// //                           <div className="w-11 text-center bg-slate-50 rounded-lg py-1">
// //                             <div className="text-[10px] font-semibold text-orange-500">
// //                               {db.month}
// //                             </div>
// //                             <div className="text-sm font-bold text-slate-700 leading-tight">
// //                               {db.day}
// //                             </div>
// //                           </div>
// //                           <div>
// //                             <div className="text-slate-700 font-medium">
// //                               {db.weekday}
// //                             </div>
// //                             <div className="text-xs text-slate-400">
// //                               {db.year}
// //                             </div>
// //                           </div>
// //                         </div>
// //                       </td>
// //                       <td className="px-5 py-3.5 text-slate-600">
// //                         {formatTime(r.check_in_time)}
// //                       </td>
// //                       <td className="px-5 py-3.5 text-slate-600">
// //                         {formatTime(r.check_out_time)}
// //                       </td>
// //                       <td className="px-5 py-3.5 text-slate-600">
// //                         {formatDuration(r.working_minutes)}
// //                       </td>
// //                       <td className="px-5 py-3.5 text-slate-600">
// //                         {formatDuration(r.break_minutes)}
// //                       </td>
// //                       <td className="px-5 py-3.5">
// //                         <span
// //                           className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}
// //                         >
// //                           <StIcon size={12} /> {r.status || "—"}
// //                         </span>
// //                       </td>
// //                       <td className="px-5 py-3.5 text-slate-500 text-xs">
// //                         {loc ? (
// //                           <span className="flex items-center gap-1">
// //                             <MapPin size={11} className="text-slate-400" />
// //                             {loc}
// //                           </span>
// //                         ) : (
// //                           "—"
// //                         )}
// //                       </td>
// //                       <td className="px-5 py-3.5 text-right">
// //                         <button
// //                           onClick={() => setSelected(r)}
// //                           className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
// //                         >
// //                           <Eye size={14} />
// //                         </button>
// //                       </td>
// //                     </tr>
// //                   );
// //                 })}
// //             </tbody>
// //           </table>
// //         </div>

// //         {/* ---------- Pagination ---------- */}
// //         <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100">
// //           <div className="text-xs text-slate-400">
// //             {filtered.length === 0
// //               ? "Showing 0 records"
// //               : `Showing ${(page - 1) * pageSize + 1} to ${Math.min(
// //                   page * pageSize,
// //                   filtered.length,
// //                 )} of ${filtered.length} records`}
// //           </div>
// //           <div className="flex items-center gap-3">
// //             <select
// //               value={pageSize}
// //               onChange={(e) => {
// //                 setPageSize(Number(e.target.value));
// //                 setPage(1);
// //               }}
// //               className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-slate-600"
// //             >
// //               {PAGE_SIZE_OPTIONS.map((n) => (
// //                 <option key={n} value={n}>
// //                   {n} per page
// //                 </option>
// //               ))}
// //             </select>
// //             <div className="flex items-center gap-1">
// //               <button
// //                 onClick={() => setPage(1)}
// //                 disabled={page === 1}
// //                 className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40"
// //               >
// //                 <ChevronsLeft size={13} />
// //               </button>
// //               <button
// //                 onClick={() => setPage((p) => Math.max(1, p - 1))}
// //                 disabled={page === 1}
// //                 className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40"
// //               >
// //                 <ChevronLeft size={13} />
// //               </button>
// //               <span className="w-7 h-7 flex items-center justify-center rounded-md bg-orange-500 text-white text-xs font-medium">
// //                 {page}
// //               </span>
// //               <button
// //                 onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
// //                 disabled={page === totalPages}
// //                 className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40"
// //               >
// //                 <ChevronRight size={13} />
// //               </button>
// //               <button
// //                 onClick={() => setPage(totalPages)}
// //                 disabled={page === totalPages}
// //                 className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40"
// //               >
// //                 <ChevronsRight size={13} />
// //               </button>
// //             </div>
// //           </div>
// //         </div>
// //       </div>

// //       {/* ---------- Detail modal ---------- */}
// //       {selected && (
// //         <div
// //           className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
// //           onClick={() => setSelected(null)}
// //         >
// //           <div
// //             className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-5"
// //             onClick={(e) => e.stopPropagation()}
// //           >
// //             <div className="flex items-center justify-between mb-4">
// //               <h3 className="font-semibold text-slate-800 flex items-center gap-2">
// //                 <SlidersHorizontal size={15} className="text-orange-500" />
// //                 {formatDateBlock(selected.date).weekday}, {selected.date}
// //               </h3>
// //               <button
// //                 onClick={() => setSelected(null)}
// //                 className="text-slate-400 hover:text-slate-600"
// //               >
// //                 <X size={18} />
// //               </button>
// //             </div>

// //             <div className="grid grid-cols-2 gap-3 mb-4">
// //               <div className="bg-slate-50 rounded-lg p-3">
// //                 <div className="text-xs text-slate-400 mb-1">Check In</div>
// //                 <div className="font-semibold text-slate-700">
// //                   {formatTime(selected.check_in_time)}
// //                 </div>
// //               </div>
// //               <div className="bg-slate-50 rounded-lg p-3">
// //                 <div className="text-xs text-slate-400 mb-1">Check Out</div>
// //                 <div className="font-semibold text-slate-700">
// //                   {formatTime(selected.check_out_time)}
// //                 </div>
// //               </div>
// //               <div className="bg-orange-50 rounded-lg p-3">
// //                 <div className="text-xs text-orange-500 mb-1 flex items-center gap-1">
// //                   <Clock size={11} /> Working Hours
// //                 </div>
// //                 <div className="font-semibold text-slate-700">
// //                   {formatDuration(selected.working_minutes)}
// //                 </div>
// //               </div>
// //               <div className="bg-slate-50 rounded-lg p-3">
// //                 <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
// //                   <Coffee size={11} /> Break
// //                 </div>
// //                 <div className="font-semibold text-slate-700">
// //                   {formatDuration(selected.break_minutes)}
// //                 </div>
// //               </div>
// //             </div>

// //             {selected.breaks?.length > 0 && (
// //               <div className="mb-4">
// //                 <div className="text-xs text-slate-400 mb-2">
// //                   Break Timeline
// //                 </div>
// //                 <ul className="space-y-1.5">
// //                   {selected.breaks.map((b, i) => (
// //                     <li
// //                       key={i}
// //                       className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded-md px-2.5 py-1.5"
// //                     >
// //                       <span>{formatTime(b.break_start)}</span>
// //                       <span className="text-slate-300">→</span>
// //                       <span>{formatTime(b.break_end)}</span>
// //                     </li>
// //                   ))}
// //                 </ul>
// //               </div>
// //             )}

// //             {(selected.check_in_latitude || selected.check_out_latitude) && (
// //               <div className="text-xs text-slate-500 flex items-center gap-1.5">
// //                 <MapPin size={12} className="text-slate-400" />
// //                 {nearestLocationName(
// //                   selected.check_in_latitude,
// //                   selected.check_in_longitude,
// //                   locations,
// //                 ) || "Location recorded, no matching office"}
// //               </div>
// //             )}
// //           </div>
// //         </div>
// //       )}

// //       {/* ---------- Summary panel: slides in from the right when the info
// //           button next to "Back to Attendance" is clicked. Always mounted
// //           (rather than conditionally rendered) so the transform transition
// //           actually animates instead of just popping in/out. ---------- */}
// //       <div
// //         className={`fixed inset-0 z-50 ${
// //           statsOpen ? "" : "pointer-events-none"
// //         }`}
// //       >
// //         <div
// //           onClick={() => setStatsOpen(false)}
// //           className={`absolute inset-0 bg-slate-900/30 transition-opacity duration-200 ${
// //             statsOpen ? "opacity-100" : "opacity-0"
// //           }`}
// //         />
// //         <div
// //           className={`absolute right-0 top-0 h-full w-full max-w-xs bg-white border-l border-slate-200 shadow-xl p-5 overflow-y-auto transition-transform duration-200 ${
// //             statsOpen ? "translate-x-0" : "translate-x-full"
// //           }`}
// //         >
// //           <div className="flex items-center justify-between mb-5">
// //             <h3 className="font-semibold text-slate-800">Attendance summary</h3>
// //             <button
// //               onClick={() => setStatsOpen(false)}
// //               className="text-slate-400 hover:text-slate-600"
// //             >
// //               <X size={18} />
// //             </button>
// //           </div>

// //           <div className="divide-y divide-slate-100">
// //             <div className="flex items-center justify-between py-3">
// //               <span className="text-sm text-slate-500">Present Days</span>
// //               <span className="text-sm font-semibold text-slate-800">
// //                 {stats.present}{" "}
// //                 <span className="text-xs font-normal text-slate-400">
// //                   (
// //                   {stats.total
// //                     ? Math.round((stats.present / stats.total) * 100)
// //                     : 0}
// //                   %)
// //                 </span>
// //               </span>
// //             </div>

// //             <div className="flex items-center justify-between py-3">
// //               <span className="text-sm text-slate-500">Absent Days</span>
// //               <span className="text-sm font-semibold text-slate-800">
// //                 {stats.absent}{" "}
// //                 <span className="text-xs font-normal text-slate-400">
// //                   (
// //                   {stats.total
// //                     ? Math.round((stats.absent / stats.total) * 100)
// //                     : 0}
// //                   %)
// //                 </span>
// //               </span>
// //             </div>

// //             <div className="flex items-center justify-between py-3">
// //               <span className="text-sm text-slate-500">Late Days</span>
// //               <span className="text-sm font-semibold text-slate-800">
// //                 {stats.late}{" "}
// //                 <span className="text-xs font-normal text-slate-400">
// //                   (
// //                   {stats.total
// //                     ? Math.round((stats.late / stats.total) * 100)
// //                     : 0}
// //                   %)
// //                 </span>
// //               </span>
// //             </div>

// //             <div className="flex items-center justify-between py-3">
// //               <span className="text-sm text-slate-500">Half Days</span>
// //               <span className="text-sm font-semibold text-slate-800">
// //                 {stats.halfDay}{" "}
// //                 <span className="text-xs font-normal text-slate-400">
// //                   (
// //                   {stats.total
// //                     ? Math.round((stats.halfDay / stats.total) * 100)
// //                     : 0}
// //                   %)
// //                 </span>
// //               </span>
// //             </div>

// //             <div className="flex items-center justify-between py-3">
// //               <span className="text-sm text-slate-500">
// //                 Total Working Hours
// //               </span>
// //               <span className="text-sm font-semibold text-slate-800">
// //                 {formatDuration(stats.workingMinutes)}
// //               </span>
// //             </div>

// //             <div className="flex items-center justify-between py-3">
// //               <span className="text-sm text-slate-500">Total Days</span>
// //               <span className="text-sm font-semibold text-slate-800">
// //                 {stats.total}
// //               </span>
// //             </div>
// //           </div>
// //         </div>
// //       </div>
// //     </div>
// //   );
// // }
// import {
//   AlertTriangle,
//   CheckCircle2,
//   ChevronDown,
//   ChevronLeft,
//   ChevronRight,
//   ChevronsLeft,
//   ChevronsRight,
//   Clock,
//   Coffee,
//   Download,
//   Eye,
//   Filter,
//   Info,
//   MapPin,
//   Moon,
//   Search,
//   SlidersHorizontal,
//   Umbrella,
//   X,
//   XCircle,
// } from "lucide-react";
// import { useEffect, useMemo, useState } from "react";
// import { Link } from "react-router-dom";
// import PageHeader from "../../components/common/PageHeader";
// import DatePicker from "../../components/layout/DatePicker";
// import { apiClient } from "../../services/apiClient";

// // ---------------------------------------------------------------------
// // Backend contract (see BACKEND_NOTES.md / attendance_history.sql that
// // ship alongside this file for the full writeup):
// //
// //   GET /attendance/my?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD
// //   -> { success: true, data: [ {
// //        id, date, status,
// //        check_in_time, check_out_time,
// //        check_in_latitude, check_in_longitude,
// //        check_out_latitude, check_out_longitude,
// //        working_minutes, break_minutes,
// //        breaks: [{ break_start, break_end }]
// //      }, ... ] }
// //
// // This mirrors the shape already returned by GET /attendance/timeline/{date}
// // (see CheckInOutCard.jsx) and GET /attendance/team (manager dashboard) —
// // /attendance/my is the "list, not single-day" version of the same row.
// // If that route doesn't exist yet on the backend, this page still renders
// // (empty state + inline notice) instead of crashing, and the query params
// // are sent so the backend can do date filtering server-side once it exists;
// // everything is also re-filtered client-side below as a safety net.
// // ---------------------------------------------------------------------

// const STATUS_STYLES = {
//   Present: {
//     text: "text-blue-600",
//     bg: "bg-blue-50",
//     icon: CheckCircle2,
//   },
//   Absent: { text: "text-orange-500", bg: "bg-orange-50", icon: XCircle },
//   "Half Day": { text: "text-orange-600", bg: "bg-orange-50", icon: Clock },
//   Late: { text: "text-orange-600", bg: "bg-orange-50", icon: AlertTriangle },
//   "On Leave": { text: "text-blue-600", bg: "bg-blue-50", icon: Umbrella },
//   "Weekly Off": { text: "text-slate-500", bg: "bg-slate-100", icon: Moon },
// };

// function statusStyle(status) {
//   return STATUS_STYLES[status] || STATUS_STYLES["Weekly Off"];
// }

// function todayIso() {
//   return new Date().toISOString().slice(0, 10);
// }

// function firstOfMonthIso() {
//   const d = new Date();
//   return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
// }

// function formatTime(iso) {
//   if (!iso) return "--:--";
//   return new Date(iso).toLocaleTimeString([], {
//     hour: "2-digit",
//     minute: "2-digit",
//   });
// }

// function formatDuration(minutes) {
//   if (minutes == null) return "--";
//   const total = Math.max(0, Math.round(minutes));
//   const h = Math.floor(total / 60);
//   const m = total % 60;
//   if (h === 0) return `${m}m`;
//   if (m === 0) return `${h}h`;
//   return `${h}h ${m}m`;
// }

// function formatDateBlock(dateStr) {
//   const d = new Date(dateStr);
//   return {
//     month: d.toLocaleDateString([], { month: "short" }).toUpperCase(),
//     day: d.toLocaleDateString([], { day: "2-digit" }),
//     year: d.getFullYear(),
//     weekday: d.toLocaleDateString([], { weekday: "short" }),
//   };
// }

// // Same Haversine matching used in CheckInOutCard.jsx so the resolved
// // location name here is consistent with what the dashboard card shows.
// function distanceMeters(lat1, lon1, lat2, lon2) {
//   const R = 6371000;
//   const toRad = (d) => (d * Math.PI) / 180;
//   const dLat = toRad(lat2 - lat1);
//   const dLon = toRad(lon2 - lon1);
//   const a =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
//   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// }

// function nearestLocationName(lat, lon, locations) {
//   if (lat == null || lon == null || !locations || locations.length === 0) {
//     return null;
//   }
//   let best = null;
//   for (const loc of locations) {
//     if (loc.latitude == null || loc.longitude == null) continue;
//     const d = distanceMeters(lat, lon, loc.latitude, loc.longitude);
//     if (!best || d < best.distance) best = { loc, distance: d };
//   }
//   return best ? best.loc.location_name : null;
// }

// const PAGE_SIZE_OPTIONS = [10, 25, 50];

// export default function AttendanceHistory() {
//   const [rows, setRows] = useState([]);
//   const [locations, setLocations] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [endpointMissing, setEndpointMissing] = useState(false);

//   // ---------- filters ----------
//   const [dateFrom, setDateFrom] = useState(firstOfMonthIso());
//   const [dateTo, setDateTo] = useState(todayIso());
//   const [statusFilter, setStatusFilter] = useState("All");
//   const [search, setSearch] = useState("");

//   // ---------- pagination ----------
//   const [page, setPage] = useState(1);
//   const [pageSize, setPageSize] = useState(10);

//   // ---------- detail modal ----------
//   const [selected, setSelected] = useState(null);

//   // ---------- summary panel (Present/Absent/Half Day/Weekly Off counts,
//   // moved out of the page body and behind the info button next to
//   // "Back to Attendance" — click it to slide the details in from the right) ----------
//   const [statsOpen, setStatsOpen] = useState(false);

//   function load() {
//     setLoading(true);
//     setError(null);
//     setEndpointMissing(false);

//     apiClient
//       .get(`/attendance/my?from_date=${dateFrom}&to_date=${dateTo}`)
//       .then((res) => setRows(res.data || []))
//       .catch((err) => {
//         setRows([]);
//         if (err.status === 404) {
//           setEndpointMissing(true);
//         } else {
//           setError(err.message);
//         }
//       })
//       .finally(() => setLoading(false));
//   }

//   useEffect(() => {
//     apiClient
//       .get("/locations/")
//       .then((res) => setLocations(res.data || []))
//       .catch(() => setLocations([]));
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   useEffect(() => {
//     load();
//     setPage(1);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [dateFrom, dateTo]);

//   const filtered = useMemo(() => {
//     return rows
//       .filter((r) => !dateFrom || r.date >= dateFrom)
//       .filter((r) => !dateTo || r.date <= dateTo)
//       .filter((r) => statusFilter === "All" || r.status === statusFilter)
//       .filter((r) => {
//         if (!search.trim()) return true;
//         const q = search.trim().toLowerCase();
//         const loc =
//           nearestLocationName(
//             r.check_in_latitude,
//             r.check_in_longitude,
//             locations,
//           ) || "";
//         return (
//           r.date?.toLowerCase().includes(q) ||
//           r.status?.toLowerCase().includes(q) ||
//           loc.toLowerCase().includes(q)
//         );
//       })
//       .sort((a, b) => (a.date < b.date ? 1 : -1));
//   }, [rows, dateFrom, dateTo, statusFilter, search, locations]);

//   const stats = useMemo(() => {
//     const s = {
//       total: filtered.length,
//       present: 0,
//       absent: 0,
//       late: 0,
//       halfDay: 0,
//       workingMinutes: 0,
//     };
//     filtered.forEach((r) => {
//       if (r.status === "Present") s.present += 1;
//       if (r.status === "Absent") s.absent += 1;
//       if (r.status === "Late") s.late += 1;
//       if (r.status === "Half Day") s.halfDay += 1;
//       s.workingMinutes += r.working_minutes || 0;
//     });
//     return s;
//   }, [filtered]);

//   const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
//   const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

//   function exportCsv() {
//     const header = [
//       "Date",
//       "Check In",
//       "Check Out",
//       "Working Hours",
//       "Break",
//       "Status",
//     ];
//     const body = filtered.map((r) => [
//       r.date,
//       formatTime(r.check_in_time),
//       formatTime(r.check_out_time),
//       formatDuration(r.working_minutes),
//       formatDuration(r.break_minutes),
//       r.status,
//     ]);
//     const csv = [header, ...body].map((row) => row.join(",")).join("\n");
//     const blob = new Blob([csv], { type: "text/csv" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = `attendance-history-${dateFrom}-to-${dateTo}.csv`;
//     a.click();
//     URL.revokeObjectURL(url);
//   }

//   return (
//     <div>
//       <PageHeader
//         title="Attendance History"
//         subtitle="View your daily attendance records and working hours."
//         actions={
//           <div className="flex items-center gap-2">
//             <button
//               onClick={() => setStatsOpen(true)}
//               aria-label="View attendance summary"
//               className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
//             >
//               <Info size={16} />
//             </button>
//             <Link
//               to="/employee/attendance"
//               className="flex items-center gap-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-lg"
//             >
//               <ChevronLeft size={15} /> Back to Attendance
//             </Link>
//           </div>
//         }
//       />

//       {/* ---------- Filter bar ---------- */}
//       <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6 flex flex-wrap items-end gap-3.5">
//         <div>
//           <label className="block text-xs font-medium text-slate-500 mb-1.5">
//             Date Range
//           </label>
//           <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50/60 hover:border-slate-300 transition-colors">
//             <DatePicker
//               value={new Date(dateFrom + "T00:00:00")}
//               onSelect={(d) => setDateFrom(d.toISOString().slice(0, 10))}
//             />
//             <span className="text-slate-300">→</span>
//             <DatePicker
//               value={new Date(dateTo + "T00:00:00")}
//               onSelect={(d) => setDateTo(d.toISOString().slice(0, 10))}
//             />
//           </div>
//         </div>

//         <div>
//           <label className="block text-xs font-medium text-slate-500 mb-1.5">
//             Status
//           </label>
//           <div className="relative">
//             <select
//               value={statusFilter}
//               onChange={(e) => {
//                 setStatusFilter(e.target.value);
//                 setPage(1);
//               }}
//               className="appearance-none text-sm text-slate-700 border border-slate-200 bg-slate-50/60 hover:border-slate-300 rounded-xl pl-3.5 pr-9 py-2.5 outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 transition-colors cursor-pointer"
//             >
//               <option>All</option>
//               <option>Present</option>
//               <option>Absent</option>
//               <option>Half Day</option>
//               <option>Late</option>
//               <option>On Leave</option>
//               <option>Weekly Off</option>
//             </select>
//             <ChevronDown
//               size={14}
//               className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
//             />
//           </div>
//         </div>

//         <div className="flex-1 min-w-[180px]">
//           <label className="block text-xs font-medium text-slate-500 mb-1.5">
//             Search
//           </label>
//           <div className="flex items-center gap-2 border border-slate-200 bg-slate-50/60 hover:border-slate-300 focus-within:ring-2 focus-within:ring-orange-200 focus-within:border-orange-400 rounded-xl px-3.5 py-2.5 transition-colors">
//             <Search size={15} className="text-slate-400" />
//             <input
//               value={search}
//               onChange={(e) => {
//                 setSearch(e.target.value);
//                 setPage(1);
//               }}
//               placeholder="Search by date, status, or location..."
//               className="text-sm text-slate-700 outline-none w-full bg-transparent"
//             />
//           </div>
//         </div>

//         <button
//           onClick={() => {
//             setPage(1);
//             load();
//           }}
//           className="flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 px-4 py-2.5 rounded-xl transition-colors"
//         >
//           <Filter size={14} /> Filter
//         </button>

//         <button
//           onClick={exportCsv}
//           disabled={filtered.length === 0}
//           className="flex items-center gap-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-4 py-2.5 rounded-xl shadow-sm transition-colors"
//         >
//           <Download size={14} /> Export
//         </button>
//       </div>

//       {/* ---------- Inline notices ---------- */}
//       {endpointMissing && (
//         <div className="mb-4 flex items-start gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-4 py-3">
//           <AlertTriangle size={16} className="shrink-0 mt-0.5" />
//           <span>
//             <strong>GET /attendance/my</strong> isn't available on the backend
//             yet (404), so history can't load. See{" "}
//             <code>attendance_history_backend_notes.sql</code> for the endpoint
//             spec and query this page expects.
//           </span>
//         </div>
//       )}
//       {error && !endpointMissing && (
//         <div className="mb-4 text-sm text-orange-500 bg-orange-50 border border-orange-100 rounded-lg px-4 py-3">
//           {error}
//         </div>
//       )}

//       {/* ---------- Table ---------- */}
//       <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
//         <div className="overflow-x-auto">
//           <table className="w-full text-sm">
//             <thead>
//               <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
//                 <th className="px-5 py-3 font-medium">Date</th>
//                 <th className="px-5 py-3 font-medium">Check In</th>
//                 <th className="px-5 py-3 font-medium">Check Out</th>
//                 <th className="px-5 py-3 font-medium">Working Hours</th>
//                 <th className="px-5 py-3 font-medium">Break</th>
//                 <th className="px-5 py-3 font-medium">Status</th>
//                 <th className="px-5 py-3 font-medium">Location</th>
//                 <th className="px-5 py-3 font-medium text-right">Action</th>
//               </tr>
//             </thead>
//             <tbody>
//               {loading &&
//                 Array.from({ length: 5 }).map((_, i) => (
//                   <tr key={i} className="border-b border-slate-50">
//                     <td colSpan={8} className="px-5 py-4">
//                       <div className="h-4 bg-slate-100 rounded animate-pulse" />
//                     </td>
//                   </tr>
//                 ))}

//               {!loading && pageRows.length === 0 && (
//                 <tr>
//                   <td
//                     colSpan={8}
//                     className="px-5 py-10 text-center text-slate-400"
//                   >
//                     No attendance records found for this range.
//                   </td>
//                 </tr>
//               )}

//               {!loading &&
//                 pageRows.map((r) => {
//                   const db = formatDateBlock(r.date);
//                   const st = statusStyle(r.status);
//                   const StIcon = st.icon;
//                   const loc = nearestLocationName(
//                     r.check_in_latitude,
//                     r.check_in_longitude,
//                     locations,
//                   );
//                   return (
//                     <tr
//                       key={r.id ?? r.date}
//                       className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
//                     >
//                       <td className="px-5 py-3.5">
//                         <div className="flex items-center gap-2.5">
//                           <div className="w-11 text-center bg-slate-50 rounded-lg py-1">
//                             <div className="text-[10px] font-semibold text-orange-500">
//                               {db.month}
//                             </div>
//                             <div className="text-sm font-bold text-slate-700 leading-tight">
//                               {db.day}
//                             </div>
//                           </div>
//                           <div>
//                             <div className="text-slate-700 font-medium">
//                               {db.weekday}
//                             </div>
//                             <div className="text-xs text-slate-400">
//                               {db.year}
//                             </div>
//                           </div>
//                         </div>
//                       </td>
//                       <td className="px-5 py-3.5 text-slate-600">
//                         {formatTime(r.check_in_time)}
//                       </td>
//                       <td className="px-5 py-3.5 text-slate-600">
//                         {formatTime(r.check_out_time)}
//                       </td>
//                       <td className="px-5 py-3.5 text-slate-600">
//                         {formatDuration(r.working_minutes)}
//                       </td>
//                       <td className="px-5 py-3.5 text-slate-600">
//                         {formatDuration(r.break_minutes)}
//                       </td>
//                       <td className="px-5 py-3.5">
//                         <span
//                           className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}
//                         >
//                           <StIcon size={12} /> {r.status || "—"}
//                         </span>
//                       </td>
//                       <td className="px-5 py-3.5 text-slate-500 text-xs">
//                         {loc ? (
//                           <span className="flex items-center gap-1">
//                             <MapPin size={11} className="text-slate-400" />
//                             {loc}
//                           </span>
//                         ) : (
//                           "—"
//                         )}
//                       </td>
//                       <td className="px-5 py-3.5 text-right">
//                         <button
//                           onClick={() => setSelected(r)}
//                           className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
//                         >
//                           <Eye size={14} />
//                         </button>
//                       </td>
//                     </tr>
//                   );
//                 })}
//             </tbody>
//           </table>
//         </div>

//         {/* ---------- Pagination ---------- */}
//         <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100">
//           <div className="text-xs text-slate-400">
//             {filtered.length === 0
//               ? "Showing 0 records"
//               : `Showing ${(page - 1) * pageSize + 1} to ${Math.min(
//                   page * pageSize,
//                   filtered.length,
//                 )} of ${filtered.length} records`}
//           </div>
//           <div className="flex items-center gap-3">
//             <select
//               value={pageSize}
//               onChange={(e) => {
//                 setPageSize(Number(e.target.value));
//                 setPage(1);
//               }}
//               className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-slate-600"
//             >
//               {PAGE_SIZE_OPTIONS.map((n) => (
//                 <option key={n} value={n}>
//                   {n} per page
//                 </option>
//               ))}
//             </select>
//             <div className="flex items-center gap-1">
//               <button
//                 onClick={() => setPage(1)}
//                 disabled={page === 1}
//                 className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40"
//               >
//                 <ChevronsLeft size={13} />
//               </button>
//               <button
//                 onClick={() => setPage((p) => Math.max(1, p - 1))}
//                 disabled={page === 1}
//                 className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40"
//               >
//                 <ChevronLeft size={13} />
//               </button>
//               <span className="w-7 h-7 flex items-center justify-center rounded-md bg-orange-500 text-white text-xs font-medium">
//                 {page}
//               </span>
//               <button
//                 onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
//                 disabled={page === totalPages}
//                 className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40"
//               >
//                 <ChevronRight size={13} />
//               </button>
//               <button
//                 onClick={() => setPage(totalPages)}
//                 disabled={page === totalPages}
//                 className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40"
//               >
//                 <ChevronsRight size={13} />
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* ---------- Detail modal ---------- */}
//       {selected && (
//         <div
//           className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
//           onClick={() => setSelected(null)}
//         >
//           <div
//             className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-5"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div className="flex items-center justify-between mb-4">
//               <h3 className="font-semibold text-slate-800 flex items-center gap-2">
//                 <SlidersHorizontal size={15} className="text-orange-500" />
//                 {formatDateBlock(selected.date).weekday}, {selected.date}
//               </h3>
//               <button
//                 onClick={() => setSelected(null)}
//                 className="text-slate-400 hover:text-slate-600"
//               >
//                 <X size={18} />
//               </button>
//             </div>

//             <div className="grid grid-cols-2 gap-3 mb-4">
//               <div className="bg-slate-50 rounded-lg p-3">
//                 <div className="text-xs text-slate-400 mb-1">Check In</div>
//                 <div className="font-semibold text-slate-700">
//                   {formatTime(selected.check_in_time)}
//                 </div>
//               </div>
//               <div className="bg-slate-50 rounded-lg p-3">
//                 <div className="text-xs text-slate-400 mb-1">Check Out</div>
//                 <div className="font-semibold text-slate-700">
//                   {formatTime(selected.check_out_time)}
//                 </div>
//               </div>
//               <div className="bg-orange-50 rounded-lg p-3">
//                 <div className="text-xs text-orange-500 mb-1 flex items-center gap-1">
//                   <Clock size={11} /> Working Hours
//                 </div>
//                 <div className="font-semibold text-slate-700">
//                   {formatDuration(selected.working_minutes)}
//                 </div>
//               </div>
//               <div className="bg-slate-50 rounded-lg p-3">
//                 <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
//                   <Coffee size={11} /> Break
//                 </div>
//                 <div className="font-semibold text-slate-700">
//                   {formatDuration(selected.break_minutes)}
//                 </div>
//               </div>
//             </div>

//             {selected.breaks?.length > 0 && (
//               <div className="mb-4">
//                 <div className="text-xs text-slate-400 mb-2">
//                   Break Timeline
//                 </div>
//                 <ul className="space-y-1.5">
//                   {selected.breaks.map((b, i) => (
//                     <li
//                       key={i}
//                       className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded-md px-2.5 py-1.5"
//                     >
//                       <span>{formatTime(b.break_start)}</span>
//                       <span className="text-slate-300">→</span>
//                       <span>{formatTime(b.break_end)}</span>
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//             )}

//             {(selected.check_in_latitude || selected.check_out_latitude) && (
//               <div className="text-xs text-slate-500 flex items-center gap-1.5">
//                 <MapPin size={12} className="text-slate-400" />
//                 {nearestLocationName(
//                   selected.check_in_latitude,
//                   selected.check_in_longitude,
//                   locations,
//                 ) || "Location recorded, no matching office"}
//               </div>
//             )}
//           </div>
//         </div>
//       )}

//       {/* ---------- Summary panel: slides in from the right when the info
//           button next to "Back to Attendance" is clicked. Always mounted
//           (rather than conditionally rendered) so the transform transition
//           actually animates instead of just popping in/out. ---------- */}
//       <div
//         className={`fixed inset-0 z-50 ${
//           statsOpen ? "" : "pointer-events-none"
//         }`}
//       >
//         <div
//           onClick={() => setStatsOpen(false)}
//           className={`absolute inset-0 bg-slate-900/30 transition-opacity duration-200 ${
//             statsOpen ? "opacity-100" : "opacity-0"
//           }`}
//         />
//         <div
//           className={`absolute right-0 top-0 h-full w-full max-w-xs bg-white border-l border-slate-200 shadow-xl p-5 overflow-y-auto transition-transform duration-200 ${
//             statsOpen ? "translate-x-0" : "translate-x-full"
//           }`}
//         >
//           <div className="flex items-center justify-between mb-5">
//             <h3 className="font-semibold text-slate-800">Attendance summary</h3>
//             <button
//               onClick={() => setStatsOpen(false)}
//               className="text-slate-400 hover:text-slate-600"
//             >
//               <X size={18} />
//             </button>
//           </div>

//           <div className="divide-y divide-slate-100">
//             <div className="flex items-center justify-between py-3">
//               <span className="text-sm text-slate-500">Present Days</span>
//               <span className="text-sm font-semibold text-slate-800">
//                 {stats.present}{" "}
//                 <span className="text-xs font-normal text-slate-400">
//                   (
//                   {stats.total
//                     ? Math.round((stats.present / stats.total) * 100)
//                     : 0}
//                   %)
//                 </span>
//               </span>
//             </div>

//             <div className="flex items-center justify-between py-3">
//               <span className="text-sm text-slate-500">Absent Days</span>
//               <span className="text-sm font-semibold text-slate-800">
//                 {stats.absent}{" "}
//                 <span className="text-xs font-normal text-slate-400">
//                   (
//                   {stats.total
//                     ? Math.round((stats.absent / stats.total) * 100)
//                     : 0}
//                   %)
//                 </span>
//               </span>
//             </div>

//             <div className="flex items-center justify-between py-3">
//               <span className="text-sm text-slate-500">Late Days</span>
//               <span className="text-sm font-semibold text-slate-800">
//                 {stats.late}{" "}
//                 <span className="text-xs font-normal text-slate-400">
//                   (
//                   {stats.total
//                     ? Math.round((stats.late / stats.total) * 100)
//                     : 0}
//                   %)
//                 </span>
//               </span>
//             </div>

//             <div className="flex items-center justify-between py-3">
//               <span className="text-sm text-slate-500">Half Days</span>
//               <span className="text-sm font-semibold text-slate-800">
//                 {stats.halfDay}{" "}
//                 <span className="text-xs font-normal text-slate-400">
//                   (
//                   {stats.total
//                     ? Math.round((stats.halfDay / stats.total) * 100)
//                     : 0}
//                   %)
//                 </span>
//               </span>
//             </div>

//             <div className="flex items-center justify-between py-3">
//               <span className="text-sm text-slate-500">
//                 Total Working Hours
//               </span>
//               <span className="text-sm font-semibold text-slate-800">
//                 {formatDuration(stats.workingMinutes)}
//               </span>
//             </div>

//             <div className="flex items-center justify-between py-3">
//               <span className="text-sm text-slate-500">Total Days</span>
//               <span className="text-sm font-semibold text-slate-800">
//                 {stats.total}
//               </span>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Coffee,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Info,
  MapPin,
  Moon,
  Search,
  SlidersHorizontal,
  Umbrella,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import PageHeader from "../../components/common/PageHeader";
import DatePicker from "../../components/layout/DatePicker";
import { apiClient } from "../../services/apiClient";
import { toLocalISODate } from "../../utils/date";

// ---------------------------------------------------------------------
// Backend contract (see BACKEND_NOTES.md / attendance_history.sql that
// ship alongside this file for the full writeup):
//
//   GET /attendance/my?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD
//   -> { success: true, data: [ {
//        id, date, status,
//        check_in_time, check_out_time,
//        check_in_latitude, check_in_longitude,
//        check_out_latitude, check_out_longitude,
//        working_minutes, break_minutes,
//        breaks: [{ break_start, break_end }]
//      }, ... ] }
//
// This mirrors the shape already returned by GET /attendance/timeline/{date}
// (see CheckInOutCard.jsx) and GET /attendance/team (manager dashboard) —
// /attendance/my is the "list, not single-day" version of the same row.
// If that route doesn't exist yet on the backend, this page still renders
// (empty state + inline notice) instead of crashing, and the query params
// are sent so the backend can do date filtering server-side once it exists;
// everything is also re-filtered client-side below as a safety net.
// ---------------------------------------------------------------------

const STATUS_STYLES = {
  Present: {
    text: "text-blue-600",
    bg: "bg-blue-50",
    icon: CheckCircle2,
  },
  Absent: { text: "text-orange-500", bg: "bg-orange-50", icon: XCircle },
  "Half Day": { text: "text-orange-600", bg: "bg-orange-50", icon: Clock },
  Late: { text: "text-orange-600", bg: "bg-orange-50", icon: AlertTriangle },
  "On Leave": { text: "text-blue-600", bg: "bg-blue-50", icon: Umbrella },
  "Weekly Off": { text: "text-slate-500", bg: "bg-slate-100", icon: Moon },
};

function statusStyle(status) {
  return STATUS_STYLES[status] || STATUS_STYLES["Weekly Off"];
}

function todayIso() {
  return toLocalISODate();
}

function formatTime(iso) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(minutes) {
  if (minutes == null) return "--";
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDateBlock(dateStr) {
  const d = new Date(dateStr);
  return {
    month: d.toLocaleDateString([], { month: "short" }).toUpperCase(),
    day: d.toLocaleDateString([], { day: "2-digit" }),
    year: d.getFullYear(),
    weekday: d.toLocaleDateString([], { weekday: "short" }),
  };
}

// Same Haversine matching used in CheckInOutCard.jsx so the resolved
// location name here is consistent with what the dashboard card shows.
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestLocationName(lat, lon, locations) {
  if (lat == null || lon == null || !locations || locations.length === 0) {
    return null;
  }
  let best = null;
  for (const loc of locations) {
    if (loc.latitude == null || loc.longitude == null) continue;
    const d = distanceMeters(lat, lon, loc.latitude, loc.longitude);
    if (!best || d < best.distance) best = { loc, distance: d };
  }
  return best ? best.loc.location_name : null;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const STATUS_OPTIONS = [
  "All",
  "Present",
  "Absent",
  "Half Day",
  "Late",
  "On Leave",
  "Weekly Off",
];

// Fully custom (non-native) dropdown so every part of it — the trigger,
// the popover, the option rows, the selected-state highlight — follows
// the app's own rounded/orange design instead of the browser's default
// <select> popup styling (which can't be restyled via CSS).
function StatusDropdown({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between gap-6 w-full sm:w-36 text-sm text-slate-700 border rounded-xl pl-3.5 pr-3 py-2.5 bg-slate-50/60 hover:border-slate-300 transition-colors ${
          open ? "ring-2 ring-orange-200 border-orange-400" : "border-slate-200"
        }`}
      >
        <span>{value}</span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-30 top-full mt-2 left-0 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5">
          {options.map((opt) => {
            const active = opt === value;
            return (
              <button
                type="button"
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                  active
                    ? "bg-orange-500 text-white font-medium"
                    : "text-slate-600 hover:bg-orange-50"
                }`}
              >
                {opt}
                {active && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Export button with a small popover offering Excel / PDF — replaces the
// old single CSV-only button.
function ExportMenu({ disabled, onExportExcel, onExportPdf }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="flex items-center gap-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-4 py-2.5 rounded-xl shadow-sm transition-colors"
      >
        <Download size={14} /> Export
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && !disabled && (
        <div className="absolute z-30 top-full mt-2 right-0 w-52 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5">
          <button
            type="button"
            onClick={() => {
              onExportExcel();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 text-left text-sm px-3 py-2.5 rounded-lg text-slate-700 hover:bg-orange-50 transition-colors"
          >
            <FileSpreadsheet size={16} className="text-green-600 shrink-0" />
            <span>
              Export as Excel
              <span className="block text-[11px] text-slate-400">
                .xlsx file
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              onExportPdf();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 text-left text-sm px-3 py-2.5 rounded-lg text-slate-700 hover:bg-orange-50 transition-colors"
          >
            <FileText size={16} className="text-red-500 shrink-0" />
            <span>
              Export as PDF
              <span className="block text-[11px] text-slate-400">
                .pdf file
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function AttendanceHistory() {
  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [endpointMissing, setEndpointMissing] = useState(false);

  // ---------- filters ----------
  // Date range starts empty on purpose — the person picks both ends
  // before we fetch/export anything, rather than silently defaulting to
  // "this month".
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  // ---------- pagination ----------
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ---------- detail modal ----------
  const [selected, setSelected] = useState(null);

  // ---------- summary panel (Present/Absent/Half Day/Weekly Off counts,
  // moved out of the page body and behind the info button next to
  // "Back to Attendance" — click it to slide the details in from the right) ----------
  const [statsOpen, setStatsOpen] = useState(false);

  function load() {
    // Load everything by default. Date fields are optional narrowing
    // filters, not a prerequisite — previously the page stayed blank until
    // the person picked both a "from" and "to" date, even though there was
    // attendance history to show. `filtered` below still re-applies
    // dateFrom/dateTo client-side, so leaving them out of the request just
    // means "no server-side narrowing yet", not "no data".
    setLoading(true);
    setError(null);
    setEndpointMissing(false);

    const params = new URLSearchParams();
    if (dateFrom) params.set("from_date", dateFrom);
    if (dateTo) params.set("to_date", dateTo);
    const qs = params.toString();

    apiClient
      .get(`/attendance/my${qs ? `?${qs}` : ""}`)
      .then((res) => setRows(res.data || []))
      .catch((err) => {
        setRows([]);
        if (err.status === 404) {
          setEndpointMissing(true);
        } else {
          setError(err.message);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    apiClient
      .get("/locations/")
      .then((res) => setLocations(res.data || []))
      .catch(() => setLocations([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const filtered = useMemo(() => {
    return rows
      .filter((r) => !dateFrom || r.date >= dateFrom)
      .filter((r) => !dateTo || r.date <= dateTo)
      .filter((r) => statusFilter === "All" || r.status === statusFilter)
      .filter((r) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        const loc =
          nearestLocationName(
            r.check_in_latitude,
            r.check_in_longitude,
            locations,
          ) || "";
        return (
          r.date?.toLowerCase().includes(q) ||
          r.status?.toLowerCase().includes(q) ||
          loc.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [rows, dateFrom, dateTo, statusFilter, search, locations]);

  const stats = useMemo(() => {
    const s = {
      total: filtered.length,
      present: 0,
      absent: 0,
      late: 0,
      halfDay: 0,
      workingMinutes: 0,
    };
    filtered.forEach((r) => {
      if (r.status === "Present") s.present += 1;
      if (r.status === "Absent") s.absent += 1;
      if (r.status === "Late") s.late += 1;
      if (r.status === "Half Day") s.halfDay += 1;
      s.workingMinutes += r.working_minutes || 0;
    });
    return s;
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportHeader = [
    "Date",
    "Check In",
    "Check Out",
    "Working Hours",
    "Break",
    "Status",
  ];

  // "2024-01-01 to 2024-01-31", "from 2024-01-01" (no "to"), or "all-time"
  // when neither date filter is set — used in export filenames/subtitles
  // instead of the old `${dateFrom}-to-${dateTo}` which printed literally
  // "-to-" once history started loading unfiltered by default.
  function exportRangeLabel(joiner) {
    if (dateFrom && dateTo) return `${dateFrom}${joiner}to${joiner}${dateTo}`;
    if (dateFrom) return `from${joiner}${dateFrom}`;
    if (dateTo) return `through${joiner}${dateTo}`;
    return "all-time";
  }

  const exportRows = () =>
    filtered.map((r) => [
      r.date,
      formatTime(r.check_in_time),
      formatTime(r.check_out_time),
      formatDuration(r.working_minutes),
      formatDuration(r.break_minutes),
      r.status || "—",
    ]);

  function exportExcel() {
    const worksheet = XLSX.utils.aoa_to_sheet([exportHeader, ...exportRows()]);
    worksheet["!cols"] = [
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 14 },
      { wch: 10 },
      { wch: 12 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance History");
    XLSX.writeFile(workbook, `attendance-history-${exportRangeLabel("-")}.xlsx`);
  }

  function exportPdf() {
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text("Attendance History", 14, 16);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(exportRangeLabel(" "), 14, 22);

    autoTable(doc, {
      head: [exportHeader],
      body: exportRows(),
      startY: 27,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [249, 115, 22] }, // orange-500
      alternateRowStyles: { fillColor: [248, 250, 252] }, // slate-50
    });

    doc.save(`attendance-history-${exportRangeLabel("-")}.pdf`);
  }

  return (
    <div>
      <PageHeader
        title="Attendance History"
        subtitle="View your daily attendance records and working hours."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatsOpen(true)}
              aria-label="View attendance summary"
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            >
              <Info size={16} />
            </button>
            <Link
              to="/employee/attendance"
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-lg"
            >
              <ChevronLeft size={15} /> Back to Attendance
            </Link>
          </div>
        }
      />

      {/* ---------- Filter bar ---------- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6 flex flex-wrap items-end gap-3.5">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            Date Range
          </label>
          <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50/60 hover:border-slate-300 transition-colors">
            <DatePicker
              value={dateFrom ? new Date(dateFrom + "T00:00:00") : null}
              max={dateTo || todayIso()}
              placeholder="From"
              onSelect={(d) => setDateFrom(toLocalISODate(d))}
            />
            <span className="text-slate-300">→</span>
            <DatePicker
              value={dateTo ? new Date(dateTo + "T00:00:00") : null}
              min={dateFrom}
              max={todayIso()}
              placeholder="To"
              onSelect={(d) => setDateTo(toLocalISODate(d))}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            Status
          </label>
          <StatusDropdown
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          />
        </div>

        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            Search
          </label>
          <div className="flex items-center gap-2 border border-slate-200 bg-slate-50/60 hover:border-slate-300 focus-within:ring-2 focus-within:ring-orange-200 focus-within:border-orange-400 rounded-xl px-3.5 py-2.5 transition-colors">
            <Search size={15} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by date, status, or location..."
              className="text-sm text-slate-700 outline-none w-full bg-transparent"
            />
          </div>
        </div>

        <button
          onClick={() => {
            setPage(1);
            load();
          }}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 px-4 py-2.5 rounded-xl transition-colors"
        >
          <Filter size={14} /> Filter
        </button>

        <ExportMenu
          disabled={filtered.length === 0}
          onExportExcel={exportExcel}
          onExportPdf={exportPdf}
        />
      </div>

      {/* ---------- Inline notices ---------- */}
      {endpointMissing && (
        <div className="mb-4 flex items-start gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            <strong>GET /attendance/my</strong> isn't available on the backend
            yet (404), so history can't load. See{" "}
            <code>attendance_history_backend_notes.sql</code> for the endpoint
            spec and query this page expects.
          </span>
        </div>
      )}
      {error && !endpointMissing && (
        <div className="mb-4 text-sm text-orange-500 bg-orange-50 border border-orange-100 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* ---------- Table ---------- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Check In</th>
                <th className="px-5 py-3 font-medium">Check Out</th>
                <th className="px-5 py-3 font-medium">Working Hours</th>
                <th className="px-5 py-3 font-medium">Break</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Location</th>
                <th className="px-5 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td colSpan={8} className="px-5 py-4">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))}

              {!loading && pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-10 text-center text-slate-400"
                  >
                    {!dateFrom && !dateTo
                      ? "No attendance records found."
                      : "No attendance records found for this range."}
                  </td>
                </tr>
              )}

              {!loading &&
                pageRows.map((r) => {
                  const db = formatDateBlock(r.date);
                  const st = statusStyle(r.status);
                  const StIcon = st.icon;
                  const loc = nearestLocationName(
                    r.check_in_latitude,
                    r.check_in_longitude,
                    locations,
                  );
                  return (
                    <tr
                      key={r.id ?? r.date}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-11 text-center bg-slate-50 rounded-lg py-1">
                            <div className="text-[10px] font-semibold text-orange-500">
                              {db.month}
                            </div>
                            <div className="text-sm font-bold text-slate-700 leading-tight">
                              {db.day}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-700 font-medium">
                              {db.weekday}
                            </div>
                            <div className="text-xs text-slate-400">
                              {db.year}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {formatTime(r.check_in_time)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {formatTime(r.check_out_time)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {formatDuration(r.working_minutes)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {formatDuration(r.break_minutes)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}
                        >
                          <StIcon size={12} /> {r.status || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">
                        {loc ? (
                          <span className="flex items-center gap-1">
                            <MapPin size={11} className="text-slate-400" />
                            {loc}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setSelected(r)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* ---------- Pagination ---------- */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100">
          <div className="text-xs text-slate-400">
            {filtered.length === 0
              ? "Showing 0 records"
              : `Showing ${(page - 1) * pageSize + 1} to ${Math.min(
                  page * pageSize,
                  filtered.length,
                )} of ${filtered.length} records`}
          </div>
          <div className="flex items-center gap-3">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-slate-600"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40"
              >
                <ChevronsLeft size={13} />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="w-7 h-7 flex items-center justify-center rounded-md bg-orange-500 text-white text-xs font-medium">
                {page}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40"
              >
                <ChevronRight size={13} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40"
              >
                <ChevronsRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Detail modal ---------- */}
      {selected && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <SlidersHorizontal size={15} className="text-orange-500" />
                {formatDateBlock(selected.date).weekday}, {selected.date}
              </h3>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1">Check In</div>
                <div className="font-semibold text-slate-700">
                  {formatTime(selected.check_in_time)}
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1">Check Out</div>
                <div className="font-semibold text-slate-700">
                  {formatTime(selected.check_out_time)}
                </div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <div className="text-xs text-orange-500 mb-1 flex items-center gap-1">
                  <Clock size={11} /> Working Hours
                </div>
                <div className="font-semibold text-slate-700">
                  {formatDuration(selected.working_minutes)}
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  <Coffee size={11} /> Break
                </div>
                <div className="font-semibold text-slate-700">
                  {formatDuration(selected.break_minutes)}
                </div>
              </div>
            </div>

            {selected.breaks?.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-slate-400 mb-2">
                  Break Timeline
                </div>
                <ul className="space-y-1.5">
                  {selected.breaks.map((b, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded-md px-2.5 py-1.5"
                    >
                      <span>{formatTime(b.break_start)}</span>
                      <span className="text-slate-300">→</span>
                      <span>{formatTime(b.break_end)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(selected.check_in_latitude || selected.check_out_latitude) && (
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <MapPin size={12} className="text-slate-400" />
                {nearestLocationName(
                  selected.check_in_latitude,
                  selected.check_in_longitude,
                  locations,
                ) || "Location recorded, no matching office"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- Summary panel: slides in from the right when the info
          button next to "Back to Attendance" is clicked. Always mounted
          (rather than conditionally rendered) so the transform transition
          actually animates instead of just popping in/out. ---------- */}
      <div
        className={`fixed inset-0 z-50 ${
          statsOpen ? "" : "pointer-events-none"
        }`}
      >
        <div
          onClick={() => setStatsOpen(false)}
          className={`absolute inset-0 bg-slate-900/30 transition-opacity duration-200 ${
            statsOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute right-0 top-0 h-full w-full max-w-xs bg-white border-l border-slate-200 shadow-xl p-5 overflow-y-auto transition-transform duration-200 ${
            statsOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-slate-800">Attendance summary</h3>
            <button
              onClick={() => setStatsOpen(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-500">Present Days</span>
              <span className="text-sm font-semibold text-slate-800">
                {stats.present}{" "}
                <span className="text-xs font-normal text-slate-400">
                  (
                  {stats.total
                    ? Math.round((stats.present / stats.total) * 100)
                    : 0}
                  %)
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-500">Absent Days</span>
              <span className="text-sm font-semibold text-slate-800">
                {stats.absent}{" "}
                <span className="text-xs font-normal text-slate-400">
                  (
                  {stats.total
                    ? Math.round((stats.absent / stats.total) * 100)
                    : 0}
                  %)
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-500">Late Days</span>
              <span className="text-sm font-semibold text-slate-800">
                {stats.late}{" "}
                <span className="text-xs font-normal text-slate-400">
                  (
                  {stats.total
                    ? Math.round((stats.late / stats.total) * 100)
                    : 0}
                  %)
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-500">Half Days</span>
              <span className="text-sm font-semibold text-slate-800">
                {stats.halfDay}{" "}
                <span className="text-xs font-normal text-slate-400">
                  (
                  {stats.total
                    ? Math.round((stats.halfDay / stats.total) * 100)
                    : 0}
                  %)
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-500">
                Total Working Hours
              </span>
              <span className="text-sm font-semibold text-slate-800">
                {formatDuration(stats.workingMinutes)}
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-500">Total Days</span>
              <span className="text-sm font-semibold text-slate-800">
                {stats.total}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
