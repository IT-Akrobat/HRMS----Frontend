import { useEffect, useRef } from "react";

/**
 * Makes the browser/phone back button close a modal (or bottom sheet, drawer,
 * etc.) instead of leaving the page it was opened from.
 *
 * THE BUG THIS FIXES
 * -------------------
 * Modals in this app are opened with plain React state (e.g.
 * `setViewing(employee)`), which never touches browser history. So when a
 * user taps the phone's back button while a modal is open, the browser has
 * no idea a "modal" exists — it just pops the real previous history entry,
 * which is often a completely different page (e.g. the Dashboard), skipping
 * right past the list page the modal was opened from.
 *
 * HOW THE FIX WORKS
 * ------------------
 * - When `isOpen` becomes true, we push one extra history entry.
 * - If the user presses back, that entry is popped, `popstate` fires, and we
 *   call `onClose()` — so back just closes the modal and leaves you on the
 *   list page, exactly one "back" per screen.
 * - If the user closes the modal some other way (X button, overlay click,
 *   Escape key, Save/Cancel), `isOpen` becomes false on its own. We then
 *   clean up the extra history entry with `history.back()` so the stack
 *   doesn't grow and a *later* back-press doesn't land on a stale entry.
 *
 * USAGE
 * -----
 *   const [viewing, setViewing] = useState(null);
 *   useModalBackClose(!!viewing, () => setViewing(null));
 *
 * Works for any "open" flag: booleans (`editOpen`), nullable objects
 * (`viewing`), or nullable ids (`selectedEmployeeId`) — just pass `!!value`.
 * Safe to call multiple times in the same component for multiple
 * independent modals; stacked/nested modals close in the right order
 * because each pushes and pops its own entry.
 */
export function useModalBackClose(isOpen, onClose) {
  const hasPushedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isOpen && !hasPushedRef.current) {
      // Opening: reserve a history entry for this modal.
      window.history.pushState({ __modal: true }, "");
      hasPushedRef.current = true;
    } else if (!isOpen && hasPushedRef.current) {
      // Closed via something other than the back button (X, overlay,
      // Escape, Save, Cancel...) — remove the entry we reserved so the
      // history stack stays one-entry-per-screen.
      hasPushedRef.current = false;
      window.history.back();
    }
    // Only `isOpen` should re-trigger this; onClose identity changes
    // shouldn't push/pop history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    function handlePopState() {
      if (hasPushedRef.current) {
        hasPushedRef.current = false;
        onCloseRef.current();
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
}
