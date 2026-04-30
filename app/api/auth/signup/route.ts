import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export async function POST(req: Request) {
  try {
    const { userId, email } = await req.json();

    if (!userId || !email) {
      return NextResponse.json({ error: "userId and email required" }, { status: 400 });
    }

    const supabase    = getSupabase();
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from("profiles").upsert(
      {
        user_id:       userId,
        email,
        plan:          "trial",
        trial_ends_at: trialEndsAt,
      },
      { onConflict: "user_id", ignoreDuplicates: false }
    );

    if (error) {
      console.error("[auth/signup] profile upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, trialEndsAt });
  } catch (err) {
    console.error("[auth/signup] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
