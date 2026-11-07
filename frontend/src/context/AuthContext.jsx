import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setUnauthorizedHandler } from "../api/client";

const AuthContext = createContext(null);

const WRITE_ROLES = ["ADMIN", "MANAGER", "AGENT"];
const REPORT_ROLES = ["ADMIN", "MANAGER"];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  // A 401 from any request clears the session and returns to the login screen.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  const persist = useCallback((data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const loginWithPassword = useCallback(
    async (phone, password) => {
      const { data } = await api.post("/auth/login", { phone, password });
      return persist(data);
    },
    [persist]
  );

  const requestOtp = useCallback(async (phone) => {
    const { data } = await api.post("/auth/otp/request", { phone });
    return data;
  }, []);

  const verifyOtp = useCallback(
    async (phone, code) => {
      const { data } = await api.post("/auth/otp/verify", { phone, code });
      return persist(data);
    },
    [persist]
  );

  const permissions = useMemo(
    () => ({
      canWrite: WRITE_ROLES.includes(user?.role),
      canSeeReports: REPORT_ROLES.includes(user?.role),
      isAdmin: user?.role === "ADMIN",
    }),
    [user]
  );

  const value = useMemo(
    () => ({ user, loginWithPassword, requestOtp, verifyOtp, logout, ...permissions }),
    [user, loginWithPassword, requestOtp, verifyOtp, logout, permissions]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
