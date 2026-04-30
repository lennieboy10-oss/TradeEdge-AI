"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "./supabase-browser";

interface AuthState {
  session:  Session | null;
  user:     User | null;
  loading:  boolean;
  signOut:  () => Promise<void>;
}

const AuthCtx = createContext<AuthState>({
  session: null,
  user:    null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthCtx);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabaseBrowser();

    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await getSupabaseBrowser().auth.signOut();
    setSession(null);
    // Clear cached plan so the next page load re-fetches as anonymous
    if (typeof window !== "undefined") {
      localStorage.removeItem("ciq_plan");
      localStorage.removeItem("ciq_plan_checked_at");
      sessionStorage.removeItem("ciq_verified_pro");
    }
  }

  return (
    <AuthCtx.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}
