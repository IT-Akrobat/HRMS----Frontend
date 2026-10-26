import { ExternalLink } from "lucide-react";
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
    btnGhost,
    btnPrimary,
    fmtDate,
    fmtDateTime,
    fmtTime,
    hours,
    inputCls,
    money,
    statusColor,
    useLoad,
} from "./ui";

// First non-empty value among several possible column names. Personal /
// bank / statutory columns differ between deployments, so the Profile tab
// tries the likely names instead of hard-coding one.
const pick = (obj, ...keys) => {
  for (const k of keys) if (obj?.[k]) return obj[k];
  return "";
};

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
    <div className="grid gap-4 lg:grid-cols-2">
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
        <div className="grid gap-3 sm:grid-cols-2">
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
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Personal information">
              <FieldGrid>
                <Field label="Full name">{e.full_name}</Field>
                <Field label="Date of birth">
                  {fmtDate(pick(e, "date_of_birth", "dob"))}
                </Field>
                <Field label="Gender">{e.gender}</Field>
                <Field label="Blood group">{e.blood_group}</Field>
                <Field label="Phone">{e.phone}</Field>
                <Field label="Personal email">
                  {pick(e, "personal_email")}
                </Field>
                <Field label="Current address">
                  {pick(e, "current_address", "address")}
                </Field>
                <Field label="Permanent address">{e.permanent_address}</Field>
              </FieldGrid>
            </Card>
            <Card title="Employment information">
              <FieldGrid>
                <Field label="Employee ID">{e.employee_id}</Field>
                <Field label="Company email">{e.email}</Field>
                <Field label="Department">
                  {e.departments?.department_name}
                </Field>
                <Field label="Designation">
                  {e.designations?.designation_name}
                </Field>
                <Field label="Reporting manager">{e.manager_name}</Field>
                <Field label="Joining date">{fmtDate(e.joining_date)}</Field>
                <Field label="Shift">{e.shifts?.shift_name}</Field>
                <Field label="Work location">{e.work_location}</Field>
                <Field label="Status">{e.employment_status}</Field>
              </FieldGrid>
            </Card>
          </div>

          <Card title="Site assignment history">
            <Table
              rows={site_assignments}
              empty="No site assignments."
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

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Bank and statutory">
              <FieldGrid>
                <Field label="Bank">{pick(e, "bank_name")}</Field>
                <Field label="Account number">
                  {mask(pick(e, "bank_account_number", "account_number"))}
                </Field>
                <Field label="IFSC / bank code">
                  {pick(e, "ifsc_code", "bank_code")}
                </Field>
                <Field label="PAN / tax ID">
                  {mask(pick(e, "pan_number", "pan", "tax_id"))}
                </Field>
                <Field label="UAN / CPF / PF">
                  {pick(e, "uan", "pf_number", "cpf_number")}
                </Field>
                <Field label="ESI number">{pick(e, "esi_number")}</Field>
              </FieldGrid>
            </Card>
            <Card title="Emergency contacts">
              <Table
                rows={emergency_contacts}
                empty="No emergency contacts."
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

export function AttendanceTab({ id }) {
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("");
  const state = useLoad(
    () => resignationService.attendance(id, { month, status }),
    [id, month, status],
  );

  return (
    <div className="space-y-4">
      <TabState state={state}>
        {({ summary: s, monthly, records }) => (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                ["Days present", s.present_days],
                ["Absent days", s.absent_days],
                ["Late marks", s.late_marks],
                ["Overtime hours", s.overtime_hours],
                ["Avg hours / day", s.avg_hours_per_day],
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

            <Card
              title="Daily records"
              actions={
                <div className="flex flex-wrap gap-2">
                  <input
                    type="month"
                    aria-label="Month"
                    className="w-auto"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                  <Select
                    aria-label="Status"
                    className="w-auto"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    <option>Present</option>
                    <option>Absent</option>
                    <option>Late</option>
                    <option>On Leave</option>
                  </Select>
                  {(month || status) && (
                    <button
                      className={btnGhost}
                      onClick={() => {
                        setMonth("");
                        setStatus("");
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              }
            >
              <Table
                rows={records}
                rowKey={(r) => r.attendance_date}
                empty="No attendance records."
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

export function LeavesTab({ id }) {
  const state = useLoad(() => resignationService.leaves(id), [id]);
  return (
    <TabState state={state}>
      {({ balances, requests }) => {
        const latestYear = balances[0]?.year;
        const current = balances.filter((b) => b.year === latestYear);
        return (
          <div className="space-y-4">
            <Card
              title={`Leave balance${latestYear ? ` (${latestYear})` : ""}`}
            >
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
            </Card>
            <Card title="Leave history">
              <Table
                rows={requests}
                empty="No leave requests."
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
