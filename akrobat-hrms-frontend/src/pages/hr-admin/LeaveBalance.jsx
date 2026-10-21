import { AlertTriangle, Percent, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import SearchInput from "../../components/common/SearchInput";
import { useAttendanceLiveUpdates } from "../../hooks/Useattendanceliveupdates";
import { useIsDesktop } from "../../hooks/useBasePath";
import { apiClient } from "../../services/apiClient";

// ---------------------------------------------------------------------
// Backend contract:
//   GET /employees/            -> { data: [...] }
//   GET /leaves/types          -> { data: [{ id, leave_name, default_days }] }
//     (leave_types.default_days is the annual allocation per type — this
//     is the real figure, not a guess.)
//   GET /leaves/?status=Approved&page&limit  (max limit 100, so paginate)
//     -> { data: { records: [...], total, page, limit } }
// All three require VIEW_LEAVE_REQUESTS, which HR ADMIN holds.
//
// Balance = allocation (leave_types.default_days) - sum of total_days on
// this employee's Approved leave requests of that type. Only Approved
// leave counts against balance; Pending/Rejected don't.
// ---------------------------------------------------------------------

function asList(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// Ring/pill color by how much of that allocation is left — this is what
// makes "who's running low" visible at a glance across a whole grid of
// employees instead of needing a sorted column to spot it.
function statusFromPct(pct) {
  if (pct <= 20)
    return { ring: "#DC2626", bg: "bg-red-50", text: "text-red-700" };
  if (pct <= 40)
    return { ring: "#D97706", bg: "bg-amber-50", text: "text-amber-700" };
  return { ring: "#e8eef8", bg: "bg-slate-50", text: "text-slate-500" };
}

function BalanceRing({ pct, label, photo }) {
  const r = 25;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = c - (clamped / 100) * c;
  const style = statusFromPct(pct);
  const clipId = `balance-ring-clip-${label}`;
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" className="mx-auto">
      {photo && (
        <clipPath id={clipId}>
          <circle cx="30" cy="30" r={r - 3} />
        </clipPath>
      )}
      <circle
        cx="30"
        cy="30"
        r={r}
        fill="none"
        stroke="#E2E8F0"
        strokeWidth="4.5"
      />
      {photo && (
        <image
          href={photo}
          x="6"
          y="6"
          width="48"
          height="48"
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
      )}
      <circle
        cx="30"
        cy="30"
        r={r}
        fill="none"
        stroke={style.ring}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 30 30)"
      />
      {!photo && (
        <text
          x="30"
          y="34"
          textAnchor="middle"
          fontSize="12"
          fontWeight="500"
          fill="#1e293b"
        >
          {label}
        </text>
      )}
    </svg>
  );
}

function EmployeeTile({ name, photo, department, pct, balanceLabel, onClick }) {
  const style = statusFromPct(pct);
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white border border-slate-100 rounded-xl p-4 text-center hover:border-orange-300 hover:shadow-sm transition-all cursor-pointer"
    >
      <BalanceRing pct={pct} label={initials(name)} photo={photo} />
      <p className="text-sm font-medium text-slate-800 mt-2.5 truncate">
        {name}
      </p>
      <p className="text-xs text-slate-400 mb-1.5 truncate">{department}</p>
      <span
        className={`inline-block text-xs px-2 py-0.5 rounded-md ${style.bg} ${style.text}`}
      >
        {balanceLabel}
      </span>
    </button>
  );
}

