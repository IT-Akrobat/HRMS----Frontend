import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import { useAttendanceLiveUpdates } from "../../hooks/Useattendanceliveupdates";
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

const PAGE_SIZE = 100;
const MAX_PAGES = 10; // safety cap — 1,000 approved leave records

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
function LeaveTypeRow({ leaveName, allocated, used, balance, pct }) {
  const style = statusFromPct(pct);
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-slate-700">{leaveName}</span>
        <span className={`text-xs font-medium ${style.text}`}>
          {round1(balance)} / {allocated} left
        </span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${clamped}%`, backgroundColor: style.ring }}
        />
      </div>
      <p className="text-xs text-slate-400 mt-1">{round1(used)} days used</p>
    </div>
  );
}

export default function LeaveBalance() {
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("employee"); // "employee" | "type"
  const [activeType, setActiveType] = useState("");
  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const [empRes, typesRes] = await Promise.all([
          apiClient.get("/employees/"),
          apiClient.get("/leaves/types"),
        ]);

        let approved = [];
        let page = 1;
        while (page <= MAX_PAGES) {
          const res = await apiClient.get(
            `/leaves/?status=Approved&page=${page}&limit=${PAGE_SIZE}`,
          );
          const chunk = res?.data?.records || [];
          approved = approved.concat(chunk);
          const total = res?.data?.total || 0;
          if (approved.length >= total || chunk.length === 0) break;
          page += 1;
        }

        if (!cancelled) {
          setEmployees(asList(empRes));
          setLeaveTypes(asList(typesRes));
          setRecords(approved);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load leave balances.");
          setEmployees([]);
          setLeaveTypes([]);
          setRecords([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // A leave changes the numbers on this page only once it's approved
  // (see the `status=Approved` filter above) — every check-in/out and
  // pending/rejected leave elsewhere in the company would otherwise
  // trigger this fairly expensive multi-page refetch for nothing, so
  // filter to the one event type/action that actually affects balances.
  useAttendanceLiveUpdates((event) => {
    if (event?.type === "leave_event" && event?.action === "approved") {
      setLoading(true);
      setError(null);
      (async () => {
        try {
          const [empRes, typesRes] = await Promise.all([
            apiClient.get("/employees/"),
            apiClient.get("/leaves/types"),
          ]);

          let approved = [];
          let page = 1;
          while (page <= MAX_PAGES) {
            const res = await apiClient.get(
              `/leaves/?status=Approved&page=${page}&limit=${PAGE_SIZE}`,
            );
            const chunk = res?.data?.records || [];
            approved = approved.concat(chunk);
            const total = res?.data?.total || 0;
            if (approved.length >= total || chunk.length === 0) break;
            page += 1;
          }

          setEmployees(asList(empRes));
          setLeaveTypes(asList(typesRes));
          setRecords(approved);
        } catch (err) {
          setError(err.message || "Could not load leave balances.");
        } finally {
          setLoading(false);
        }
      })();
    }
  });

  useEffect(() => {
    if (!activeType && leaveTypes.length > 0) {
      setActiveType(leaveTypes[0].leave_name);
    }
  }, [leaveTypes, activeType]);

  // Per employee: { id, name, department, types: { [leaveName]: { allocated, used, balance, pct } }, totalAllocated, totalBalance, totalPct, minPct }
  const balances = useMemo(() => {
    const byEmployee = {};
    employees.forEach((e) => {
      byEmployee[e.id] = {
        id: e.id,
        name: e.full_name,
        photo: e.profile_photo,
        department: e.departments?.department_name || e.department_name || "—",
        used: {},
      };
    });

    records.forEach((r) => {
      const entry = byEmployee[r.employee_id];
      if (!entry) return;
      const typeName = r.leave_types?.leave_name || "Leave";
      entry.used[typeName] = (entry.used[typeName] || 0) + (r.total_days || 0);
    });

    return Object.values(byEmployee).map((emp) => {
      const types = {};
      leaveTypes.forEach((lt) => {
        const allocated = lt.default_days || 0;
        const used = emp.used[lt.leave_name] || 0;
        const balance = Math.max(0, allocated - used);
        types[lt.leave_name] = {
          allocated,
          used,
          balance,
          pct: allocated ? (balance / allocated) * 100 : 0,
        };
      });

      const values = Object.values(types);
      const totalAllocated = values.reduce((s, t) => s + t.allocated, 0);
      const totalBalance = values.reduce((s, t) => s + t.balance, 0);

      return {
        ...emp,
        types,
        totalAllocated,
        totalBalance,
        totalPct: totalAllocated ? (totalBalance / totalAllocated) * 100 : 0,
        minPct: values.length ? Math.min(...values.map((t) => t.pct)) : 100,
      };
    });
  }, [employees, records, leaveTypes]);

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
    () => [...searched].sort((a, b) => a.totalBalance - b.totalBalance),
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
    const runningLow = balances.filter((b) => b.minPct <= 20).length;
    const avgUsedPct = balances.length
      ? Math.round(
          balances.reduce(
            (s, b) => s + (b.totalAllocated ? 100 - b.totalPct : 0),
            0,
          ) / balances.length,
        )
      : 0;
    return { total: balances.length, avgUsedPct, runningLow };
  }, [balances]);

  return (
    <div>
      <PageHeader
        title="Leave balance"
        subtitle="Remaining leave per employee, tracked against approved leave taken."
      />

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-slate-50 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1.5">Employees tracked</p>
          <p className="text-2xl font-semibold text-slate-800">
            {summary.total}
          </p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1.5">Avg balance used</p>
          <p className="text-2xl font-semibold text-slate-800">
            {summary.avgUsedPct}%
          </p>
        </div>
        <div className="bg-red-50 rounded-xl p-4">
          <p className="text-xs text-red-600 mb-1.5">Running low</p>
          <p className="text-2xl font-semibold text-red-700">
            {summary.runningLow}
          </p>
        </div>
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
                  ? "bg-white font-medium text-slate-800 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee or department"
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500/30"
          />
        </div>
      </div>

      {view === "type" && leaveTypes.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto">
          {leaveTypes.map((lt) => (
            <button
              key={lt.id}
              onClick={() => setActiveType(lt.leave_name)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeType === lt.leave_name
                  ? "bg-orange-500 border-orange-500 text-white"
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
              balanceLabel={`${round1(emp.totalBalance)}/${emp.totalAllocated} left`}
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
                balanceLabel={`${round1(t.balance)}/${t.allocated} left`}
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
          <div>
            <div className="flex items-center gap-4 pb-4 mb-1 border-b border-slate-100">
              <BalanceRing
                pct={selectedEmployee.totalPct}
                label={initials(selectedEmployee.name)}
                photo={selectedEmployee.photo}
              />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {round1(selectedEmployee.totalBalance)} /{" "}
                  {selectedEmployee.totalAllocated} days left overall
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Based on approved leave taken this year
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
                  />
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
