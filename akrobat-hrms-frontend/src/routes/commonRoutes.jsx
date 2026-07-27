// // Routes that are the same for every role, defined once here and mounted
// // under each role's path in App.jsx — the same way config/navigationConfig.js
// // is one shared file that Sidebar.jsx reads per-role, instead of copying
// // sidebar entries into every role's file.
// //
// // Add a page here: create the component in ../pages/shared/, import it,
// // add a { path, element } entry — it will automatically be available
// // under /employee, /manager, /hr-admin AND /super-admin.
// import MyProfile from "../pages/shared/MyProfile.jsx";

// export const commonRoutes = [
//   { path: "profile/my-profile", element: <MyProfile /> },
// ];
// Routes that are the same for every role, defined once here and mounted
// under each role's path in App.jsx — the same way config/navigationConfig.js
// is one shared file that Sidebar.jsx reads per-role, instead of copying
// sidebar entries into every role's file.
//
// Add a page here: create the component in ../pages/shared/, import it,
// add a { path, element } entry — it will automatically be available
// under /employee, /manager, /hr-admin AND /super-admin.
import MyProfile from "../pages/shared/MyProfile.jsx";
import Notifications from "../pages/shared/Notifications.jsx";
import Settings from "../pages/shared/Settings.jsx";
// Settings and Notifications used to be duplicated per role (Employee had
// a real implementation of each; Manager/HR Admin/Super Admin mostly had
// empty PlaceholderPage stand-ins). Neither page is actually role-specific
// — account settings and the notification inbox work the same way for any
// logged-in user — so they're defined once here, same as My Profile, and
// mounted under every role automatically.
export const commonRoutes = [
  { path: "profile/personal", element: <MyProfile /> },
  { path: "profile/my-profile", element: <MyProfile /> },
  { path: "settings", element: <Settings /> },
  { path: "notifications", element: <Notifications /> },
];
