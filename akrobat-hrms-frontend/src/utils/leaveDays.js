// Day-count text for a leave row.
// MC days are not known when the employee applies -- they come from the end
// date on the medical certificate. The backend sends total_days = null until
// then (and keeps it null for the employee / leave manager until HR validates),
// so this never prints "null Days".
export function leaveDaysText(leave, lowercase = false) {
  const pendingMc = leave?.mc_status && leave.mc_status !== "VALIDATED";
  const days = leave?.total_days;
  if (days === null || days === undefined) {
    return pendingMc ? "Days pending" : "";
  }
  const unit = days === 1 ? "day" : "days";
  const text = `${days} ${lowercase ? unit : unit[0].toUpperCase() + unit.slice(1)}`;
  // HR / Super Admin see the number before validation: mark it provisional.
  return pendingMc ? `${text} (provisional)` : text;
}
