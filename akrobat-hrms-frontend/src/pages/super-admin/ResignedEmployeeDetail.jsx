import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

const DETAILS_TAB = ["details", "Details"];

function useIsMobile() {
  const q = "(max-width: 767px)";
  const [m, setM] = useState(
    () => typeof window !== "undefined" && window.matchMedia(q).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

export default function ResignedEmployeeDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();
  const visibleTabs = isMobile ? [DETAILS_TAB, ...TABS] : TABS;
  const tab = visibleTabs.some(([k]) => k === params.get("tab"))
    ? params.get("tab")
    : isMobile
      ? "details"
      : "exit";

  const state = useLoad(() => resignationService.get(id), [id]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const tabListRef = useRef(null);

  // Keep the active tab visible in the scrollable mobile tab bar.
  useEffect(() => {
    tabListRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView?.({ inline: "center", block: "nearest" });
  }, [tab]);

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

  // Switching tab scrolls the page up so the tab bar sits at the top and the
  // new tab's content is in view (instead of staying scrolled at the header).
  function selectTab(key) {
    setParams({ tab: key }, { replace: true });
    requestAnimationFrame(() =>
      tabListRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      }),
    );
  }

  const short = (d) => fmtDate(d).slice(0, 6);
  const actionButtons = serving && (
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
  );

  return (
    <div className="flex min-w-0 flex-col gap-4 md:block md:space-y-5">
      {/* Mobile: navy hero + overlapping stats */}
      <div className="md:hidden">
        <div className="rounded-2xl bg-[#0B1830] px-4 pb-10 pt-4 text-white">
          <Link
            to="/super-admin/resigned-employees"
            className="inline-flex min-h-[32px] items-center gap-1.5 text-[13px] font-medium text-white/70"
          >
            <ArrowLeft className="h-4 w-4" /> Resigned Employees
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F5730B] text-base font-semibold">
              {initials(emp.full_name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-lg font-bold leading-tight !text-white">
                  {emp.full_name}
                </h1>
                <Tag color={statusColor(r.status)}>{r.status}</Tag>
              </div>
              <p className="text-[13px] text-white/70">
                {emp.employee_id} · {snap.designation || "—"} ·{" "}
                {snap.department || "—"}
              </p>
            </div>
          </div>
        </div>
        <div className="relative z-10 mx-3 -mt-7 grid grid-cols-3 divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-white py-3 shadow-sm">
          <HeroStat label="Last day" value={short(r.last_working_day)} />
          <HeroStat
            label="Notice"
            value={`${r.notice_period_days ?? 0} days`}
          />
          {serving ? (
            <HeroStat
              label="Days left"
              value={r.notice_days_remaining ?? "—"}
            />
          ) : (
            <HeroStat label="Relieved" value={short(r.relieved_at)} />
          )}
        </div>
        {serving && (
          <div className="mt-3 grid grid-cols-2 gap-2">{actionButtons}</div>
        )}
      </div>

      {/* Desktop header */}
      <div className="hidden space-y-5 md:block">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/super-admin/resigned-employees"
              aria-label="Back to Resigned Employees"
              title="Back to Resigned Employees"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200/70 hover:text-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#0B1830] text-lg font-semibold text-white">
              {initials(emp.full_name)}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-800">
                  {emp.full_name}
                </h1>
                <Tag color={statusColor(r.status)}>{r.status}</Tag>
              </div>
              <p className="text-sm text-slate-500">
                {emp.employee_id} · {snap.designation || "—"} ·{" "}
                {snap.department || "—"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {actionButtons}
          </div>
        </div>
      </div>

      {actionError && <ErrorBox message={actionError} />}

      <ResignationDetails
        id={id}
        r={r}
        snap={snap}
        onSaved={state.reload}
        showMobile={tab === "details"}
      />

      <div
        role="tablist"
        ref={tabListRef}
        className="scroll-mt-20 md:scroll-mt-15 sticky top-16 z-10 order-1 -mx-3 flex flex-nowrap gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 [scrollbar-width:none] md:static md:z-auto md:order-none md:mx-0 md:bg-transparent md:px-0 lg:flex-wrap lg:overflow-visible [&::-webkit-scrollbar]:hidden"
      >
        {visibleTabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => selectTab(key)}
            className={`-mb-px min-h-[44px] shrink-0 whitespace-nowrap border-b-2 px-3 text-sm font-medium md:px-4 ${
              tab === key
                ? "border-orange-500 font-semibold text-orange-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== "details" && (
        <div className="order-3 min-h-[calc(100vh-6rem)] min-w-0 md:order-none">
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
      )}
    </div>
  );
}

function HeroStat({ label, value }) {
  return (
    <div className="min-w-0 px-2 text-center">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="truncate text-sm font-semibold text-slate-800">
        {value}
      </div>
    </div>
  );
}

function MRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-slate-100 py-2.5 text-sm first:border-t-0 first:pt-0 last:pb-0">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-slate-800">
        {children === undefined || children === null || children === ""
          ? "—"
          : children}
      </span>
    </div>
  );
}

function MGroup({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-[15px] font-semibold text-slate-800">{title}</h3>
      {children}
    </section>
  );
}

function ResignationDetails({ id, r, snap, onSaved, showMobile }) {
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

  const recordedBy = r.accepted_by_name
    ? `${r.accepted_by_name}, ${fmtDate(r.accepted_at)}`
    : fmtDate(r.accepted_at);

  const mobileView = (
    <div className="order-2 space-y-3 md:hidden">
      <MGroup title="Resignation">
        <MRow label="Submitted on">{fmtDate(r.resignation_date)}</MRow>
        <MRow label="Last working day">{fmtDate(r.last_working_day)}</MRow>
        <MRow label="Notice period">
          {r.notice_period_days} days
          {r.status === "Serving Notice"
            ? ` (${r.notice_days_remaining} left)`
            : ""}
        </MRow>
        <MRow label="Reason">{r.reason_category}</MRow>
        <MRow label="Joined">{fmtDate(snap.joining_date)}</MRow>
        <MRow label="Relieved on">{fmtDate(r.relieved_at)}</MRow>
      </MGroup>
      <MGroup title="People">
        <MRow label="Reporting manager">{snap.manager}</MRow>
        <MRow label="Recorded by">{recordedBy}</MRow>
        <MRow label="Eligible for rehire">{rehire || "Not decided"}</MRow>
      </MGroup>
      <MGroup title="Remarks">
        <div className="space-y-3">
          <Field label="Employee remarks">{r.reason_remarks}</Field>
          <Field label="Super Admin remarks (private)">{r.admin_remarks}</Field>
        </div>
      </MGroup>
      <button className={`${btnGhost} w-full`} onClick={startEdit}>
        Edit resignation details
      </button>
    </div>
  );

  const card = (
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

  if (editing)
    return (
      <div className={showMobile ? "order-2" : "hidden md:block"}>{card}</div>
    );
  return (
    <>
      {showMobile && mobileView}
      <div className="hidden md:block">{card}</div>
    </>
  );
}
