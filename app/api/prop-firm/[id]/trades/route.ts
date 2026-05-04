import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date"); // YYYY-MM-DD, optional

    let query = getSupabase()
      .from("prop_firm_trades")
      .select("*")
      .eq("account_id", id)
      .order("traded_at", { ascending: false });

    if (date) query = query.eq("trade_date", date);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true, trades: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const supabase = getSupabase();

    const pnl = parseFloat(body.pnl ?? 0);

    // Insert trade
    const today = new Date().toISOString().split("T")[0];
    const { data: trade, error: tradeErr } = await supabase
      .from("prop_firm_trades")
      .insert({
        account_id: id,
        user_id:    body.user_id ?? null,
        asset:      body.asset ?? null,
        direction:  body.direction ?? null,
        pnl,
        notes:      body.notes ?? "",
        trade_date: today,
      })
      .select()
      .single();
    if (tradeErr) throw tradeErr;

    // Update account current_pnl (lifetime) and trading_days_completed if new day
    const { data: acct } = await supabase.from("prop_firm_accounts").select("current_pnl,trading_days_completed").eq("id", id).single();
    const newPnl = (acct?.current_pnl ?? 0) + pnl;

    // Check if this is a new trading day
    const { count } = await supabase
      .from("prop_firm_trades")
      .select("id", { count: "exact", head: true })
      .eq("account_id", id)
      .eq("trade_date", today);
    const isFirstTradeToday = (count ?? 0) <= 1; // just inserted, so <=1

    const accountPatch: Record<string, unknown> = { current_pnl: newPnl };
    if (isFirstTradeToday && (acct?.trading_days_completed ?? 0) > -1) {
      accountPatch.trading_days_completed = (acct?.trading_days_completed ?? 0) + 1;
    }

    await supabase.from("prop_firm_accounts").update(accountPatch).eq("id", id);

    return NextResponse.json({ success: true, trade });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const tradeId = searchParams.get("trade_id");
    const { id: accountId } = await params;
    if (!tradeId) return NextResponse.json({ success: false, error: "No trade_id" }, { status: 400 });

    const supabase = getSupabase();
    // Get trade pnl to reverse it
    const { data: t } = await supabase.from("prop_firm_trades").select("pnl").eq("id", tradeId).single();
    const { error } = await supabase.from("prop_firm_trades").delete().eq("id", tradeId);
    if (error) throw error;

    // Reverse pnl from account
    if (t?.pnl != null) {
      const { data: acct } = await supabase.from("prop_firm_accounts").select("current_pnl").eq("id", accountId).single();
      await supabase.from("prop_firm_accounts").update({ current_pnl: (acct?.current_pnl ?? 0) - t.pnl }).eq("id", accountId);
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
