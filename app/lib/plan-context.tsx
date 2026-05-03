"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getSupabaseBrowser } from "./supabase-browser";

interface UserPlanState {
  plan:           string;
  isPro:          boolean;
  isElite:        boolean;
  isOnTrial:      boolean;
  trialEndsAt:    string | null;
  email:          string | null;
  totalAnalyses:  number;
  confirmPro:     () => void;
  confirmPlan:    (plan: string) => void;
  refresh:        () => Promise<void>;
}

const UserPlanCtx = createContext<UserPlanState>({
  plan: "free", isPro: false, isElite: false, isOnTrial: false, trialEndsAt: null,
  email: null, totalAnalyses: 0,
  confirmPro: () => {},
  confirmPlan: () => {},
  refresh: async () => {},
});

export function useUserPlan() {
  return useContext(UserPlanCtx);
}

export function UserPlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan]                   = useState<string>("free");
  const [isOnTrial, setIsOnTrial]         = useState(false);
  const [trialEndsAt, setTrialEndsAt]     = useState<string | null>(null);
  const [email, setEmail]                 = useState<string | null>(null);
  const [totalAnalyses, setTotalAnalyses] = useState(0);

  const confirmPlan = useCallback((activatedPlan: string) => {
    const p = activatedPlan === "elite" ? "elite" : "pro";
    setPlan(p);
    setIsOnTrial(false);
    if (typeof window === "undefined") return;
    localStorage.setItem("ciq_plan", p);
    localStorage.setItem("ciq_plan_checked_at", Date.now().toString());
    sessionStorage.setItem("ciq_verified_pro", "true");
  }, []);

  const confirmPro = useCallback(() => confirmPlan("pro"), [confirmPlan]);

  const fetchPlan = useCallback(async () => {
    if (typeof window === "undefined") return;

    try {
      // Prefer auth user_id, fall back to anonymous client_id
      const sb = getSupabaseBrowser();
      const { data: { session } } = await sb.auth.getSession();
      const userId   = session?.user?.id ?? null;
      const clientId = localStorage.getItem("ciq_client_id");

      let url: string;
      if (userId) {
        url = `/api/user/plan?user_id=${encodeURIComponent(userId)}`;
      } else if (clientId) {
        url = `/api/user/plan?client_id=${encodeURIComponent(clientId)}`;
      } else {
        return;
      }

      const res        = await fetch(url);
      const d          = await res.json();
      const serverPlan = d.plan as string | null;

      if (d.email)                             setEmail(d.email);
      if (typeof d.totalAnalyses === "number") setTotalAnalyses(d.totalAnalyses);
      if (d.trialEndsAt)                       setTrialEndsAt(d.trialEndsAt);

      // Active trial → grant Pro features, keep isOnTrial=true for banner
      if (d.isOnTrial && serverPlan !== "pro") {
        setIsOnTrial(true);
        setPlan("pro");
        localStorage.setItem("ciq_plan", "pro");
        localStorage.setItem("ciq_plan_checked_at", Date.now().toString());
        sessionStorage.setItem("ciq_verified_pro", "true");
        return;
      }

      if (serverPlan === "elite" || serverPlan === "pro") {
        setIsOnTrial(false);
        setPlan(serverPlan);
        localStorage.setItem("ciq_plan", serverPlan);
        localStorage.setItem("ciq_plan_checked_at", Date.now().toString());
        sessionStorage.setItem("ciq_verified_pro", "true");
      } else if (serverPlan === "free" || serverPlan === "trial") {
        setIsOnTrial(false);
        const cached = localStorage.getItem("ciq_plan");
        if (cached !== "pro") {
          setPlan("free");
          localStorage.setItem("ciq_plan", "free");
        }
        localStorage.setItem("ciq_plan_checked_at", Date.now().toString());
      }
      // null → profile row missing, keep cached value
    } catch { /* non-fatal */ }
  }, []);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("ciq_plan_checked_at");
    await fetchPlan();
  }, [fetchPlan]);

  useEffect(() => {
    const cached = localStorage.getItem("ciq_plan") ?? "free";
    setPlan(cached);

    if (sessionStorage.getItem("ciq_verified_pro") === "true") {
      setPlan(cached === "elite" ? "elite" : "pro");
    }

    const checkedAt = parseInt(localStorage.getItem("ciq_plan_checked_at") || "0", 10);
    if ((cached === "pro" || cached === "elite") && Date.now() - checkedAt < 24 * 60 * 60 * 1000) {
      setPlan(cached);
      sessionStorage.setItem("ciq_verified_pro", "true");
      return;
    }

    fetchPlan();
  }, [fetchPlan]);

  // Re-fetch when auth state changes (login / logout)
  useEffect(() => {
    const sb = getSupabaseBrowser();
    const { data: { subscription } } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        // Clear cache and re-fetch
        localStorage.removeItem("ciq_plan_checked_at");
        sessionStorage.removeItem("ciq_verified_pro");
        fetchPlan();
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchPlan]);

  return (
    <UserPlanCtx.Provider value={{
      plan,
      isPro:    plan === "pro" || plan === "elite",
      isElite:  plan === "elite",
      isOnTrial,
      trialEndsAt,
      email,
      totalAnalyses,
      confirmPro,
      confirmPlan,
      refresh,
    }}>
      {children}
    </UserPlanCtx.Provider>
  );
}
