import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthActionResult = {
  success: boolean;
  error?: string;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setLocalProfileName: (fullName: string) => void;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  register: (name: string, email: string, password: string) => Promise<AuthActionResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapAuth() {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (!initialSession) {
          setSession(null);
          setUser(null);
          return;
        }

        // Validate the persisted session against Supabase so the app does not
        // stay "logged in" locally while backend requests fail with 401.
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!isMounted) return;

        if (userError || !userData.user) {
          await supabase.auth.signOut();
          if (!isMounted) return;
          setSession(null);
          setUser(null);
          return;
        }

        const {
          data: { session: verifiedSession },
        } = await supabase.auth.getSession();

        if (!isMounted) return;
        setSession(verifiedSession ?? initialSession);
        setUser(userData.user);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrapAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      setLocalProfileName: (fullName) => {
        setUser((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            user_metadata: {
              ...prev.user_metadata,
              full_name: fullName,
            },
          } as User;
        });
      },
      login: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          return {
            success: false,
            error: error.message,
          };
        }
        return { success: true };
      },
      register: async (name, email, password) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });
        if (error) {
          return {
            success: false,
            error: error.message,
          };
        }
        return { success: true };
      },
      logout: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, user, isLoading]
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
