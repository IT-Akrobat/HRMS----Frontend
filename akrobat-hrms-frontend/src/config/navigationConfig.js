// import {
//   BarChart3,
//   Bell,
//   Building2,
//   Clock,
//   FileText,
//   LayoutDashboard,
//   Palmtree,
//   Settings,
//   ShieldCheck,
//   User,
//   Users,
// } from "lucide-react";
// import { ROLES } from "./roles";

// /**
//  * Each item:
//  *  - label: display text
//  *  - icon: lucide-react component
//  *  - path: route (for leaf items) OR omitted if it only has children
//  *  - children: sub-items (optional)
//  *
//  * Sidebar.jsx renders this recursively, so adding a role or menu item
//  * only ever means editing this file.
//  */
// export const NAVIGATION_CONFIG = {
//   [ROLES.EMPLOYEE]: [
//     { label: "Dashboard", icon: LayoutDashboard, path: "/employee/dashboard" },

//     {
//       label: "My Profile",
//       icon: User,
//       children: [
//         {
//           label: "Personal Details",
//           path: "/employee/profile/personal",
//         },
//         {
//           label: "Sites Worked",
//           path: "/employee/profile/sites",
//         },
//       ],
//     },
//     {
//       label: "Attendance",
//       icon: Clock,
//       children: [
//         { label: "My Attendance", path: "/employee/attendance" },
//         { label: "Attendance History", path: "/employee/attendance/history" },
//       ],
//     },
//     {
//       label: "Leave",
//       icon: Palmtree,
//       children: [
//         { label: "Apply Leave", path: "/employee/leave/apply" },
//         { label: "Leave History", path: "/employee/leave/history" },
//         // { label: 'Leave Balance', path: '/employee/leave/balance' },
//       ],
//     },
//     // {
//     //   label: "My Documents",
//     //   icon: FileText,
//     //   children: [
//     //     { label: "Documents", path: "/employee/documents" },
//     //     { label: "Download Documents", path: "/employee/documents/download" },
//     //   ],
//     // },
//     // {
//     //   label: "Payroll",
//     //   icon: Wallet,
//     //   children: [
//     //     { label: "Payslips", path: "/employee/payroll/payslips" },
//     //     { label: "Salary Details", path: "/employee/payroll/salary-details" },
//     //   ],
//     // },
//     // {
//     //   label: "My Projects",
//     //   icon: FolderKanban,
//     //   children: [
//     //     { label: "Assigned Projects", path: "/employee/projects" },
//     //     { label: "Tasks", path: "/employee/projects/tasks" },
//     //   ],
//     // },
//     { label: "Notifications", icon: Bell, path: "/employee/notifications" },
//     { label: "Settings", icon: Settings, path: "/employee/settings" },
//   ],

//   [ROLES.MANAGER]: [
//     { label: "Dashboard", icon: LayoutDashboard, path: "/manager/dashboard" },
//     {
//       label: "My Team",
//       icon: Users,
//       children: [
//         { label: "Team Members", path: "/manager/team/members" },
//         { label: "Employee Details", path: "/manager/team/employee-details" },
//         { label: "Site Locations", path: "/manager/team/locations" },
//       ],
//     },
//     {
//       label: "Attendance",
//       icon: Clock,
//       children: [
//         { label: "Team Attendance", path: "/manager/attendance" },
//         { label: "Attendance Reports", path: "/manager/attendance/reports" },
//       ],
//     },
//     {
//       label: "Leave Management",
//       icon: Palmtree,
//       children: [
//         { label: "Apply Leave", path: "/manager/leave/apply" },
//         { label: "Team Leave Requests", path: "/manager/leave/pending" },
//         { label: "Leave History", path: "/manager/leave/history" },
//       ],
//     },
//     // {
//     //   label: "Projects",
//     //   icon: FolderKanban,
//     //   children: [
//     //     { label: "Team Projects", path: "/manager/projects" },
//     //     { label: "Assign Tasks", path: "/manager/projects/assign-tasks" },
//     //     { label: "Project Progress", path: "/manager/projects/progress" },
//     //   ],
//     // },
//     // {
//     //   label: "Reports",
//     //   icon: BarChart3,
//     //   children: [
//     //     { label: "Team Performance", path: "/manager/reports/performance" },
//     //     { label: "Attendance Reports", path: "/manager/reports/attendance" },
//     //   ],
//     // },
//     { label: "Notifications", icon: Bell, path: "/manager/notifications" },
//     { label: "Settings", icon: Settings, path: "/manager/settings" },
//   ],

