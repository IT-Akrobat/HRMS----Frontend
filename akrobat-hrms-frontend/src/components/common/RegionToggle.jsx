import { Check, ChevronDown, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRegion } from "../../context/RegionContext";

// Region switcher (header).
//  * Mobile (below lg)  -> pill + dropdown (Chennai / Singapore).
//  * Web (lg and up)    -> original Chennai | Singapore tab pill.
// Super Admin / HR (Company) get the switch; every other role sees nothing.
export default function RegionToggle({ className = "" }) {
  const { region, regions, canSwitch, switchRegion } = useRegion();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close the mobile dropdown on outside tap / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!region) return null;

  const label = regions.find((r) => r.value === region)?.label;

  // Only roles that can actually switch region (Super Admin, HR in Company
  // workspace) see anything here. Employees / Managers / HR My Space get no
  // region label at all.
  if (!canSwitch) return null;

  return (
    <>
      {/* ---------- Mobile: pill + dropdown ---------- */}
      <div ref={wrapRef} className={`relative lg:hidden ${className}`}>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Select region"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#fbd9bf] bg-[#fde8d6] px-3 py-1.5 text-xs font-semibold text-[#1e3a8a] transition-colors hover:bg-[#fbdcc4]"
        >
          <MapPin size={14} className="text-[#e8650f]" />
          {label}
          <ChevronDown
            size={14}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <ul
            role="listbox"
            aria-label="Region"
            className="absolute right-0 top-full mt-2 z-50 min-w-[180px] rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-slate-200"
          >
            {regions.map((r) => {
              const active = r.value === region;
              return (
                <li key={r.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => {
                      switchRegion(r.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm text-left transition-colors ${
                      active
                        ? "bg-[#fde8d6] font-semibold text-[#1e3a8a]"
                        : "text-[#1e3a8a] hover:bg-slate-50"
                    }`}
                  >
                    {r.label}
                    {active && <Check size={16} className="text-[#e8650f]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ---------- Web: original tab toggle ---------- */}
      <div
        role="tablist"
        aria-label="Region"
        className={`hidden lg:inline-flex items-center rounded-full border border-slate-200 bg-white p-1 ${className}`}
      >
        {regions.map((r) => {
          const active = r.value === region;
          return (
            <button
              key={r.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchRegion(r.value)}
              className={`rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold transition-colors ${
                active
                  ? "bg-[#e8650f] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
