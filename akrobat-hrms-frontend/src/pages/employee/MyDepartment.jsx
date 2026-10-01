import { AlertTriangle, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Avatar from "../../components/common/Avatar";
import EmployeeProfileModal from "../../components/common/EmployeeProfileModal";
import SearchInput from "../../components/common/SearchInput";
import { useAuth } from "../../context/AuthContext";
import { fetchEmployeeDirectory } from "../../services/directoryService";

// Employee -> People -> My Department
// Banner with the department name + one row-card per teammate.
// Tap a card to see that person's main details.

export default function MyDepartment() {
  const { user } = useAuth();
  const departmentId = user?.department?.id;
  const departmentName = user?.department?.department_name;
  const myEmployeeId = user?.profile?.id;

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchEmployeeDirectory()
      .then(setEmployees)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const members = useMemo(
    () =>
      employees.filter((e) => departmentId && e.department_id === departmentId),
    [employees, departmentId],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (e) =>
        e.full_name?.toLowerCase().includes(q) ||
        e.employee_id?.toLowerCase().includes(q) ||
        e.designations?.designation_name?.toLowerCase().includes(q),
    );
  }, [members, search]);

  return (
    <div>
      {/* Department banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0b1f45] to-[#1e3a8a] text-white px-5 py-5 mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest text-blue-200">
            My Department
          </div>
          <div className="text-xl font-bold truncate">
            {departmentName || "No department"}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2 bg-white/10 rounded-xl px-3.5 py-2">
          <Users size={16} className="text-orange-300" />
          <div className="leading-tight">
            <div className="text-lg font-bold">{members.length}</div>
            <div className="text-[10px] uppercase tracking-wide text-blue-200">
              Member{members.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      </div>

      {!departmentId && !loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-400">
          You haven't been assigned to a department yet.
        </div>
      ) : (
        <>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name, ID or designation…"
            className="mb-4 sm:max-w-sm"
          />

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 bg-slate-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <div className="text-sm text-orange-500 flex items-center gap-2">
              <AlertTriangle size={14} /> {error}
            </div>
          ) : visible.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-400">
              No one found.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5">
              {visible.map((e) => {
                const isMe = e.id === myEmployeeId;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setSelected(e)}
                    className="group relative text-left bg-white rounded-xl border border-slate-200 border-t-2 border-t-[#0b1f45] px-2.5 py-3 flex flex-col items-center text-center hover:shadow-md hover:border-orange-300 hover:border-t-orange-400 transition"
                  >
                    {isMe && (
                      <span className="absolute top-1.5 right-1.5 text-[9px] font-medium bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                    <Avatar
                      name={e.full_name}
                      photo={e.profile_photo}
                      size="w-10 h-10"
                      textSize="text-xs"
                    />
                    <div className="mt-2 w-full text-[13px] font-semibold text-slate-800 truncate group-hover:text-orange-600">
                      {e.full_name}
                    </div>
                    <div className="w-full text-[11px] text-slate-500 truncate">
                      {e.designations?.designation_name || "—"}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {e.employee_id}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <EmployeeProfileModal
        employee={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
