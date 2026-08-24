// HR Admin's "Reports" page. This used to be an empty PlaceholderPage --
// Super Admin had the real, fully-built Reports & Analytics page
// (tabs for Employees / Attendance / Leave Requests / Payroll / Projects,
// stat cards, search+pagination, and Excel export) at
// ../super-admin/Reports.jsx, but HR Admin never got the same page wired
// up.
//
// The underlying endpoints (GET /reports/*, see app/reports/routes.py)
// only require an authenticated user -- no role check -- so there's
// nothing super-admin-specific about the data itself, and the component
// has no hardcoded role/permission logic either. Reusing it directly
// here (rather than forking a second copy) means both roles stay in
// sync automatically if the report page is improved later.
import Reports from "../super-admin/Reports.jsx";

export default function ReportsHr() {
  return <Reports />;
}
