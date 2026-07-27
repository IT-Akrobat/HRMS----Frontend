import { X } from "lucide-react";
import {
    createContext,
    useCallback,
    useContext,
    useRef,
    useState,
} from "react";

// ---------------------------------------------------------------------
// Global toast stack. Mounted once at the app root (see main.jsx) so
// any component — anywhere in the tree, for any signed-in role — can
// pop a toast via useToast().showToast(...).
//
// Primary consumer today: NotificationBell in components/layout/Header.jsx,
// which polls GET /notifications/my and calls showToast() for any
// notification it hasn't seen before, so a new notification (leave
// approved/rejected, late check-in flagged to a Super Admin, etc.)
// surfaces immediately instead of only appearing after a manual page
// refresh.
// ---------------------------------------------------------------------

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
  }, []);

  const showToast = useCallback(
    ({
      title,
      message,
      icon: Icon,
      iconClassName = "text-orange-500 bg-orange-50",
      duration = 6000,
      onClick,
    } = {}) => {
      const id = ++idCounter;

      setToasts((prev) => {
        // Cap the visible stack so a burst of notifications (e.g. a
        // broadcast to everyone) doesn't fill the whole screen.
        const next = [
          ...prev,
          { id, title, message, Icon, iconClassName, onClick },
        ];
        return next.length > 4 ? next.slice(next.length - 4) : next;
      });

      timersRef.current[id] = setTimeout(() => dismissToast(id), duration);

      return id;
    },
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}

      {/* Toast stack — fixed, top-right, above everything else */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => {
              t.onClick?.();
              dismissToast(t.id);
            }}
            className={`animate-toast-in pointer-events-auto bg-white rounded-xl shadow-lg border border-slate-100 p-3.5 flex gap-3 items-start transition-shadow ${
              t.onClick ? "cursor-pointer hover:shadow-xl" : ""
            }`}
          >
            {t.Icon && (
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.iconClassName}`}
              >
                <t.Icon size={16} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              {t.title && (
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {t.title}
                </p>
              )}
              {t.message && (
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                  {t.message}
                </p>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissToast(t.id);
              }}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-50"
              aria-label="Dismiss notification"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
