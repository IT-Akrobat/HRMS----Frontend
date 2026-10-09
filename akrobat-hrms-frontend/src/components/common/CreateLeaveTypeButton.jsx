import { CalendarPlus, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { apiClient } from "../../services/apiClient";
import Modal from "./Modal";
import SelectDropdown from "./SelectDropdown";

// HR / Super Admin: create a new leave type. Lives in the Leave Requests
// page header (moved out of the Create / Edit User form). Once created, the
// type shows up as a "days" box on the user form.
// Backend: POST /leaves/types

const APPLIES_TO = [
  { value: "ALL", label: "Everyone" },
  { value: "MALE", label: "Male only" },
  { value: "FEMALE", label: "Female only" },
];

const EMPTY = { name: "", days: "", applies_to: "ALL", married_only: false };

const inputCls =
  "w-full border border-slate-200 rounded-lg px-3 py-2.5 sm:py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-orange-400";

export default function CreateLeaveTypeButton({
  onChanged,
  label = "New leave type",
  className = "",
  // Mobile header: show just a symbol (no text) so both header buttons fit.
  iconOnly = false,
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function close() {
    setOpen(false);
    setForm(EMPTY);
    setError(null);
  }

  async function submit() {
    setError(null);
    if (form.name.trim().length < 2) {
      setError("Enter a leave name.");
      return;
    }
    setSaving(true);
    try {
      await apiClient.post("/leaves/types", {
        leave_name: form.name.trim(),
        default_days: Number(form.days) || 0,
        applies_to: form.applies_to,
        married_only: form.married_only,
      });
      onChanged?.();
      close();
    } catch (err) {
      setError(err?.message || "Could not add leave type.");
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
        className={`shrink-0 inline-flex items-center justify-center gap-1.5 text-sm font-medium border border-orange-200 text-orange-600 bg-white rounded-lg hover:bg-orange-50 transition-colors ${
          iconOnly ? "w-10 h-10" : "px-3.5 py-2.5"
        } ${className}`}
      >
        {iconOnly ? <CalendarPlus size={18} /> : <Plus size={15} />}
        {!iconOnly && label}
      </button>

      <Modal
        open={open}
        onClose={close}
        title="New leave type"
        subtitle="It will appear as a days box on the Add / Edit User form."
        icon={
          <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
            <CalendarPlus size={18} />
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
              Add leave type
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="text-sm text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Name <span className="text-orange-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Study Leave"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Default days
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.days}
                onChange={(e) => {
                  if (/^\d{0,3}(\.\d?)?$/.test(e.target.value))
                    set("days", e.target.value);
                }}
                placeholder="0"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Applies to
              </label>
              <SelectDropdown
                value={form.applies_to}
                onChange={(v) => set("applies_to", v)}
                options={APPLIES_TO}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.married_only}
              onChange={(e) => set("married_only", e.target.checked)}
              className="rounded border-slate-300"
            />
            Married only
          </label>
        </div>
      </Modal>
    </>
  );
}
