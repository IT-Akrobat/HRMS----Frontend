import * as XLSX from "xlsx-js-style";
import { effectiveRow } from "./otUtils";

// Columns: A Code, B Employee, C Date, D Day, E Shift end, F Check-out,
// G After shift (min), H Auto OT (h), I Manual OT (h), J Final OT (h), K Note.
// H and J are real Excel formulas so HR can change G / I in Excel and the
// result recalculates there.
const HEADER = [
  "Employee Code",
  "Employee",
  "Date",
  "Day",
  "Shift End",
  "Check-out",
  "After Shift (min)",
  "Auto OT (h)",
  "Manual OT (h)",
  "Final OT (h)",
  "Note",
];

const headerStyle = {
  font: { bold: true },
  fill: { fgColor: { rgb: "EFEDE7" } },
};

export function exportOtExcel(employees, edits, month, fileName) {
  const aoa = [HEADER.map((h) => ({ v: h, t: "s", s: headerStyle }))];
  let n = 1;
  employees.forEach((emp) =>
    emp.rows.forEach((row) => {
      n += 1;
      const cur = effectiveRow(emp, row, edits);
      aoa.push([
        emp.employee_code || "",
        emp.full_name || "",
        row.date,
        row.weekday,
        row.shift_end || "",
        row.check_out || "",
        row.after_shift_minutes,
        {
          t: "n",
          v: row.auto_ot_hours,
          f: `IF(MOD(G${n},60)>41,INT(G${n}/60)+1,INT(G${n}/60))`,
        },
        cur.edited ? Number(cur.manual) : undefined,
        {
          t: "n",
          v: cur.final,
          f: `IF(I${n}<>"",I${n},H${n})`,
        },
        cur.note || "",
      ]);
    }),
  );
  if (n > 1) {
    const sum = (col) => ({ t: "n", f: `SUM(${col}2:${col}${n})` });
    aoa.push([
      "",
      { v: "Total", t: "s", s: { font: { bold: true } } },
      "",
      "",
      "",
      "",
      sum("G"),
      sum("H"),
      sum("I"),
      sum("J"),
      "",
    ]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = [14, 28, 12, 6, 10, 10, 16, 12, 14, 12, 32].map((wch) => ({
    wch,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, `OT ${month}`);
  XLSX.writeFile(wb, fileName || `ot-calculator-${month}.xlsx`);
}

// Reads an exported-and-edited file. Returns { patches, unmatched }.
// patches: [{ employee, row, manual, note }] only where something changed.
export async function readOtExcel(file, employees, edits) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const lookup = new Map();
  employees.forEach((emp) =>
    emp.rows.forEach((row) =>
      lookup.set(`${String(emp.employee_code)}|${row.date}`, { emp, row }),
    ),
  );

  const patches = [];
  let unmatched = 0;
  rows.forEach((r) => {
    if (!r["Employee Code"] || !r["Date"]) return; // blank / total row
    const hit = lookup.get(
      `${String(r["Employee Code"])}|${String(r["Date"])}`,
    );
    if (!hit) {
      unmatched += 1;
      return;
    }
    const manualRaw = r["Manual OT (h)"];
    const manual =
      manualRaw === "" || manualRaw === null || manualRaw === undefined
        ? ""
        : String(manualRaw);
    const note = String(r["Note"] ?? "");
    const cur = effectiveRow(hit.emp, hit.row, edits);
    if (cur.manual !== manual || (cur.note || "") !== note) {
      patches.push({ employee: hit.emp, row: hit.row, manual, note });
    }
  });
  return { patches, unmatched };
}
