import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId   = searchParams.get("user_id");
  const clientId = searchParams.get("client_id");

  if (!userId && !clientId) {
    return NextResponse.json({ plan: "free", email: null, totalAnalyses: 0, isOnTrial: false, trialEndsAt: null });
  }

  const supabase = getSupabase();

  // Look up profile — prefer user_id (auth user), fall back to client_id (anonymous)
  const profileQuery = userId
    ? supabase.from("profiles").select("plan, email, trial_ends_at, free_analyses_used").eq("user_id", userId).single()
    : supabase.from("profiles").select("plan, email, trial_ends_at, free_analyses_used").eq("client_id", clientId!).single();

  const countQuery = userId
    ? supabase.from("journal").select("id", { count: "exact", head: true }).eq("user_id", userId)
    : supabase.from("journal").select("id", { count: "exact", head: true }).eq("client_id", clientId!);

  const [profileRes, countRes] = await Promise.all([profileQuery, countQuery]);

  // PGRST116 = no row found (new anonymous user) — auto-create trial profile
  if (profileRes.error?.code === "PGRST116" && !userId) {
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await supabase.from("profiles").upsert(
        { client_id: clientId, plan: "trial", trial_ends_at: trialEndsAt },
        { onConflict: "client_id", ignoreDuplicates: true }
      );
    } catch { /* non-fatal */ }
    return NextResponse.json({
      plan:          null,
      email:         null,
      totalAnalyses: countRes.count ?? 0,
      isOnTrial:     true,
      trialEndsAt,
    });
  }

  if (profileRes.error) {
    return NextResponse.json({ plan: null, email: null, totalAnalyses: 0, isOnTrial: false, trialEndsAt: null });
  }

  const serverPlan  = profileRes.data?.plan          ?? null;
  const trialEndsAt = profileRes.data?.trial_ends_at ?? null;
  const isOnTrial   = serverPlan !== "pro" && serverPlan !== "elite" && !!trialEndsAt && new Date(trialEndsAt) > new Date();

  return NextResponse.json({
    plan:               serverPlan,
    email:              profileRes.data?.email               ?? null,
    totalAnalyses:      countRes.count                       ?? 0,
    freeAnalysesUsed:   profileRes.data?.free_analyses_used  ?? 0,
    isOnTrial,
    trialEndsAt,
  });
}
