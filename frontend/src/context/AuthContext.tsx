import { createContext, useContext, useMemo, useState } from "react";
import type { AuthUser } from "@/services/authService";
import {
  getSession,
  login as loginService,
  logout as logoutService,
  register as registerService,
} from "@/services/authService";

type AuthActionResult = {
  success: boolean;
  error?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => AuthActionResult;
  register: (name: string, email: string, password: string) => AuthActionResult;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getSession());

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login: (email, password) => {
        const sessionUser = loginService(email, password);
        if (!sessionUser) {
          return {
            success: false,
            error: "Nespravny e-mail nebo heslo.",
          };
        }
        setUser(sessionUser);
        return { success: true };
      },
      register: (name, email, password) => {
        const sessionUser = registerService(name, email, password);
        if (!sessionUser) {
          return {
            success: false,
            error: "Uzivatel s timto e-mailem uz existuje.",
          };
        }
        setUser(sessionUser);
        return { success: true };
      },
      logout: () => {
        logoutService();
        setUser(null);
      },
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth musi byt pouzit uvnitr AuthProvider.");
  }
  return context;
}
