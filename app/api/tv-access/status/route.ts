import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ status: null });

  const { data } = await getSupabase()
    .from("tradingview_access")
    .select("status, tradingview_username, requested_at, approved_at")
    .eq("user_id", clientId)
    .single();

  if (!data) return NextResponse.json({ status: null });
  return NextResponse.json(data);
}

// GET count of approved/total for social proof
export async function HEAD() {
  const { count } = await getSupabase()
    .from("tradingview_access")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved");
  return new Response(null, { headers: { "x-count": String(count ?? 0) } });
}
