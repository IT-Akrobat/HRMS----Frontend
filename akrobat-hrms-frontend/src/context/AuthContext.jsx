import { createContext, useContext, useEffect, useState } from "react";
import { authService } from "../services/authService";
import { resetNotificationFallback } from "../services/Notificationfallback · JS";
import {
  disablePushNotifications,
  enablePushNotifications,
} from "../services/pushService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Rehydrate session on refresh. There's no client-side token to
    // check anymore (see authService.js) -- the httpOnly cookie either
    // still validates against GET /auth/me or it doesn't, so this just
    // asks the backend rather than reading anything out of storage.
    let cancelled = false;

    authService.restoreSession().then((restoredUser) => {
      if (cancelled) return;
      if (restoredUser) {
        setUser(restoredUser);
        // Covers reopening the app on a device that granted permission
        // before but doesn't have an active subscription anymore (e.g.
        // browser data was cleared) -- enablePushNotifications() itself
        // no-ops quickly if a subscription already exists.
        enablePushNotifications();
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (employeeCode, password) => {
    const { user: loggedInUser } = await authService.login(
      employeeCode,
      password,
    );
    setUser(loggedInUser);
    // Fire-and-forget: prompts for notification permission and registers
    // this device for push (see src/services/pushService.js). Never
    // blocks or fails the login itself -- a denied prompt or
    // unsupported browser just means no push, not a broken sign-in.
    enablePushNotifications();
    return loggedInUser;
  };

  const logout = async () => {
    disablePushNotifications();
    resetNotificationFallback();
    await authService.logout();
    setUser(null);
  };

  // Merge a partial update (e.g. { profile: { profile_photo } }) into the
  // shared user object, so every component reading useAuth().user --
  // Header included -- reflects the change immediately without a full
  // re-login. This only lives in React state now, not localStorage --
  // it's derived, re-fetchable data (GET /auth/me), not a credential, so
  // there's nothing sensitive gained by persisting it, and one less
  // place for stale/stolen data to sit around in.
  const updateUser = (partial) => {
    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ...partial,
        profile: { ...prev.profile, ...partial?.profile },
      };
    });
  };

  const value = {
    user,
    role: user?.role ?? null,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
