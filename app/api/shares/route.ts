import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { asset, signal, platform } = await request.json();
    const supabase = getSupabase();
    await supabase.from("shares").insert({ asset: asset ?? null, signal: signal ?? null, platform: platform ?? null });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const asset  = searchParams.get("asset");
    const signal = searchParams.get("signal");
    const supabase = getSupabase();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Count for a specific asset+signal this week
    if (asset && signal) {
      const { count } = await supabase
        .from("shares")
        .select("id", { count: "exact", head: true })
        .eq("asset", asset)
        .eq("signal", signal)
        .gte("created_at", weekAgo);
      return NextResponse.json({ success: true, count: count ?? 0 });
    }

    // Top 3 setups this week
    const { data } = await supabase
      .from("shares")
      .select("asset, signal")
      .gte("created_at", weekAgo)
      .not("asset", "is", null);

    const counts: Record<string, { asset: string; signal: string; count: number }> = {};
    (data ?? []).forEach(({ asset: a, signal: s }) => {
      const key = `${a}||${s}`;
      if (!counts[key]) counts[key] = { asset: a, signal: s, count: 0 };
      counts[key].count++;
    });

    const top3 = Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return NextResponse.json({ success: true, setups: top3 });
  } catch {
    return NextResponse.json({ success: true, count: 0, setups: [] });
  }
}
