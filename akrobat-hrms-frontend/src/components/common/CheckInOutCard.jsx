// import {
//   AlertTriangle,
//   CheckCircle2,
//   Clock,
//   Coffee,
//   LogIn,
//   LogOut,
//   MapPin,
// } from "lucide-react";
// import { useEffect, useState } from "react";
// import { useAuth } from "../../context/AuthContext";
// import { apiClient } from "../../services/apiClient";
// import { parseServerDate, toLocalISODate } from "../../utils/date";
// import { isFieldEmployee } from "../../utils/employeeType";

// // GET /attendance/check-in, /check-out, /break-start, /break-end all work
// // for ANY logged-in user regardless of role (see app/attendance/routes.py —
// // they only depend on get_current_user, not a permission). So this card is
// // dropped into every dashboard, not just the Employee one: a Manager, HR
// // Admin, or Super Admin is still a person who can check in/out for their
// // own attendance record.
// //
// // ---------------------------------------------------------------------
// // Location / anti-fake-checkin logic
// // ---------------------------------------------------------------------
// // The backend already supports geofencing (see _validate_geofence in
// // app/attendance/services.py) — check-in/out accepts latitude, longitude,
// // and location_id, and rejects the request if you're further than that
// // location's `radius` (meters) away. But it only ENFORCES this when a
// // location_id is actually sent — if you omit it, no check happens at all.
// // So to actually get anti-fake-checkin behavior, this card must:
// //   1. Ask the browser for real GPS coordinates (navigator.geolocation) —
// //      not something the user can type in, unlike a manual "office" dropdown.
// //   2. Fetch the company's configured locations (GET /locations) and find
// //      the nearest one client-side (Haversine formula).
// //   3. Send that location's id + the real coordinates on check-in/check-out,
// //      so the backend performs the actual radius check server-side.
// // The client-side "nearest office" distance shown here is just a preview
// // for the user — the backend re-validates independently and is the real
// // enforcement point, so this can't be spoofed by editing the UI.
// //
// // It only breaks for accounts with no linked `employees` row (e.g. the
// // bootstrap Super Admin created purely via scripts/create_super_admin.py,
// // before anyone attaches an employee profile to it) — handled below with a
// // quiet "not linked to an employee profile" state instead of a crash.

// function todayIso() {
//   return toLocalISODate();
// }

// function formatTime(iso) {
//   if (!iso) return "--:--";
//   const d = parseServerDate(iso);
//   if (!d) return "--:--";
//   return d.toLocaleTimeString([], {
//     hour: "2-digit",
//     minute: "2-digit",
//   });
// }

// // "Xh Ym" for a minutes count — used for the working-hours / break-hours
// // summary that appears once the day's check-out lands.
// function formatDuration(minutes) {
//   if (minutes == null) return "--";
//   const total = Math.max(0, Math.round(minutes));
//   const h = Math.floor(total / 60);
//   const m = total % 60;
//   if (h === 0) return `${m}m`;
//   if (m === 0) return `${h}h`;
//   return `${h}h ${m}m`;
// }

// // Haversine distance in meters — mirrors _haversine_meters in
// // app/attendance/services.py so the client-side preview matches what the
// // server will actually decide.
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

// // The backend stores raw check_in/check_out latitude+longitude on the
// // attendance row (see app/attendance/services.py) but not a location name —
// // so to actually *show* "checked in at Main Office" we match those saved
// // coordinates against the same company locations list used for the live
// // "nearest office" preview above, and take whichever is closest.
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

// export default function CheckInOutCard({
//   onActivityChange,
//   // Dashboard renders this card next to Site Visits / Quote of the Day in a
//   // fixed grid row — the Working Hours/Break Hours summary and Last Location
//   // thumbnail below only appear once checked out, and both blocks would
//   // otherwise make the card (and so the whole row, since grid items stretch
//   // together) grow taller partway through the day. My Attendance already has
//   // its own "Today's Summary" panel with the same working-hours numbers, so
//   // compact=true just skips both blocks here to keep the dashboard steady.
//   compact = false,
// } = {}) {
//   const { user } = useAuth();
//   const isFieldStaff = isFieldEmployee(user);

//   const [today, setToday] = useState(null); // attendance row for today, or null
//   const [loading, setLoading] = useState(true);
//   const [busy, setBusy] = useState(false); // true while a check-in/out call is in flight
//   const [error, setError] = useState(null);
//   const [notLinked, setNotLinked] = useState(false);

//   // Live clock — ticks every second so the card always shows the actual
//   // current time (not just a static check-in/out timestamp).
//   const [now, setNow] = useState(new Date());
//   useEffect(() => {
//     const id = setInterval(() => setNow(new Date()), 1000);
//     return () => clearInterval(id);
//   }, []);

//   // Geolocation state
//   const [locations, setLocations] = useState([]);
//   const [coords, setCoords] = useState(null); // { latitude, longitude }
//   const [accuracy, setAccuracy] = useState(null); // meters — radius of uncertainty for `coords`
//   const [geoStatus, setGeoStatus] = useState("locating"); // locating | ok | denied | unsupported
//   const [nearest, setNearest] = useState(null); // { location, distance, withinRadius }

//   // Manager-assigned site(s) — see app/site_assignments. This is still
//   // fetched (for the informational "Your manager assigned you to X"
//   // banner below) but no longer restricts *daily attendance* check-in —
//   // that restriction belongs to Site Visits (SiteVisitCard / arrive_at_site)
//   // only. Daily check-in matches against every configured company
//   // location, same as check-out already does, so it can be done from any
//   // office, not just the employee's assigned site.
//   //
//   // Site assignment only ever applies to Inspection/Operation field staff
//   // (see is_field_employee on the backend, mirrored by isFieldEmployee()
//   // here) — office staff never fetch /site-assignments/my at all, so a
//   // stale assignment row can't surface a "assigned you to X" banner for
//   // someone outside those two departments.
//   const [assignedSites, setAssignedSites] = useState([]);
//   const eligibleLocations = locations;

//   // Reverse-geocoded place name for the detected GPS fix, so we can show
//   // "City, State, Country" (e.g. "Chennai, Tamil Nadu, India") instead of
//   // raw coordinates — and, per the request, surface which country the
//   // check-in is being attempted from.
//   const [place, setPlace] = useState(null); // { city, region, country }
//   const [placeLoading, setPlaceLoading] = useState(false);

//   // Reverse-geocoded label for the check-in/check-out coordinates already
//   // saved on today's attendance row (as opposed to `place` above, which is
//   // for the *live* GPS fix before you've checked in). This is what actually
//   // answers "where were they when they checked in" — previously the card
//   // only ever showed the nearest *configured office* name, which silently
//   // showed a misleading office name even when the real GPS point was far
//   // from any office (e.g. a field visit) since it just picks the closest
//   // one with no distance cutoff.
//   const [checkInPlace, setCheckInPlace] = useState(null);
//   const [checkOutPlace, setCheckOutPlace] = useState(null);

//   // Singapore's bounding box (rough, with a little padding). Coordinates
//   // outside this box skip OneMap entirely and go straight to BigDataCloud
//   // below — so Chennai/India and everywhere else keep working exactly as
//   // before.
//   const SG_LAT_MIN = 1.15,
//     SG_LAT_MAX = 1.48;
//   const SG_LON_MIN = 103.59,
//     SG_LON_MAX = 104.05;

//   function isInSingapore(latitude, longitude) {
//     return (
//       latitude >= SG_LAT_MIN &&
//       latitude <= SG_LAT_MAX &&
//       longitude >= SG_LON_MIN &&
//       longitude <= SG_LON_MAX
//     );
//   }

//   // Tries OneMap (via our backend, see app/locations/routes.py ->
//   // GET /locations/reverse-geocode) for a Singapore coordinate — it has
//   // the exact building/block/street that BigDataCloud can't give (BigData
//   // Cloud only ever returns city/region, never a building name). Returns
//   // null for anything outside Singapore, or if OneMap has no result /
//   // the call fails — callers fall back to BigDataCloud in that case.
//   async function reverseGeocodeOneMap(latitude, longitude) {
//     if (!isInSingapore(latitude, longitude)) return null;
//     try {
//       const res = await apiClient.get(
//         `/locations/reverse-geocode?lat=${latitude}&lon=${longitude}`,
//       );
//       return res?.data?.address || null;
//     } catch {
//       return null;
//     }
//   }

