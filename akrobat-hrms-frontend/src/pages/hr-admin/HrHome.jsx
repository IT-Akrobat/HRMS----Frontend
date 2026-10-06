import { Building2, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HR_COMPANY_HOME, HR_SELF_BASE } from "../../config/roles";
import { useAuth } from "../../context/AuthContext";

// Landing page shown to HR right after login (full screen, no header or
// sidebar). Two round buttons:
//   My Profile -> employee-style workspace (own check-in, attendance, leave)
//   Company    -> HR admin workspace (employees, reports, audit logs...)
// Either side can switch to the other later from the sidebar switcher.
const CHOICES = [
  {
    key: "me",
    title: "My Profile",
    icon: User,
    to: `${HR_SELF_BASE}/dashboard`,
    circle: "bg-orange-500 group-hover:bg-orange-600",
  },
  {
    key: "company",
    title: "Company",
    icon: Building2,
    to: HR_COMPANY_HOME,
    circle: "bg-[#0b1f45] group-hover:bg-[#13306a]",
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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-xl text-slate-600 overflow-hidden mb-4">
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
      <h1 className="text-xl sm:text-2xl font-semibold text-slate-800 text-center">
        {greeting()}, {user?.name?.split(" ")[0] || "there"}
      </h1>
      <p className="text-sm text-slate-500 mt-1 mb-10 text-center">
        Where would you like to go?
      </p>

      <div className="grid grid-cols-2 gap-6 sm:gap-12 w-full max-w-md">
        {CHOICES.map(({ key, title, icon: Icon, to, circle }) => (
          <button
            key={key}
            type="button"
            onClick={() => navigate(to)}
            className="group flex flex-col items-center gap-3 focus:outline-none"
          >
            <span
              className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full ${circle} text-white flex items-center justify-center transition-all group-hover:scale-105 group-active:scale-95 group-focus-visible:ring-4 group-focus-visible:ring-orange-300`}
            >
              <Icon size={44} />
            </span>
            <span className="text-sm sm:text-base font-semibold text-slate-800">
              {title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
