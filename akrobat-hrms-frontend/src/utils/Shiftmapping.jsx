// ---------------------------------------------------------------------
// Working schedule rules per the company's finalized department /
// designation / timing table:
//
//   QS, DESIGN, HR, ACCOUNT, PURCHASING & LOGISTICS, SALES
//     -> Office — HR picks EITHER of two timings per staff member:
//        8:30 AM - 5:30 PM  OR  9:00 AM - 6:00 PM (Mon-Fri)
//   INSPECTION (Inspection Planner, QS Head of Inspection,
//   Construction Worker, Construction Worker-Cum-Driver)
//     -> Inspection Site (9:00 AM - 6:00 PM Mon-Fri, Sat 9:00-1:00) — fixed
//   OPERATION (Project Manager, Driver, Construction Worker (Operation),
//   Construction Worker-Cum-Driver (Operation))
//     -> Operation Site (8:00 AM - 4:30 PM Mon-Fri, Sat 8:30-3:30) — fixed
//   Construction Worker (Storeman)
//     -> Workshop (6:30 AM - 6:00 PM Mon-Fri, Sat 6:30-5:00) — fixed
//
// Only the Office case is a HR *choice* between two timings — every other
// department/designation combo has exactly one fixed schedule, so the
// dropdown narrows to that single shift and can't be changed to something
// that doesn't apply to that role.
//
// Shifts aren't tagged with a department_id in the schema (only
// designations are, via designations.department_id) — shifts are only
// distinguishable by name (see sql/003_attendance_info_seed.sql /
// sql/014_designation_shifts_and_site_visits.sql). So this maps
// department (+ a Storeman override) to the exact shift_name string(s) the
// backend seeds, and every Add/Edit form (Users.jsx, Employees.jsx,
// EmployeesHrAdmins.jsx, EmployeesAdd.jsx) imports it rather than each
// re-implementing its own version of this rule.
//
// Saturday isn't a separate manual choice here: the attendance backend
// (app/attendance/services._get_employee_shift) already auto-substitutes
// the matching "<area> ... SATURDAY" shift on Saturdays by name, so
// picking the WEEKDAY shift below covers both.
// ---------------------------------------------------------------------

export const OFFICE_SHIFT_NAME = "OFFICE - WEEKDAY (8:30-5:30)";
export const OFFICE_SHIFT_NAME_LATE = "OFFICE - WEEKDAY (9:00-6:00)";
export const OFFICE_SHIFT_NAMES = [OFFICE_SHIFT_NAME, OFFICE_SHIFT_NAME_LATE];
export const INSPECTION_SITE_SHIFT_NAME = "INSPECTION SITE - WEEKDAY";
export const OPERATION_SITE_SHIFT_NAME = "OPERATION SITE - WEEKDAY";
export const WORK_SHOP_SHIFT_NAME = "WORK SHOP - WEEKDAY";

/**
 * Returns the exact shift_name that applies for a given department +
 * designation combo, or null if the department isn't recognized/picked
 * yet, OR if this combo has more than one valid timing (the office case —
 * callers should use resolveShiftNamesForSelection for the full list in
 * that situation instead of a single forced value).
 */
export function resolveShiftNameForSelection(departmentName, designationName) {
  if (!departmentName) return null;

  const dept = departmentName.trim().toUpperCase();
  const desig = (designationName || "").trim().toUpperCase();

  if (desig.includes("STOREMAN")) return WORK_SHOP_SHIFT_NAME;
  if (dept === "INSPECTION") return INSPECTION_SITE_SHIFT_NAME;
  if (dept === "OPERATION") return OPERATION_SITE_SHIFT_NAME;
  // QS, DESIGN, HR, ACCOUNT, PURCHASING & LOGISTICS, SALES, and anything
  // else not called out above are Office — but Office has two valid
  // timings, not one, so there's no single answer here.
  return null;
}

/**
 * Returns the list of shift_name(s) valid for this department/designation
 * combo. Inspection/Operation/Storeman always resolve to exactly one
 * (their schedule is fixed). Office departments resolve to BOTH office
 * timings, since HR chooses per staff member which one applies. Returns
 * null if the department isn't picked yet (caller should show every shift).
 */
export function resolveShiftNamesForSelection(departmentName, designationName) {
  if (!departmentName) return null;

  const single = resolveShiftNameForSelection(departmentName, designationName);
  if (single) return [single];

  return OFFICE_SHIFT_NAMES;
}

/**
 * Filters a `shifts` list down to just the shift(s) that match this
 * department/designation combo — a single fixed shift for
 * Inspection/Operation/Storeman, or both office timings (8:30-5:30 and
 * 9:00-6:00) for every other department, so HR can pick whichever one
 * actually applies to that staff member. Falls back to the full list if
 * the department isn't picked yet, or if none of the expected shift(s)
 * are in the list (e.g. migration 014 hasn't been run), so the dropdown
 * never ends up silently empty.
 */
export function filterShiftsForSelection(
  shifts,
  departmentName,
  designationName,
) {
  const shiftNames = resolveShiftNamesForSelection(
    departmentName,
    designationName,
  );
  if (!shiftNames) return shifts;
  const match = shifts.filter((s) => shiftNames.includes(s.shift_name));
  return match.length ? match : shifts;
}
