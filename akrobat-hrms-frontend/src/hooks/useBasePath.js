import { useLocation } from "react-router-dom";
import {
  isSelfSpacePath,
  ROLE_BASE_PATH,
  SELF_SPACE_BY_ROLE,
} from "../config/roles";
import { useAuth } from "../context/AuthContext";

/**
 * Base path for "my own" pages (dashboard, attendance, leave history...).
 * Employee -> /employee. HR and Manager get /hr-admin/me and /manager/me
 * while they are in My Space (otherwise /hr-admin, /manager), so links
 * inside shared pages keep them inside the My Space sidebar instead of
 * dropping into Company.
 */
export function useBasePath() {
  const { role } = useAuth();
  const { pathname } = useLocation();
  if (isSelfSpacePath(role, pathname)) return SELF_SPACE_BY_ROLE[role].base;
  return ROLE_BASE_PATH[role] || "/employee";
}