//   async function reverseGeocodeLabel(latitude, longitude) {
//     const oneMapAddress = await reverseGeocodeOneMap(latitude, longitude);
//     if (oneMapAddress) return oneMapAddress;

//     try {
//       const res = await fetch(
//         `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
//       );
//       if (!res.ok) throw new Error("reverse geocode failed");
//       const data = await res.json();
//       const city = data.city || data.locality || data.principalSubdivision;
//       const region = data.principalSubdivision;
//       return [city, region].filter(Boolean).join(", ") || null;
//     } catch {
//       return null;
//     }
//   }

//   async function load() {
//     try {
//       setLoading(true);
//       setError(null);
//       const res = await apiClient.get(`/attendance/timeline/${todayIso()}`);
//       setToday(res.data ?? null);
//     } catch (err) {
//       // No employee profile linked -> backend returns data: null via a 200,
//       // so a thrown error here is a real failure, not "no record yet".
//       setError(err.message);
//     } finally {
//       setLoading(false);
//     }
//   }

//   // Turns a GPS fix into a human-readable "City, State, Country" via a free,
//   // no-API-key reverse-geocoding lookup (BigDataCloud's client-side endpoint —
//   // CORS-enabled specifically for browser use, no backend proxy needed).
//   // This is what actually tells us — and shows the user — which country the
//   // check-in attempt is coming from.
//   async function reverseGeocode(latitude, longitude) {
//     setPlaceLoading(true);

//     // Singapore coordinate -> OneMap gives the exact building/block/street,
//     // shown here as the "city" slot so it renders as the full address
//     // (region left blank so it doesn't duplicate "Singapore" twice).
//     const oneMapAddress = await reverseGeocodeOneMap(latitude, longitude);
//     if (oneMapAddress) {
//       setPlace({
//         city: oneMapAddress,
//         region: null,
//         country: "Singapore",
//         countryCode: "SG",
//       });
//       setPlaceLoading(false);
//       return;
//     }

//     try {
//       const res = await fetch(
//         `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
//       );
//       if (!res.ok) throw new Error("reverse geocode failed");
//       const data = await res.json();
//       setPlace({
//         city: data.city || data.locality || data.principalSubdivision || null,
//         region: data.principalSubdivision || null,
//         country: data.countryName || null,
//         countryCode: data.countryCode || null,
//       });
//     } catch {
//       setPlace(null);
//     } finally {
//       setPlaceLoading(false);
//     }
//   }

//   // Pulled out so it can run both automatically on mount AND again on demand
//   // when the user taps "Detect Location" (e.g. after they granted permission
//   // following an earlier denial, or just want a fresh GPS fix).
//   //
//   // A single getCurrentPosition() call isn't reliable on a laptop with no
//   // GPS chip: the browser/OS location provider often returns a coarse
//   // Wi-Fi- or IP-based fix *first* (sometimes off by hundreds of km — this
//   // is why "Detect Location" was showing a different state entirely) and
//   // only refines to a tighter Wi-Fi-triangulated fix a few seconds later,
//   // if at all. So instead of taking the first result, we watch for up to
//   // ~8s and keep whichever fix has the smallest `accuracy` (meters of
//   // uncertainty), and stop early once we get a genuinely GPS-grade fix.
//   function detectLocation() {
//     if (!navigator.geolocation) {
//       setGeoStatus("unsupported");
//       return;
//     }
//     setGeoStatus("locating");
//     setPlace(null);
//     setAccuracy(null);

//     let bestFix = null;
//     let watchId = null;
//     let settled = false;
//     let timeoutId = null;

//     const finish = () => {
//       if (settled) return;
//       settled = true;
//       if (timeoutId) clearTimeout(timeoutId);
//       if (watchId != null) navigator.geolocation.clearWatch(watchId);
//       if (bestFix) {
//         setCoords({ latitude: bestFix.latitude, longitude: bestFix.longitude });
//         setAccuracy(bestFix.accuracy);
//         setGeoStatus("ok");
//         reverseGeocode(bestFix.latitude, bestFix.longitude);
//       } else {
//         setGeoStatus("denied");
//       }
//     };

//     watchId = navigator.geolocation.watchPosition(
//       (pos) => {
//         const { latitude, longitude, accuracy: acc } = pos.coords;
//         if (!bestFix || acc < bestFix.accuracy) {
//           bestFix = { latitude, longitude, accuracy: acc };
//         }
//         // GPS-grade fix already — no need to keep waiting.
//         if (acc <= 50) finish();
//       },
//       () => finish(),
//       { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
//     );

//     // Give the provider a few seconds to refine from an initial coarse
//     // (Wi-Fi/IP) fix to a tighter one, then lock in whatever's best so far.
//     timeoutId = setTimeout(finish, 8000);
//   }

//   useEffect(() => {
//     load();

//     apiClient
//       .get("/locations/")
//       .then((res) => setLocations(res.data || []))
//       .catch(() => setLocations([]));

//     if (isFieldStaff) {
//       apiClient
//         .get("/site-assignments/my")
//         .then((res) =>
//           setAssignedSites(
//             (res.data || []).map((a) => a.locations).filter(Boolean),
//           ),
//         )
//         .catch(() => setAssignedSites([]));
//     }

//     detectLocation();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   // Recompute nearest eligible site whenever we have both a GPS fix and the
//   // (assigned-site-restricted, if any) location list.
//   useEffect(() => {
//     if (!coords || eligibleLocations.length === 0) {
//       setNearest(null);
//       return;
//     }
//     let best = null;
//     for (const loc of eligibleLocations) {
//       if (loc.latitude == null || loc.longitude == null) continue;
//       const d = distanceMeters(
//         coords.latitude,
//         coords.longitude,
//         loc.latitude,
//         loc.longitude,
//       );
//       if (!best || d < best.distance) best = { location: loc, distance: d };
//     }
//     if (best) {
//       setNearest({
//         ...best,
//         withinRadius: best.distance <= (best.location.radius ?? Infinity),
//       });
//     }
//   }, [coords, eligibleLocations]);

//   // Resolve real place names for wherever the employee actually was when
//   // they checked in / out today, straight from the saved lat/lon — this is
//   // what drives the "at <place>" label under each timeline entry below,
//   // instead of only the nearest-configured-office guess.
//   useEffect(() => {
//     if (today?.check_in_latitude != null && today?.check_in_longitude != null) {
//       reverseGeocodeLabel(
//         today.check_in_latitude,
//         today.check_in_longitude,
//       ).then(setCheckInPlace);
//     } else {
//       setCheckInPlace(null);
//     }
//   }, [today?.check_in_latitude, today?.check_in_longitude]);

//   useEffect(() => {
//     if (
//       today?.check_out_latitude != null &&
//       today?.check_out_longitude != null
//     ) {
//       reverseGeocodeLabel(
//         today.check_out_latitude,
//         today.check_out_longitude,
//       ).then(setCheckOutPlace);
//     } else {
//       setCheckOutPlace(null);
//     }
//   }, [today?.check_out_latitude, today?.check_out_longitude]);

//   // On-demand GPS fetch, used as a fallback right before check-in/out —
//   // separate from detectLocation() (which runs automatically on mount and
//   // drives the status banner). If the user clicks Check In/Out before that
//   // automatic fix has resolved (slow GPS, or they were fast), `coords` is
//   // still null and the request would otherwise go out with no lat/long at
//   // all. This grabs a fresh position at the moment of the click instead,
//   // so a location is always attached (never hardcoded, always the real
//   // detected one — just via a fresh request if we didn't already have it).
//   function getFreshCoords() {
//     return new Promise((resolve) => {
//       if (!navigator.geolocation) {
//         resolve(null);
//         return;
//       }
//       navigator.geolocation.getCurrentPosition(
//         (pos) =>
//           resolve({
//             latitude: pos.coords.latitude,
//             longitude: pos.coords.longitude,
//           }),
//         () => resolve(null),
//         { enableHighAccuracy: true, timeout: 10000 },
//       );
//     });
//   }

