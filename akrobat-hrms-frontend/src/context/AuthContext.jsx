import { createContext, useContext, useEffect, useState } from "react";
import { authService } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Rehydrate session on refresh
    const storedUser = authService.getStoredUser();
    const token = authService.getToken();
    if (storedUser && token) {
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  const login = async (employeeCode, password) => {
    const { user: loggedInUser } = await authService.login(
      employeeCode,
      password,
    );
    setUser(loggedInUser);
    return loggedInUser;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  // Merge a partial update (e.g. { profile: { profile_photo } }) into the
  // shared user object and keep sessionStorage in sync, so every component
  // reading useAuth().user — Header included — reflects the change
  // immediately, without needing a full re-login or its own local copy.
  const updateUser = (partial) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        ...partial,
        profile: { ...prev.profile, ...partial?.profile },
      };
      authService.setStoredUser(next);
      return next;
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
