import { useCallback, useEffect, useState } from "react";
import PageHeader from "../../../components/common/PageHeader";
import { useModalBackClose } from "../../../components/common/usemodalbackclose";
import DatePicker from "../../../components/layout/DatePicker";
import ExcelTab from "./ExcelTab";

import ReviewChangesSheet from "./ReviewChangesSheet";
import { otCalculatorService } from "./otCalculatorService";
import { buildSaveItems, currentMonth, effectiveRow, rowKey } from "./otUtils";

// OT Calculator page for HR Admin and Super Admin.
// Two tabs share one fetch + one set of unsaved edits:
//   1. Monthly Calculator (one person)   2. Excel Sheet (everyone)
// WEB: unchanged (both tabs, Save goes straight to the server).
// MOBILE: Monthly tab is hidden, only Excel Sheet is shown, and Save opens a
// "review changes" bottom sheet listing the edited dates first.

function useIsMobile() {
  const query = "(max-width: 1023px)";
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

export default function OtCalculator() {
  const [tab, setTab] = useState("monthly");
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState({ employees: [] });
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { text, error }
  const isMobile = useIsMobile();
  const [reviewOpen, setReviewOpen] = useState(false);
  const activeTab = isMobile ? "excel" : tab;
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

  const tabClass = (id) =>
    `flex-1 lg:flex-none min-h-[44px] px-5 rounded-lg text-sm transition-colors ${
      tab === id
        ? "bg-white text-orange-700 font-bold shadow-sm"
        : "text-slate-600 font-medium"
    }`;

  return (
    <div>
      <PageHeader
        title="OT Calculator"
        subtitle={
          <span className="hidden lg:inline">
            OT for on-site staff who get additional salary. Auto OT counts after
            shift end; edit any day by hand.
          </span>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-sm text-slate-500">Month</span>
        <DatePicker
          monthOnly
          value={month}
          onChange={handleMonthChange}
          placeholder="Select month"
          className="w-[168px]"
        />
      </div>

      <div className="hidden lg:inline-flex lg:w-auto bg-slate-200/70 rounded-xl p-1 mb-5">
        <button
          type="button"
          className={tabClass("monthly")}
          onClick={() => setTab("monthly")}
        >
          Monthly Calculator
        </button>
        <button
          type="button"
          className={tabClass("excel")}
          onClick={() => setTab("excel")}
        >
          Excel Sheet
        </button>
      </div>

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
      ) : activeTab === "monthly" ? (
        <MonthlyTab
          data={data}
          month={month}
          edits={edits}
          onEdit={handleEdit}
          onSave={handleSave}
          onReset={() => setEdits({})}
          saving={saving}
          dirtyCount={dirtyCount}
        />
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
