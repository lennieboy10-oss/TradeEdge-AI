import { NextResponse } from "next/server";
import { getSupabase } from "../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId   = searchParams.get("user_id");
  const clientId = searchParams.get("client_id");
  const id = userId ?? clientId ?? "";
  if (!id) return NextResponse.json({ error: "missing user_id" }, { status: 400 });

  try {
    const sb = getSupabase();
    const col = userId ? "user_id" : "client_id";
    const { data } = await sb
      .from("profiles")
      .select("current_streak,longest_streak,last_active_date,total_xp,level")
      .eq(col, id)
      .single();
    return NextResponse.json(data ?? {});
  } catch {
    return NextResponse.json({});
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, clientId, xp, level, streak, longestStreak, lastActiveDate } = body;
    const id = userId ?? clientId;
    if (!id) return NextResponse.json({ ok: false });

    const sb = getSupabase();
    const col = userId ? "user_id" : "client_id";
    await sb.from("profiles").upsert({
      [col]:           id,
      total_xp:        xp,
      level:           level,
      current_streak:  streak,
      longest_streak:  longestStreak,
      last_active_date: lastActiveDate,
    }, { onConflict: col });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
