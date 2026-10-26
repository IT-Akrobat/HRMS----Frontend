import { ArrowLeft, Lock } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import DatePicker from "../../components/layout/DatePicker";
import {
    REASON_CATEGORIES,
    resignationService,
} from "../../services/resignationService";
import {
    AttendanceTab,
    AuditTab,
    DocumentsTab,
    ExitTab,
    LeavesTab,
    PayrollTab,
    ProfileTab,
} from "./resigned/tabs";
import {
    Card,
    ErrorBox,
    Field,
    FieldGrid,
    Select,
    Spinner,
    Tag,
    btnGhost,
    btnPrimary,
    fmtDate,
    initials,
    inputCls,
    statusColor,
    useLoad,
} from "./resigned/ui";

const TABS = [
  ["exit", "Exit & settlement"],
  ["profile", "Profile"],
  ["attendance", "Attendance"],
  ["leaves", "Leaves"],
  ["payroll", "Payroll"],
  ["documents", "Documents"],
  ["audit", "Audit trail"],
];

export default function ResignedEmployeeDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get("tab"))
    ? params.get("tab")
    : "exit";

  const state = useLoad(() => resignationService.get(id), [id]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  if (state.loading && !state.data) return <Spinner />;
  if (state.error)
    return <ErrorBox message={state.error} onRetry={state.reload} />;

  const r = state.data;
  const emp = r.employee || {};
  const snap = r.snapshot || {};
  const serving = r.status === "Serving Notice";

  async function act(fn, confirmText) {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setActionError("");
    try {
      await fn(id);
      state.reload();
    } catch (e) {
      setActionError(e?.message || "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link
        to="/super-admin/resigned-employees"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Resigned Employees
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#0B1830] text-lg font-semibold text-white">
            {initials(emp.full_name)}
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {emp.full_name}
            </h1>
            <p className="text-sm text-slate-500">
              {emp.employee_id} · {snap.designation || "—"} ·{" "}
              {snap.department || "—"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tag color={statusColor(r.status)}>{r.status}</Tag>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800">
            <Lock className="h-3.5 w-3.5" /> Super Admin only
          </span>
          {serving && (
            <>
              <button
                className={btnGhost}
                disabled={busy}
                onClick={() =>
                  act(
                    resignationService.withdraw,
                    "Withdraw this resignation? The employee stays active.",
                  )
                }
              >
                Withdraw resignation
              </button>
              <button
                className={btnPrimary}
                disabled={busy}
                onClick={() =>
                  act(
                    resignationService.relieve,
                    "Relieve now? Login is disabled immediately and the employee moves to the archive.",
                  )
                }
              >
                Relieve now
              </button>
            </>
          )}
        </div>
      </div>

      {actionError && <ErrorBox message={actionError} />}

      <ResignationDetails id={id} r={r} snap={snap} onSaved={state.reload} />

      <div
        role="tablist"
        className="flex flex-wrap gap-1 border-b border-slate-200"
      >
        {TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setParams({ tab: key }, { replace: true })}
            className={`-mb-px min-h-[44px] border-b-2 px-4 text-sm font-medium ${
              tab === key
                ? "border-orange-500 font-semibold text-orange-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "exit" && (
        <ExitTab id={id} resignation={r} onChanged={state.reload} />
      )}
      {tab === "profile" && <ProfileTab id={id} />}
      {tab === "attendance" && <AttendanceTab id={id} />}
      {tab === "leaves" && <LeavesTab id={id} />}
      {tab === "payroll" && <PayrollTab id={id} />}
      {tab === "documents" && <DocumentsTab id={id} />}
      {tab === "audit" && <AuditTab id={id} />}
    </div>
  );
}

function ResignationDetails({ id, r, snap, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({});

  const rehire =
    r.eligible_for_rehire === true
      ? "Yes"
      : r.eligible_for_rehire === false
        ? "No"
        : "";

  function startEdit() {
    setForm({
      last_working_day: r.last_working_day,
      reason_category: r.reason_category,
      reason_remarks: r.reason_remarks || "",
      admin_remarks: r.admin_remarks || "",
      eligible_for_rehire: rehire,
    });
    setError("");
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const body = {
        reason_category: form.reason_category,
        reason_remarks: form.reason_remarks,
        admin_remarks: form.admin_remarks,
        eligible_for_rehire:
          form.eligible_for_rehire === ""
            ? null
            : form.eligible_for_rehire === "Yes",
      };
      if (r.status === "Serving Notice")
        body.last_working_day = form.last_working_day;
      await resignationService.update(id, body);
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(e?.message || "Unable to save.");
    } finally {
      setSaving(false);
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Card
      title="Resignation details"
      actions={
        editing ? (
          <div className="flex gap-2">
            <button className={btnGhost} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className={btnPrimary} onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <button className={btnGhost} onClick={startEdit}>
            Edit
          </button>
        )
      }
    >
      {error && (
        <div className="mb-3">
          <ErrorBox message={error} />
        </div>
      )}

      {editing ? (
        <div className="grid gap-3 md:grid-cols-2">
          {r.status === "Serving Notice" && (
            <DatePicker
              label="Last working day"
              portal
              sheetOnMobile
              sheetTitle="Last working day"
              min={r.resignation_date}
              value={form.last_working_day}
              onChange={(iso) =>
                setForm((f) => ({ ...f, last_working_day: iso }))
              }
            />
          )}
          <label className="text-xs text-slate-500">
            Reason
            <Select
              value={form.reason_category}
              onChange={set("reason_category")}
            >
              {[...new Set([form.reason_category, ...REASON_CATEGORIES])].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </Select>
          </label>
          <label className="text-xs text-slate-500">
            Eligible for rehire
            <Select
              value={form.eligible_for_rehire}
              onChange={set("eligible_for_rehire")}
            >
              <option value="">Not decided</option>
              <option>Yes</option>
              <option>No</option>
            </Select>
          </label>
          <label className="text-xs text-slate-500 md:col-span-2">
            Employee remarks
            <textarea
              rows={3}
              className={inputCls}
              value={form.reason_remarks}
              onChange={set("reason_remarks")}
            />
          </label>
          <label className="text-xs text-slate-500 md:col-span-2">
            Super Admin remarks (private)
            <textarea
              rows={3}
              className={inputCls}
              value={form.admin_remarks}
              onChange={set("admin_remarks")}
            />
          </label>
        </div>
      ) : (
        <>
          <FieldGrid>
            <Field label="Resignation submitted on">
              {fmtDate(r.resignation_date)}
            </Field>
            <Field label="Last working day">
              {fmtDate(r.last_working_day)}
            </Field>
            <Field label="Notice period">
              {r.notice_period_days} days
              {r.status === "Serving Notice"
                ? ` (${r.notice_days_remaining} remaining)`
                : ""}
            </Field>
            <Field label="Reason">{r.reason_category}</Field>
            <Field label="Reporting manager">{snap.manager}</Field>
            <Field label="Recorded by">
              {r.accepted_by_name
                ? `${r.accepted_by_name}, ${fmtDate(r.accepted_at)}`
                : fmtDate(r.accepted_at)}
            </Field>
            <Field label="Joined">{fmtDate(snap.joining_date)}</Field>
            <Field label="Relieved on">{fmtDate(r.relieved_at)}</Field>
            <Field label="Eligible for rehire">{rehire || "Not decided"}</Field>
          </FieldGrid>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Employee remarks">{r.reason_remarks}</Field>
            <Field label="Super Admin remarks (private)">
              {r.admin_remarks}
            </Field>
          </div>
        </>
      )}
    </Card>
  );
}
