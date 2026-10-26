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

// Saturday Swap is only offered to Chennai staff. `work_location` is free
// text on the employee profile (e.g. "Chennai Office"), so match "chennai"
// anywhere in it, case-insensitive -- same rule UserformModal uses.
export function isChennaiEmployee(user) {
  return /chennai/i.test(String(user?.profile?.work_location || ""));
}
