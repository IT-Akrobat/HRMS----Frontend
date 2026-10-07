// Shared helpers for the OT Calculator (Monthly tab + Excel tab).
// `edits` is { "<employeeId>|<date>": { manual: "2", note: "..." } } and only
// holds rows the user changed since the last fetch/save.

export const rowKey = (employeeId, date) => `${employeeId}|${date}`;

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMins(mins) {
  const m = Math.max(0, Math.round(mins || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function formatH(hours) {
  const n = Number(hours || 0);
  return `${Number.isInteger(n) ? n : n.toFixed(1)} h`;
}

// Manual value wins when filled in; otherwise the auto OT is used.
export function effectiveRow(emp, row, edits) {
  const edit = edits[rowKey(emp.employee_id, row.date)];
  const manualRaw = edit ? edit.manual : row.manual_ot_hours;
  const note = edit && edit.note !== undefined ? edit.note : row.note || "";
  const hasManual =
    manualRaw !== null && manualRaw !== undefined && String(manualRaw) !== "";
  const manualNum = hasManual ? Number(manualRaw) : null;
  const valid = manualNum !== null && !Number.isNaN(manualNum);
  return {
    manual: hasManual ? String(manualRaw) : "",
    note,
    final: valid ? manualNum : row.auto_ot_hours,
    edited: valid,
  };
}

export function empTotals(emp, edits) {
  let afterShift = 0;
  let auto = 0;
  let final = 0;
  let editedDays = 0;
  emp.rows.forEach((row) => {
    const cur = effectiveRow(emp, row, edits);
    afterShift += row.after_shift_minutes;
    auto += row.auto_ot_hours;
    final += cur.final;
    if (cur.edited) editedDays += 1;
  });
  return { afterShift, auto, final, editedDays, delta: final - auto };
}

// Rows the user touched -> body for PUT /ot-calculator/adjustments.
export function buildSaveItems(employees, edits) {
  const items = [];
  employees.forEach((emp) =>
    emp.rows.forEach((row) => {
      const key = rowKey(emp.employee_id, row.date);
      if (!edits[key]) return;
      const cur = effectiveRow(emp, row, edits);
      items.push({
        employee_id: emp.employee_id,
        attendance_date: row.date,
        manual_ot_hours: cur.edited ? Number(cur.manual) : null,
        note: cur.note || null,
      });
    }),
  );
  return items;
}
