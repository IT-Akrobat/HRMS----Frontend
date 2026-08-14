import { Check, ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Generic, app-styled replacement for a native <select>.
//
// Native <select> popovers are drawn by the OS/browser, so their width
// grows with the longest option ("PURCHASING & LOGISTICS", "QUANTITY
// SURVEYING", etc.) with no way for us to constrain it — on a narrow
// screen that pushes the menu past the right edge of the viewport.
// This component renders the option list ourselves, so we can cap its
// width to the viewport and flip it to a right-aligned position when
// the trigger sits close to the screen edge, so the menu never spills
// off-screen.
export default function SelectDropdown({
  value,
  onChange,
  options, // [{ value, label }]
  placeholder = "Select",
  className = "",
  triggerClassName = "",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState("left");
  const containerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    function handleOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Decide, right when the menu opens, whether it fits below/right of
  // the trigger or needs to hug the right edge instead — this is what
  // keeps it fully on-screen regardless of where the trigger sits.
  useLayoutEffect(() => {
    if (!open || !containerRef.current || !panelRef.current) return;
    const triggerRect = containerRef.current.getBoundingClientRect();
    const panelWidth = panelRef.current.offsetWidth;
    const overflowsRight =
      triggerRect.left + panelWidth > window.innerWidth - 8;
    setAlign(overflowsRight ? "right" : "left");
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between gap-2 w-full px-3 py-2 text-sm border rounded-lg bg-white text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          open
            ? "ring-2 ring-orange-200 border-orange-400"
            : "border-slate-200 hover:border-slate-300"
        } ${triggerClassName}`}
      >
        <span
          className={`truncate ${selected ? "text-slate-700" : "text-slate-400"}`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          className={`absolute z-50 top-full mt-1.5 ${
            align === "right" ? "right-0" : "left-0"
          } w-max min-w-full max-w-[min(260px,calc(100vw-1.5rem))] max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg p-1.5`}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                type="button"
                key={String(opt.value)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                  active
                    ? "bg-orange-500 text-white font-medium"
                    : "text-slate-600 hover:bg-orange-50"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {active && <Check size={14} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