//   [ROLES.HR_ADMIN]: [
//     { label: "Dashboard", icon: LayoutDashboard, path: "/hr-admin/dashboard" },
//     {
//       label: "Employees",
//       icon: Users,
//       children: [
//         { label: "Employee List", path: "/hr-admin/employees" },
//         // { label: "Add Employee", path: "/hr-admin/employees/add" },
//         // { label: "Employee Profile", path: "/hr-admin/employees/profile" },
//       ],
//     },
//     {
//       label: "Attendance",
//       icon: Clock,
//       children: [
//         { label: "Attendance Overview", path: "/hr-admin/attendance" },
//         // { label: "Shift Management", path: "/hr-admin/attendance/shifts" },
//         { label: "Attendance Reports", path: "/hr-admin/attendance/reports" },
//       ],
//     },
//     {
//       label: "Leave Management",
//       icon: Palmtree,
//       children: [
//         { label: "Apply Leave", path: "/hr-admin/leave/apply" },
//         { label: "Leave Requests (View)", path: "/hr-admin/leave/requests" },
//         // { label: "Leave Policies", path: "/hr-admin/leave/policies" },
//         { label: "Leave Balance", path: "/hr-admin/leave/balance" },
//       ],
//     },
//     // {
//     //   label: "Payroll",
//     //   icon: Wallet,
//     //   children: [
//     //     {
//     //       label: "Salary Structure",
//     //       path: "/hr-admin/payroll/salary-structure",
//     //     },
//     //     {
//     //       label: "Generate Payslip",
//     //       path: "/hr-admin/payroll/generate-payslip",
//     //     },
//     //     { label: "Payroll Reports", path: "/hr-admin/payroll/reports" },
//     //   ],
//     // },
//     {
//       label: "Documents",
//       icon: FileText,
//       path: "/hr-admin/documents",
//     },
//     {
//       label: "Live Site Tracking",
//       icon: Clock,
//       path: "/hr-admin/attendance/live-tracking",
//     },
//     {
//       label: "Audit Logs",
//       icon: ShieldCheck,
//       path: "/hr-admin/security/audit-logs",
//     },
//     {
//       label: "Reports",
//       icon: BarChart3,
//       path: "/hr-admin/reports/hr",
//     },
//     // "Employee Analytics" isn't a separate built page yet (see
//     // pages/hr-admin/ReportsAnalytics.jsx, still a PlaceholderPage) --
//     // Super Admin doesn't have one either, just the single "Reports" link
//     // above, so this stays a single link the same way rather than a
//     // submenu with one dead child.
//     { label: "Notifications", icon: Bell, path: "/hr-admin/notifications" },
//     { label: "Settings", icon: Settings, path: "/hr-admin/settings" },
//   ],

