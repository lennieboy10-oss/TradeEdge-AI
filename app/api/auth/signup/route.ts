import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export async function POST(req: Request) {
  try {
    const { userId, email, plan, trialEndsAt } = await req.json();

    if (!userId || !email) {
      return NextResponse.json({ error: "userId and email required" }, { status: 400 });
    }

    const chosenPlan  = plan === "free" ? "free" : "trial";
    const trialExpiry = chosenPlan === "trial"
      ? (trialEndsAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      : null;

    const supabase = getSupabase();
    const { error } = await supabase.from("profiles").upsert(
      {
        user_id:       userId,
        email,
        plan:          chosenPlan,
        trial_ends_at: trialExpiry,
      },
      { onConflict: "user_id", ignoreDuplicates: false }
    );

    if (error) {
      console.error("[auth/signup] profile upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, plan: chosenPlan, trialEndsAt: trialExpiry });
  } catch (err) {
    console.error("[auth/signup] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
