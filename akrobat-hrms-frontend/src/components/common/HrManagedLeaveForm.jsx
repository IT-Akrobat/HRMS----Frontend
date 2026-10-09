import { Calendar, ClipboardPlus, Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../../services/apiClient";
import DatePicker from "../layout/DatePicker";
import Modal from "./Modal";
import SelectDropdown from "./SelectDropdown";

// HR / Super Admin only: record Hospitalisation or Maternity leave.
// Renders a button (meant for the page header's `actions` slot) that opens
// a popup -- a centred dialog on desktop and a bottom sheet on mobile
// (the shared Modal handles both). Employees can't apply for or see these
// types; the leave is saved as Approved straight away.
// Backend: POST /leaves/hr-managed (app/leaves/routes.py)

const TYPES = [
  { value: "HOSPITALISATION LEAVE", label: "Hospitalisation Leave" },
  { value: "MATERNITY LEAVE", label: "Maternity Leave" },
];

const EMPTY = {
  employee_id: "",
  leave_type: TYPES[0].value,
  from_date: "",
  to_date: "",
  reason: "",
};

function asList(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toDate(iso) {
  return iso ? new Date(`${iso}T00:00:00`) : null;
}

function fmt(iso) {
  return iso
    ? toDate(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
    : "";
}

function Label({ children, required }) {
  return (
    <label className="block text-xs font-medium text-slate-600 mb-1.5">
      {children}
      {required && <span className="text-orange-500"> *</span>}
    </label>
  );
}

export default function HrManagedLeaveForm({
  onChanged,
  label = "Hospitalisation / Maternity",
  className = "",
  // Mobile header: show just a symbol (no text) so both header buttons fit.
  iconOnly = false,
}) {
  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  // Which date the inline calendar is editing: null (hidden) | "from" | "to"
  const [activeDate, setActiveDate] = useState(null);
  const calRef = useRef(null);

  // Bring the inline calendar into view inside the scrolling popup.
  useEffect(() => {
    if (activeDate && calRef.current) {
      calRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeDate]);

  // Employees are only needed once the popup is opened.
  useEffect(() => {
    if (!open || employees.length > 0) return;
    apiClient
      .get("/employees/")
      .then((res) => setEmployees(asList(res)))
      .catch(() => setError("Could not load employees."));
  }, [open, employees.length]);

  const employeeOptions = useMemo(
    () =>
      [...employees]
        .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""))
        .map((e) => ({ value: e.id, label: e.full_name })),
    [employees],
  );

  const days =
    form.from_date && form.to_date && form.to_date >= form.from_date
      ? Math.round((toDate(form.to_date) - toDate(form.from_date)) / 86400000) +
        1
      : null;

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
    setSuccess(null);
  }

  function close() {
    setOpen(false);
    setActiveDate(null);
    setForm(EMPTY);
    setError(null);
    setSuccess(null);
  }

  async function submit() {
    if (!form.employee_id || !form.from_date || !form.to_date) {
      setError("Choose an employee and both dates.");
      return;
    }
    if (form.to_date < form.from_date) {
      setError("The end date must be on or after the start date.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.post("/leaves/hr-managed", {
        employee_id: form.employee_id,
        leave_type: form.leave_type,
        from_date: form.from_date,
        to_date: form.to_date,
        reason: form.reason.trim() || null,
      });
      onChanged?.();
      close();
    } catch (err) {
      setError(err.message || "Unable to record this leave.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className={`shrink-0 inline-flex items-center justify-center gap-1.5 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors ${
          iconOnly ? "w-10 h-10" : "px-3.5 py-2.5"
        } ${className}`}
      >
        {iconOnly ? <ClipboardPlus size={18} /> : <Plus size={15} />}
        {!iconOnly && label}
      </button>

      <Modal
        open={open}
        onClose={close}
        title="Record leave"
        subtitle="Hospitalisation and Maternity are managed by HR and Super Admin only. Saved as approved."
        icon={
          <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
            <ClipboardPlus size={18} />
          </div>
        }
        width="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={close}
              className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="inline-flex items-center gap-2 text-sm font-medium bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-60"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Record leave
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label required>Employee</Label>
            <SelectDropdown
              value={form.employee_id}
              onChange={(v) => set("employee_id", v)}
              options={employeeOptions}
              placeholder="Select employee"
              searchable
              searchPlaceholder="Search employee…"
              triggerClassName="py-2.5"
            />
          </div>

          <div>
            <Label required>Leave type</Label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set("leave_type", t.value)}
                  className={`text-sm px-3 py-2.5 rounded-lg border transition-colors ${
                    form.leave_type === t.value
                      ? "border-orange-500 bg-orange-50 text-orange-700 font-medium"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t.label.replace(" Leave", "")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label required>Dates</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "from", text: "From", iso: form.from_date },
                { key: "to", text: "To", iso: form.to_date },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() =>
                    setActiveDate((a) => (a === f.key ? null : f.key))
                  }
                  className={`flex items-center gap-2 border rounded-lg px-3 py-2.5 text-sm text-left transition-colors ${
                    activeDate === f.key
                      ? "border-orange-400 ring-2 ring-orange-200 bg-white"
                      : "border-slate-200 bg-slate-50/60 hover:border-slate-300"
                  }`}
                >
                  <Calendar
                    size={15}
                    className={
                      activeDate === f.key || f.iso
                        ? "text-orange-500 shrink-0"
                        : "text-slate-400 shrink-0"
                    }
                  />
                  <span
                    className={`truncate ${
                      f.iso ? "text-slate-700" : "text-slate-400"
                    }`}
                  >
                    {f.iso ? fmt(f.iso) : f.text}
                  </span>
                </button>
              ))}
            </div>

            {/* Calendar shown right inside this popup (no second popup). */}
            {activeDate && (
              <div ref={calRef} className="mt-2">
                <DatePicker
                  key={activeDate}
                  inline
                  value={toDate(
                    activeDate === "from" ? form.from_date : form.to_date,
                  )}
                  defaultMonth={
                    activeDate === "to" ? toDate(form.from_date) : undefined
                  }
                  min={
                    activeDate === "to"
                      ? form.from_date || undefined
                      : undefined
                  }
                  onSelect={(d) => {
                    const iso = toISO(d);
                    if (activeDate === "from") {
                      setForm((f) => ({
                        ...f,
                        from_date: iso,
                        to_date: f.to_date && f.to_date < iso ? iso : f.to_date,
                      }));
                      setError(null);
                      setActiveDate("to"); // move on to the end date
                    } else {
                      set("to_date", iso);
                      setActiveDate(null); // done -- collapse the calendar
                    }
                  }}
                />
              </div>
            )}
            {days && (
              <p className="text-xs text-slate-400 mt-1.5">
                {days} day{days === 1 ? "" : "s"}
              </p>
            )}
          </div>

          <div>
            <Label>Reason / notes</Label>
            <textarea
              rows={3}
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              placeholder="Optional"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:border-orange-400 resize-none"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