//   [ROLES.SUPER_ADMIN]: [
//     {
//       label: "Dashboard",
//       icon: LayoutDashboard,
//       path: "/super-admin/dashboard",
//     },
//     {
//       label: "User Management",
//       icon: Users,
//       children: [
//         { label: "Users", path: "/super-admin/users" },
//         // { label: "Roles", path: "/super-admin/users/roles" },
//         { label: "Permissions", path: "/super-admin/users/permissions" },
//       ],
//     },
//     {
//       label: "Departments",
//       icon: Building2,
//       path: "/super-admin/organization/departments",
//     },
//     // {
//     //   label: "Organization Setup",
//     //   icon: Building2,
//     //   children: [
//     //     {
//     //       label: "Company Profile",
//     //       path: "/super-admin/organization/company-profile",
//     //     },
//     //     { label: "Locations", path: "/super-admin/organization/locations" },
//     //   ],
//     // },
//     // {
//     //   label: "Employee Management",
//     //   icon: User,
//     //   children: [
//     //     { label: "Employees", path: "/super-admin/employees" },
//     //     // { label: "HR Admins", path: "/super-admin/employees/hr-admins" },
//     //     // { label: "Managers", path: "/super-admin/employees/managers" },
//     //   ],
//     // },
//     {
//       label: "Leave Management",
//       icon: Palmtree,
//       children: [
//         { label: "Leave Requests", path: "/super-admin/leave/requests" },
//       ],
//     },
//     {
//       label: "Live Site Tracking",
//       icon: Clock,
//       path: "/super-admin/attendance/live-tracking",
//     },
//     {
//       label: "Security",
//       icon: ShieldCheck,
//       children: [
//         {
//           label: "Login Activity",
//           path: "/super-admin/security/login-activity",
//         },
//         { label: "Audit Logs", path: "/super-admin/security/audit-logs" },
//         {
//           label: "Access Control",
//           path: "/super-admin/security/access-control",
//         },
//       ],
//     },
//     // {
//     //   label: "System Settings",
//     //   icon: KeyRound,
//     //   children: [
//     //     {
//     //       label: "Configurations",
//     //       path: "/super-admin/system-settings/configurations",
//     //     },
//     //     {
//     //       label: "Integrations",
//     //       path: "/super-admin/system-settings/integrations",
//     //     },
//     //   ],
//     // },
//     { label: "Reports", icon: BarChart3, path: "/super-admin/reports" },
//     { label: "Notifications", icon: Bell, path: "/super-admin/notifications" },
//     { label: "Settings", icon: Settings, path: "/super-admin/settings" },
//   ],
// };
import {
  BarChart3,
  Bell,
  Building2,
  Clock,
  FileText,
  LayoutDashboard,
  Palmtree,
  Settings,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { ROLES } from "./roles";

/**
 * Each item:
 *  - label: display text
 *  - icon: lucide-react component
 *  - path: route (for leaf items) OR omitted if it only has children
 *  - children: sub-items (optional)
 *
 * Sidebar.jsx renders this recursively, so adding a role or menu item
 * only ever means editing this file.
 */
export const NAVIGATION_CONFIG = {
  [ROLES.EMPLOYEE]: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/employee/dashboard" },

    {
      label: "My Profile",
      icon: User,
      children: [
        {
          label: "Personal Details",
          path: "/employee/profile/personal",
        },
        {
          label: "Sites Worked",
          path: "/employee/profile/sites",
          // Only Inspection / Operation staff visit sites -- Sidebar.jsx
          // hides this item for everyone else (see isFieldEmployee).
          fieldOnly: true,
        },
      ],
    },
    {
      label: "Attendance",
      icon: Clock,
      // Employees whose Working Location is "Site" don't get this tab --
      // Sidebar.jsx hides it (see isSiteEmployee).
      hideForSite: true,
      children: [
        { label: "My Attendance", path: "/employee/attendance" },
        { label: "Attendance History", path: "/employee/attendance/history" },
      ],
    },
    {
      label: "Leave",
      icon: Palmtree,
      children: [
        { label: "Apply Leave", path: "/employee/leave/apply" },
        { label: "Leave History", path: "/employee/leave/history" },
        // { label: 'Leave Balance', path: '/employee/leave/balance' },
      ],
    },
    {
      label: "Team",
      icon: Users,
      children: [
        { label: "All Employees", path: "/employee/people/all" },
        { label: "My Department", path: "/employee/people/department" },
      ],
    },
    // {
    //   label: "My Documents",
    //   icon: FileText,
    //   children: [
    //     { label: "Documents", path: "/employee/documents" },
    //     { label: "Download Documents", path: "/employee/documents/download" },
    //   ],
    // },
    // {
    //   label: "Payroll",
    //   icon: Wallet,
    //   children: [
    //     { label: "Payslips", path: "/employee/payroll/payslips" },
    //     { label: "Salary Details", path: "/employee/payroll/salary-details" },
    //   ],
    // },
    // {
    //   label: "My Projects",
    //   icon: FolderKanban,
    //   children: [
    //     { label: "Assigned Projects", path: "/employee/projects" },
    //     { label: "Tasks", path: "/employee/projects/tasks" },
    //   ],
    // },
    { label: "Notifications", icon: Bell, path: "/employee/notifications" },
    { label: "Settings", icon: Settings, path: "/employee/settings" },
  ],

  [ROLES.MANAGER]: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/manager/dashboard" },
    {
      label: "My Team",
      icon: Users,
      children: [
        { label: "Team Members", path: "/manager/team/members" },
        { label: "Employee Details", path: "/manager/team/employee-details" },
        { label: "Site Locations", path: "/manager/team/locations" },
      ],
    },
    {
      label: "Attendance",
      icon: Clock,
      children: [
        { label: "Team Attendance", path: "/manager/attendance" },
        { label: "Attendance Reports", path: "/manager/attendance/reports" },
      ],
    },
    {
      label: "Leave Management",
      icon: Palmtree,
      children: [
        { label: "Team Leave Requests", path: "/manager/leave/pending" },
        { label: "Leave History", path: "/manager/leave/history" },
      ],
    },
    // {
    //   label: "Projects",
    //   icon: FolderKanban,
    //   children: [
    //     { label: "Team Projects", path: "/manager/projects" },
    //     { label: "Assign Tasks", path: "/manager/projects/assign-tasks" },
    //     { label: "Project Progress", path: "/manager/projects/progress" },
    //   ],
    // },
    // {
    //   label: "Reports",
    //   icon: BarChart3,
    //   children: [
    //     { label: "Team Performance", path: "/manager/reports/performance" },
    //     { label: "Attendance Reports", path: "/manager/reports/attendance" },
    //   ],
    // },
    { label: "Notifications", icon: Bell, path: "/manager/notifications" },
    { label: "Settings", icon: Settings, path: "/manager/settings" },
  ],

  [ROLES.HR_ADMIN]: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/hr-admin/dashboard" },
    // { label: "Company", icon: Building2, path: "/hr-admin/company" },
    {
      label: "Employees",
      icon: Users,
      children: [
        { label: "Employee List", path: "/hr-admin/employees" },
        // { label: "Add Employee", path: "/hr-admin/employees/add" },
        // { label: "Employee Profile", path: "/hr-admin/employees/profile" },
      ],
    },
    {
      label: "Attendance",
      icon: Clock,
      children: [
        { label: "Attendance Overview", path: "/hr-admin/attendance" },
        // { label: "Shift Management", path: "/hr-admin/attendance/shifts" },
        { label: "Attendance Reports", path: "/hr-admin/attendance/reports" },
        { label: "OT Calculator", path: "/hr-admin/attendance/ot-calculator" },
      ],
    },
    {
      label: "Leave Management",
      icon: Palmtree,
      children: [
        { label: "Leave Requests (View)", path: "/hr-admin/leave/requests" },
        // { label: "Leave Policies", path: "/hr-admin/leave/policies" },
        { label: "Leave Balance", path: "/hr-admin/leave/balance" },
      ],
    },
    // {
    //   label: "Payroll",
    //   icon: Wallet,
    //   children: [
    //     {
    //       label: "Salary Structure",
    //       path: "/hr-admin/payroll/salary-structure",
    //     },
    //     {
    //       label: "Generate Payslip",
    //       path: "/hr-admin/payroll/generate-payslip",
    //     },
    //     { label: "Payroll Reports", path: "/hr-admin/payroll/reports" },
    //   ],
    // },
    {
      label: "Documents",
      icon: FileText,
      path: "/hr-admin/documents",
    },
    {
      label: "Live Site Tracking",
      icon: Clock,
      path: "/hr-admin/attendance/live-tracking",
    },
    {
      label: "Audit Logs",
      icon: ShieldCheck,
      path: "/hr-admin/security/audit-logs",
    },
    {
      label: "Reports",
      icon: BarChart3,
      path: "/hr-admin/reports/hr",
    },
    // "Employee Analytics" isn't a separate built page yet (see
    // pages/hr-admin/ReportsAnalytics.jsx, still a PlaceholderPage) --
    // Super Admin doesn't have one either, just the single "Reports" link
    // above, so this stays a single link the same way rather than a
    // submenu with one dead child.
    { label: "Notifications", icon: Bell, path: "/hr-admin/notifications" },
    { label: "Settings", icon: Settings, path: "/hr-admin/settings" },
  ],

  [ROLES.SUPER_ADMIN]: [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      path: "/super-admin/dashboard",
    },
    {
      label: "User Management",
      icon: Users,
      children: [
        { label: "Users", path: "/super-admin/users" },
        // { label: "Roles", path: "/super-admin/users/roles" },
        { label: "Permissions", path: "/super-admin/users/permissions" },
      ],
    },
    {
      label: "Departments",
      icon: Building2,
      path: "/super-admin/organization/departments",
    },
    // {
    //   label: "Organization Setup",
    //   icon: Building2,
    //   children: [
    //     {
    //       label: "Company Profile",
    //       path: "/super-admin/organization/company-profile",
    //     },
    //     { label: "Locations", path: "/super-admin/organization/locations" },
    //   ],
    // },
    // {
    //   label: "Employee Management",
    //   icon: User,
    //   children: [
    //     { label: "Employees", path: "/super-admin/employees" },
    //     // { label: "HR Admins", path: "/super-admin/employees/hr-admins" },
    //     // { label: "Managers", path: "/super-admin/employees/managers" },
    //   ],
    // },
    {
      label: "Leave Management",
      icon: Palmtree,
      children: [
        { label: "Leave Requests", path: "/super-admin/leave/requests" },
        { label: "Leave Balance", path: "/super-admin/leave/balance" },
      ],
    },
    {
      label: "Live Site Tracking",
      icon: Clock,
      path: "/super-admin/attendance/live-tracking",
    },
    {
      label: "OT Calculator",
      icon: Clock,
      path: "/super-admin/attendance/ot-calculator",
    },
    {
      label: "Security",
      icon: ShieldCheck,
      children: [
        {
          label: "Login Activity",
          path: "/super-admin/security/login-activity",
        },
        { label: "Audit Logs", path: "/super-admin/security/audit-logs" },
        {
          label: "Access Control",
          path: "/super-admin/security/access-control",
        },
      ],
    },
    // {
    //   label: "System Settings",
    //   icon: KeyRound,
    //   children: [
    //     {
    //       label: "Configurations",
    //       path: "/super-admin/system-settings/configurations",
    //     },
    //     {
    //       label: "Integrations",
    //       path: "/super-admin/system-settings/integrations",
    //     },
    //   ],
    // },
    { label: "Reports", icon: BarChart3, path: "/super-admin/reports" },
    { label: "Notifications", icon: Bell, path: "/super-admin/notifications" },
    { label: "Settings", icon: Settings, path: "/super-admin/settings" },
  ],
};

