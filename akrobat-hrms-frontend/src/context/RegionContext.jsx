// Chennai / Singapore region switch.
//
//  * HR (Company workspace) -> same switch as Super Admin; starts on HR's own
//                    region. In HR's My Space it stays on their own region.
//  * Super Admin  -> can flip between CHENNAI and SINGAPORE with the header
//                    toggle. The choice is remembered (localStorage) and sent
//                    to the API as `X-Region` on every request
//                    (see services/apiClient.js).
//  * Everyone else -> locked to their own region (user.profile.region, or
//                    guessed from work_location). The backend ignores the
//                    header for them anyway, so this is only for display.
//
// When the region changes, DashboardLayout re-keys the page area so every
// page remounts and refetches its data for the new region.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { isHrSelfPath, ROLES } from "../config/roles";
import { setActiveRegion } from "../services/apiClient";
import { useAuth } from "./AuthContext";

export const REGIONS = [
  { value: "CHENNAI", label: "Chennai" },
  { value: "SINGAPORE", label: "Singapore" },
];

// Super Admin always lands on Singapore.
const DEFAULT_REGION = "SINGAPORE";

const RegionContext = createContext(null);

function normalize(value) {
  const v = String(value || "")
    .trim()
    .toUpperCase();
  return REGIONS.some((r) => r.value === v) ? v : null;
}

function fromLocationText(text) {
  const t = String(text || "").toLowerCase();
  // Chennai (or India) -> CHENNAI, everyone else -> SINGAPORE.
  if (t.includes("chennai") || t.includes("india")) return "CHENNAI";
  return "SINGAPORE";
}

export function RegionProvider({ children }) {
  const { user, role } = useAuth();
  const { pathname } = useLocation();
  // null = "not chosen yet": Super Admin then starts on Singapore, HR on
  // their own region. Switching afterwards only lasts for this session.
  const [selected, setSelected] = useState(null);

  // Logging out -> next login starts fresh.
  useEffect(() => {
    if (!user) setSelected(null);
  }, [user]);

  const isSuperAdmin = role === ROLES.SUPER_ADMIN;
  const isHr = role === ROLES.HR_ADMIN;
  const ownRegion =
    normalize(user?.profile?.region) ||
    fromLocationText(user?.profile?.work_location);

  // HR can switch region in the Company workspace only. In HR's My Space
  // (own attendance / leave) the region stays on HR's own region so their
  // personal data always loads correctly.
  const canSwitch = isSuperAdmin || (isHr && !isHrSelfPath(pathname));

  const effectiveSelected =
    selected || (isSuperAdmin ? DEFAULT_REGION : ownRegion);

  // Logged out -> no region header at all.
  const region = !user ? null : canSwitch ? effectiveSelected : ownRegion;

  // Must happen synchronously during render (not in an effect): child
  // components fire their fetches in their own effects, which run BEFORE
  // this provider's effects, so the header has to be right already.
  setActiveRegion(region);

  const switchRegion = useCallback(
    (next) => {
      const n = normalize(next);
      if (n && canSwitch) setSelected(n);
    },
    [canSwitch],
  );

  const value = useMemo(
    () => ({
      region, // "CHENNAI" | "SINGAPORE" | null
      regions: REGIONS,
      canSwitch,
      switchRegion,
    }),
    [region, canSwitch, switchRegion],
  );

  return (
    <RegionContext.Provider value={value}>{children}</RegionContext.Provider>
  );
}

export function useRegion() {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error("useRegion must be used within a RegionProvider");
  return ctx;
}
