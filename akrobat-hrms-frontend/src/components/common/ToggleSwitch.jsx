
// Small reusable on/off switch used across Settings-style forms.
// Kept visually in line with the app's brand-orange accent (see
// tailwind.config.js -> colors.brand.orange) instead of the default
// Tailwind blue, so it reads as part of this design system.

export default function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  description,
}) {
  return (
    <label
      className={`flex items-start justify-between gap-4 py-3 ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <div className="min-w-0">
        {label && <p className="text-sm font-medium text-slate-800">{label}</p>}
        {description && (
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative shrink-0 w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-200 ${
          checked ? "bg-brand-orange" : "bg-slate-200"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}
