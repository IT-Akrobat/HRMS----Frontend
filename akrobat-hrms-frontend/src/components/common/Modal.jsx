// import { X } from "lucide-react";
// import { useEffect } from "react";

// // Generic popup/modal shell used for "edit this field" style dialogs
// // (e.g. Edit Profile, Edit Emergency Contact). Renders nothing when
// // `open` is false so callers can always mount it unconditionally.
// export default function Modal({
//   open,
//   onClose,
//   title,
//   subtitle,
//   children,
//   footer,
//   width = "max-w-lg",
// }) {
//   useEffect(() => {
//     if (!open) return;
//     function handleKey(e) {
//       if (e.key === "Escape") onClose?.();
//     }
//     document.addEventListener("keydown", handleKey);
//     document.body.style.overflow = "hidden";
//     return () => {
//       document.removeEventListener("keydown", handleKey);
//       document.body.style.overflow = "";
//     };
//   }, [open, onClose]);

//   if (!open) return null;

//   return (
//     // Bottom sheet on mobile (anchored to the bottom edge, square top
//     // corners hugging the sides), centered dialog from `sm` up — same
//     // responsive pattern already used for the quick-create sheets on
//     // the Super Admin dashboard / LiveTracking / LeaveApply, instead of
//     // the old "small floating card adrift in the middle of the screen"
//     // look this used everywhere before.
//     <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
//       {/* Backdrop */}
//       <div
//         className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
//         onClick={onClose}
//       />

//       {/* Panel */}
//       <div
//         className={`relative w-full ${width} bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 max-h-[88vh] sm:max-h-[90vh] flex flex-col`}
//         role="dialog"
//         aria-modal="true"
//       >
//         {/* Drag-handle affordance — mobile only, signals "this is a sheet
//             you can dismiss", matches the other bottom sheets in the app. */}
//         <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mt-2.5 mb-0.5 sm:hidden shrink-0" />

//         <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-3 sm:py-4 border-b border-slate-100 shrink-0">
//           <div className="min-w-0">
//             <h3 className="text-base font-semibold text-slate-800">{title}</h3>
//             {subtitle && (
//               <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
//             )}
//           </div>
//           <button
//             onClick={onClose}
//             className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg p-1.5 -mt-1 -mr-1 shrink-0"
//           >
//             <X size={18} />
//           </button>
//         </div>

//         <div className="px-5 py-4 overflow-y-auto">{children}</div>

//         {footer && (
//           <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
//             {footer}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
import { X } from "lucide-react";
import { useEffect } from "react";

// Generic popup/modal shell used for "edit this field" style dialogs
// (e.g. Edit Profile, Edit Emergency Contact). Renders nothing when
// `open` is false so callers can always mount it unconditionally.
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "max-w-lg",
}) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Make the mobile/browser back button close the modal instead of
  // leaving the page it's opened on top of.
  //
  // This modal never touches the URL/router -- opening it is just a
  // setState in the parent (e.g. tapping an employee row on Leave
  // Balance sets selectedEmployeeId). That means the browser has no
  // idea a modal is "open" at all. On mobile, tapping the hardware/
  // gesture back button doesn't close the modal first the way it would
  // in a native app -- it just runs whatever "back" already meant
  // before the modal opened, i.e. it jumps straight to the previous
  // *page* (e.g. Dashboard), skipping the modal entirely.
  //
  // Fix: push one extra history entry the moment the modal opens, so
  // there's now something for "back" to consume that isn't the
  // previous page. A back/popstate while open closes the modal instead
  // of navigating away. If the modal is closed some other way (X
  // button, backdrop tap, Escape) we pop that extra entry ourselves on
  // cleanup so the back stack doesn't grow by one every time a modal
  // opens and closes, and a later back tap still needs only one tap.
  useEffect(() => {
    if (!open) return;
    let closedByBack = false;
    window.history.pushState({ modalOpen: true }, "");
    function handlePopState() {
      closedByBack = true;
      onClose?.();
    }
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (!closedByBack) {
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    // Bottom sheet on mobile (anchored to the bottom edge, square top
    // corners hugging the sides), centered dialog from `sm` up — same
    // responsive pattern already used for the quick-create sheets on
    // the Super Admin dashboard / LiveTracking / LeaveApply, instead of
    // the old "small floating card adrift in the middle of the screen"
    // look this used everywhere before.
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`relative w-full ${width} bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 max-h-[88vh] sm:max-h-[90vh] flex flex-col`}
        role="dialog"
        aria-modal="true"
      >
        {/* Drag-handle affordance — mobile only, signals "this is a sheet
            you can dismiss", matches the other bottom sheets in the app. */}
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mt-2.5 mb-0.5 sm:hidden shrink-0" />

        <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-3 sm:py-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-800">{title}</h3>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg p-1.5 -mt-1 -mr-1 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto">{children}</div>

        {footer && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
