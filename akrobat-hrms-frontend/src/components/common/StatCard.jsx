// Small color presets so callers just pass a name instead of raw Tailwind
// classes every time. Add more here if a page needs a color this doesn't have.
const COLOR_MAP = {
  orange: "bg-orange-50 text-orange-600",
  blue: "bg-blue-50 text-blue-600",
  green: "bg-blue-50 text-blue-600",
  red: "bg-orange-50 text-orange-600",
  purple: "bg-blue-50 text-blue-600",
  slate: "bg-slate-100 text-slate-600",
};

/**
 * icon: a lucide-react component, e.g. <Users />
 * trend: optional { value: '+24', direction: 'up' | 'down', label: 'vs last week' }
 */
export default function StatCard({
  icon: Icon,
  label,
  value,
  color = "orange",
  trend,
  loading,
  className = "",
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 p-2.5 lg:p-4 flex flex-col gap-2 lg:gap-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] lg:text-sm text-slate-500">{label}</span>
        {Icon && (
          <div
            className={`w-7 h-7 lg:w-9 lg:h-9 rounded-lg flex items-center justify-center ${COLOR_MAP[color]}`}
          >
            <Icon size={14} className="lg:hidden" />
            <Icon size={18} className="hidden lg:block" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-5 w-12 lg:h-7 lg:w-16 bg-slate-100 rounded animate-pulse" />
      ) : (
        <div className="text-lg lg:text-2xl font-bold text-slate-800">
          {value}
        </div>
      )}

      {trend && !loading && (
        <div
          className={`text-xs font-medium ${trend.direction === "up" ? "text-blue-600" : "text-orange-500"}`}
        >
          {trend.direction === "up" ? "↑" : "↓"} {trend.value}{" "}
          <span className="text-slate-400 font-normal">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
