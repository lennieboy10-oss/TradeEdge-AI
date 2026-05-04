import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("client_id");
    if (!clientId) return NextResponse.json({ success: true, accounts: [] });
    const { data, error } = await getSupabase()
      .from("prop_firm_accounts")
      .select("*")
      .eq("user_id", clientId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ success: true, accounts: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const clientId = body.client_id as string | null;
    if (!clientId) return NextResponse.json({ success: false, error: "No user id" }, { status: 400 });
    const row = {
      user_id:               clientId,
      firm_name:             body.firm_name,
      account_size:          body.account_size,
      max_daily_loss:        body.max_daily_loss,
      max_drawdown:          body.max_drawdown,
      profit_target:         body.profit_target,
      min_trading_days:      body.min_trading_days ?? null,
      max_lot_size:          body.max_lot_size ?? null,
      news_trading:          body.news_trading ?? false,
      weekend_holding:       body.weekend_holding ?? false,
      consistency_rule:      body.consistency_rule ?? false,
      consistency_percent:   body.consistency_percent ?? null,
      phase:                 body.phase ?? "evaluation",
      current_pnl:           0,
      daily_pnl:             0,
      trading_days_completed: 0,
    };
    const { data, error } = await getSupabase().from("prop_firm_accounts").insert(row).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, account: data });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