//   async function runAction(path, successReload = true) {
//     setBusy(true);
//     setError(null);
//     try {
//       // Prefer the already-detected fix; if none has resolved yet, fetch
//       // one now rather than sending an empty body. Either way this is the
//       // real device location at request time, never a stored/hardcoded
//       // value.
//       const liveCoords = coords || (await getFreshCoords());
//       if (liveCoords && !coords) {
//         setCoords(liveCoords);
//         setGeoStatus("ok");
//         reverseGeocode(liveCoords.latitude, liveCoords.longitude);
//       }
//       // location_id is only included when we actually matched one — the
//       // backend skips the geofence check entirely if location_id is
//       // missing, so an unmatched location deliberately does NOT get
//       // silently treated as "in range".
//       const body = liveCoords
//         ? {
//             latitude: liveCoords.latitude,
//             longitude: liveCoords.longitude,
//             ...(nearest ? { location_id: nearest.location.id } : {}),
//           }
//         : {};
//       await apiClient.post(path, body);
//       if (successReload) await load();
//       // Audit-log entries for this action land on the backend as part of
//       // the same request (see app/attendance/services.py), so Recent
//       // Activity can be refreshed immediately rather than waiting for the
//       // next full page load / poll.
//       onActivityChange?.();
//     } catch (err) {
//       if (err.status === 403 && /no employee profile/i.test(err.message)) {
//         setNotLinked(true);
//       } else {
//         setError(err.message);
//       }
//     } finally {
//       setBusy(false);
//     }
//   }

//   const onBreak =
//     today?.breaks?.length > 0 &&
//     !today.breaks[today.breaks.length - 1].break_end;
//   const checkedIn = !!today?.check_in_time;
//   const checkedOut = !!today?.check_out_time;

//   const checkInOfficeMatch = nearestLocationName(
//     today?.check_in_latitude,
//     today?.check_in_longitude,
//     locations,
//   );
//   const checkOutOfficeMatch = nearestLocationName(
//     today?.check_out_latitude,
//     today?.check_out_longitude,
//     locations,
//   );

//   // Prefer the real detected place ("Chennai, Tamil Nadu") since that's
//   // where the employee actually was; fall back to the nearest configured
//   // office name if reverse-geocoding hasn't resolved yet.
//   const checkInLocation = checkInPlace || checkInOfficeMatch;
//   const checkOutLocation = checkOutPlace || checkOutOfficeMatch;

//   if (notLinked) {
//     return (
//       <div className="bg-white rounded-xl border border-slate-200 p-5">
//         <div className="flex items-center gap-2 text-slate-500 text-sm">
//           <Clock size={16} />
//           This account isn't linked to an employee profile, so attendance
//           check-in/out isn't available here.
//         </div>
//       </div>
//     );
//   }

//   const onBreakForDot = onBreak;

//   // ---------- Timeline events, right-hand column ----------
//   // Same underlying data as the check-in/out/break state above, just laid
//   // out chronologically instead of as three side-by-side stats.
//   const timelineEvents = [];
//   if (checkedIn) {
//     timelineEvents.push({
//       key: "check-in",
//       label: "Checked In",
//       time: formatTime(today?.check_in_time),
//       sub: checkInLocation,
//       dot: "bg-green-500",
//     });
//   }
//   (today?.breaks || []).forEach((b, i) => {
//     timelineEvents.push({
//       key: `break-start-${i}`,
//       label: "Break Started",
//       time: formatTime(b.break_start),
//       sub: "Break",
//       dot: "bg-blue-500",
//     });
//     if (b.break_end) {
//       timelineEvents.push({
//         key: `break-end-${i}`,
//         label: "Break Ended",
//         time: formatTime(b.break_end),
//         sub: null,
//         dot: "bg-blue-500",
//       });
//     }
//   });
//   if (checkedOut) {
//     timelineEvents.push({
//       key: "check-out",
//       label: "Checked Out",
//       time: formatTime(today?.check_out_time),
//       sub: checkOutLocation,
//       dot: "bg-slate-700",
//     });
//   } else if (checkedIn) {
//     timelineEvents.push({
//       key: "in-progress",
//       label: "Work In Progress",
//       time: "",
//       sub: onBreakForDot ? "Currently on break" : "Still working",
//       dot: "bg-slate-300",
//       pending: true,
//     });
//   }

//   // ---------- Left status circle ----------
//   let statusLabel = "Not Checked In";
//   let statusTime = null;
//   let CircleIcon = Clock;
//   let circleRing = "bg-slate-100";
//   let circleFill = "bg-slate-300";
//   if (checkedOut) {
//     statusLabel = "Checked Out";
//     statusTime = formatTime(today?.check_out_time);
//     CircleIcon = CheckCircle2;
//     circleRing = "bg-slate-100";
//     circleFill = "bg-slate-700";
//   } else if (checkedIn && onBreakForDot) {
//     statusLabel = "On Break";
//     statusTime = formatTime(today?.check_in_time);
//     CircleIcon = Coffee;
//     circleRing = "bg-orange-50";
//     circleFill = "bg-orange-500";
//   } else if (checkedIn) {
//     statusLabel = "Checked In";
//     statusTime = formatTime(today?.check_in_time);
//     CircleIcon = CheckCircle2;
//     circleRing = "bg-green-50";
//     circleFill = "bg-green-500";
//   }

//   return (
//     <div
//       className={`bg-white rounded-xl border border-slate-200 p-5${
//         compact ? " lg:min-h-[280px]" : ""
//       }`}
//     >
//       <div className="flex items-center justify-between mb-4">
//         <h3 className="font-semibold text-slate-800">Today's Attendance</h3>
//         <div className="flex items-center gap-2">
//           <span className="text-xs font-medium text-slate-500 tabular-nums">
//             {now.toLocaleTimeString([], {
//               hour: "2-digit",
//               minute: "2-digit",
//               second: "2-digit",
//             })}
//           </span>
//           {checkedIn && !checkedOut && (
//             <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
//               <CheckCircle2 size={13} /> Checked in
//             </span>
//           )}
//         </div>
//       </div>

//       {loading ? (
//         <div className="h-16 bg-slate-100 rounded animate-pulse" />
//       ) : (
//         <>
//           {/* ---------- Two-column layout: status circle + action on the
//               left, chronological timeline on the right ---------- */}
//           <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,160px)_1fr] gap-5 mb-4">
//             {/* ===== Left: status circle + primary action ===== */}
//             <div className="flex flex-col items-center text-center sm:border-r sm:border-slate-100 sm:pr-5">
//               <div
//                 className={`w-20 h-20 rounded-full ${circleRing} flex items-center justify-center mb-2`}
//               >
//                 <div
//                   className={`w-12 h-12 rounded-full ${circleFill} flex items-center justify-center`}
//                 >
//                   <CircleIcon size={22} className="text-white" />
//                 </div>
//               </div>
//               <div className="text-xs text-slate-400">{statusLabel}</div>
//               {statusTime && (
//                 <div className="font-semibold text-slate-800 text-base mb-3">
//                   {statusTime}
//                 </div>
//               )}
//               {!statusTime && <div className="mb-3" />}

//               <div className="flex flex-col gap-2 w-full max-w-[160px]">
//                 {!checkedIn && (
//                   <button
//                     onClick={() => runAction("/attendance/check-in")}
//                     disabled={busy}
//                     className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
//                   >
//                     <LogIn size={15} /> Check In
//                   </button>
//                 )}

//                 {checkedIn && !checkedOut && !onBreakForDot && (
//                   <button
//                     onClick={() => runAction("/attendance/break-start")}
//                     disabled={busy}
//                     className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-sm font-medium py-2 rounded-lg transition-colors"
//                   >
//                     <Coffee size={15} /> Start Break
//                   </button>
//                 )}

//                 {checkedIn && !checkedOut && onBreakForDot && (
//                   <button
//                     onClick={() => runAction("/attendance/break-end")}
//                     disabled={busy}
//                     className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-sm font-medium py-2 rounded-lg transition-colors"
//                   >
//                     <Coffee size={15} /> End Break
//                   </button>
//                 )}

//                 {checkedIn && !checkedOut && (
//                   <button
//                     onClick={() => runAction("/attendance/check-out")}
//                     disabled={busy}
//                     className="flex items-center justify-center gap-2 border border-orange-500 text-orange-600 hover:bg-orange-50 disabled:opacity-50 text-sm font-medium py-2 rounded-lg transition-colors"
//                   >
//                     <LogOut size={15} /> Check Out
//                   </button>
//                 )}

//                 {checkedOut && (
//                   <button
//                     disabled
//                     className="flex items-center justify-center gap-2 bg-slate-100 text-slate-400 text-sm font-medium py-2 rounded-lg cursor-not-allowed"
//                   >
//                     <LogOut size={15} /> Checked Out
//                   </button>
//                 )}
//               </div>
//             </div>

