# Akrobat HRMS — Frontend Architecture

Role-based React frontend scaffold for the Akrobat HRMS. Login determines the
role, and the role determines everything else — sidebar menu, available
routes, and default landing page. Every screen right now is a placeholder
card; wire in your Figma/design output page by page without touching routing
or auth.

## Stack
- React 18 + Vite
- React Router v6 (nested, role-guarded routes)
- Tailwind CSS
- lucide-react (icons)

## Quick start
```bash
npm install
npm run dev
```

Demo logins (see `src/services/authService.js`), password is `password` for all:
| Role        | Email                  |
|-------------|-------------------------|
| Employee    | employee@akrobat.sg    |
| Manager     | manager@akrobat.sg     |
| HR Admin    | hradmin@akrobat.sg     |
| Super Admin | superadmin@akrobat.sg  |

## How role-based rendering works

```
Login  →  AuthContext stores { user, role }  →  App.jsx routes
                                                     │
                                     ┌───────────────┼────────────────┬───────────────┐
                                 /employee        /manager         /hr-admin      /super-admin
                                     │                │                │               │
                              ProtectedRoute    ProtectedRoute   ProtectedRoute   ProtectedRoute
                              (allowedRoles)    (allowedRoles)   (allowedRoles)   (allowedRoles)
                                     │
                              DashboardLayout  →  Sidebar reads NAVIGATION_CONFIG[role]
                                     │
                                  <Outlet/>     →  renders the matched page component
```

1. **`src/config/roles.js`** — the 4 roles, their default landing route, and display labels.
   Add a 5th role here first.

2. **`src/config/navigationConfig.js`** — single source of truth for each role's sidebar.
   `Sidebar.jsx` renders this recursively (supports flat items and grouped items with children).
   Add/remove a menu entry only here — the sidebar updates automatically.

3. **`src/context/AuthContext.jsx`** — holds the logged-in `user` and `role`, exposes
   `login()`/`logout()`, rehydrates the session from `sessionStorage` on refresh.

4. **`src/services/authService.js`** — currently a mock login against an in-file user
   list. Replace the body of `login()` with your real `POST /auth/login` call; keep the
   same return shape (`{ token, user: { role, ... } }`) and nothing else needs to change.

5. **`src/components/common/ProtectedRoute.jsx`** — route guard. Wrap a route branch with
   `allowedRoles={[ROLES.X]}` to restrict it; an authenticated user with the wrong role is
   redirected to their own dashboard rather than to login.

6. **`src/routes/*.jsx`** (`employeeRoutes.jsx`, `managerRoutes.jsx`, `hrAdminRoutes.jsx`,
   `superAdminRoutes.jsx`) — one array of `{ path, element }` per role, imported into
   `App.jsx` as nested routes under that role's `DashboardLayout`.

7. **`src/pages/<role>/...`** — one file per screen, matching the sidebar 1:1. Every file
   currently just renders `<PlaceholderPage title="..." />` — replace the body with your
   real design. Nothing else in the app needs to change when you do.

## Adding a brand-new page
1. Create the component in `src/pages/<role>/YourPage.jsx`.
2. Import it and add `{ path: "your-path", element: <YourPage /> }` to
   `src/routes/<role>Routes.jsx`.
3. Add the matching entry (with icon) to `src/config/navigationConfig.js` so it shows in
   the sidebar.

## Folder structure
```
src/
├── assets/                # images, illustrations
├── components/
│   ├── common/             # ProtectedRoute, PageHeader, PlaceholderPage
│   └── layout/              # Sidebar, Header, DashboardLayout
├── config/
│   ├── roles.js             # role constants, default routes, labels
│   └── navigationConfig.js  # sidebar menu per role
├── context/
│   └── AuthContext.jsx      # current user/role + login/logout
├── pages/
│   ├── auth/Login.jsx
│   ├── employee/            # 16 screens
│   ├── manager/              # 14 screens
│   ├── hr-admin/             # 22 screens
│   └── super-admin/          # 17 screens
├── routes/                  # per-role route arrays
├── services/
│   └── authService.js       # login/logout, swap in real API here
├── styles/index.css
├── App.jsx                  # route tree
└── main.jsx                 # entry point
```

## Next steps
- Swap `authService.js` for real API calls (JWT, refresh tokens, etc.).
- Replace each `PlaceholderPage` body with the actual designed screen.
- If field-level permissions are needed within a role (e.g. some HR Admins can't
  see Payroll), extend `user` with a `permissions[]` array and check it inside
  `navigationConfig.js` / `ProtectedRoute`.
