import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  MapPin,
  ShieldCheck,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../services/apiClient";

// Employment Details — read-only view of the employee's job info.
// Backed entirely by GET /auth/me (app/auth/services.py -> get_me),
// which now also joins departments/designations/manager/shift onto the
// employee record. Nothing here is editable: employment fields are set
// by HR, not self-service (see EDIT_EMPLOYEE permission notes on
// pages/shared/MyProfile.jsx).

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function tenureLabel(joiningDate) {
  if (!joiningDate) return null;
  const start = new Date(joiningDate);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const parts = [];
  if (years > 0) parts.push(`${years} yr${years === 1 ? "" : "s"}`);
  if (months > 0 || years === 0)
    parts.push(`${months} mo${months === 1 ? "" : "s"}`);
  return parts.join(" ");
}

function formatTime(t) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m} ${suffix}`;
}

function StatusBadge({ status }) {
  const isActive = (status || "Active").toLowerCase() === "active";
  return (
    <span
      className={`text-xs font-medium px-2.5 py-1 rounded-full ${
        isActive
          ? "bg-emerald-50 text-emerald-600"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {status || "Active"}
    </span>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-400">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-800 truncate">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

export default function ProfileEmployment() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient
      .get("/auth/me")
      .then((res) => setProfile(res.data || res))
      .catch((err) =>
        setError(err.message || "Could not load your employment details."),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Employment Details"
          subtitle="Your job, department, and reporting information."
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-72 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const p = profile?.profile || {};
  const name = profile?.name || user?.name || "—";
  const employeeId = p.employee_id || "—";
  const designation = p.designation?.designation_name || "—";
  const department = profile?.department?.department_name || "—";
  const manager = p.manager?.full_name;
  const shift = p.shift;
  const tenure = tenureLabel(p.joining_date);

  return (
    <div>
      <PageHeader
        title="Employment Details"
        subtitle="Your job, department, and reporting information."
      />

      {error && (
        <div className="mb-4 text-sm text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ---------------- Main column ---------------- */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">
                  {employeeId} · {department}
                </p>
                <h2 className="text-lg font-semibold text-slate-800">
                  {designation}
                </h2>
                <p className="text-sm text-slate-500">{name}</p>
              </div>
              <StatusBadge status={p.employment_status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-400 mb-1">Joined On</p>
                <p className="text-sm font-medium text-slate-700">
                  {formatDate(p.joining_date)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Tenure</p>
                <p className="text-sm font-medium text-slate-700">
                  {tenure || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Employee ID</p>
                <p className="text-sm font-medium text-slate-700">
                  {employeeId}
                </p>
              </div>
            </div>
          </div>

          {/* Job & organization */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-1">
              Job & Organization
            </h3>
            <p className="text-xs text-slate-400 mb-2">
              Set by HR — reach out to them for corrections.
            </p>
            <div className="divide-y divide-slate-100">
              <DetailRow
                icon={Briefcase}
                label="Designation"
                value={designation}
              />
              <DetailRow
                icon={Building2}
                label="Department"
                value={department}
              />
              <DetailRow
                icon={MapPin}
                label="Work Location"
                value={p.work_location}
              />
              <DetailRow
                icon={ShieldCheck}
                label="Employment Status"
                value={p.employment_status}
              />
            </div>
          </div>
        </div>

        {/* ---------------- Side column ---------------- */}
        <div className="space-y-6">
          {/* Reporting manager */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">
              Reporting Manager
            </h3>
            {manager ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-semibold text-sm shrink-0">
                  {manager
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0].toUpperCase())
                    .join("")}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {manager}
                  </p>
                  <p className="text-xs text-slate-400">Manager</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <User size={15} /> Not assigned yet
              </div>
            )}
          </div>

          {/* Shift */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Clock size={16} className="text-orange-500" /> Work Shift
            </h3>
            {shift?.shift_name ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-800">
                  {shift.shift_name}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Timing</span>
                  <span className="font-medium text-slate-700">
                    {formatTime(shift.start_time)} –{" "}
                    {formatTime(shift.end_time)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No shift assigned.</p>
            )}
          </div>

          {/* Joining timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Calendar size={16} className="text-orange-500" /> Timeline
            </h3>
            <div className="flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Joined the company
                </p>
                <p className="text-xs text-slate-400">
                  {formatDate(p.joining_date)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
