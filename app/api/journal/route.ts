import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

const FREE_LIMIT = 10;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const assetsParam = searchParams.get("assets");
    const clientId    = searchParams.get("client_id");
    const userId      = searchParams.get("user_id");

    const supabase = getSupabase();

    // Determine plan
    let isPro = false;
    if (clientId) {
      const { data } = await supabase
        .from("profiles")
        .select("plan")
        .eq("client_id", clientId)
        .single();
      isPro = data?.plan === "pro" || data?.plan === "elite";
    } else if (userId) {
      const { data } = await supabase
        .from("profiles")
        .select("plan")
        .eq("user_id", userId)
        .single();
      isPro = data?.plan === "pro" || data?.plan === "elite";
    }

    let query = supabase
      .from("journal")
      .select("*")
      .order("created_at", { ascending: false });

    // CRITICAL: filter by owner — never return other users' entries
    if (clientId) {
      query = query.eq("client_id", clientId);
    } else if (userId) {
      query = query.eq("user_id", userId);
    } else {
      // No identifier — return empty rather than all entries
      return NextResponse.json({ success: true, entries: [], isPro: false });
    }

    if (assetsParam) {
      const assets = assetsParam.split(",").map((a) => a.trim()).filter(Boolean);
      if (assets.length > 0) query = query.in("asset", assets);
    }

    if (!isPro) query = query.limit(FREE_LIMIT);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true, entries: data ?? [], isPro });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch journal";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body     = await req.json();
    const clientId = body.client_id as string | null;
    const userId   = body.user_id   as string | null;
    if (!clientId && !userId) {
      return NextResponse.json({ success: false, error: "No user identifier" }, { status: 400 });
    }
    const supabase = getSupabase();
    const row: Record<string, unknown> = {
      asset:          body.asset         ?? null,
      timeframe:      body.timeframe     ?? null,
      signal:         body.signal        ?? null,
      entry:          body.entry         ?? null,
      stop_loss:      body.stop_loss     ?? null,
      take_profit:    body.take_profit   ?? null,
      risk_reward:    body.risk_reward   ?? null,
      summary:        body.summary       ?? null,
      confidence:     body.confidence    ?? null,
      outcome:        body.outcome       ?? null,
      notes:          body.notes         ?? "",
      pnl:            body.pnl           ?? null,
      r_achieved:     body.r_achieved    ?? null,
      entry_session:  body.entry_session ?? null,
      entry_time_utc: body.entry_time_utc ?? null,
      exit_time:      body.exit_time     ?? null,
      manually_added: true,
    };
    if (clientId) row.client_id = clientId;
    if (userId)   row.user_id   = userId;
    const { data, error } = await supabase.from("journal").insert(row).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, entry: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Insert failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
