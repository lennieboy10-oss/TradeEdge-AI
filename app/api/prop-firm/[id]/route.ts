import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const patch: Record<string, unknown> = {};
    const fields = [
      "firm_name","account_size","max_daily_loss","max_drawdown","profit_target",
      "min_trading_days","max_lot_size","news_trading","weekend_holding",
      "consistency_rule","consistency_percent","phase","current_pnl","daily_pnl",
      "trading_days_completed",
    ];
    for (const f of fields) {
      if (f in body) patch[f] = body[f];
    }
    const { error } = await getSupabase().from("prop_firm_accounts").update(patch).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await getSupabase().from("prop_firm_accounts").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
