// Working Location helpers (employees.working_location -- see sql/035.sql).
//
// Employees whose Working Location is exactly "Site" must NOT see their
// own working hours / break time / total working hours anywhere in the
// UI. "Office" and "Office and Site" employees see everything as before.
//
// `user` is the object from useAuth(); the value comes from GET /auth/me
// (user.profile.working_location).
export function isSiteEmployee(user) {
  return (
    String(user?.profile?.working_location || "")
      .trim()
      .toLowerCase() === "site"
  );
}
