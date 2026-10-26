import {
    CalendarDays,
    Clock,
    Download,
    Lock,
    Search,
    UserMinus,
    Wallet,
    X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx-js-style";
import PageHeader from "../../components/common/PageHeader";
import SelectDropdown from "../../components/common/SelectDropdown";
import StatCard from "../../components/common/StatCard";
import DatePicker from "../../components/layout/DatePicker";
import { apiClient } from "../../services/apiClient";
import {
    REASON_CATEGORIES,
    resignationService,
} from "../../services/resignationService";
import { toLocalISODate } from "../../utils/date";
import { unwrap } from "../../utils/unwrap";
import {
    ErrorBox,
    Spinner,
    Table,
    Tag,
    btnGhost,
    btnPrimary,
    fmtDate,
    initials,
    inputCls,
    statusColor,
} from "./resigned/ui";

const STATUS_OPTIONS = ["Serving Notice", "Relieved"];

export default function ResignedEmployees() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [year, setYear] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(
        await resignationService.list({ search, department, status, year }),
      );
    } catch (e) {
      setError(e?.message || "Unable to load resigned employees.");
    } finally {
      setLoading(false);
    }
  }

  // Debounced so typing in the search box doesn't fire a request per key.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, department, status, year]);

  const items = data?.items || [];
  const stats = data?.stats;
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => now - i);
  }, []);

  function exportExcel() {
    const rows = [
      [
        "Employee ID",
        "Name",
        "Department",
        "Designation",
        "Resignation date",
        "Last working day",
        "Reason",
        "Status",
        "Settlement",
      ],
      ...items.map((r) => [
        r.employee?.employee_id,
        r.employee?.full_name,
        r.snapshot?.department,
        r.snapshot?.designation,
        fmtDate(r.resignation_date),
        fmtDate(r.last_working_day),
        r.reason_category,
        r.status,
        r.settlement_status,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resigned Employees");
    XLSX.writeFile(wb, `resigned-employees-${toLocalISODate()}.xlsx`);
  }

  const open = (r) =>
    navigate(`/super-admin/resigned-employees/${r.employee_id}`);

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-clip">
      <PageHeader
        title="Resigned Employees"
        subtitle={
          <span className="hidden sm:inline">
            Archived records of employees who have left the company.
          </span>
        }
        actionsInline
        actions={
          <>
            <span className="hidden items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800 sm:inline-flex">
              <Lock className="h-3.5 w-3.5" /> Super Admin only
            </span>
            <button className={btnPrimary} onClick={() => setShowModal(true)}>
              <UserMinus className="h-4 w-4" /> Mark as resigned
            </button>
          </>
        }
      />

      <div className="-mx-3 mb-4 flex gap-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0 [&>*]:min-w-[150px] [&>*]:shrink-0 lg:[&>*]:min-w-0">
        <StatCard
          compact
          icon={UserMinus}
          label="Total resigned"
          value={stats?.total ?? "—"}
          loading={loading && !data}
        />
        <StatCard
          compact
          icon={Clock}
          label="Serving notice"
          value={stats?.serving_notice ?? "—"}
          color="blue"
          loading={loading && !data}
        />
        <StatCard
          compact
          icon={CalendarDays}
          label="Resigned this year"
          value={stats?.this_year ?? "—"}
          loading={loading && !data}
        />
        <StatCard
          compact
          icon={Wallet}
          label="Settlement pending"
          value={stats?.settlement_pending ?? "—"}
          color="blue"
          loading={loading && !data}
        />
      </div>

      <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
        <div className="mb-4 space-y-3 sm:flex sm:flex-wrap sm:items-center sm:gap-3 sm:space-y-0">
          <div className="flex items-center gap-2 sm:contents">
            <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className={`${inputCls} pl-9`}
                placeholder="Search by name, employee ID or email"
                aria-label="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <SelectDropdown
              className="w-[140px] shrink-0 sm:w-48"
              triggerClassName="min-h-[36px] text-[13px]"
              value={department}
              onChange={setDepartment}
              options={[
                { value: "", label: "All departments" },
                ...(data?.departments || []).map((d) => ({
                  value: d,
                  label: d,
                })),
              ]}
            />
          </div>
          <div className="flex items-center gap-2 sm:contents">
            <SelectDropdown
              className="min-w-0 flex-1 sm:w-40 sm:flex-none"
              triggerClassName="min-h-[36px] text-[13px]"
              value={status}
              onChange={setStatus}
              options={[
                { value: "", label: "All statuses" },
                ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
              ]}
            />
            <SelectDropdown
              className="min-w-0 flex-1 sm:w-32 sm:flex-none"
              triggerClassName="min-h-[36px] text-[13px]"
              value={year}
              onChange={setYear}
              options={[
                { value: "", label: "All years" },
                ...years.map((y) => ({ value: String(y), label: String(y) })),
              ]}
            />
            <button
              className={`${btnGhost} shrink-0 !px-2.5 sm:!px-3.5`}
              onClick={exportExcel}
              disabled={!items.length}
              aria-label="Export Excel"
              title="Export Excel"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>
          </div>
        </div>

        {error ? (
          <ErrorBox message={error} onRetry={load} />
        ) : loading && !data ? (
          <Spinner />
        ) : (
          <>
            <div className="space-y-2.5 md:hidden">
              {items.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-slate-400">
                  No resigned employees found.
                </div>
              ) : (
                items.map((r) => (
                  <div
                    key={r.id ?? r.employee_id}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B1830] text-xs font-semibold text-white">
                        {initials(r.employee?.full_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-800">
                          {r.employee?.full_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {r.employee?.employee_id}
                        </div>
                      </div>
                      <Tag color={statusColor(r.status)}>{r.status}</Tag>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div className="min-w-0">
                        <div className="text-slate-400">Department</div>
                        <div className="truncate font-medium text-slate-700">
                          {r.snapshot?.department || "—"}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-slate-400">Designation</div>
                        <div className="truncate font-medium text-slate-700">
                          {r.snapshot?.designation || "—"}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-slate-400">Resigned on</div>
                        <div className="font-medium text-slate-700">
                          {fmtDate(r.resignation_date)}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-slate-400">Last working day</div>
                        <div className="font-medium text-slate-700">
                          {fmtDate(r.last_working_day)}
                        </div>
                      </div>
                      <div className="col-span-2 min-w-0">
                        <div className="text-slate-400">Reason</div>
                        <div className="truncate font-medium text-slate-700">
                          {r.reason_category || "—"}
                        </div>
                      </div>
                    </div>
                    <button
                      className={`${btnGhost} mt-3 w-full`}
                      onClick={() => open(r)}
                    >
                      View record
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="hidden md:block">
              <Table
                rows={items}
                empty="No resigned employees found."
                columns={[
                  {
                    header: "Employee",
                    render: (r) => (
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B1830] text-xs font-semibold text-white">
                          {initials(r.employee?.full_name)}
                        </span>
                        <div>
                          <div className="font-medium text-slate-800">
                            {r.employee?.full_name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {r.employee?.employee_id}
                          </div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    header: "Department",
                    render: (r) => r.snapshot?.department || "—",
                  },
                  {
                    header: "Designation",
                    render: (r) => r.snapshot?.designation || "—",
                  },
                  {
                    header: "Resigned on",
                    render: (r) => fmtDate(r.resignation_date),
                  },
                  {
                    header: "Last working day",
                    render: (r) => fmtDate(r.last_working_day),
                  },
                  { header: "Reason", render: (r) => r.reason_category },
                  {
                    header: "Status",
                    render: (r) => (
                      <Tag color={statusColor(r.status)}>{r.status}</Tag>
                    ),
                  },
                  {
                    header: "",
                    render: (r) => (
                      <button className={btnGhost} onClick={() => open(r)}>
                        View record
                      </button>
                    ),
                  },
                ]}
              />
            </div>
          </>
        )}

        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
          Once relieved, an employee can no longer log in and disappears from
          Employees, attendance, payroll and leave lists. Their data stays here
          for audit and reference.
        </p>
      </div>

      {showModal && (
        <MarkResignedModal
          existingIds={items.map((r) => r.employee_id)}
          onClose={() => setShowModal(false)}
          onCreated={(row) => {
            setShowModal(false);
            navigate(`/super-admin/resigned-employees/${row.employee_id}`);
          }}
        />
      )}
    </div>
  );
}

function MarkResignedModal({ existingIds, onClose, onCreated }) {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({
    employee_id: "",
    resignation_date: toLocalISODate(),
    last_working_day: "",
    reason_category: REASON_CATEGORIES[0],
    reason_remarks: "",
    admin_remarks: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient
      .get("/employees/")
      .then((res) => setEmployees(unwrap(res) || []))
      .catch(() => setError("Unable to load employees."));
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const choices = employees.filter(
    (e) => e.employment_status !== "Resigned" && !existingIds.includes(e.id),
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.employee_id || !form.last_working_day) {
      setError("Select an employee and a last working day.");
      return;
    }
    setSaving(true);
    try {
      const row = await resignationService.create({
        ...form,
        reason_remarks: form.reason_remarks || null,
        admin_remarks: form.admin_remarks || null,
      });
      onCreated(row);
    } catch (err) {
      setError(err?.message || "Unable to record resignation.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Mark employee as resigned"
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Mark as resigned
            </h2>
            <p className="text-sm text-slate-500">
              Access stays active until the last working day.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block text-xs text-slate-500">
            Employee
            <SelectDropdown
              className="mt-1"
              triggerClassName="min-h-[36px] text-[13px]"
              searchable
              searchPlaceholder="Search employee..."
              placeholder="Select employee"
              value={form.employee_id}
              onChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}
              options={choices.map((e) => ({
                value: e.id,
                label: `${e.full_name} (${e.employee_id})`,
              }))}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <DatePicker
              label="Resignation date"
              required
              portal
              sheetOnMobile
              sheetTitle="Resignation date"
              value={form.resignation_date}
              onChange={(iso) =>
                setForm((f) => ({
                  ...f,
                  resignation_date: iso,
                  last_working_day:
                    f.last_working_day && f.last_working_day < iso
                      ? ""
                      : f.last_working_day,
                }))
              }
            />
            <DatePicker
              label="Last working day"
              required
              portal
              sheetOnMobile
              sheetTitle="Last working day"
              min={form.resignation_date}
              value={form.last_working_day}
              onChange={(iso) =>
                setForm((f) => ({ ...f, last_working_day: iso }))
              }
            />
          </div>
          <label className="block text-xs text-slate-500">
            Reason
            <SelectDropdown
              className="mt-1"
              triggerClassName="min-h-[36px] text-[13px]"
              value={form.reason_category}
              onChange={(v) => setForm((f) => ({ ...f, reason_category: v }))}
              options={REASON_CATEGORIES.map((r) => ({ value: r, label: r }))}
            />
          </label>
          <label className="block text-xs text-slate-500">
            Employee remarks
            <textarea
              rows={3}
              className={inputCls}
              value={form.reason_remarks}
              onChange={set("reason_remarks")}
            />
          </label>
          <label className="block text-xs text-slate-500">
            Super Admin remarks (private)
            <textarea
              rows={2}
              className={inputCls}
              value={form.admin_remarks}
              onChange={set("admin_remarks")}
            />
          </label>
        </div>

        {error && (
          <div className="mt-3">
            <ErrorBox message={error} />
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={saving}>
            {saving ? "Saving…" : "Record resignation"}
          </button>
        </div>
      </form>
    </div>
  );
}