//             {/* ===== Right: chronological timeline ===== */}
//             <div className="sm:pl-1">
//               {timelineEvents.length === 0 ? (
//                 <div className="h-full flex items-center justify-center text-sm text-slate-400 py-6">
//                   No activity yet today.
//                 </div>
//               ) : (
//                 <div>
//                   {timelineEvents.map((ev, idx) => (
//                     <div key={ev.key} className="relative pl-5 pb-4 last:pb-0">
//                       {idx !== timelineEvents.length - 1 && (
//                         <span className="absolute left-[4px] top-3 bottom-0 w-px bg-slate-200" />
//                       )}
//                       <span
//                         className={`absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full ${ev.dot}${
//                           ev.pending ? " animate-pulse" : ""
//                         }`}
//                       />
//                       <div className="flex items-start justify-between gap-3">
//                         <p
//                           className={`text-sm font-medium ${
//                             ev.pending ? "text-slate-400" : "text-slate-800"
//                           }`}
//                         >
//                           {ev.label}
//                         </p>
//                         {ev.time && (
//                           <span className="text-xs text-slate-400 whitespace-nowrap">
//                             {ev.time}
//                           </span>
//                         )}
//                       </div>
//                       {ev.sub && (
//                         <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
//                           {!ev.pending && (
//                             <MapPin size={10} className="shrink-0" />
//                           )}
//                           {ev.sub}
//                         </p>
//                       )}
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>
//           </div>

//           {/* ---------- Assigned site banner ---------- */}
//           {isFieldStaff &&
//             !checkedIn &&
//             !checkedOut &&
//             assignedSites.length > 0 && (
//               <div className="mb-3 flex items-center gap-1.5 text-xs bg-orange-50 text-orange-700 rounded-lg px-3 py-2">
//                 <MapPin size={12} />
//                 {assignedSites.length === 1 ? (
//                   <span>
//                     Your manager assigned you to{" "}
//                     <strong>{assignedSites[0].location_name}</strong> for site
//                     visits today.
//                   </span>
//                 ) : (
//                   <span>
//                     You're assigned to {assignedSites.length} sites for site
//                     visits today:{" "}
//                     {assignedSites.map((s) => s.location_name).join(", ")}.
//                   </span>
//                 )}
//               </div>
//             )}
//           {/* ---------- Location status — the anti-fake-checkin signal ---------- */}
//           {!checkedIn && !checkedOut && (
//             <div className="mb-3 text-xs rounded-lg px-3 py-2.5 bg-slate-50">
//               <div className="flex items-start justify-between gap-2 flex-wrap">
//                 <div className="flex items-start gap-2 min-w-0">
//                   {geoStatus === "locating" && (
//                     <>
//                       <MapPin
//                         size={13}
//                         className="text-slate-400 animate-pulse shrink-0 mt-0.5"
//                       />
//                       <span className="text-slate-500">
//                         Getting your location…
//                       </span>
//                     </>
//                   )}
//                   {geoStatus === "denied" && (
//                     <>
//                       <AlertTriangle
//                         size={13}
//                         className="text-orange-500 shrink-0 mt-0.5"
//                       />
//                       <span className="text-orange-600">
//                         Location access denied — check-in won't be
//                         location-verified.
//                       </span>
//                     </>
//                   )}
//                   {geoStatus === "unsupported" && (
//                     <>
//                       <AlertTriangle
//                         size={13}
//                         className="text-orange-500 shrink-0 mt-0.5"
//                       />
//                       <span className="text-orange-600">
//                         This browser doesn't support location.
//                       </span>
//                     </>
//                   )}
//                   {geoStatus === "ok" && nearest && nearest.withinRadius && (
//                     <>
//                       <MapPin
//                         size={13}
//                         className="text-blue-500 shrink-0 mt-0.5"
//                       />
//                       <span className="text-blue-600">
//                         Within range of {nearest.location.location_name} (
//                         {Math.round(nearest.distance)}m)
//                         {place && (
//                           <span className="text-slate-400">
//                             {" "}
//                             —{" "}
//                             {[place.city, place.region]
//                               .filter(Boolean)
//                               .join(", ")}
//                           </span>
//                         )}
//                       </span>
//                     </>
//                   )}
//                   {geoStatus === "ok" && nearest && !nearest.withinRadius && (
//                     <>
//                       <MapPin
//                         size={13}
//                         className="text-slate-400 shrink-0 mt-0.5"
//                       />
//                       <span className="text-slate-500">
//                         {place
//                           ? `Detected at ${[place.city, place.region]
//                               .filter(Boolean)
//                               .join(", ")}`
//                           : "Location detected"}{" "}
//                         ({Math.round(nearest.distance)}m from{" "}
//                         {nearest.location.location_name}) — check-in is allowed
//                         from any location.
//                       </span>
//                     </>
//                   )}
//                   {geoStatus === "ok" && !nearest && (
//                     <>
//                       <MapPin
//                         size={13}
//                         className="text-slate-400 shrink-0 mt-0.5"
//                       />
//                       <span className="text-slate-500">
//                         {place
//                           ? `Detected at ${[place.city, place.region]
//                               .filter(Boolean)
//                               .join(
//                                 ", ",
//                               )} — no office locations configured yet.`
//                           : placeLoading
//                             ? "Location acquired — resolving place…"
//                             : "Location acquired — no office locations configured yet."}
//                       </span>
//                     </>
//                   )}
//                 </div>

//                 {/* Manual trigger — click to (re)detect instead of relying
//                     only on the automatic check on page load. */}
//                 <button
//                   type="button"
//                   onClick={detectLocation}
//                   disabled={geoStatus === "locating"}
//                   className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 px-2 py-1 rounded-md"
//                 >
//                   <MapPin size={11} />
//                   {geoStatus === "locating" ? "Detecting…" : "Detect Location"}
//                 </button>
//               </div>

//               {/* Accuracy check — a laptop with no GPS chip is often given a
//                   coarse Wi-Fi- or IP-based fix instead of a real GPS one,
//                   which can be off by hundreds of km (the accuracy value
//                   reveals this even when the place name looks plausible).
//                   LOW_ACCURACY_THRESHOLD_M is deliberately generous (GPS is
//                   normally <50m, Wi-Fi positioning a few hundred m) so this
//                   only fires for genuinely unreliable, IP-grade fixes. */}
//               {geoStatus === "ok" && accuracy != null && accuracy > 3000 && (
//                 <div className="mt-1.5 flex items-start gap-2 text-orange-600">
//                   <AlertTriangle size={13} className="shrink-0 mt-0.5" />
//                   <span>
//                     Low-accuracy location (±{Math.round(accuracy / 1000)}km) —
//                     this looks like a network-based estimate, not your real GPS
//                     position. Turn on Location Services / Wi-Fi on this device,
//                     or check in from a mobile phone for an accurate fix.
//                   </span>
//                 </div>
//               )}
//             </div>
//           )}
//           {error && (
//             <div className="text-xs text-orange-500 mb-3">
//               {error}
//               {error.toLowerCase().includes("expired") && (
//                 <span className="text-slate-400">
//                   {" "}
//                   — your session will refresh automatically; if this persists,
//                   please log in again.
//                 </span>
//               )}
//             </div>
//           )}
//           {/* ---------- Working hours / break hours ---------- */}
//           {!compact && checkedOut && (
//             <div className="grid grid-cols-2 gap-3">
//               <div className="bg-orange-50 rounded-lg py-2.5 text-center">
//                 <div className="text-[10px] text-orange-500 font-medium mb-0.5 flex items-center justify-center gap-1">
//                   <Clock size={11} /> Working Hours
//                 </div>
//                 <div className="font-semibold text-slate-800 text-sm">
//                   {formatDuration(today?.working_minutes)}
//                 </div>
//               </div>
//               <div className="bg-slate-50 rounded-lg py-2.5 text-center">
//                 <div className="text-[10px] text-slate-500 font-medium mb-0.5 flex items-center justify-center gap-1">
//                   <Coffee size={11} /> Break Hours
//                 </div>
//                 <div className="font-semibold text-slate-800 text-sm">
//                   {formatDuration(today?.break_minutes)}
//                 </div>
//               </div>
//             </div>
//           )}
//         </>
//       )}
//     </div>
//   );
// }
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coffee,
  LogIn,
  LogOut,
  MapPin,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../services/apiClient";
