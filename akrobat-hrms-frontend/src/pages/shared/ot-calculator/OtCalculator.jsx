import { Download, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import PageHeader from "../../../components/common/PageHeader";
import { useModalBackClose } from "../../../components/common/usemodalbackclose";
import DatePicker from "../../../components/layout/DatePicker";
import ExcelTab from "./ExcelTab";

import ReviewChangesSheet from "./ReviewChangesSheet";
import { otCalculatorService } from "./otCalculatorService";
import { exportOtExcel, readOtExcel } from "./otExcel";
import { buildSaveItems, currentMonth, effectiveRow, rowKey } from "./otUtils";

// OT Calculator page for HR Admin and Super Admin.
// Single Excel Sheet view (everyone) on web and mobile.
// WEB: Save goes straight to the server.
// MOBILE: Save opens a "review changes" bottom sheet listing the edited
// dates first.

export default function OtCalculator() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState({ employees: [] });
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { text, error }
  const [reviewOpen, setReviewOpen] = useState(false);
  const fileRef = useRef(null);
  useModalBackClose(reviewOpen, () => setReviewOpen(false));

  const load = useCallback(() => {
    setLoading(true);
    setMessage(null);
    otCalculatorService
      .getMonth(month)
      .then((res) => {
        setData(res?.data || { employees: [] });
        setEdits({});
      })
      .catch((err) =>
        setMessage({
          text: err?.message || "Could not load OT data.",
          error: true,
        }),
      )
      .finally(() => setLoading(false));
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const dirtyCount = Object.keys(edits).length;

  function handleEdit(emp, row, patch) {
    const key = rowKey(emp.employee_id, row.date);
    setEdits((prev) => {
      const cur = effectiveRow(emp, row, prev);
      return {
        ...prev,
        [key]: { manual: cur.manual, note: cur.note, ...patch },
      };
    });
  }

  function handleMonthChange(value) {
    if (!value || value === month) return;
    if (dirtyCount && !window.confirm("Discard unsaved OT changes?")) return;
    setMonth(value);
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const employees = data.employees || [];
    try {
      const { patches, unmatched } = await readOtExcel(file, employees, edits);
      patches.forEach((p) =>
        handleEdit(p.employee, p.row, { manual: p.manual, note: p.note }),
      );
      setMessage({
        text: `${patches.length} change(s) imported${
          unmatched ? `, ${unmatched} row(s) not matched` : ""
        }. Click Save to keep them.`,
        error: false,
      });
    } catch {
      setMessage({
        text: "Could not read that file. Use a file exported from here.",
        error: true,
      });
    }
  }

  async function handleSave() {
    const items = buildSaveItems(data.employees, edits);
    if (!items.length) return;
    setSaving(true);
    try {
      const res = await otCalculatorService.saveAdjustments(items);
      setMessage({ text: res?.message || "Saved.", error: false });
      load();
    } catch (err) {
      setMessage({ text: err?.message || "Could not save.", error: true });
    } finally {
      setSaving(false);
      setReviewOpen(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="OT Calculator"
        actionsInline
        actions={
          <>
            <span className="hidden sm:inline text-sm text-slate-500">
              Month
            </span>
            <DatePicker
              monthOnly
              overlay
              alignRight
              value={month}
              onChange={handleMonthChange}
              placeholder="Select month"
              className="shrink-0"
            />
            <div className="hidden lg:flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  exportOtExcel(data.employees || [], edits, month)
                }
                className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 flex items-center gap-1.5 hover:bg-slate-50"
              >
                <Download size={15} />
                Export
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 flex items-center gap-1.5 hover:bg-slate-50"
              >
                <Upload size={15} />
                Import
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImport}
              />
            </div>
          </>
        }
      />

      {message && (
        <div
          role="status"
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            message.error
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-green-50 text-green-800 border border-green-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500 py-12 text-center">Loading...</div>
      ) : (
        <ExcelTab
          data={data}
          month={month}
          edits={edits}
          onEdit={handleEdit}
          onSave={handleSave}
          onReview={() => setReviewOpen(true)}
          saving={saving}
          dirtyCount={dirtyCount}
          onMessage={(text, error = false) => setMessage({ text, error })}
        />
      )}

      <ReviewChangesSheet
        open={reviewOpen}
        employees={data.employees || []}
        edits={edits}
        saving={saving}
        onClose={() => setReviewOpen(false)}
        onConfirm={handleSave}
      />
    </div>
  );
}