/**
 * HR "My Space" sidebar -- the same menu a normal employee sees, but every
 * path lives under /hr-admin/me. Sidebar.jsx swaps to this whenever HR is
 * inside My Space (see isHrSelfPath in roles.js); the Company sidebar is
 * NAVIGATION_CONFIG[ROLES.HR_ADMIN] above.
 */
export const HR_SELF_NAVIGATION = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/hr-admin/me/dashboard" },
  {
    label: "My Profile",
    icon: User,
    children: [
      { label: "Personal Details", path: "/hr-admin/me/profile/personal" },
      {
        label: "Sites Worked",
        path: "/hr-admin/me/profile/sites",
        fieldOnly: true,
      },
    ],
  },
  {
    label: "Attendance",
    icon: Clock,
    hideForSite: true,
    children: [
      { label: "My Attendance", path: "/hr-admin/me/attendance" },
      { label: "Attendance History", path: "/hr-admin/me/attendance/history" },
    ],
  },
  {
    label: "Leave",
    icon: Palmtree,
    children: [
      { label: "Apply Leave", path: "/hr-admin/me/leave/apply" },
      { label: "Leave History", path: "/hr-admin/me/leave/history" },
    ],
  },
  {
    label: "Team",
    icon: Users,
    children: [
      { label: "All Employees", path: "/hr-admin/me/people/all" },
      { label: "My Department", path: "/hr-admin/me/people/department" },
    ],
  },
  { label: "Notifications", icon: Bell, path: "/hr-admin/me/notifications" },
  { label: "Settings", icon: Settings, path: "/hr-admin/me/settings" },
];

