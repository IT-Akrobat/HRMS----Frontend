import { useLocation } from "react-router-dom";
import {
    HR_SELF_BASE,
    isHrSelfPath,
    ROLE_BASE_PATH,
    ROLES,
} from "../config/roles";
import { useAuth } from "../context/AuthContext";

/**
 * Base path for "my own" pages (dashboard, attendance, leave history...).
 * Employee -> /employee, Manager -> /manager, and for HR it is
 * /hr-admin/me while they are in My Space, so links inside shared pages
 * keep HR inside the My Space sidebar instead of dropping into Company.
 */
export function useBasePath() {
  const { role } = useAuth();
  const { pathname } = useLocation();
  if (role === ROLES.HR_ADMIN && isHrSelfPath(pathname)) return HR_SELF_BASE;
  return ROLE_BASE_PATH[role] || "/employee";
}
