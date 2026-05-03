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