// Row inside the employee detail modal — one line per leave type showing
// allocated / used / balance, with a small progress bar so it's scannable
// alongside the numbers.
function LeaveTypeRow({
  leaveName,
  allocated,
  used,
  balance,
  pct,
  editable,
  saving,
  onSave,
}) {
  const style = statusFromPct(pct);
  const clamped = Math.max(0, Math.min(100, pct));
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(used));

  function startEdit() {
    setValue(String(used));
    setEditing(true);
  }

  async function save() {
    const ok = await onSave(leaveName, value);
    if (ok) setEditing(false);
  }

  return (
    <div className="py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-slate-700">{leaveName}</span>
        <span className="flex items-center gap-2">
          <span className={`text-xs font-medium ${style.text}`}>
            {round1(used)} / {allocated} taken
          </span>
          {editable && !editing && (
            <button
              type="button"
              onClick={startEdit}
              className="text-xs text-blue-600 hover:underline"
            >
              Edit
            </button>
          )}
        </span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${clamped}%`, backgroundColor: style.ring }}
        />
      </div>
      <p className="text-xs text-slate-400 mt-1">{round1(balance)} days left</p>
      {editing && (
        <div className="mt-2 flex items-center gap-2">
          <label className="text-xs text-slate-500">Days taken</label>
          <input
            type="number"
            min="0"
            max={allocated}
            step="0.5"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-20 border border-slate-200 rounded-md px-2 py-1 text-sm"
          />
          <button
            type="button"
            disabled={saving || value === ""}
            onClick={save}
            className="text-xs px-2.5 py-1 rounded-md bg-blue-600 text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setEditing(false)}
            className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-600"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// Employee detail (ring summary, per-type balances with edit, leave
// details). Shared by the mobile popup and the desktop side panel so the
// two can't drift apart.
function EmployeeDetailBody({
  selectedEmployee,
  leaveTypes,
  history,
  historyLoading,
  savingType,
  saveError,
  saveUsedDays,
}) {
  return (
    <div>
      <div className="flex items-center gap-4 pb-4 mb-1 border-b border-slate-100">
        <BalanceRing
          pct={selectedEmployee.totalPct}
          label={initials(selectedEmployee.name)}
          photo={selectedEmployee.photo}
        />
        <div>
          <p className="text-sm font-medium text-slate-800">
            {selectedEmployee.hasBalance
              ? `${round1(selectedEmployee.totalUsed)} / ${selectedEmployee.totalAllocated} days taken overall`
              : "No leave balance set for this year"}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Leave taken out of total entitlement this year
          </p>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {leaveTypes.map((lt) => {
          const t = selectedEmployee.types[lt.leave_name];
          if (!t) return null;
          return (
            <LeaveTypeRow
              key={lt.id}
              leaveName={lt.leave_name}
              allocated={t.allocated}
              used={t.used}
              balance={t.balance}
              pct={t.pct}
              editable={lt.leave_name !== "REPLACEMENT LEAVE"}
              saving={savingType === lt.leave_name}
              onSave={saveUsedDays}
            />
          );
        })}
      </div>

      {saveError && <p className="text-xs text-red-600 mt-2">{saveError}</p>}

      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-sm font-medium text-slate-700 mb-2">Leave details</p>
        {historyLoading ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-slate-400">No leave requests recorded.</p>
        ) : (
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
            {history.map((l) => (
              <div
                key={l.id}
                className="py-2 flex items-start justify-between gap-3"
              >
                <div>
                  <p className="text-xs font-medium text-slate-700">
                    {l.leave_types?.leave_name || "Leave"} · {l.total_days} day
                    {l.total_days === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {String(l.start_date).slice(0, 10)}
                    {l.end_date && l.end_date !== l.start_date
                      ? ` → ${String(l.end_date).slice(0, 10)}`
                      : ""}
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 shrink-0">
                  {l.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Bar color by how much of the allocation is left (healthy = brand navy).
function barColor(pct) {
  if (pct <= 20) return "#DC2626";
  if (pct <= 40) return "#D97706";
  return "#0b1d45";
}

function StatusChip({ emp, pct }) {
  if (!emp.hasBalance)
    return (
      <span className="text-[11px] font-semibold rounded-md px-2 py-0.5 bg-slate-100 text-slate-600 whitespace-nowrap">
        No balance set
      </span>
    );
  if (pct <= 20)
    return (
      <span className="text-[11px] font-semibold rounded-md px-2 py-0.5 bg-red-100 text-red-700 whitespace-nowrap">
        Running low
      </span>
    );
  if (pct <= 40)
    return (
      <span className="text-[11px] font-semibold rounded-md px-2 py-0.5 bg-amber-100 text-amber-800 whitespace-nowrap">
        Getting low
      </span>
    );
  return (
    <span className="text-[11px] font-semibold rounded-md px-2 py-0.5 bg-green-100 text-green-800 whitespace-nowrap">
      Healthy
    </span>
  );
}

function MiniBar({ pct }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <span className="inline-block h-1.5 w-12 rounded-full bg-slate-200 overflow-hidden align-middle">
      <span
        className="block h-full rounded-full"
        style={{ width: `${clamped}%`, backgroundColor: barColor(pct) }}
      />
    </span>
  );
}

export default function LeaveBalance() {
  const [employees, setEmployees] = useState([]);
  const [balanceRows, setBalanceRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("employee"); // "employee" | "type"
  const [activeType, setActiveType] = useState("");
  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [savingType, setSavingType] = useState(null);
  const [saveError, setSaveError] = useState(null);
  // Web (lg+) uses the table + detail-panel layout; mobile keeps the
  // original tile grid + popup below, unchanged.
  const isDesktop = useIsDesktop();

  // The real balances (leave_balances + Replacement credits) -- the same
  // numbers employees see on Apply Leave -- not "company default days
  // minus approved requests", which ignored the imported sheet balances.
  async function fetchAll(showSpinner = true) {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const [empRes, balRes] = await Promise.all([
        apiClient.get("/employees/"),
        apiClient.get("/leaves/balances"),
      ]);
      setEmployees(asList(empRes));
      setBalanceRows(balRes?.data?.balances || []);
    } catch (err) {
      setError(err.message || "Could not load leave balances.");
      setEmployees([]);
      setBalanceRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  // HR correcting how many days an employee has already taken.
  async function saveUsedDays(leaveName, value) {
    setSaveError(null);
    setSavingType(leaveName);
    try {
      await apiClient.put("/leaves/policy/set-used", {
        employee_id: selectedEmployeeId,
        leave_type: leaveName,
        used_days: Number(value),
      });
      await fetchAll(false);
      return true;
    } catch (err) {
      setSaveError(err.message || "Could not update the balance.");
      return false;
    } finally {
      setSavingType(null);
    }
  }

  // Days are held when someone applies and returned on rejection, so any
  // leave event can change a balance.
  useAttendanceLiveUpdates((event) => {
    if (event?.type === "leave_event") fetchAll(false);
  });

  // Leave details (every request, with dates/status) for the employee
  // whose popup is open.
  useEffect(() => {
    if (!selectedEmployeeId) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    apiClient
      .get(`/leaves/?employee_id=${selectedEmployeeId}&page=1&limit=100`)
      .then((res) => {
        if (!cancelled) setHistory(res?.data?.records || []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEmployeeId]);

  // One entry per leave type that exists in the balances (tabs in "By leave type").
  const leaveTypes = useMemo(() => {
    const names = [...new Set(balanceRows.map((r) => r.leave_name))].sort();
    return names.map((n) => ({ id: n, leave_name: n }));
  }, [balanceRows]);

  useEffect(() => {
    if (!activeType && leaveTypes.length > 0) {
      setActiveType(leaveTypes[0].leave_name);
    }
  }, [leaveTypes, activeType]);

  // Per employee: only employees that actually have balances
  // (MC-only staff have none and are left out).
  const balances = useMemo(() => {
    const byEmployee = {};
    employees.forEach((e) => {
      byEmployee[e.id] = {
        id: e.id,
        name: e.full_name,
        photo: e.profile_photo,
        department: e.departments?.department_name || e.department_name || "—",
        types: {},
      };
    });

    balanceRows.forEach((r) => {
      const entry = byEmployee[r.employee_id];
      if (!entry) return;
      const allocated = r.total_days || 0;
      const balance = Math.max(0, r.remaining_days || 0);
      entry.types[r.leave_name] = {
        allocated,
        used: r.used_days || 0,
        balance,
        pct: allocated ? (balance / allocated) * 100 : 0,
      };
    });

    // HR / Super Admin see EVERY employee. Those with no balance row yet
    // (not on the imported sheet, or yearly balances not generated) are
    // shown with "No balance set" instead of being silently dropped.
    return Object.values(byEmployee).map((emp) => {
      const values = Object.values(emp.types);
      if (values.length === 0) {
        return {
          ...emp,
          hasBalance: false,
          totalAllocated: 0,
          totalUsed: 0,
          totalBalance: 0,
          totalPct: 0,
          minPct: 100,
        };
      }
      const totalAllocated = values.reduce((sum, t) => sum + t.allocated, 0);
      const totalBalance = values.reduce((sum, t) => sum + t.balance, 0);
      const totalUsed = values.reduce((sum, t) => sum + t.used, 0);
      return {
        ...emp,
        hasBalance: true,
        totalAllocated,
        totalUsed,
        totalBalance,
        totalPct: totalAllocated ? (totalBalance / totalAllocated) * 100 : 0,
        minPct: Math.min(...values.map((t) => t.pct)),
      };
    });
  }, [employees, balanceRows]);

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return balances;
    return balances.filter(
      (b) =>
        b.name?.toLowerCase().includes(q) ||
        b.department?.toLowerCase().includes(q),
    );
  }, [balances, search]);

  // Least remaining leave first, in both views — the point of this page
  // is spotting who's about to run out, so that's what leads instead of
  // an alphabetical list.
  const sortedByEmployee = useMemo(
    () =>
      [...searched].sort((a, b) => {
        if (a.hasBalance !== b.hasBalance) return a.hasBalance ? -1 : 1;
        return a.totalBalance - b.totalBalance;
      }),
    [searched],
  );

  const sortedByType = useMemo(() => {
    if (!activeType) return [];
    return [...searched].sort(
      (a, b) =>
        (a.types[activeType]?.balance ?? 0) -
        (b.types[activeType]?.balance ?? 0),
    );
  }, [searched, activeType]);

  const selectedEmployee = useMemo(
    () => balances.find((b) => b.id === selectedEmployeeId) || null,
    [balances, selectedEmployeeId],
  );

  const summary = useMemo(() => {
    const withBalance = balances.filter((b) => b.hasBalance);
    const runningLow = withBalance.filter((b) => b.minPct <= 20).length;
    const avgUsedPct = withBalance.length
      ? Math.round(
          withBalance.reduce(
            (s, b) => s + (b.totalAllocated ? 100 - b.totalPct : 0),
            0,
          ) / withBalance.length,
        )
      : 0;
    return { total: balances.length, avgUsedPct, runningLow };
  }, [balances]);

  // Desktop: table shows full width first; the detail panel opens only
  // after a row is clicked, and Esc closes it.
  useEffect(() => {
    if (!isDesktop || !selectedEmployeeId) return;
    function onKey(e) {
      if (e.key === "Escape") setSelectedEmployeeId(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isDesktop, selectedEmployeeId]);

  // ======================= Web layout: table + detail panel =======================
  if (isDesktop) {
    const rows =
      view === "employee"
        ? sortedByEmployee
        : sortedByType.filter((e) => e.types[activeType]);
    const th =
      "text-left text-xs font-semibold text-slate-500 px-3.5 h-11 bg-slate-50 border-b border-slate-200 whitespace-nowrap sticky top-0 z-10";
    const td =
      "px-3.5 h-14 border-b border-slate-100 text-slate-600 whitespace-nowrap";

    return (
      <div>
        <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-800">Leave balance</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Remaining leave per employee for this year (balance forward and
              entitlement, less leave taken).
            </p>
          </div>
          <div className="flex items-center gap-6">
            {[
              { label: "Employees tracked", value: summary.total, tone: "" },
              {
                label: "Avg balance used",
                value: `${summary.avgUsedPct}%`,
                tone: "",
              },
              {
                label: "Running low",
                value: summary.runningLow,
                tone: summary.runningLow > 0 ? "text-red-600" : "",
              },
            ].map(({ label, value, tone }) => (
              <div key={label} className="text-xs text-slate-500">
                {label}
                <div
                  className={`text-xl font-bold leading-tight ${tone || "text-slate-800"}`}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex gap-1.5">
            {[
              { key: "employee", label: "By employee" },
              { key: "type", label: "By leave type" },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setView(t.key)}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  view === t.key
                    ? "border-[#0b1f45] bg-[#0b1f45] text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search employee or department"
            className="w-64"
            iconSize={14}
            inputClassName="py-2"
          />
        </div>

        {view === "type" && leaveTypes.length > 0 && (
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto">
            {leaveTypes.map((lt) => (
              <button
                key={lt.id}
                type="button"
                onClick={() => setActiveType(lt.leave_name)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activeType === lt.leave_name
                    ? "bg-[#0b1f45] border-[#0b1f45] text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {lt.leave_name}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-slate-500 py-10 text-center">
            Loading leave balances…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-500 py-10 text-center bg-white rounded-xl border border-slate-100">
            No employees match here.
          </div>
        ) : (
          <div
            className={
              selectedEmployee
                ? "grid grid-cols-[minmax(0,1fr)_360px] gap-4 items-start"
                : ""
            }
          >
            <div className="bg-white rounded-2xl border border-slate-200 overflow-auto min-w-0 max-h-[calc(100vh-11rem)]">
              <table className="w-full text-[13px] border-collapse min-w-[760px]">
                <thead>
                  <tr>
                    <th className={th}>Employee</th>
                    {view !== "employee" && <th className={th}>Department</th>}
                    {view === "employee" ? (
                      <>
                        {leaveTypes.map((lt) => (
                          <th key={lt.id} className={th}>
                            {lt.leave_name}
                          </th>
                        ))}
                        <th className={th}>Total left</th>
                      </>
                    ) : (
                      <>
                        <th className={th}>Allocated</th>
                        <th className={th}>Taken</th>
                        <th className={th}>Left</th>
                      </>
                    )}
                    <th className={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((emp) => {
                    const t = view === "type" ? emp.types[activeType] : null;
                    const selected = emp.id === selectedEmployeeId;
                    const statusPct = t ? t.pct : emp.minPct;
                    return (
                      <tr
                        key={emp.id}
                        onClick={() => setSelectedEmployeeId(emp.id)}
                        className={`cursor-pointer ${selected ? "bg-[#eef3ff]" : "hover:bg-slate-50"}`}
                      >
                        <td className={td}>
                          <button
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setSelectedEmployeeId(emp.id)}
                            title={emp.name}
                            className="flex items-center gap-2.5 text-left font-semibold text-slate-800 w-[240px]"
                          >
                            {emp.photo ? (
                              <img
                                src={emp.photo}
                                alt=""
                                className="w-7 h-7 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-900 text-[11px] font-bold flex items-center justify-center shrink-0">
                                {initials(emp.name)}
                              </span>
                            )}
                            <span className="truncate min-w-0">{emp.name}</span>
                          </button>
                        </td>
                        {view !== "employee" && (
                          <td className={td}>{emp.department}</td>
                        )}
                        {view === "employee" ? (
                          <>
                            {leaveTypes.map((lt) => {
                              const ty = emp.types[lt.leave_name];
                              return (
                                <td key={lt.id} className={td}>
                                  {ty ? (
                                    <span className="inline-flex items-center gap-2">
                                      <MiniBar pct={ty.pct} />
                                      <span className="tabular-nums">
                                        {round1(ty.balance)}/{ty.allocated}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td
                              className={`${td} font-semibold text-slate-800`}
                            >
                              {emp.hasBalance
                                ? `${round1(emp.totalBalance)} d`
                                : "—"}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className={td}>{t.allocated}</td>
                            <td className={td}>{round1(t.used)}</td>
                            <td className={td}>
                              <span className="inline-flex items-center gap-2">
                                <MiniBar pct={t.pct} />
                                <span className="tabular-nums font-semibold text-slate-800">
                                  {round1(t.balance)}
                                </span>
                              </span>
                            </td>
                          </>
                        )}
                        <td className={`${td} border-b`}>
                          <StatusChip emp={emp} pct={statusPct} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="px-3.5 py-2 text-[11px] text-slate-400">
                Cells show days left / yearly allocation.
              </p>
            </div>

            {selectedEmployee && (
              <aside
                aria-label="Leave balance details"
                className="bg-white rounded-2xl border border-slate-200 sticky top-20 max-h-[calc(100vh-6rem)] flex flex-col overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3 px-4 py-4 bg-[#0b1f45] shrink-0">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-white">
                      {selectedEmployee.name}
                    </h2>
                    <p className="text-xs text-blue-200">
                      {selectedEmployee.department}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedEmployeeId(null)}
                    className="p-1.5 rounded-md text-blue-100 hover:bg-white/10 hover:text-white"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="p-4 overflow-y-auto">
                  <EmployeeDetailBody
                    selectedEmployee={selectedEmployee}
                    leaveTypes={leaveTypes}
                    history={history}
                    historyLoading={historyLoading}
                    savingType={savingType}
                    saveError={saveError}
                    saveUsedDays={saveUsedDays}
                  />
                </div>
              </aside>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Leave balance"
        // Explanatory line is desktop-only; on mobile it just pushes the
        // stats and employee list down the screen.
        subtitle={
          <span className="hidden lg:inline">
            Remaining leave per employee for this year (balance forward and
            entitlement, less leave taken).
          </span>
        }
      />

      {/* KPI strip — compact tiles (same size as the Departments page) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
        {[
          {
            icon: Users,
            label: "Employees tracked",
            value: summary.total,
            tone: "bg-orange-50 text-orange-600",
          },
          {
            icon: Percent,
            label: "Avg balance used",
            value: `${summary.avgUsedPct}%`,
            tone: "bg-blue-50 text-blue-600",
          },
          {
            icon: AlertTriangle,
            label: "Running low",
            value: summary.runningLow,
            tone: "bg-red-50 text-red-600",
          },
        ].map(({ icon: Icon, label, value, tone }) => (
          <div
            key={label}
            className="bg-white rounded-lg border border-slate-200 px-2.5 py-2 flex items-center gap-2.5 min-w-0"
          >
            <div
              className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${tone}`}
            >
              <Icon size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] text-slate-500 truncate leading-tight">
                {label}
              </div>
              <div className="text-base font-bold text-slate-800 leading-tight">
                {value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {[
            { key: "employee", label: "By employee" },
            { key: "type", label: "By leave type" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`text-sm px-3.5 py-1.5 rounded-md transition-colors ${
                view === t.key
                  ? "bg-[#0b1f45] font-medium text-white shadow-sm"
                  : "text-slate-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search employee or department"
          className="w-full sm:w-64"
          iconSize={14}
          inputClassName="py-2"
        />
      </div>

      {view === "type" && leaveTypes.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto">
          {leaveTypes.map((lt) => (
            <button
              key={lt.id}
              onClick={() => setActiveType(lt.leave_name)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeType === lt.leave_name
                  ? "bg-[#0b1f45] border-[#0b1f45] text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {lt.leave_name}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500 py-10 text-center">
          Loading leave balances…
        </div>
      ) : searched.length === 0 ? (
        <div className="text-sm text-slate-500 py-10 text-center bg-white rounded-xl border border-slate-100">
          No employees match here.
        </div>
      ) : view === "employee" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {sortedByEmployee.map((emp) => (
            <EmployeeTile
              key={emp.id}
              name={emp.name}
              photo={emp.photo}
              department={emp.department}
              pct={emp.totalPct}
              balanceLabel={
                emp.hasBalance
                  ? `${round1(emp.totalUsed)}/${emp.totalAllocated} taken`
                  : "No balance set"
              }
              onClick={() => setSelectedEmployeeId(emp.id)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {sortedByType.map((emp) => {
            const t = emp.types[activeType];
            if (!t) return null;
            return (
              <EmployeeTile
                key={emp.id}
                name={emp.name}
                photo={emp.photo}
                department={emp.department}
                pct={t.pct}
                balanceLabel={`${round1(t.used)}/${t.allocated} taken`}
                onClick={() => setSelectedEmployeeId(emp.id)}
              />
            );
          })}
        </div>
      )}

      <Modal
        open={!!selectedEmployee}
        onClose={() => setSelectedEmployeeId(null)}
        title={selectedEmployee?.name}
        subtitle={selectedEmployee?.department}
        width="max-w-md"
      >
        {selectedEmployee && (
          <EmployeeDetailBody
            selectedEmployee={selectedEmployee}
            leaveTypes={leaveTypes}
            history={history}
            historyLoading={historyLoading}
            savingType={savingType}
            saveError={saveError}
            saveUsedDays={saveUsedDays}
          />
        )}
      </Modal>
    </div>
  );
}
