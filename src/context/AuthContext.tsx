import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { login as loginApi, logoutApi } from "../api/client";
import { clearSession, getAccessToken, getRoles, getUsername, setSession } from "../auth/tokenStorage";

interface AuthContextValue {
  username: string | null;
  roles: string[];
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; errorMessage?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(() => getUsername());
  const [roles, setRoles] = useState<string[]>(() => getRoles());
  const [hasToken, setHasToken] = useState<boolean>(() => !!getAccessToken());

  useEffect(() => {
    // apiClient tu dispatch su kien nay khi refresh token cung het han/khong hop le.
    function handleForcedLogout() {
      clearSession();
      setUsername(null);
      setRoles([]);
      setHasToken(false);
    }
    window.addEventListener("auth:logout", handleForcedLogout);
    return () => window.removeEventListener("auth:logout", handleForcedLogout);
  }, []);

  async function login(user: string, password: string) {
    const res = await loginApi(user, password);
    if (res.success && res.accessToken && res.refreshToken && res.username) {
      setSession(res.accessToken, res.refreshToken, res.username, res.roles);
      setUsername(res.username);
      setRoles(res.roles);
      setHasToken(true);
      return { success: true };
    }
    return { success: false, errorMessage: res.errorMessage };
  }

  async function logout() {
    await logoutApi();
    clearSession();
    setUsername(null);
    setRoles([]);
    setHasToken(false);
  }

  return (
    <AuthContext.Provider value={{ username, roles, isAuthenticated: hasToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