/**
 * Builds the employee-style "My Space" menu for any base path. HR uses
 * /hr-admin/me (HR_SELF_NAVIGATION above); managers use /manager/me.
 */
function buildSelfNavigation(base) {
  return [
    { label: "Dashboard", icon: LayoutDashboard, path: `${base}/dashboard` },
    {
      label: "My Profile",
      icon: User,
      children: [
        { label: "Personal Details", path: `${base}/profile/personal` },
        {
          label: "Sites Worked",
          path: `${base}/profile/sites`,
          fieldOnly: true,
        },
      ],
    },
    {
      label: "Attendance",
      icon: Clock,
      hideForSite: true,
      children: [
        { label: "My Attendance", path: `${base}/attendance` },
        { label: "Attendance History", path: `${base}/attendance/history` },
      ],
    },
    {
      label: "Leave",
      icon: Palmtree,
      children: [
        { label: "Apply Leave", path: `${base}/leave/apply` },
        { label: "Leave History", path: `${base}/leave/history` },
      ],
    },
    {
      label: "Team",
      icon: Users,
      children: [
        { label: "All Employees", path: `${base}/people/all` },
        { label: "My Department", path: `${base}/people/department` },
      ],
    },
    { label: "Notifications", icon: Bell, path: `${base}/notifications` },
    { label: "Settings", icon: Settings, path: `${base}/settings` },
  ];
}

/** Manager "My Space" sidebar (see isSelfSpacePath in roles.js). */
export const MANAGER_SELF_NAVIGATION = buildSelfNavigation("/manager/me");

/** My Space menu per role, used by Sidebar.jsx. */
export const SELF_NAVIGATION_BY_ROLE = {
  [ROLES.HR_ADMIN]: HR_SELF_NAVIGATION,
  [ROLES.MANAGER]: MANAGER_SELF_NAVIGATION,
};
