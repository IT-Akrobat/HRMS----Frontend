import { Building2, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HR_COMPANY_HOME, HR_SELF_BASE } from "../../config/roles";
import { useAuth } from "../../context/AuthContext";

// Landing page shown to HR right after login (full screen, no header or sidebar).
//   My Profile -> employee-style workspace (own check-in, attendance, leave)
//   Company    -> HR admin workspace (employees, reports, audit logs...)
const CHOICES = [
  {
    key: "me",
    title: "My Profile",
    icon: User,
    to: `${HR_SELF_BASE}/dashboard`,
    icon_bg: "bg-orange-500",
    hover: "hover:border-orange-400",
  },
  {
    key: "company",
    title: "Company",
    icon: Building2,
    to: HR_COMPANY_HOME,
    icon_bg: "bg-[#0b1f45]",
    hover: "hover:border-[#0b1f45]",
  },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function HrHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const photo = user?.profile?.profile_photo || null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-5">
      <div className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center font-heading font-semibold text-xl text-slate-600 overflow-hidden mb-4">
        {photo ? (
          <img
            src={photo}
            alt={user?.name}
            className="w-full h-full object-cover"
          />
        ) : (
          (user?.name?.[0] ?? "U")
        )}
      </div>

      <h1 className="font-heading text-2xl font-semibold text-slate-800 text-center">
        {greeting()}, {user?.name?.split(" ")[0] || "there"}
      </h1>
      <p className="text-sm text-slate-500 mt-1 mb-8 text-center">
        Where would you like to go?
      </p>

      <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
        {CHOICES.map(({ key, title, icon: Icon, to, icon_bg, hover }) => (
          <button
            key={key}
            type="button"
            onClick={() => navigate(to)}
            className={`flex flex-col items-center gap-3 py-7 rounded-2xl bg-white border border-slate-200 ${hover} shadow-sm hover:shadow-md active:scale-[0.97] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200`}
          >
            <span
              className={`w-14 h-14 rounded-full ${icon_bg} text-white flex items-center justify-center`}
            >
              <Icon size={26} />
            </span>
            <span className="text-sm font-semibold text-slate-800">
              {title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
