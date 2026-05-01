import { NextResponse } from "next/server";
import { getSupabase } from "../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id") ?? searchParams.get("client_id") ?? "";
  if (!userId) return NextResponse.json({ error: "missing user_id" }, { status: 400 });

  try {
    const sb = getSupabase();
    const { data } = await sb
      .from("profiles")
      .select("current_streak,longest_streak,last_active_date,total_xp,level")
      .eq("user_id", userId)
      .single();
    return NextResponse.json(data ?? {});
  } catch {
    return NextResponse.json({});
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, xp, level, streak, longestStreak, lastActiveDate } = body;
    if (!userId) return NextResponse.json({ ok: false });

    const sb = getSupabase();
    await sb.from("profiles").upsert({
      user_id:         userId,
      total_xp:        xp,
      level:           level,
      current_streak:  streak,
      longest_streak:  longestStreak,
      last_active_date: lastActiveDate,
    }, { onConflict: "user_id" });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
