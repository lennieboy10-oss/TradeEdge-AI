"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

interface UserPlanState {
  plan: string;
  isPro: boolean;
  email: string | null;
  totalAnalyses: number;
  confirmPro: () => void;       // call immediately after successful payment activation
  refresh: () => Promise<void>; // force re-fetch from Supabase (e.g. after portal)
}

const UserPlanCtx = createContext<UserPlanState>({
  plan: "free",
  isPro: false,
  email: null,
  totalAnalyses: 0,
  confirmPro: () => {},
  refresh: async () => {},
});

export function useUserPlan() {
  return useContext(UserPlanCtx);
}

export function UserPlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan]                   = useState<string>("free");
  const [email, setEmail]                 = useState<string | null>(null);
  const [totalAnalyses, setTotalAnalyses] = useState(0);

  // Called by dashboard/activate — marks plan as pro in state + all storage
  const confirmPro = useCallback(() => {
    setPlan("pro");
    if (typeof window === "undefined") return;
    localStorage.setItem("ciq_plan", "pro");
    localStorage.setItem("ciq_plan_checked_at", Date.now().toString());
    sessionStorage.setItem("ciq_verified_pro", "true");
  }, []);

  const fetchFromSupabase = useCallback(async (clientId: string) => {
    try {
      const res        = await fetch(`/api/user/plan?client_id=${clientId}`);
      const d          = await res.json();
      const serverPlan = d.plan as string | null;

      if (d.email)                          setEmail(d.email);
      if (typeof d.totalAnalyses === "number") setTotalAnalyses(d.totalAnalyses);

      if (serverPlan === "pro") {
        setPlan("pro");
        localStorage.setItem("ciq_plan", "pro");
        localStorage.setItem("ciq_plan_checked_at", Date.now().toString());
        sessionStorage.setItem("ciq_verified_pro", "true");
      } else if (serverPlan === "free") {
        // Only downgrade if we have no local pro claim
        const cached = localStorage.getItem("ciq_plan");
        if (cached !== "pro") {
          setPlan("free");
          localStorage.setItem("ciq_plan", "free");
        }
        localStorage.setItem("ciq_plan_checked_at", Date.now().toString());
      }
      // null → profiles table row missing yet (just paid?), keep cached value
    } catch { /* non-fatal */ }
  }, []);

  // Force re-fetch — clears the 24h cache first
  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    const clientId = localStorage.getItem("ciq_client_id");
    if (!clientId) return;
    localStorage.removeItem("ciq_plan_checked_at");
    await fetchFromSupabase(clientId);
  }, [fetchFromSupabase]);

  useEffect(() => {
    // 1. Read localStorage immediately — no flash
    const cached = localStorage.getItem("ciq_plan") ?? "free";
    setPlan(cached);

    // 2. Session guard: verified pro in this tab already
    if (sessionStorage.getItem("ciq_verified_pro") === "true") {
      setPlan("pro");
      localStorage.setItem("ciq_plan", "pro");
      return;
    }

    // 3. 24h cache: confirmed pro recently, skip Supabase round-trip
    const checkedAt = parseInt(localStorage.getItem("ciq_plan_checked_at") || "0", 10);
    if (cached === "pro" && Date.now() - checkedAt < 24 * 60 * 60 * 1000) {
      setPlan("pro");
      sessionStorage.setItem("ciq_verified_pro", "true");
      return;
    }

    // 4. Fetch from Supabase once — never downgrades a local pro claim
    const clientId = localStorage.getItem("ciq_client_id");
    if (clientId) fetchFromSupabase(clientId);
  }, [fetchFromSupabase]);

  return (
    <UserPlanCtx.Provider value={{ plan, isPro: plan === "pro", email, totalAnalyses, confirmPro, refresh }}>
      {children}
    </UserPlanCtx.Provider>
  );
}
