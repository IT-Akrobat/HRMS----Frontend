// Input with the same look as the Login screen: pill input with a left
// icon on desktop, floating-label rounded box on mobile.
export default function AuthField({
  id,
  label,
  icon: Icon,
  right = null,
  className = "",
  ...inputProps
}) {
  return (
    <div className="max-lg:relative max-lg:rounded-2xl max-lg:border max-lg:border-slate-200 max-lg:bg-white/80 max-lg:px-4 max-lg:pt-2.5 max-lg:pb-2 max-lg:transition-colors max-lg:focus-within:border-[#0b1f45]">
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-[#0b1f45] mb-2 max-lg:mb-0 max-lg:pl-9 max-lg:text-[15px] max-lg:font-medium"
      >
        {label}
      </label>
      <div className="relative max-lg:static">
        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#0b1f45]" />
        <input
          id={id}
          className={`w-full pl-12 pr-12 py-3 rounded-full border border-gray-200 transition-colors focus:border-[#0b1f45] focus:ring-[#0b1f45] max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:py-0.5 max-lg:pl-9 max-lg:pr-9 max-lg:text-[15px] max-lg:outline-none max-lg:focus:ring-0 max-lg:placeholder:text-slate-400 ${className}`}
          {...inputProps}
        />
        {right}
      </div>
    </div>
  );
}
