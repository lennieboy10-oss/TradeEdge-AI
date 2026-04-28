import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

const FREE_LIMIT = 5;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ items: [] });

  const { data, error } = await getSupabase()
    .from("watchlist")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const { clientId, pair, isPro } = await req.json();
  if (!clientId || !pair?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (!isPro) {
    const { count } = await getSupabase()
      .from("watchlist")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId);
    if ((count ?? 0) >= FREE_LIMIT) {
      return NextResponse.json(
        { error: "limit", message: `Free plan allows up to ${FREE_LIMIT} pairs. Upgrade to Pro for unlimited.` },
        { status: 429 }
      );
    }
  }

  const { data, error } = await getSupabase()
    .from("watchlist")
    .insert({ client_id: clientId, pair: pair.trim().toUpperCase() })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Pair already in watchlist" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}

export async function PATCH(req: Request) {
  const { id, clientId, alerts_enabled, alert_signal, alert_confidence, alert_price, alert_email } =
    await req.json();
  if (!id || !clientId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { data, error } = await getSupabase()
    .from("watchlist")
    .update({ alerts_enabled, alert_signal, alert_confidence, alert_price, alert_email })
    .eq("id", id)
    .eq("client_id", clientId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: Request) {
  const { id, clientId } = await req.json();
  if (!id || !clientId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { error } = await getSupabase()
    .from("watchlist")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
