import {
  AlertTriangle,
  Briefcase,
  ChevronDown,
  Loader2,
  Shield,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../../services/apiClient";
import {
  filterShiftsForSelection,
  formatTime12h,
  resolveSaturdayShift,
} from "../../utils/shiftMapping";

// ---------------------------------------------------------------------
// Shared "Add / Edit user" modal — originally lived only inside
// src/pages/super-admin/Users.jsx, pulled out here so the Super Admin
// dashboard's "Add New User" quick action can open the exact same form
// in a popup instead of navigating to the Users page. Behavior,
// validation, and the POST /employees/ (create) / PUT /employees/{id}
// (edit) calls are unchanged — see Users.jsx for the full backend
// contract notes.
//
// `refData` shape: { departments, designations, shifts, roles, users }.
// Callers own fetching these (Users.jsx already did; Dashboard.jsx now
// fetches its own copy on open) and pass `onSaved` to refresh their own
// list/state after a create or edit.
// ---------------------------------------------------------------------

export const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2.5 sm:py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400";

export function Field({ label, required, error, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 mb-1 block">
        {label} {required && <span className="text-orange-500">*</span>}
      </span>
      {children}
      {error && (
        <span className="text-xs text-orange-500 mt-1 block">{error}</span>
      )}
    </label>
  );
}

// ==========================================================================
// Reusable searchable-looking dropdown (fixed-height option list, always
// loads every option rather than a truncated subset).
// ==========================================================================

export function FilterDropdown({
  allLabel,
  value,
  options,
  getKey,
  getLabel,
  onChange,
  fullWidth = false,
  showAllOption = true,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selected = options.find((o) => getKey(o) === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${fullWidth ? "w-full" : "w-full sm:w-48"} flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 sm:py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-100`}
      >
        <span className={`truncate ${!selected ? "text-slate-400" : ""}`}>
          {selected ? getLabel(selected) : allLabel}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        // No forced min-width on mobile: with the Add User form's grids
        // now stacking to a single column below the `sm` breakpoint (see
        // UserformModal.jsx), this panel's own field is already the full
        // modal width there, so a hardcoded 200px min-width isn't needed
        // -- it was previously what made the options list spill out past
        // its half-width column and overlap the fields next to/below it
        // (e.g. Designation's list covering Basic Information) on narrow
        // screens. sm:min-w-[200px] keeps the old behavior for the
        // narrower fixed-width (non-fullWidth) selects on desktop.
        <div className="absolute z-20 mt-1 w-full sm:min-w-[200px] rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="max-h-56 overflow-y-auto py-1 scrollbar-hide">
            {showAllOption && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className={`block w-full truncate px-3 py-2.5 sm:py-2 text-left text-sm hover:bg-slate-50 ${
                  !value ? "font-medium text-orange-600" : "text-slate-600"
                }`}
              >
                {allLabel}
              </button>
            )}
            {options.map((o) => (
              <button
                type="button"
                key={getKey(o)}
                onClick={() => {
                  onChange(getKey(o));
                  setOpen(false);
                }}
                className={`block w-full truncate px-3 py-2.5 sm:py-2 text-left text-sm hover:bg-slate-50 ${
                  value === getKey(o)
                    ? "font-medium text-orange-600"
                    : "text-slate-600"
                }`}
              >
                {getLabel(o)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Previously, if no real email was ever set for this employee, the
// backend filled in a placeholder login email built from the employee
// code itself (e.g. "akr-ins-cw-0002@akrobat.com.sg"). That's been
// removed -- email is now required on create (see
// app/employees/schemas.py EmployeeCreate / create_employee() in
// app/employees/services.py), so the backend never appends the
// employee code into the email field.
//
// isSystemGeneratedEmail() is kept for older records that still carry
// one of those legacy code-based addresses from before this change --
// it's treated as blank when prefilling Edit so it isn't resubmitted
// as if it were real.
function isSystemGeneratedEmail(candidateUser) {
  if (!candidateUser?.email || !candidateUser?.employee_id) return false;
  const localPart = candidateUser.email.split("@")[0]?.toLowerCase();
  return localPart === candidateUser.employee_id.toLowerCase();
}

// Full country list for the Nationality field. Only "Singapore" maps
// to NS Leave eligibility -- every other value here is normalized to
// "Foreigner" server-side for the leave_eligibility_rules check (see
// app/leaves/policy_services.py _employee_field_value()), so this can
// safely be a real country picker instead of a Singaporean/Foreigner
// binary choice.
export const COUNTRIES = [
  "Singapore",
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo (Republic of the)",
  "Congo (DR)",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hong Kong",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Ivory Coast",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kosovo",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Macau",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
  "Other",
];

// only managerial/admin-type roles belong there (see managerCandidates
// below). Matches the role_name values seeded in sql/001_schema.sql.
const NON_MANAGER_ROLES = ["EMPLOYEE", "VIEWER"];

// ==========================================================================
// Add / Edit modal
// ==========================================================================

export default function UserFormModal({
  mode,
  user,
  refData,
  onClose,
  onSaved,
}) {
  const isEdit = mode === "edit";
  const { departments, designations, shifts, roles, users } = refData;

  // SUPER ADMIN is deliberately excluded from the *assignable* role
  // list on create -- it's not selectable here even for a Super Admin
  // caller. The one fixed Super Admin login (IT@akrobat.com.sg) is
  // bootstrapped exclusively via scripts/create_super_admin.py, run
  // from the backend terminal. `roles` itself (unfiltered) is still
  // used elsewhere in this app -- e.g. the Users list's filter-by-role
  // dropdown -- since existing Super Admin accounts still need to be
  // filterable/visible there. The backend also rejects
  // role_id=SUPER ADMIN on POST /employees/ regardless of this list, so
  // this is UX, not the actual guard.
  const assignableRoles = roles.filter(
    (r) => r.role_name?.trim().toUpperCase() !== "SUPER ADMIN",
  );

  const [form, setForm] = useState(() => ({
    full_name: user?.full_name || "",
    email: isSystemGeneratedEmail(user) ? "" : user?.email || "",
    phone: user?.phone || "",
    department_id: user?.department_id || "",
    designation_id: user?.designation_id || "",
    manager_id: user?.manager_id || "",
    shift_id: user?.shift_id || "",
    role_id: "",
    joining_date: user?.joining_date || "",
    employment_status: user?.employment_status || "Active",
    work_location: user?.work_location || "",
    // Leave policy engine fields (see app/leaves/policy_services.py).
    // Annual Leave tier is required for every user/employee; Childcare
    // Leave tier only matters for those who pass the CHILDCARE LEAVE
    // eligibility rule (married). Neither comes back from GET
    // /employees/ (they live in employee_leave_tier, not on the
    // employees row), so on Edit these always start blank -- leaving
    // them blank leaves the existing assignment untouched.
    annual_leave_tier_id: "",
    childcare_leave_tier_id: "",
    working_days_per_week: user?.working_days_per_week || 5,
    works_saturday: user?.works_saturday || false,
    // Eligibility inputs for the leave policy engine (see
    // app/leaves/policy_services.py evaluate_leave_eligibility() /
    // leave_eligibility_rules seed). These used to only be settable
    // later from the employee's own "My Profile", which meant HR had
    // no way to see Paternity/Maternity/Childcare eligibility (or set
    // Nationality correctly for the NS Leave rule) at the point the
    // account is actually created. Prefilled from `user` on Edit since
    // GET /employees/ returns these columns directly (employees.*).
    gender: user?.gender || "",
    marital_status: user?.marital_status || "",
    // Free-text country names used to be a problem here because the
    // eligibility rule is seeded as field=nationality, value='Foreigner'
    // (an exact, case-insensitive string match -- see
    // _employee_field_value() / evaluate_leave_eligibility()). This is
    // now a full country picker (see COUNTRIES below); the backend
    // normalizes anything other than "Singapore" to "Foreigner" before
    // running that match, so only Singapore nationals are eligible for
    // National Service Leave.
    nationality: user?.nationality || "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Tier options for the Annual Leave / Childcare Leave dropdowns --
  // see app/leaves/policy_services.py get_tiers_for_leave_type() /
  // leave_policy_tiers seed (Annual: 21/20/14/11/10, Childcare: 6/2).
  // Fetched here (rather than expected on refData) so every caller of
  // this shared modal -- Users.jsx, and the "Add New User" quick
  // actions on the Super Admin / HR Admin dashboards -- gets it for
  // free without having to fetch and thread it through separately.
  const [annualLeaveTiers, setAnnualLeaveTiers] = useState([]);
  const [childcareLeaveTiers, setChildcareLeaveTiers] = useState([]);
  // Previously a failed fetch here (wrong/missing auth, migration
  // 026.sql not yet applied so ANNUAL LEAVE has no rows in
  // leave_policy_tiers, etc.) was swallowed by `.catch(() => [])` --
  // the dropdown just rendered with a "Select tier" placeholder and no
  // options, which is indistinguishable from "still loading" or "there
  // are genuinely no tiers." This surfaces which one it actually is.
  const [tiersError, setTiersError] = useState(null);
  const [tiersLoading, setTiersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setTiersLoading(true);
    setTiersError(null);

    Promise.all([
      apiClient.get(
        `/leaves/policy/tiers/${encodeURIComponent("ANNUAL LEAVE")}`,
      ),
      apiClient.get(
        `/leaves/policy/tiers/${encodeURIComponent("CHILDCARE LEAVE")}`,
      ),
    ])
      .then(([annualRes, childcareRes]) => {
        if (cancelled) return;
        setAnnualLeaveTiers(annualRes?.data || []);
        setChildcareLeaveTiers(childcareRes?.data || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setAnnualLeaveTiers([]);
        setChildcareLeaveTiers([]);
        setTiersError(
          err?.message ||
            "Could not load leave tiers. Confirm migration 026.sql has run and try again.",
        );
      })
      .finally(() => {
        if (!cancelled) setTiersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Childcare Leave tier is only shown once we know the user is
  // eligible (married) -- see leave_eligibility_rules seed: CHILDCARE
  // LEAVE -> marital_status=Single -> false.
  //
  // Marital Status is now a field on this form itself (see form state
  // above), so eligibility can be computed live the moment HR picks
  // it -- on Create *and* Edit -- instead of waiting on a server round
  // trip that (on Create) had no employee_id to check against yet.
  // `apiChildcareEligible` is kept purely as a fallback for Edit: an
  // existing employee record that predates this field and has no
  // marital_status saved yet still gets the real answer from the
  // eligibility endpoint until HR fills the field in on this form.
  const [apiChildcareEligible, setApiChildcareEligible] = useState(
    isEdit ? null : true,
  );

  useEffect(() => {
    if (!isEdit || !user?.id) return;
    let cancelled = false;
    apiClient
      .get(
        `/leaves/policy/eligibility/${user.id}/${encodeURIComponent("CHILDCARE LEAVE")}`,
      )
      .then((res) => {
        if (!cancelled) setApiChildcareEligible(!!res?.data?.eligible);
      })
      .catch(() => {
        if (!cancelled) setApiChildcareEligible(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, user?.id]);

  // Real eligibility used by the render below. Marital Status is now a
  // closed Single/Married choice (see options below), so this is a
  // direct check rather than "not Single" -- Childcare Leave tier only
  // shows once Married is actually picked, not by default while
  // nothing's been chosen yet. Falls back to the server check only on
  // Edit, for an existing record that predates this field and has no
  // marital_status saved yet.
  const childcareEligible = form.marital_status
    ? form.marital_status === "Married"
    : isEdit
      ? apiChildcareEligible
      : false;

  // Password and employee code are both auto-generated by the backend
  // (see app/employees/services.py create_employee) — never typed in by
  // HR. The code preview below just mirrors what the server will assign
  // so HR can see it before hitting Save; `credentials` holds the real
  // values returned once the account is actually created.
  const [codePreview, setCodePreview] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [credentials, setCredentials] = useState(null);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Re-fetch the employee-code preview every time department or
  // designation changes, so picking a department immediately shows the
  // code HR can expect (e.g. AKR-HR-0001, then AKR-HR-EXE-0001 once a
  // designation is also picked).
  useEffect(() => {
    if (isEdit) return;
    if (!form.department_id && !form.designation_id) {
      setCodePreview("");
      return;
    }
    let cancelled = false;
    setCodeLoading(true);
    const params = new URLSearchParams();
    if (form.department_id) params.set("department_id", form.department_id);
    if (form.designation_id) params.set("designation_id", form.designation_id);
    apiClient
      .get(`/employees/preview-code?${params.toString()}`)
      .then((res) => {
        if (!cancelled) setCodePreview(res?.data?.employee_id || "");
      })
      .catch(() => {
        if (!cancelled) setCodePreview("");
      })
      .finally(() => {
        if (!cancelled) setCodeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.department_id, form.designation_id, isEdit]);

  // Reporting Manager should only offer people who actually manage
  // others -- SUPER ADMIN / HR / MANAGER-type roles -- not regular
  // Employee or read-only Viewer accounts. `users` entries only carry
  // role_name when they came from a per-role fetch (see Users.jsx's
  // loadUsers() and the Dashboard "Create User" quick action) --
  // callers that don't tag it will just see an empty list here rather
  // than silently falling back to "everyone".
  const managerCandidates = useMemo(
    () =>
      users.filter(
        (u) =>
          u.id !== user?.id &&
          !NON_MANAGER_ROLES.includes((u.role_name || "").trim().toUpperCase()),
      ),
    [users, user?.id],
  );

  // Designations belong to exactly one department (designations.department_id),
  // so once a department is picked, only show designations under it.
  const filteredDesignations = useMemo(() => {
    if (!form.department_id) return designations;
    return designations.filter((d) => d.department_id === form.department_id);
  }, [designations, form.department_id]);

  // Each designation carries its own default "timing" (designations.default_shift_id,
  // joined back as `shifts` by GET /designations/) — that's the shift a new hire in
  // that designation should default to.
  const selectedDesignation = useMemo(
    () => designations.find((d) => d.id === form.designation_id),
    [designations, form.designation_id],
  );

  // Shifts aren't tagged with a department in the schema, but every
  // designation has exactly one fixed timing per department (see
  // src/utils/shiftMapping.js) — so the Shift dropdown is filtered down
  // to just that one option, e.g. picking INSPECTION only shows
  // Inspection Site's timing, not Office/Work Shop/Operation Site.
  const filteredShifts = useMemo(() => {
    const dept = departments.find((d) => d.id === form.department_id);
    return filterShiftsForSelection(
      shifts,
      dept?.department_name,
      selectedDesignation?.designation_name,
    );
  }, [shifts, departments, form.department_id, selectedDesignation]);

  // The weekday shift currently in effect — either the one HR explicitly
  // picked (Office's two-timing case) or the single fixed option for
  // Inspection/Operation/Work Shop. Used to derive the read-only Saturday
  // line below; not re-fetched from `shifts` by id so it stays in sync
  // with filteredShifts even before form.shift_id has been set.
  const selectedWeekdayShift = useMemo(() => {
    if (filteredShifts.length === 1) return filteredShifts[0];
    return filteredShifts.find((s) => s.id === form.shift_id) || null;
  }, [filteredShifts, form.shift_id]);

  // "Works Saturdays?" is a separate yes/no from weekday timing — every
  // area has some staff who work Saturdays and some who don't (see
  // resolveSaturdayShift's doc comment). Derived from the area's sibling
  // "<AREA> - SATURDAY" shift row so the hours shown always match
  // whichever department/timing is currently selected.
  // "Works Saturdays?" is its own independent field (employees.works_saturday)
  // -- deliberately NOT derived from working_days_per_week. That field is
  // payroll's Unpaid Leave deduction denominator and has no defined
  // relationship to Saturday shift hours in the source Leave Info doc, so
  // the two are kept fully separate rather than one implying the other.
  const worksSaturday = form.works_saturday;
  const saturdayShift = useMemo(
    () => resolveSaturdayShift(shifts, selectedWeekdayShift?.shift_name),
    [shifts, selectedWeekdayShift],
  );

  // If the currently-picked designation no longer belongs to the newly-picked
  // department, clear it (and its shift) rather than leaving a stale mismatch.
  const didMountDept = useRef(false);
  useEffect(() => {
    if (!didMountDept.current) {
      didMountDept.current = true;
      return;
    }
    setForm((f) => {
      const stillValid =
        !f.designation_id ||
        designations.some(
          (d) =>
            d.id === f.designation_id && d.department_id === f.department_id,
        );
      return stillValid ? f : { ...f, designation_id: "", shift_id: "" };
    });
  }, [form.department_id, designations]);

  // Auto-fill the shift/timing from the designation's own default whenever the
  // designation changes (HR can still override it via the Shift dropdown).
  const didMountDesig = useRef(false);
  useEffect(() => {
    if (!didMountDesig.current) {
      didMountDesig.current = true;
      return;
    }
    if (selectedDesignation?.shifts?.id) {
      setForm((f) => ({ ...f, shift_id: selectedDesignation.shifts.id }));
    }
  }, [form.designation_id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.full_name.trim() || form.full_name.trim().length < 2) {
      setError("Full name must be at least 2 characters.");
      return;
    }
    if (!isEdit && !form.role_id) {
      setError("Please select a role.");
      return;
    }
    // The backend requires email on create (EmployeeCreate.email is a
    // mandatory EmailStr — the old "auto-generate a placeholder login
    // email from the employee code when left blank" flow was removed).
    // This form never enforced that client-side, so a blank email used
    // to sail past this point, get submitted as "", and bounce off the
    // backend's required-email validation with a confusing error.
    if (!isEdit && !form.email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!isEdit && !form.annual_leave_tier_id) {
      // Every employee must be on one of the Annual Leave tiers
      // (21/20/14/11/10 days) -- required on EmployeeCreate.
      setError("Please select an Annual Leave tier for this user.");
      return;
    }
    // Gender / Marital Status / Nationality feed the leave eligibility
    // engine (Paternity, Maternity, Childcare, National Service Leave)
    // -- required up front on create so eligibility is correct from
    // day one instead of depending on the employee filling in "My
    // Profile" later.
    if (!isEdit && !form.gender) {
      setError("Please select a gender for this user.");
      return;
    }
    if (!isEdit && !form.marital_status) {
      setError("Please select a marital status for this user.");
      return;
    }
    if (!isEdit && !form.nationality) {
      setError("Please select a nationality for this user.");
      return;
    }

    const orUndefined = (v) => (v ? v : undefined);

    setSaving(true);
    try {
      if (isEdit) {
        const payload = {
          full_name: form.full_name.trim(),
          // Unlike every other optional field below, this used to send
          // "" instead of omitting the key. On edit, email is optional
          // (EmployeeUpdate.email is Optional[EmailStr]) — but "" isn't
          // a valid email either, so leaving this blank (e.g. after the
          // isSystemGeneratedEmail() reset above) meant Save silently
          // failed backend validation instead of just leaving the
          // existing email untouched.
          email: orUndefined(form.email.trim()),
          phone: form.phone.trim() || undefined,
          department_id: orUndefined(form.department_id),
          designation_id: orUndefined(form.designation_id),
          manager_id: orUndefined(form.manager_id),
          shift_id: orUndefined(form.shift_id),
          joining_date: orUndefined(form.joining_date),
          employment_status: form.employment_status,
          work_location: form.work_location.trim() || undefined,
          // Only sent if something was actually picked -- omitting
          // these leaves the user's existing tier assignment untouched
          // rather than clearing it (see app/employees/services.py
          // update_employee()).
          annual_leave_tier_id: orUndefined(form.annual_leave_tier_id),
          childcare_leave_tier_id: orUndefined(form.childcare_leave_tier_id),
          working_days_per_week: form.working_days_per_week,
          works_saturday: form.works_saturday,
          gender: orUndefined(form.gender),
          marital_status: orUndefined(form.marital_status),
          nationality: orUndefined(form.nationality),
        };
        await apiClient.put(`/employees/${user.id}`, payload);
        onSaved();
      } else {
        // No `password` here — the backend generates it (and the
        // employee code) itself; both come back in the create response
        // for HR to share with the new hire (see credentials modal
        // below).
        const payload = {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          department_id: orUndefined(form.department_id),
          designation_id: orUndefined(form.designation_id),
          manager_id: orUndefined(form.manager_id),
          shift_id: orUndefined(form.shift_id),
          role_id: form.role_id,
          joining_date: orUndefined(form.joining_date),
          employment_status: form.employment_status,
          work_location: form.work_location.trim() || undefined,
          annual_leave_tier_id: form.annual_leave_tier_id,
          childcare_leave_tier_id: orUndefined(form.childcare_leave_tier_id),
          working_days_per_week: form.working_days_per_week,
          works_saturday: form.works_saturday,
          gender: form.gender,
          marital_status: form.marital_status,
          nationality: form.nationality,
        };
        const res = await apiClient.post("/employees/", payload);
        setCredentials({
          employee_id: res?.data?.login_employee_id,
          password: res?.data?.login_password,
        });
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Shown once, right after a successful create — the generated
  // employee code + password only ever come back in this one response
  // (see app/employees/services.py create_employee), so this is HR's
  // only chance to see/copy them before the list reloads.
  if (credentials) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800">User Created</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Share these login details with the new user securely — the
              password won't be shown again.
            </p>
          </div>
          <div className="px-6 py-5 space-y-3">
            <div>
              <span className="text-xs font-medium text-slate-600 mb-1 block">
                Employee Code
              </span>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                {credentials.employee_id}
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-600 mb-1 block">
                Password
              </span>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                {credentials.password}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
            <button
              onClick={onSaved}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {isEdit ? "Edit User" : "Add New User"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit
                ? `Update details for ${user?.full_name}`
                : "Create a new account with any role"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto px-4 sm:px-6 py-5 space-y-6"
        >
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-100 text-orange-600 text-sm px-3 py-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Role & Access
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {!isEdit ? (
                <Field label="Role" required>
                  <FilterDropdown
                    fullWidth
                    showAllOption={false}
                    allLabel="Select role"
                    value={form.role_id}
                    onChange={(v) => set("role_id", v)}
                    options={assignableRoles}
                    getKey={(r) => r.id}
                    getLabel={(r) => r.role_name}
                  />
                </Field>
              ) : (
                <Field label="Role">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <Shield size={14} className="text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-600">
                      {user?.role_name || "—"}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 mt-1 block">
                    Role can only be set when the account is created.
                  </span>
                </Field>
              )}
              <Field label="Employment Status">
                <FilterDropdown
                  fullWidth
                  showAllOption={false}
                  allLabel="Select status"
                  value={form.employment_status}
                  onChange={(v) => set("employment_status", v)}
                  options={["Active", "Inactive"]}
                  getKey={(s) => s}
                  getLabel={(s) => s}
                />
              </Field>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Department & Designation
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Department">
                <FilterDropdown
                  fullWidth
                  allLabel="Select department"
                  value={form.department_id}
                  onChange={(v) => set("department_id", v)}
                  options={departments}
                  getKey={(d) => d.id}
                  getLabel={(d) => d.department_name}
                />
              </Field>
              <Field label="Designation">
                <FilterDropdown
                  fullWidth
                  allLabel={
                    form.department_id
                      ? "Select designation"
                      : "Select department first"
                  }
                  value={form.designation_id}
                  onChange={(v) => set("designation_id", v)}
                  options={filteredDesignations}
                  getKey={(d) => d.id}
                  getLabel={(d) => d.designation_name}
                />
              </Field>
              {!isEdit && (form.department_id || form.designation_id) && (
                <Field label="Employee Code">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <Briefcase size={14} className="text-slate-400 shrink-0" />
                    <span className="text-sm font-medium text-slate-600">
                      {codeLoading ? "Generating…" : codePreview || "—"}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 mt-1 block">
                    Auto-generated from the department and designation.
                  </span>
                </Field>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full Name" required>
                <input
                  className={inputCls}
                  value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                  placeholder="John Doe"
                />
              </Field>
              <Field label="Email Address" required={!isEdit}>
                <input
                  type="email"
                  className={inputCls}
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="you@company.com"
                />
              </Field>
              <Field label="Phone Number">
                <input
                  className={inputCls}
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+65 9123 4567"
                />
              </Field>
              {!isEdit && (
                <Field label="Password">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-sm text-slate-400">
                      Auto-generated on save
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 mt-1 block">
                    A secure password is generated automatically and shown once
                    the account is created.
                  </span>
                </Field>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Personal Details
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Gender" required={!isEdit}>
                <FilterDropdown
                  fullWidth
                  showAllOption={false}
                  allLabel="Select gender"
                  value={form.gender}
                  onChange={(v) => set("gender", v)}
                  options={["Male", "Female", "Other"]}
                  getKey={(g) => g}
                  getLabel={(g) => g}
                />
              </Field>
              <Field label="Marital Status" required={!isEdit}>
                <FilterDropdown
                  fullWidth
                  showAllOption={false}
                  allLabel="Select marital status"
                  value={form.marital_status}
                  onChange={(v) => set("marital_status", v)}
                  options={["Single", "Married"]}
                  getKey={(m) => m}
                  getLabel={(m) => m}
                />
                <span className="text-xs text-slate-400 mt-1 block">
                  Drives Paternity / Maternity / Childcare Leave eligibility —
                  Single is not eligible for any of them.
                </span>
              </Field>
              <Field label="Nationality" required={!isEdit}>
                <FilterDropdown
                  fullWidth
                  showAllOption={false}
                  allLabel="Select nationality"
                  value={form.nationality}
                  onChange={(v) => set("nationality", v)}
                  options={COUNTRIES}
                  getKey={(n) => n}
                  getLabel={(n) => n}
                />
                <span className="text-xs text-slate-400 mt-1 block">
                  Foreigners are not eligible for National Service Leave.
                </span>
              </Field>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Work Details
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Reporting Manager">
                <FilterDropdown
                  fullWidth
                  allLabel="None"
                  value={form.manager_id}
                  onChange={(v) => set("manager_id", v)}
                  options={managerCandidates}
                  getKey={(u) => u.id}
                  getLabel={(u) => `${u.full_name} (${u.employee_id})`}
                />
              </Field>
              <Field label="Weekday Hours">
                {!form.department_id ? (
                  <div className="text-sm text-slate-400 border border-slate-200 rounded-lg px-3 py-2.5 sm:py-2 bg-slate-50">
                    Select department first
                  </div>
                ) : filteredShifts.length <= 1 ? (
                  // Inspection / Operation / Work Shop — one fixed timing,
                  // nothing for HR to choose, so show it read-only instead
                  // of a dropdown with a single, unclickable-feeling option.
                  <div className="text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-2.5 sm:py-2 bg-slate-50">
                    {filteredShifts[0]
                      ? `${formatTime12h(filteredShifts[0].start_time)} – ${formatTime12h(filteredShifts[0].end_time)} (fixed)`
                      : "No matching shift configured"}
                  </div>
                ) : (
                  // Office — the one area with a real choice.
                  <div className="flex gap-2">
                    {filteredShifts.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => set("shift_id", s.id)}
                        className={`flex-1 rounded-lg border px-3 py-2.5 sm:py-2 text-sm transition-colors ${
                          form.shift_id === s.id
                            ? "border-orange-400 bg-orange-50 text-orange-700 font-medium"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {formatTime12h(s.start_time)} –{" "}
                        {formatTime12h(s.end_time)}
                      </button>
                    ))}
                  </div>
                )}
                {selectedDesignation?.shifts && filteredShifts.length > 1 && (
                  <span className="text-xs text-slate-400 mt-1 block">
                    Defaults to {selectedDesignation.shifts.shift_name}'s timing
                    for this designation — pick the other option to override.
                  </span>
                )}
              </Field>
              <Field label="Joining Date">
                <input
                  type="date"
                  className={inputCls}
                  value={form.joining_date || ""}
                  onChange={(e) => set("joining_date", e.target.value)}
                />
              </Field>
              <Field label="Work Location">
                <input
                  className={inputCls}
                  value={form.work_location}
                  onChange={(e) => set("work_location", e.target.value)}
                  placeholder="Singapore Office"
                />
              </Field>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Leave Policy
            </h3>
            {tiersError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-100 text-orange-600 text-xs px-3 py-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{tiersError}</span>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Annual Leave Tier" required={!isEdit}>
                {tiersLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">
                    <Loader2 size={14} className="animate-spin shrink-0" />
                    Loading tiers…
                  </div>
                ) : (
                  <FilterDropdown
                    fullWidth
                    showAllOption={false}
                    allLabel={
                      isEdit
                        ? "Keep current tier"
                        : annualLeaveTiers.length
                          ? "Select tier"
                          : "No tiers available"
                    }
                    value={form.annual_leave_tier_id}
                    onChange={(v) => set("annual_leave_tier_id", v)}
                    options={annualLeaveTiers}
                    getKey={(t) => t.id}
                    getLabel={(t) => `${t.tier_name} (${t.days} days)`}
                  />
                )}
              </Field>
              <Field label="Works Saturdays?">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => set("works_saturday", false)}
                    className={`flex-1 rounded-lg border px-3 py-2.5 sm:py-2 text-sm transition-colors ${
                      !worksSaturday
                        ? "border-orange-400 bg-orange-50 text-orange-700 font-medium"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => set("works_saturday", true)}
                    className={`flex-1 rounded-lg border px-3 py-2.5 sm:py-2 text-sm transition-colors ${
                      worksSaturday
                        ? "border-orange-400 bg-orange-50 text-orange-700 font-medium"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    Yes
                  </button>
                </div>
                {worksSaturday && saturdayShift && (
                  <span className="text-xs text-slate-400 mt-1 block">
                    Saturday: {formatTime12h(saturdayShift.start_time)} –{" "}
                    {formatTime12h(saturdayShift.end_time)}
                  </span>
                )}
                <span className="text-xs text-slate-400 mt-1 block">
                  Controls this employee's Saturday shift assignment only.
                </span>
              </Field>
              <Field label="Working Days / Week">
                {/* Fully independent of "Works Saturdays?" above --
                    payroll's Unpaid Leave deduction denominator, with no
                    defined relationship to Saturday shift hours in the
                    source Leave Info doc. HR sets this on its own. */}
                <FilterDropdown
                  fullWidth
                  showAllOption={false}
                  allLabel="Select"
                  value={form.working_days_per_week}
                  onChange={(v) => set("working_days_per_week", Number(v))}
                  options={[5, 5.5, 6]}
                  getKey={(d) => d}
                  getLabel={(d) => `${d} days`}
                />
                <span className="text-xs text-slate-400 mt-1 block">
                  Used by payroll to calculate the Unpaid Leave deduction.
                </span>
              </Field>
              {childcareEligible !== false && (
                <Field label="Childcare Leave Tier">
                  {tiersLoading ? (
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">
                      <Loader2 size={14} className="animate-spin shrink-0" />
                      Loading tiers…
                    </div>
                  ) : (
                    <FilterDropdown
                      fullWidth
                      showAllOption={false}
                      allLabel={isEdit ? "Keep current tier" : "Not applicable"}
                      value={form.childcare_leave_tier_id}
                      onChange={(v) => set("childcare_leave_tier_id", v)}
                      options={childcareLeaveTiers}
                      getKey={(t) => t.id}
                      getLabel={(t) => `${t.tier_name} (${t.days} days)`}
                    />
                  )}
                  <span className="text-xs text-slate-400 mt-1 block">
                    {isEdit
                      ? "Only applied if the user is married."
                      : "Only applies to married employees — leave blank otherwise, it's silently ignored if they're not eligible."}
                  </span>
                </Field>
              )}
              {childcareEligible === false && (
                <div className="sm:col-span-2 text-xs text-slate-400">
                  Childcare Leave tier hidden — this user isn't eligible (must
                  be married).
                </div>
              )}
            </div>
          </div>
        </form>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="order-2 sm:order-1 px-4 py-2.5 sm:py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="order-1 sm:order-2 px-4 py-2.5 sm:py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? "Save Changes" : "Create User"}
          </button>
        </div>
      </div>
    </div>
  );
}
