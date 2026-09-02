import { Link } from "react-router-dom";

// Mobile-only dashboard shortcut row — a horizontally-scrollable strip
// of icon + short label, one per role dashboard (Employee / Manager /
// HR Admin), pointing at that role's most-used pages. Desktop never
// renders this (see the `lg:hidden` on the wrapper below) — desktop
// already has the full sidebar for navigation, this row exists purely
// because the sidebar is hidden on small screens.
//
// `actions` is an array of { to, label, icon } — icon should be the
// SAME lucide-react icon used for that destination in
// config/navigationConfig.js, so the shortcut matches what the person
// sees once they open the sidebar drawer.
//
// Labels stay short on purpose and are hard-truncated with an ellipsis
// (`truncate`, capped to a fixed-width column) rather than wrapping —
// a two-line label under a 44px circle looks cramped, so a longer name
// like "Team Attendance" just clips to "Team Atten…" instead.
export default function MobileQuickActions({ actions }) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="lg:hidden flex items-center gap-4 overflow-x-auto no-scrollbar mt-3 -mx-1 px-1">
      {actions.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="flex flex-col items-center gap-1.5 shrink-0 w-14"
        >
          <span className="w-11 h-11 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
            <Icon size={18} />
          </span>
          <span className="text-[11px] text-slate-500 truncate max-w-full text-center">
            {label}
          </span>
        </Link>
      ))}
    </div>
  );
}
