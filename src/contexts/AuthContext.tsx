import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "parent" | "staff";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  profile: { full_name: string; email: string; phone: string | null; customer_type: string | null; profile_photo: string | null } | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null; needsEmailConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [authLoadKey, setAuthLoadKey] = useState(0);

  const fetchUserData = async (userId: string) => {
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("full_name, email, phone, customer_type, profile_photo").eq("user_id", userId).single(),
    ]);

    if (rolesRes.data && rolesRes.data.length > 0) {
      const hasAdmin = rolesRes.data.some((r: any) => r.role === "admin");
      const hasStaff = rolesRes.data.some((r: any) => r.role === "staff");
      setRole(hasAdmin ? "admin" : hasStaff ? "staff" : "parent");
    } else {
      setRole("parent");
    }

    if (profileRes.data) {
      setProfile(profileRes.data);
    } else {
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setRole(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setRole(null);
      setProfile(null);
      setLoading(true);
      setAuthLoadKey((current) => current + 1);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    });

    // Mobile browsers throttle timers on backgrounded tabs, so the access
    // token can slip past its ~1h expiry without auto-refreshing. When the
    // tab regains focus, proactively refresh the session so the next write
    // (add child, checkout, booking) carries a valid token — otherwise it
    // reaches the database unauthenticated and trips row-level security.
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") {
        void supabase.auth.getSession();
      }
    };
    document.addEventListener("visibilitychange", refreshOnFocus);
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", refreshOnFocus);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    const loadUserData = async () => {
      try {
        await fetchUserData(user.id);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadUserData();

    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoadKey]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (!error) {
      // Fire branded welcome email (non-blocking)
      void supabase.functions.invoke("send-email", {
        body: {
          template: "welcome",
          to: email,
          data: { email, fullName },
        },
      });
    }
    // No session on success = the project requires email confirmation; the
    // caller adjusts its messaging (and redirect) accordingly.
    return { error: error as Error | null, needsEmailConfirmation: !error && !data?.session };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user?.id) await fetchUserData(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, profile, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