import { parseServerDate, toLocalISODate } from "../../utils/date";
import { isFieldEmployee } from "../../utils/employeeType";
// Shared reverse-geocoding helper (OneMap for Singapore -> Nominatim
// everywhere else, both formatted as "Building, B.No X, Area, City,
// State"). Used here instead of a local BigDataCloud-only lookup, which
// only ever returns city/region and never a building/area — that was
// why check-in location wasn't showing building-level detail anywhere,
// Singapore included whenever OneMap had no result for a point.
import { reverseGeocode as reverseGeocodePlace } from "../../utils/Geocode";

// GET /attendance/check-in, /check-out, /break-start, /break-end all work
// for ANY logged-in user regardless of role (see app/attendance/routes.py —
// they only depend on get_current_user, not a permission). So this card is
// dropped into every dashboard, not just the Employee one: a Manager, HR
// Admin, or Super Admin is still a person who can check in/out for their
// own attendance record.
//
// ---------------------------------------------------------------------
// Location / anti-fake-checkin logic
// ---------------------------------------------------------------------
// The backend already supports geofencing (see _validate_geofence in
// app/attendance/services.py) — check-in/out accepts latitude, longitude,
// and location_id, and rejects the request if you're further than that
// location's `radius` (meters) away. But it only ENFORCES this when a
// location_id is actually sent — if you omit it, no check happens at all.
// So to actually get anti-fake-checkin behavior, this card must:
//   1. Ask the browser for real GPS coordinates (navigator.geolocation) —
//      not something the user can type in, unlike a manual "office" dropdown.
//   2. Fetch the company's configured locations (GET /locations) and find
//      the nearest one client-side (Haversine formula).
//   3. Send that location's id + the real coordinates on check-in/check-out,
//      so the backend performs the actual radius check server-side.
// The client-side "nearest office" distance shown here is just a preview
// for the user — the backend re-validates independently and is the real
// enforcement point, so this can't be spoofed by editing the UI.
//
// It only breaks for accounts with no linked `employees` row (e.g. the
// bootstrap Super Admin created purely via scripts/create_super_admin.py,
// before anyone attaches an employee profile to it) — handled below with a
// quiet "not linked to an employee profile" state instead of a crash.

function todayIso() {
  return toLocalISODate();
}

