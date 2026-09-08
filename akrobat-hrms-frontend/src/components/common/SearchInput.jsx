// Reusable "search box" — search icon on the left, a clear (X) button on
// the right that appears once there's text, and the same focus/border
// styling used everywhere else in the app. Meant to replace one-off
// <input> + <Search> pairs scattered across pages (Employees, Reports,
// etc.) so the "click X to clear" behavior lives in one place.
import { Search, X } from "lucide-react";

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
  inputClassName = "",
  iconSize = 15,
}) {
  return (
    <div className={`relative ${className}`}>
      <Search
        size={iconSize}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 ${inputClassName}`}
      />
      {!!value && (
        <button
          type="button"
          onClick={() => onChange("")}
          title="Clear"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
