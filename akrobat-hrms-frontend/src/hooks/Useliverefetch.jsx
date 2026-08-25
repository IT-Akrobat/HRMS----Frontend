// import { useEffect, useRef } from "react";
// import { onApiMutation } from "../services/apiClient";
// import { useRefetchOnResume } from "./Userefetchonresume ";

// // A page that loads a list/record with GET and lets the user act on it
// // (edit, approve/reject, apply leave, delete, assign, ...) should reflect
// // that change immediately, without the person having to hit browser
// // refresh. Most pages already do this by calling their own load()
// // function right after their own mutation resolves -- but that only
// // covers "I changed it right here, on this exact screen". It misses:
// //   - a different page/modal writing to the same underlying data (e.g.
// //     Super Admin approves a leave request while an Employee has their
// //     leave history open in another tab)
// //   - anything that updates data this page reads but isn't the thing the
// //     person just clicked (e.g. an announcement posted from the
// //     dashboard while this page shows a different view of it)
// //
// // This hook closes that gap generically: it calls `loadFn` once on
// // mount, then again (debounced, so a burst of several quick writes only
// // triggers one reload) any time ANY POST/PUT/PATCH/DELETE anywhere in
// // the app succeeds (see onApiMutation in services/apiClient.js), plus
// // whenever the tab/PWA becomes visible again after being backgrounded
// // (see useRefetchOnResume). No polling, no guessing which endpoint to
// // watch -- just "something changed, get fresh data".
// //
// // Usage (replaces a plain `useEffect(() => { load(); }, [])`):
// //   useLiveRefetch(load);
// //
// // If `load` depends on values that change (filters, page number, an id
// // from the route, etc.), pass them the same way you would to useEffect
// // so the mount-time call and the resume listener always use the latest
// // loader:
// //   useLiveRefetch(() => loadEmployees(hrAdminRoleId), [hrAdminRoleId]);
// const DEBOUNCE_MS = 400;

// export function useLiveRefetch(loadFn, deps = []) {
//   const loadRef = useRef(loadFn);
//   loadRef.current = loadFn;

//   useEffect(() => {
//     loadRef.current();

//     let debounceTimer;
//     const unsubscribe = onApiMutation(() => {
//       clearTimeout(debounceTimer);
//       debounceTimer = setTimeout(() => loadRef.current(), DEBOUNCE_MS);
//     });

//     return () => {
//       clearTimeout(debounceTimer);
//       unsubscribe();
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, deps);

//   useRefetchOnResume(() => loadRef.current());
// }
