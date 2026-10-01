import {
    Briefcase,
    Building2,
    Calendar,
    Hash,
    Mail,
    MapPin,
    Phone,
} from "lucide-react";
import Avatar from "./Avatar";
import Modal from "./Modal";

function formatJoined(value) {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center shrink-0">
        <Icon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-slate-400">
          {label}
        </div>
        <div className="text-sm text-slate-700 truncate">{children || "—"}</div>
      </div>
    </div>
  );
}

// Shared "tap a card -> see their main details" popup, used by both
// All Employees and My Department. Pass the directory row as `employee`.
export default function EmployeeProfileModal({ employee, onClose }) {
  const e = employee;
  return (
    <Modal
      open={!!e}
      onClose={onClose}
      title="Employee Profile"
      width="max-w-md"
    >
      {e && (
        <div>
          <div className="flex flex-col items-center text-center pb-4 border-b border-slate-100">
            <Avatar
              name={e.full_name}
              photo={e.profile_photo}
              size="w-20 h-20"
              textSize="text-xl"
            />
            <div className="mt-3 text-lg font-semibold text-slate-800">
              {e.full_name}
            </div>
            <div className="text-sm text-slate-500">
              {e.designations?.designation_name || "—"}
            </div>
            {e.departments?.department_name && (
              <span className="mt-2 inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full">
                <Building2 size={11} />
                {e.departments.department_name}
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-50 pt-1">
            <Row icon={Hash} label="Employee ID">
              {e.employee_id}
            </Row>
            <Row icon={Briefcase} label="Designation">
              {e.designations?.designation_name}
            </Row>
            <Row icon={MapPin} label="Work Location">
              {e.work_location}
            </Row>
            <Row icon={Mail} label="Email">
              {e.email && (
                <a
                  href={`mailto:${e.email}`}
                  className="text-orange-600 hover:underline"
                >
                  {e.email}
                </a>
              )}
            </Row>
            <Row icon={Phone} label="Phone">
              {e.phone && (
                <a
                  href={`tel:${e.phone}`}
                  className="text-orange-600 hover:underline"
                >
                  {e.phone}
                </a>
              )}
            </Row>
            <Row icon={Calendar} label="Joined">
              {formatJoined(e.joining_date)}
            </Row>
          </div>
        </div>
      )}
    </Modal>
  );
}