function formatTime(iso) {
  if (!iso) return "--:--";
  const d = parseServerDate(iso);
  if (!d) return "--:--";
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "Xh Ym" for a minutes count — used for the working-hours / break-hours
// summary that appears once the day's check-out lands.
function formatDuration(minutes) {
  if (minutes == null) return "--";
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Haversine distance in meters — mirrors _haversine_meters in
// app/attendance/services.py so the client-side preview matches what the
// server will actually decide.
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

// The backend stores raw check_in/check_out latitude+longitude on the
// attendance row (see app/attendance/services.py) but not a location name —
// so to actually *show* "checked in at Main Office" we match those saved
// coordinates against the same company locations list used for the live
// "nearest office" preview above.
//
// withinRadiusOnly=true only returns a name when the point actually falls
// inside that location's configured geofence radius — used for the
// checked-in/out label so we only ever substitute the company's own
// (reliable, human-entered) office name when we're confident this really
// is that office, not just "closest of whatever's configured, however
// far away". Reverse-geocoded public map data (OpenStreetMap) is
// crowd-sourced and can be missing, wrong, or outright junk for a given
// spot — the configured office name is always more trustworthy than that
// when we know the check-in genuinely happened there.
function nearestLocationName(lat, lon, locations, withinRadiusOnly = false) {
  if (lat == null || lon == null || !locations || locations.length === 0) {
    return null;
  }
  let best = null;
  for (const loc of locations) {
    if (loc.latitude == null || loc.longitude == null) continue;
    const d = distanceMeters(lat, lon, loc.latitude, loc.longitude);
    if (!best || d < best.distance) best = { loc, distance: d };
  }
  if (!best) return null;
  if (withinRadiusOnly && best.distance > (best.loc.radius ?? 0)) return null;
  return best.loc.location_name;
}

export default function CheckInOutCard({
  onActivityChange,
  // Dashboard renders this card next to Site Visits / Quote of the Day in a
  // fixed grid row — the Working Hours/Break Hours summary and Last Location
  // thumbnail below only appear once checked out, and both blocks would
  // otherwise make the card (and so the whole row, since grid items stretch
  // together) grow taller partway through the day. My Attendance already has
  // its own "Today's Summary" panel with the same working-hours numbers, so
  // compact=true just skips both blocks here to keep the dashboard steady.
  compact = false,
  // Opt-in, defaults to false so every existing caller (Employee/Manager
  // desktop, Employee mobile, etc.) renders exactly as before. When true,
  // collapses the big status-circle + timeline layout into a single
  // horizontal row — for screens where the full card is too tall (e.g.
  // Manager mobile dashboard).
  ultraCompact = false,
} = {}) {
  const { user } = useAuth();
  const isFieldStaff = isFieldEmployee(user);

  const [today, setToday] = useState(null); // attendance row for today, or null
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); // true while a check-in/out call is in flight
  const [error, setError] = useState(null);
  const [notLinked, setNotLinked] = useState(false);

  // Live clock — ticks every second so the card always shows the actual
  // current time (not just a static check-in/out timestamp).
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Geolocation state
  const [locations, setLocations] = useState([]);
  const [coords, setCoords] = useState(null); // { latitude, longitude }
  const [accuracy, setAccuracy] = useState(null); // meters — radius of uncertainty for `coords`
  const [geoStatus, setGeoStatus] = useState("locating"); // locating | ok | denied | unsupported
  const [nearest, setNearest] = useState(null); // { location, distance, withinRadius }

  // Manager-assigned site(s) — see app/site_assignments. This is still
  // fetched (for the informational "Your manager assigned you to X"
  // banner below) but no longer restricts *daily attendance* check-in —
  // that restriction belongs to Site Visits (SiteVisitCard / arrive_at_site)
  // only. Daily check-in matches against every configured company
  // location, same as check-out already does, so it can be done from any
  // office, not just the employee's assigned site.
  //
  // Site assignment only ever applies to Inspection/Operation field staff
  // (see is_field_employee on the backend, mirrored by isFieldEmployee()
  // here) — office staff never fetch /site-assignments/my at all, so a
  // stale assignment row can't surface a "assigned you to X" banner for
  // someone outside those two departments.
  const [assignedSites, setAssignedSites] = useState([]);
  const eligibleLocations = locations;

  // Reverse-geocoded place for the detected GPS fix — a single formatted
  // "Building Name, B.No X, Area, City, State" string (see
  // utils/Geocode.jsx), not just city/region, so the banner below can
  // actually show the building/area the employee is standing in.
  const [place, setPlace] = useState(null); // formatted address string, or null
  const [placeLoading, setPlaceLoading] = useState(false);

  // Reverse-geocoded label for the check-in/check-out coordinates already
  // saved on today's attendance row (as opposed to `place` above, which is
  // for the *live* GPS fix before you've checked in). This is what actually
  // answers "where were they when they checked in" — previously the card
  // only ever showed the nearest *configured office* name, which silently
  // showed a misleading office name even when the real GPS point was far
  // from any office (e.g. a field visit) since it just picks the closest
  // one with no distance cutoff.
  const [checkInPlace, setCheckInPlace] = useState(null);
  const [checkOutPlace, setCheckOutPlace] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get(`/attendance/timeline/${todayIso()}`);
      setToday(res.data ?? null);
    } catch (err) {
      // No employee profile linked -> backend returns data: null via a 200,
      // so a thrown error here is a real failure, not "no record yet".
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Turns a GPS fix into a human-readable, building-level address via the
  // shared reverseGeocodePlace helper (OneMap for Singapore, Nominatim
  // everywhere else — see utils/Geocode.jsx) so this banner shows
  // "Building Name, B.No X, Area, City, State" instead of just a city.
  async function reverseGeocode(latitude, longitude) {
    setPlaceLoading(true);
    try {
      const formatted = await reverseGeocodePlace(latitude, longitude);
      setPlace(formatted);
    } finally {
      setPlaceLoading(false);
    }
  }

  // Pulled out so it can run both automatically on mount AND again on demand
  // when the user taps "Detect Location" (e.g. after they granted permission
  // following an earlier denial, or just want a fresh GPS fix).
  //
  // A single getCurrentPosition() call isn't reliable on a laptop with no
  // GPS chip: the browser/OS location provider often returns a coarse
  // Wi-Fi- or IP-based fix *first* (sometimes off by hundreds of km — this
  // is why "Detect Location" was showing a different state entirely) and
  // only refines to a tighter Wi-Fi-triangulated fix a few seconds later,
  // if at all. So instead of taking the first result, we watch for up to
  // ~8s and keep whichever fix has the smallest `accuracy` (meters of
  // uncertainty), and stop early once we get a genuinely GPS-grade fix.
  function detectLocation() {
    if (!navigator.geolocation) {
      setGeoStatus("unsupported");
      return;
    }
    setGeoStatus("locating");
    setPlace(null);
    setAccuracy(null);

    let bestFix = null;
    let watchId = null;
    let settled = false;
    let timeoutId = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (bestFix) {
        setCoords({ latitude: bestFix.latitude, longitude: bestFix.longitude });
        setAccuracy(bestFix.accuracy);
        setGeoStatus("ok");
        reverseGeocode(bestFix.latitude, bestFix.longitude);
      } else {
        setGeoStatus("denied");
      }
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy: acc } = pos.coords;
        if (!bestFix || acc < bestFix.accuracy) {
          bestFix = { latitude, longitude, accuracy: acc };
        }
        // GPS-grade fix already — no need to keep waiting.
        if (acc <= 50) finish();
      },
      () => finish(),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );

    // Give the provider a few seconds to refine from an initial coarse
    // (Wi-Fi/IP) fix to a tighter one, then lock in whatever's best so far.
    timeoutId = setTimeout(finish, 8000);
  }

  useEffect(() => {
    load();

    apiClient
      .get("/locations/")
      .then((res) => setLocations(res.data || []))
      .catch(() => setLocations([]));

    if (isFieldStaff) {
      apiClient
        .get("/site-assignments/my")
        .then((res) =>
          setAssignedSites(
            (res.data || []).map((a) => a.locations).filter(Boolean),
          ),
        )
        .catch(() => setAssignedSites([]));
    }

    detectLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute nearest eligible site whenever we have both a GPS fix and the
  // (assigned-site-restricted, if any) location list.
  useEffect(() => {
    if (!coords || eligibleLocations.length === 0) {
      setNearest(null);
      return;
    }
    let best = null;
    for (const loc of eligibleLocations) {
      if (loc.latitude == null || loc.longitude == null) continue;
      const d = distanceMeters(
        coords.latitude,
        coords.longitude,
        loc.latitude,
        loc.longitude,
      );
      if (!best || d < best.distance) best = { location: loc, distance: d };
    }
    if (best) {
      setNearest({
        ...best,
        withinRadius: best.distance <= (best.location.radius ?? Infinity),
      });
    }
  }, [coords, eligibleLocations]);

  // Resolve real place names for wherever the employee actually was when
  // they checked in / out today, straight from the saved lat/lon — this is
  // what drives the "at <place>" label under each timeline entry below,
  // instead of only the nearest-configured-office guess.
  useEffect(() => {
    if (today?.check_in_latitude != null && today?.check_in_longitude != null) {
      reverseGeocodePlace(
        today.check_in_latitude,
        today.check_in_longitude,
      ).then(setCheckInPlace);
    } else {
      setCheckInPlace(null);
    }
  }, [today?.check_in_latitude, today?.check_in_longitude]);

  useEffect(() => {
    if (
      today?.check_out_latitude != null &&
      today?.check_out_longitude != null
    ) {
      reverseGeocodePlace(
        today.check_out_latitude,
        today.check_out_longitude,
      ).then(setCheckOutPlace);
    } else {
      setCheckOutPlace(null);
    }
  }, [today?.check_out_latitude, today?.check_out_longitude]);

  // On-demand GPS fetch, used as a fallback right before check-in/out —
  // separate from detectLocation() (which runs automatically on mount and
  // drives the status banner). If the user clicks Check In/Out before that
  // automatic fix has resolved (slow GPS, or they were fast), `coords` is
  // still null and the request would otherwise go out with no lat/long at
  // all. This grabs a fresh position at the moment of the click instead,
  // so a location is always attached (never hardcoded, always the real
  // detected one — just via a fresh request if we didn't already have it).
  function getFreshCoords() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }

  async function runAction(path, successReload = true) {
    setBusy(true);
    setError(null);
    try {
      // Prefer the already-detected fix; if none has resolved yet, fetch
      // one now rather than sending an empty body. Either way this is the
      // real device location at request time, never a stored/hardcoded
      // value.
      const liveCoords = coords || (await getFreshCoords());
      if (liveCoords && !coords) {
        setCoords(liveCoords);
        setGeoStatus("ok");
        reverseGeocode(liveCoords.latitude, liveCoords.longitude);
      }
      // location_id is only included when we actually matched one — the
      // backend skips the geofence check entirely if location_id is
      // missing, so an unmatched location deliberately does NOT get
      // silently treated as "in range".
      const body = liveCoords
        ? {
            latitude: liveCoords.latitude,
            longitude: liveCoords.longitude,
            ...(nearest ? { location_id: nearest.location.id } : {}),
          }
        : {};
      await apiClient.post(path, body);
      if (successReload) await load();
      // Audit-log entries for this action land on the backend as part of
      // the same request (see app/attendance/services.py), so Recent
      // Activity can be refreshed immediately rather than waiting for the
      // next full page load / poll.
      onActivityChange?.();
    } catch (err) {
      if (err.status === 403 && /no employee profile/i.test(err.message)) {
        setNotLinked(true);
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  const onBreak =
    today?.breaks?.length > 0 &&
    !today.breaks[today.breaks.length - 1].break_end;
  const checkedIn = !!today?.check_in_time;
  const checkedOut = !!today?.check_out_time;

  // Check-in is blocked until location is actually detected AND resolved
  // to a shown place — not just as soon as a raw GPS fix comes in. A GPS
  // fix can land (geoStatus "ok") a moment before the reverse-geocode
  // lookup finishes, and right after login the very first fix sometimes
  // hasn't arrived yet at all — either way, the button stays disabled
  // until the location text is actually on screen, so a check-in never
  // goes out with a location that isn't yet showing to the user.
  const locationReady = geoStatus === "ok" && !placeLoading;
  let checkInButtonLabel = "Check In";
  if (geoStatus === "locating" || (geoStatus === "ok" && placeLoading)) {
    checkInButtonLabel = "Locating…";
  } else if (geoStatus === "denied") {
    checkInButtonLabel = "Enable Location";
  } else if (geoStatus === "unsupported") {
    checkInButtonLabel = "Location Unsupported";
  }

  const checkInOfficeMatch = nearestLocationName(
    today?.check_in_latitude,
    today?.check_in_longitude,
    locations,
    true, // only when actually inside that office's geofence radius
  );
  const checkOutOfficeMatch = nearestLocationName(
    today?.check_out_latitude,
    today?.check_out_longitude,
    locations,
    true,
  );

  // Prefer the company's own configured office name when the check-in/out
  // genuinely happened inside that office's geofence — it's a reliable,
  // human-entered name (e.g. "Rajkamal Building 2"), unlike the reverse-
  // geocoded public address below, which comes from OpenStreetMap and can
  // be missing or contain junk/incorrect tags for a given spot. Only fall
  // back to the reverse-geocoded place when there's no configured office
  // nearby at all (e.g. a field visit away from any office).
  const checkInLocation = checkInOfficeMatch || checkInPlace;
  const checkOutLocation = checkOutOfficeMatch || checkOutPlace;

  if (notLinked) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Clock size={16} />
          This account isn't linked to an employee profile, so attendance
          check-in/out isn't available here.
        </div>
      </div>
    );
  }

  const onBreakForDot = onBreak;

  // ---------- Timeline events, right-hand column ----------
  // Same underlying data as the check-in/out/break state above, just laid
  // out chronologically instead of as three side-by-side stats.
  const timelineEvents = [];
  if (checkedIn) {
    timelineEvents.push({
      key: "check-in",
      label: "Checked In",
      time: formatTime(today?.check_in_time),
      sub: checkInLocation,
      dot: "bg-green-500",
    });
  }
  (today?.breaks || []).forEach((b, i) => {
    timelineEvents.push({
      key: `break-start-${i}`,
      label: "Break Started",
      time: formatTime(b.break_start),
      sub: "Break",
      dot: "bg-blue-500",
    });
    if (b.break_end) {
      timelineEvents.push({
        key: `break-end-${i}`,
        label: "Break Ended",
        time: formatTime(b.break_end),
        sub: null,
        dot: "bg-blue-500",
      });
    }
  });
  if (checkedOut) {
    timelineEvents.push({
      key: "check-out",
      label: "Checked Out",
      time: formatTime(today?.check_out_time),
      sub: checkOutLocation,
      dot: "bg-slate-700",
    });
  } else if (checkedIn) {
    timelineEvents.push({
      key: "in-progress",
      label: "Work In Progress",
      time: "",
      sub: onBreakForDot ? "Currently on break" : "Still working",
      dot: "bg-slate-300",
      pending: true,
    });
  }

  // ---------- Left status circle ----------
  let statusLabel = "Not Checked In";
  let statusTime = null;
  let CircleIcon = Clock;
  let circleRing = "bg-slate-100";
  let circleFill = "bg-slate-300";
  if (checkedOut) {
    statusLabel = "Checked Out";
    statusTime = formatTime(today?.check_out_time);
    CircleIcon = CheckCircle2;
    circleRing = "bg-slate-100";
    circleFill = "bg-slate-700";
  } else if (checkedIn && onBreakForDot) {
    statusLabel = "On Break";
    statusTime = formatTime(today?.check_in_time);
    CircleIcon = Coffee;
    circleRing = "bg-orange-50";
    circleFill = "bg-orange-500";
  } else if (checkedIn) {
    statusLabel = "Checked In";
    statusTime = formatTime(today?.check_in_time);
    CircleIcon = CheckCircle2;
    circleRing = "bg-green-50";
    circleFill = "bg-green-500";
  }

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 ${ultraCompact ? "p-4" : "p-5"}${
        compact ? " lg:min-h-[280px]" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">Today's Attendance</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {now.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
          {checkedIn && !checkedOut && (
            <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
              <CheckCircle2 size={13} /> Checked in
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-16 bg-slate-100 rounded animate-pulse" />
      ) : ultraCompact ? (
        <>
          {/* ---------- Ultra-compact: one horizontal row ----------
              Small status circle + label/time on the left, action
              button(s) on the right — no side-by-side timeline, no
              full-width stacked buttons. Same runAction/state as the
              regular layout below, just laid out to fit a short card. */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`w-11 h-11 rounded-full ${circleRing} flex items-center justify-center shrink-0`}
            >
              <div
                className={`w-7 h-7 rounded-full ${circleFill} flex items-center justify-center`}
              >
                <CircleIcon size={14} className="text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-slate-400">{statusLabel}</div>
              <div className="font-semibold text-slate-800 text-sm truncate">
                {statusTime || "—"}
              </div>
              {/* ---------- Where they checked in/out — same info the
                  full (non-ultraCompact) layout shows in its timeline via
                  ev.sub, just condensed to one line here so it isn't lost
                  in the mobile manager dashboard's tighter card. ---------- */}
              {(checkedIn || checkedOut) && (
                <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate mt-0.5">
                  <MapPin size={10} className="shrink-0" />
                  <span className="truncate">
                    {(checkedOut ? checkOutLocation : checkInLocation) ||
                      "Location unavailable"}
                  </span>
                </div>
              )}
            </div>
            <div className="shrink-0 flex flex-col gap-1.5 w-[112px]">
              {!checkedIn && (
                <button
                  onClick={() => runAction("/attendance/check-in")}
                  disabled={busy || !locationReady}
                  title={
                    locationReady
                      ? undefined
                      : "Waiting for your location to be detected"
                  }
                  className="flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                  <LogIn size={13} />
                  {checkInButtonLabel}
                </button>
              )}

              {checkedIn && !checkedOut && !onBreakForDot && (
                <button
                  onClick={() => runAction("/attendance/break-start")}
                  disabled={busy}
                  className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-medium py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Coffee size={13} /> Break
                </button>
              )}

              {checkedIn && !checkedOut && onBreakForDot && (
                <button
                  onClick={() => runAction("/attendance/break-end")}
                  disabled={busy}
                  className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-medium py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Coffee size={13} /> End Break
                </button>
              )}

              {checkedIn && !checkedOut && (
                <button
                  onClick={() => runAction("/attendance/check-out")}
                  disabled={busy}
                  className="flex items-center justify-center gap-1.5 border border-orange-500 text-orange-600 hover:bg-orange-50 disabled:opacity-50 text-xs font-medium py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                  <LogOut size={13} /> Check Out
                </button>
              )}

              {checkedOut && (
                <button
                  disabled
                  className="flex items-center justify-center gap-1.5 bg-slate-100 text-slate-400 text-xs font-medium py-2 rounded-lg cursor-not-allowed whitespace-nowrap"
                >
                  <LogOut size={13} /> Checked Out
                </button>
              )}
            </div>
          </div>

          {/* ---------- Location status — trimmed to one line. Now also
              shows the resolved place/office once GPS lock succeeds
              (geoStatus === "ok"), matching the full CheckInOutCard
              layout below instead of just going silent on success. ---------- */}
          {!checkedIn && !checkedOut && (
            <div className="mb-3 flex items-center gap-1.5 text-[11px] rounded-lg px-2.5 py-1.5 bg-slate-50">
              {geoStatus === "locating" && (
                <>
                  <MapPin
                    size={11}
                    className="text-slate-400 animate-pulse shrink-0"
                  />
                  <span className="text-slate-500">Getting your location…</span>
                </>
              )}
              {geoStatus === "denied" && (
                <>
                  <AlertTriangle
                    size={11}
                    className="text-orange-500 shrink-0"
                  />
                  <span className="text-orange-600">
                    Location denied — check-in won't be location-verified.
                  </span>
                </>
              )}
              {geoStatus === "unsupported" && (
                <>
                  <AlertTriangle
                    size={11}
                    className="text-orange-500 shrink-0"
                  />
                  <span className="text-orange-600">
                    This browser doesn't support location.
                  </span>
                </>
              )}
              {geoStatus === "ok" && nearest && nearest.withinRadius && (
                <>
                  <MapPin size={11} className="text-blue-500 shrink-0" />
                  <span className="text-blue-600 truncate">
                    Within range of {nearest.location.location_name}
                    {place && (
                      <span className="text-slate-400"> — {place}</span>
                    )}
                  </span>
                </>
              )}
              {geoStatus === "ok" && nearest && !nearest.withinRadius && (
                <>
                  <MapPin size={11} className="text-slate-400 shrink-0" />
                  <span className="text-slate-500 truncate">
                    {place ? `Detected at ${place}` : "Location detected"} (
                    {Math.round(nearest.distance)}m from{" "}
                    {nearest.location.location_name})
                  </span>
                </>
              )}
              {geoStatus === "ok" && !nearest && (
                <>
                  <MapPin size={11} className="text-slate-400 shrink-0" />
                  <span className="text-slate-500 truncate">
                    {place
                      ? `Detected at ${place}`
                      : placeLoading
                        ? "Location acquired — resolving place…"
                        : "Location acquired"}
                  </span>
                </>
              )}
            </div>
          )}

          {error && (
            <div className="text-xs text-orange-500 mb-1">
              {error}
              {error.toLowerCase().includes("expired") && (
                <span className="text-slate-400">
                  {" "}
                  — your session will refresh automatically; if this persists,
                  please log in again.
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {/* ---------- Two-column layout: status circle + action on the
              left, chronological timeline on the right ---------- */}
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,160px)_1fr] gap-5 mb-4">
            {/* ===== Left: status circle + primary action ===== */}
            <div className="flex flex-col items-center text-center sm:border-r sm:border-slate-100 sm:pr-5">
              <div
                className={`w-20 h-20 rounded-full ${circleRing} flex items-center justify-center mb-2`}
              >
                <div
                  className={`w-12 h-12 rounded-full ${circleFill} flex items-center justify-center`}
                >
                  <CircleIcon size={22} className="text-white" />
                </div>
              </div>
              <div className="text-xs text-slate-400">{statusLabel}</div>
              {statusTime && (
                <div className="font-semibold text-slate-800 text-base mb-3">
                  {statusTime}
                </div>
              )}
              {!statusTime && <div className="mb-3" />}

              <div className="flex flex-col gap-2 w-full max-w-[160px]">
                {!checkedIn && (
                  <button
                    onClick={() => runAction("/attendance/check-in")}
                    disabled={busy || !locationReady}
                    title={
                      locationReady
                        ? undefined
                        : "Waiting for your location to be detected"
                    }
                    className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                  >
                    <LogIn size={15} />
                    {checkInButtonLabel}
                  </button>
                )}

                {checkedIn && !checkedOut && !onBreakForDot && (
                  <button
                    onClick={() => runAction("/attendance/break-start")}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-sm font-medium py-2 rounded-lg transition-colors"
                  >
                    <Coffee size={15} /> Start Break
                  </button>
                )}

                {checkedIn && !checkedOut && onBreakForDot && (
                  <button
                    onClick={() => runAction("/attendance/break-end")}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-sm font-medium py-2 rounded-lg transition-colors"
                  >
                    <Coffee size={15} /> End Break
                  </button>
                )}

                {checkedIn && !checkedOut && (
                  <button
                    onClick={() => runAction("/attendance/check-out")}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 border border-orange-500 text-orange-600 hover:bg-orange-50 disabled:opacity-50 text-sm font-medium py-2 rounded-lg transition-colors"
                  >
                    <LogOut size={15} /> Check Out
                  </button>
                )}

                {checkedOut && (
                  <button
                    disabled
                    className="flex items-center justify-center gap-2 bg-slate-100 text-slate-400 text-sm font-medium py-2 rounded-lg cursor-not-allowed"
                  >
                    <LogOut size={15} /> Checked Out
                  </button>
                )}
              </div>
            </div>

            {/* ===== Right: chronological timeline ===== */}
            <div className="sm:pl-1">
              {timelineEvents.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400 py-6">
                  No activity yet today.
                </div>
              ) : (
                <div>
                  {timelineEvents.map((ev, idx) => (
                    <div key={ev.key} className="relative pl-5 pb-4 last:pb-0">
                      {idx !== timelineEvents.length - 1 && (
                        <span className="absolute left-[4px] top-3 bottom-0 w-px bg-slate-200" />
                      )}
                      <span
                        className={`absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full ${ev.dot}${
                          ev.pending ? " animate-pulse" : ""
                        }`}
                      />
                      <div className="flex items-start justify-between gap-3">
                        <p
                          className={`text-sm font-medium ${
                            ev.pending ? "text-slate-400" : "text-slate-800"
                          }`}
                        >
                          {ev.label}
                        </p>
                        {ev.time && (
                          <span className="text-xs text-slate-400 whitespace-nowrap">
                            {ev.time}
                          </span>
                        )}
                      </div>
                      {ev.sub && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          {!ev.pending && (
                            <MapPin size={10} className="shrink-0" />
                          )}
                          {ev.sub}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ---------- Assigned site banner ---------- */}
          {!ultraCompact &&
            isFieldStaff &&
            !checkedIn &&
            !checkedOut &&
            assignedSites.length > 0 && (
              <div className="mb-3 flex items-center gap-1.5 text-xs bg-orange-50 text-orange-700 rounded-lg px-3 py-2">
                <MapPin size={12} />
                {assignedSites.length === 1 ? (
                  <span>
                    Your manager assigned you to{" "}
                    <strong>{assignedSites[0].location_name}</strong> for site
                    visits today.
                  </span>
                ) : (
                  <span>
                    You're assigned to {assignedSites.length} sites for site
                    visits today:{" "}
                    {assignedSites.map((s) => s.location_name).join(", ")}.
                  </span>
                )}
              </div>
            )}
          {/* ---------- Location status — the anti-fake-checkin signal ---------- */}
          {!ultraCompact && !checkedIn && !checkedOut && (
            <div className="mb-3 text-xs rounded-lg px-3 py-2.5 bg-slate-50">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-start gap-2 min-w-0">
                  {geoStatus === "locating" && (
                    <>
                      <MapPin
                        size={13}
                        className="text-slate-400 animate-pulse shrink-0 mt-0.5"
                      />
                      <span className="text-slate-500">
                        Getting your location…
                      </span>
                    </>
                  )}
                  {geoStatus === "denied" && (
                    <>
                      <AlertTriangle
                        size={13}
                        className="text-orange-500 shrink-0 mt-0.5"
                      />
                      <span className="text-orange-600">
                        Location access denied — check-in won't be
                        location-verified.
                      </span>
                    </>
                  )}
                  {geoStatus === "unsupported" && (
                    <>
                      <AlertTriangle
                        size={13}
                        className="text-orange-500 shrink-0 mt-0.5"
                      />
                      <span className="text-orange-600">
                        This browser doesn't support location.
                      </span>
                    </>
                  )}
                  {geoStatus === "ok" && nearest && nearest.withinRadius && (
                    <>
                      <MapPin
                        size={13}
                        className="text-blue-500 shrink-0 mt-0.5"
                      />
                      <span className="text-blue-600">
                        Within range of {nearest.location.location_name} (
                        {Math.round(nearest.distance)}m)
                        {place && (
                          <span className="text-slate-400"> — {place}</span>
                        )}
                      </span>
                    </>
                  )}
                  {geoStatus === "ok" && nearest && !nearest.withinRadius && (
                    <>
                      <MapPin
                        size={13}
                        className="text-slate-400 shrink-0 mt-0.5"
                      />
                      <span className="text-slate-500">
                        {place ? `Detected at ${place}` : "Location detected"} (
                        {Math.round(nearest.distance)}m from{" "}
                        {nearest.location.location_name}) — check-in is allowed
                        from any location.
                      </span>
                    </>
                  )}
                  {geoStatus === "ok" && !nearest && (
                    <>
                      <MapPin
                        size={13}
                        className="text-slate-400 shrink-0 mt-0.5"
                      />
                      <span className="text-slate-500">
                        {place
                          ? `Detected at ${place} — no office locations configured yet.`
                          : placeLoading
                            ? "Location acquired — resolving place…"
                            : "Location acquired — no office locations configured yet."}
                      </span>
                    </>
                  )}
                </div>

                {/* Manual trigger — click to (re)detect instead of relying
                    only on the automatic check on page load. */}
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={geoStatus === "locating"}
                  className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 px-2 py-1 rounded-md"
                >
                  <MapPin size={11} />
                  {geoStatus === "locating" ? "Detecting…" : "Detect Location"}
                </button>
              </div>

              {/* Accuracy check — a laptop with no GPS chip is often given a
                  coarse Wi-Fi- or IP-based fix instead of a real GPS one,
                  which can be off by hundreds of km (the accuracy value
                  reveals this even when the place name looks plausible).
                  LOW_ACCURACY_THRESHOLD_M is deliberately generous (GPS is
                  normally <50m, Wi-Fi positioning a few hundred m) so this
                  only fires for genuinely unreliable, IP-grade fixes. */}
              {geoStatus === "ok" && accuracy != null && accuracy > 3000 && (
                <div className="mt-1.5 flex items-start gap-2 text-orange-600">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>
                    Low-accuracy location (±{Math.round(accuracy / 1000)}km) —
                    this looks like a network-based estimate, not your real GPS
                    position. Turn on Location Services / Wi-Fi on this device,
                    or check in from a mobile phone for an accurate fix.
                  </span>
                </div>
              )}
            </div>
          )}
          {error && (
            <div className="text-xs text-orange-500 mb-3">
              {error}
              {error.toLowerCase().includes("expired") && (
                <span className="text-slate-400">
                  {" "}
                  — your session will refresh automatically; if this persists,
                  please log in again.
                </span>
              )}
            </div>
          )}
          {/* ---------- Working hours / break hours ---------- */}

          {!compact && checkedOut && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-orange-50 rounded-lg py-2.5 text-center">
                <div className="text-[10px] text-orange-500 font-medium mb-0.5 flex items-center justify-center gap-1">
                  <Clock size={11} /> Working Hours
                </div>
                <div className="font-semibold text-slate-800 text-sm">
                  {formatDuration(today?.working_minutes)}
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg py-2.5 text-center">
                <div className="text-[10px] text-slate-500 font-medium mb-0.5 flex items-center justify-center gap-1">
                  <Coffee size={11} /> Break Hours
                </div>
                <div className="font-semibold text-slate-800 text-sm">
                  {formatDuration(today?.break_minutes)}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
