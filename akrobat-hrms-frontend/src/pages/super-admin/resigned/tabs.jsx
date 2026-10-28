import {
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Landmark,
  MapPin,
  Phone,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import DatePicker from "../../../components/layout/DatePicker";
import { resignationService } from "../../../services/resignationService";
import {
  Card,
  ErrorBox,
  Field,
  FieldGrid,
  Select,
  Spinner,
  Table,
  Tag,
  btnPrimary,
  fmtDate,
  fmtDateTime,
  fmtTime,
  hours,
  inputCls,
  money,
  statusColor,
  useLoad
} from "./ui";

// First non-empty value among several possible column names. Personal /
// bank / statutory columns differ between deployments, so the Profile tab
// tries the likely names instead of hard-coding one.
const pick = (obj, ...keys) => {
  for (const k of keys) if (obj?.[k]) return obj[k];
  return "";
};

function SecTitle({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
        <Icon className="h-4 w-4" />
      </span>
      {children}
    </span>
  );
}

const isEmpty = (v) => v === undefined || v === null || v === "";

// Label/value rows on phones, the original field grid on desktop.
// item = [label, value, stack?] - stack puts long text under its label.
function InfoRows({ items }) {
  return (
    <>
      <div className="md:hidden">
        {items.map(([label, value, stack]) =>
          stack ? (
            <div
              key={label}
              className="border-t border-slate-100 py-2.5 first:border-t-0 first:pt-0 last:pb-0"
            >
              <div className="text-xs text-slate-500">{label}</div>
              <div className="mt-0.5 break-words text-sm font-medium text-slate-800">
                {isEmpty(value) ? "—" : value}
              </div>
            </div>
          ) : (
            <div
              key={label}
              className="flex items-start justify-between gap-4 border-t border-slate-100 py-2.5 text-sm first:border-t-0 first:pt-0 last:pb-0"
            >
              <span className="shrink-0 text-slate-500">{label}</span>
              <span className="min-w-0 break-words text-right font-medium text-slate-800">
                {isEmpty(value) ? "—" : value}
              </span>
            </div>
          ),
        )}
      </div>
      <div className="hidden md:block">
        <FieldGrid>
          {items.map(([label, value]) => (
            <Field key={label} label={label}>
              {value}
            </Field>
          ))}
        </FieldGrid>
      </div>
    </>
  );
}

function TabState({ state, children }) {
  if (state.loading) return <Spinner />;
  if (state.error)
    return <ErrorBox message={state.error} onRetry={state.reload} />;
  return children(state.data);
}

// ---------------------------------------------------------------------
// Exit & settlement
// ---------------------------------------------------------------------

const CHECKLIST = [
  ["asset_returned", "Laptop / ID card / assets returned"],
  ["site_handover", "Site assignment handover"],
  ["knowledge_transfer", "Knowledge transfer to replacement"],
  ["exit_interview", "Exit interview completed"],
  ["access_disabled", "System access disabled"],
];

export function ExitTab({ id, resignation, onChanged }) {
  const r = resignation;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    pending_salary: r.pending_salary ?? 0,
    leave_encashment: r.leave_encashment ?? 0,
    deductions: r.deductions ?? 0,
    settlement_status: r.settlement_status || "Pending",
    settlement_paid_on: r.settlement_paid_on || "",
  });

  const net =
    Number(form.pending_salary || 0) +
    Number(form.leave_encashment || 0) -
    Number(form.deductions || 0);

  async function toggle(key, value) {
    setError("");
    try {
      await resignationService.update(id, { exit_checklist: { [key]: value } });
      onChanged();
    } catch (e) {
      setError(e?.message || "Unable to update checklist.");
    }
  }

  async function saveSettlement() {
    setSaving(true);
    setError("");
    try {
      await resignationService.update(id, {
        pending_salary: Number(form.pending_salary || 0),
        leave_encashment: Number(form.leave_encashment || 0),
        deductions: Number(form.deductions || 0),
        settlement_status: form.settlement_status,
        settlement_paid_on:
          form.settlement_status === "Paid" && form.settlement_paid_on
            ? form.settlement_paid_on
            : null,
      });
      onChanged();
    } catch (e) {
      setError(e?.message || "Unable to save settlement.");
    } finally {
      setSaving(false);
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {error && (
        <div className="lg:col-span-2">
          <ErrorBox message={error} />
        </div>
      )}

      <Card title="Exit checklist">
        <ul className="divide-y divide-slate-100">
          {CHECKLIST.map(([key, label]) => {
            const done = !!r.exit_checklist?.[key];
            return (
              <li
                key={key}
                className="flex items-center justify-between gap-3 py-3"
              >
                <label className="flex min-h-[32px] cursor-pointer items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-orange-600"
                    checked={done}
                    onChange={(e) => toggle(key, e.target.checked)}
                  />
                  {label}
                </label>
                <Tag color={done ? "green" : "orange"}>
                  {done ? "Done" : "Pending"}
                </Tag>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Final settlement">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-500">
            Pending salary
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              value={form.pending_salary}
              onChange={set("pending_salary")}
            />
          </label>
          <label className="text-xs text-slate-500">
            Leave encashment
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              value={form.leave_encashment}
              onChange={set("leave_encashment")}
            />
          </label>
          <label className="text-xs text-slate-500">
            Deductions / recoveries
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              value={form.deductions}
              onChange={set("deductions")}
            />
          </label>
          <div className="text-xs text-slate-500">
            Net payable
            <div className="mt-1 rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800">
              {money(net)}
            </div>
          </div>
          <label className="text-xs text-slate-500">
            Status
            <Select
              value={form.settlement_status}
              onChange={set("settlement_status")}
            >
              <option>Pending</option>
              <option>Paid</option>
            </Select>
          </label>
          <div
            className={
              form.settlement_status !== "Paid"
                ? "pointer-events-none opacity-50"
                : ""
            }
          >
            <DatePicker
              label="Paid on"
              portal
              sheetOnMobile
              sheetTitle="Paid on"
              value={form.settlement_paid_on || ""}
              onChange={(iso) =>
                setForm((f) => ({ ...f, settlement_paid_on: iso }))
              }
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            className={btnPrimary}
            onClick={saveSettlement}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save settlement"}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------

export function ProfileTab({ id }) {
  const state = useLoad(() => resignationService.profile(id), [id]);
  return (
    <TabState state={state}>
      {({ employee: e, emergency_contacts, site_assignments }) => (
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title={<SecTitle icon={User}>Personal information</SecTitle>}>
              <InfoRows
                items={[
                  ["Full name", e.full_name],
                  ["Date of birth", fmtDate(pick(e, "date_of_birth", "dob"))],
                  ["Gender", e.gender],
                  ["Blood group", e.blood_group],
                  ["Phone", e.phone],
                  ["Personal email", pick(e, "personal_email"), true],
                  [
                    "Current address",
                    pick(e, "current_address", "address"),
                    true,
                  ],
                  ["Permanent address", e.permanent_address, true],
                ]}
              />
            </Card>
            <Card
              title={
                <SecTitle icon={Briefcase}>Employment information</SecTitle>
              }
            >
              <InfoRows
                items={[
                  ["Employee ID", e.employee_id],
                  ["Company email", e.email, true],
                  ["Department", e.departments?.department_name],
                  ["Designation", e.designations?.designation_name],
                  ["Reporting manager", e.manager_name],
                  ["Joining date", fmtDate(e.joining_date)],
                  ["Shift", e.shifts?.shift_name],
                  ["Work location", e.work_location],
                  ["Status", e.employment_status],
                ]}
              />
            </Card>
          </div>

          <Card
            title={<SecTitle icon={MapPin}>Site assignment history</SecTitle>}
          >
            <Table
              rows={site_assignments}
              empty="No site assignments."
              scroll="max-h-[320px]"
              mobileRow={(r) => (
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-slate-800">
                    {r.locations?.location_name || "—"}
                  </div>
                  <div className="text-[13px] text-slate-600">
                    {fmtDate(r.assigned_from)} →{" "}
                    {r.assigned_to ? fmtDate(r.assigned_to) : "Till date"}
                  </div>
                  {r.assigned_by_name && (
                    <div className="text-xs text-slate-400">
                      Assigned by {r.assigned_by_name}
                    </div>
                  )}
                </div>
              )}
              columns={[
                {
                  header: "Site",
                  render: (r) => r.locations?.location_name || "—",
                },
                { header: "From", render: (r) => fmtDate(r.assigned_from) },
                {
                  header: "To",
                  render: (r) =>
                    r.assigned_to ? fmtDate(r.assigned_to) : "Till date",
                },
                {
                  header: "Assigned by",
                  render: (r) => r.assigned_by_name || "—",
                },
              ]}
            />
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card
              title={<SecTitle icon={Landmark}>Bank and statutory</SecTitle>}
            >
              <InfoRows
                items={[
                  ["Bank", pick(e, "bank_name")],
                  [
                    "Account number",
                    mask(pick(e, "bank_account_number", "account_number")),
                  ],
                  ["IFSC / bank code", pick(e, "ifsc_code", "bank_code")],
                  [
                    "PAN / tax ID",
                    mask(pick(e, "pan_number", "pan", "tax_id")),
                  ],
                  ["UAN / CPF / PF", pick(e, "uan", "pf_number", "cpf_number")],
                  ["ESI number", pick(e, "esi_number")],
                ]}
              />
            </Card>
            <Card title={<SecTitle icon={Phone}>Emergency contacts</SecTitle>}>
              <Table
                rows={emergency_contacts}
                empty="No emergency contacts."
                mobileRow={(r) => {
                  const name =
                    pick(r, "contact_name", "name", "full_name") || "—";
                  const phone = pick(
                    r,
                    "phone",
                    "phone_number",
                    "contact_number",
                  );
                  return (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-800">
                          {name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {r.relationship || "—"}
                        </div>
                      </div>
                      {phone ? (
                        <a
                          href={`tel:${phone}`}
                          className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full bg-orange-50 px-3 text-[13px] font-semibold text-orange-700"
                        >
                          <Phone className="h-3.5 w-3.5" /> {phone}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  );
                }}
                columns={[
                  {
                    header: "Name",
                    render: (r) =>
                      pick(r, "contact_name", "name", "full_name") || "—",
                  },
                  {
                    header: "Relationship",
                    render: (r) => r.relationship || "—",
                  },
                  {
                    header: "Phone",
                    render: (r) =>
                      pick(r, "phone", "phone_number", "contact_number") || "—",
                  },
                ]}
              />
            </Card>
          </div>
        </div>
      )}
    </TabState>
  );
}

function mask(v) {
  const s = String(v || "");
  return s.length > 4 ? `${"X".repeat(s.length - 4)}${s.slice(-4)}` : s;
}

// ---------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------

const STATUS_CHIPS = [
  ["", "All"],
  ["Present", "Present"],
  ["Absent", "Absent"],
  ["Late", "Late"],
  ["On Leave", "On leave"],
];

function monthLabel(m) {
  if (!m) return "All months";
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(m, delta) {
  const now = new Date();
  const [y, mo] = m
    ? m.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function AttendanceFilters({ month, status, setMonth, setStatus }) {
  const active = month || status;
  const arrow =
    "flex h-11 w-11 shrink-0 items-center justify-center text-slate-600 active:bg-slate-100 md:h-9 md:w-9";
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 md:flex md:items-center md:gap-4 md:space-y-0 md:rounded-xl">
      <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 md:w-64 md:shrink-0">
        <button
          type="button"
          aria-label="Previous month"
          className={arrow}
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setMonth("")}
          title="Show all months"
          className="flex min-w-0 flex-1 items-center justify-center gap-2 text-sm font-semibold text-slate-800"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-orange-500" />
          <span className="truncate">{monthLabel(month)}</span>
        </button>
        <button
          type="button"
          aria-label="Next month"
          className={arrow}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="-mx-3 flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto px-3 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
        {STATUS_CHIPS.map(([value, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
            className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium md:min-h-[32px] ${
              status === value
                ? "border-[#0B1830] bg-[#0B1830] text-white"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
        {active && (
          <button
            type="button"
            onClick={() => {
              setMonth("");
              setStatus("");
            }}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold text-orange-600 md:min-h-[32px]"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}

export function AttendanceTab({ id }) {
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("");
  const state = useLoad(
    () => resignationService.attendance(id, { month, status }),
    [id, month, status],
  );

  return (
    <div className="min-w-0 space-y-4">
      <AttendanceFilters
        month={month}
        status={status}
        setMonth={setMonth}
        setStatus={setStatus}
      />
      <TabState state={state}>
        {({ summary: s, monthly, records }) => (
          <>
            <div className="-mx-3 flex flex-nowrap gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
              {[
                ["Days present", s.present_days],
                ["Absent days", s.absent_days],
                ["Late marks", s.late_marks],
                ["Overtime hours", s.overtime_hours],
                ["Avg hours / day", s.avg_hours_per_day],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="min-w-[132px] shrink-0 rounded-2xl border border-slate-200 bg-white p-4 md:min-w-0 md:rounded-xl"
                >
                  <div className="text-2xl font-semibold text-slate-800">
                    {value}
                  </div>
                  <div className="whitespace-nowrap text-xs text-slate-500">
                    {label}
                  </div>
                </div>
              ))}
            </div>

            <Card title="Daily records">
              <Table
                rows={records}
                rowKey={(r) => r.attendance_date}
                empty="No attendance records."
                scroll="max-h-[380px]"
                mobileRow={(r) => {
                  const [dd, mon] = fmtDate(r.attendance_date).split(" ");
                  return (
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-100">
                        <span className="text-base font-semibold leading-none text-slate-800">
                          {dd}
                        </span>
                        <span className="mt-0.5 text-[10px] uppercase text-slate-500">
                          {mon}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-800">
                          {fmtTime(r.check_in_time)} →{" "}
                          {fmtTime(r.check_out_time)}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-500">
                          <span>{hours(r.working_minutes)}</span>
                          {r.late_minutes ? (
                            <span className="text-orange-600">
                              Late {r.late_minutes}m
                            </span>
                          ) : null}
                          {r.overtime_minutes ? (
                            <span>OT {hours(r.overtime_minutes)}</span>
                          ) : null}
                        </div>
                      </div>
                      <Tag color={statusColor(r.status)}>{r.status || "—"}</Tag>
                    </div>
                  );
                }}
                columns={[
                  { header: "Date", render: (r) => fmtDate(r.attendance_date) },
                  {
                    header: "Check in",
                    render: (r) => fmtTime(r.check_in_time),
                  },
                  {
                    header: "Check out",
                    render: (r) => fmtTime(r.check_out_time),
                  },
                  { header: "Hours", render: (r) => hours(r.working_minutes) },
                  {
                    header: "Late (min)",
                    render: (r) => r.late_minutes || "—",
                  },
                  { header: "OT", render: (r) => hours(r.overtime_minutes) },
                  {
                    header: "Status",
                    render: (r) => (
                      <Tag color={statusColor(r.status)}>{r.status || "—"}</Tag>
                    ),
                  },
                ]}
              />
            </Card>

            <Card title="Month wise summary">
              <Table
                rows={monthly}
                rowKey={(r) => r.month}
                scroll="max-h-[300px]"
                mobileRow={(r) => (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-800">
                      {r.month}
                    </span>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Tag color="green">P {r.present}</Tag>
                      <Tag color="red">A {r.absent}</Tag>
                      <Tag color="orange">L {r.late}</Tag>
                      <Tag>OT {r.ot_hours}h</Tag>
                    </div>
                  </div>
                )}
                columns={[
                  { header: "Month", render: (r) => r.month },
                  { header: "Days present", render: (r) => r.present },
                  { header: "Absent", render: (r) => r.absent },
                  { header: "Late", render: (r) => r.late },
                  { header: "OT hours", render: (r) => r.ot_hours },
                ]}
              />
            </Card>
          </>
        )}
      </TabState>
    </div>
  );
}

// ---------------------------------------------------------------------
// Leaves
// ---------------------------------------------------------------------

function LeaveBalanceCards({ rows }) {
  if (!rows.length)
    return (
      <p className="py-6 text-center text-[13px] text-slate-400 md:hidden">
        No leave balances.
      </p>
    );
  return (
    <div className="-mx-4 flex flex-nowrap gap-3 overflow-x-auto px-4 pb-1 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {rows.map((b) => {
        const total = Number(b.total_days) || 0;
        const used = Number(b.used_days) || 0;
        const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
        return (
          <div
            key={b.leave_types?.leave_name}
            className="w-[170px] shrink-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5"
          >
            <div className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {b.leave_types?.leave_name || "—"}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-slate-800">
                {b.remaining_days}
              </span>
              <span className="text-xs text-slate-500">left</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[#F5730B]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1.5 text-xs text-slate-500">
              Used {b.used_days} of {b.total_days}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LeavesTab({ id }) {
  const state = useLoad(() => resignationService.leaves(id), [id]);
  return (
    <TabState state={state}>
      {({ balances, requests }) => {
        const latestYear = balances[0]?.year;
        const current = balances.filter((b) => b.year === latestYear);
        return (
          <div className="min-w-0 space-y-4">
            <Card
              title={`Leave balance${latestYear ? ` (${latestYear})` : ""}`}
            >
              <LeaveBalanceCards rows={current} />
              <div className="hidden md:block">
                <Table
                  rows={current}
                  rowKey={(r) => r.leave_types?.leave_name}
                  empty="No leave balances."
                  columns={[
                    {
                      header: "Leave type",
                      render: (r) => r.leave_types?.leave_name || "—",
                    },
                    { header: "Entitled", render: (r) => r.total_days },
                    { header: "Used", render: (r) => r.used_days },
                    {
                      header: "Balance",
                      render: (r) => <b>{r.remaining_days}</b>,
                    },
                  ]}
                />
              </div>
            </Card>
            <Card title="Leave history">
              <Table
                rows={requests}
                empty="No leave requests."
                scroll="max-h-[420px]"
                mobileRow={(r) => (
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        {r.leave_types?.leave_name || "—"}
                      </span>
                      <Tag color={statusColor(r.status)}>{r.status}</Tag>
                    </div>
                    <div className="text-[13px] text-slate-600">
                      {fmtDate(r.start_date)} – {fmtDate(r.end_date)} ·{" "}
                      {r.total_days}{" "}
                      {Number(r.total_days) === 1 ? "day" : "days"}
                    </div>
                    {r.reason && (
                      <div className="text-xs text-slate-500">{r.reason}</div>
                    )}
                    {r.approved_by_name && (
                      <div className="text-xs text-slate-400">
                        Approved by {r.approved_by_name}
                      </div>
                    )}
                  </div>
                )}
                columns={[
                  {
                    header: "Type",
                    render: (r) => r.leave_types?.leave_name || "—",
                  },
                  { header: "From", render: (r) => fmtDate(r.start_date) },
                  { header: "To", render: (r) => fmtDate(r.end_date) },
                  { header: "Days", render: (r) => r.total_days },
                  { header: "Reason", render: (r) => r.reason || "—" },
                  {
                    header: "Status",
                    render: (r) => (
                      <Tag color={statusColor(r.status)}>{r.status}</Tag>
                    ),
                  },
                  {
                    header: "Approved by",
                    render: (r) => r.approved_by_name || "—",
                  },
                ]}
              />
            </Card>
          </div>
        );
      }}
    </TabState>
  );
}

// ---------------------------------------------------------------------
// Payroll
// ---------------------------------------------------------------------

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function PayrollTab({ id }) {
  const state = useLoad(() => resignationService.payroll(id), [id]);
  return (
    <TabState state={state}>
      {({ records, totals }) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["Payslips", totals.payslips],
              ["Total net salary paid", money(totals.total_net)],
              ["Total overtime paid", money(totals.total_overtime)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="text-2xl font-semibold text-slate-800">
                  {value}
                </div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>
          <Card title="Payslip history">
            <Table
              rows={records}
              empty="No payroll records."
              columns={[
                {
                  header: "Month",
                  render: (r) =>
                    `${MONTHS[r.payroll_month - 1]} ${r.payroll_year}`,
                },
                { header: "Basic", render: (r) => money(r.basic_salary) },
                { header: "Allowance", render: (r) => money(r.allowance) },
                { header: "Overtime", render: (r) => money(r.overtime_amount) },
                {
                  header: "Deductions",
                  render: (r) =>
                    money(
                      Number(r.deduction || 0) +
                        Number(r.leave_deduction || 0) +
                        Number(r.tax || 0),
                    ),
                },
                {
                  header: "Net pay",
                  render: (r) => <b>{money(r.net_salary)}</b>,
                },
                {
                  header: "Status",
                  render: (r) => (
                    <Tag color={statusColor(r.payment_status)}>
                      {r.payment_status}
                    </Tag>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      )}
    </TabState>
  );
}

// ---------------------------------------------------------------------
// Documents (view only: nothing can be deleted from this page)
// ---------------------------------------------------------------------

export function DocumentsTab({ id }) {
  const state = useLoad(() => resignationService.documents(id), [id]);
  return (
    <TabState state={state}>
      {(docs) => (
        <Card title="Employee documents">
          <Table
            rows={docs}
            empty="No documents uploaded."
            columns={[
              { header: "Document", render: (r) => r.document_name },
              { header: "Type", render: (r) => r.document_type },
              { header: "Uploaded on", render: (r) => fmtDate(r.created_at) },
              { header: "Expiry", render: (r) => fmtDate(r.expiry_date) },
              {
                header: "",
                render: (r) => (
                  <a
                    href={r.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-orange-600 hover:underline"
                  >
                    View <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ),
              },
            ]}
          />
        </Card>
      )}
    </TabState>
  );
}

// ---------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------

export function AuditTab({ id }) {
  const state = useLoad(() => resignationService.auditTrail(id), [id]);
  return (
    <TabState state={state}>
      {(rows) => (
        <Card title="Audit trail">
          <Table
            rows={rows}
            empty="No audit entries."
            columns={[
              {
                header: "Date and time",
                render: (r) => fmtDateTime(r.created_at),
              },
              { header: "Module", render: (r) => r.module },
              {
                header: "Action",
                render: (r) => <Tag color="blue">{r.action}</Tag>,
              },
              { header: "Details", render: (r) => r.message || "—" },
              { header: "Done by", render: (r) => r.performed_by || "System" },
              { header: "IP address", render: (r) => r.ip_address || "—" },
            ]}
          />
        </Card>
      )}
    </TabState>
  );
}
