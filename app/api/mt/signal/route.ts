import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

async function hashKey(key: string): Promise<string> {
  const enc = new TextEncoder().encode(key);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function GET(request: Request) {
  try {
    const auth = request.headers.get("Authorization") ?? "";
    const rawKey = auth.replace(/^Bearer\s+/i, "").trim();

    if (!rawKey) {
      return NextResponse.json({ hasSignal: false, error: "Missing API key" }, { status: 401 });
    }

    const supabase = getSupabase();
    const hash = await hashKey(rawKey);

    const { data: keyRow } = await supabase
      .from("api_keys")
      .select("user_id, is_active")
      .eq("key_hash", hash)
      .single();

    if (!keyRow?.is_active) {
      return NextResponse.json({ hasSignal: false, error: "Invalid or revoked API key" }, { status: 401 });
    }

    // Update last_used
    await supabase
      .from("api_keys")
      .update({ last_used: new Date().toISOString() })
      .eq("key_hash", hash);

    const userId = keyRow.user_id;

    // Get user's automation settings
    const { data: settings } = await supabase
      .from("automation_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    const minConfidence = settings?.min_confidence ?? 80;

    // Get latest high-confidence journal entry (within 24h, not already acted on)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: entries } = await supabase
      .from("journal")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", since)
      .gte("confidence", minConfidence)
      .not("signal", "is", null)
      .not("entry", "is", null)
      .not("stop_loss", "is", null)
      .not("take_profit", "is", null)
      .order("confidence", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    const entry = entries?.[0];
    if (!entry) {
      return NextResponse.json({ hasSignal: false });
    }

    const expiry = new Date(new Date(entry.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Compute lot size
    const e = parseFloat(entry.entry ?? "");
    const sl = parseFloat(entry.stop_loss ?? "");
    let lotSize = 0.1;
    if (e && sl) {
      const dist = Math.abs(e - sl);
      const sym = (entry.asset ?? "").toUpperCase();
      let pipVal = 10;
      if (sym.includes("JPY"))                          pipVal = 9.1;
      if (sym.includes("XAU") || sym.includes("GOLD")) pipVal = 100;
      if (sym.includes("XAG") || sym.includes("SILVER"))pipVal = 50;
      lotSize = Math.max(0.01, Math.min(10, Math.round(100 / (dist * pipVal) * 100) / 100));
    }

    // Determine grade from confidence
    const conf = entry.confidence ?? 0;
    const grade = conf >= 90 ? "A+" : conf >= 80 ? "A" : conf >= 70 ? "B" : "C";

    return NextResponse.json({
      hasSignal:   true,
      asset:       (entry.asset ?? "").replace(/[/\\]/g, "").toUpperCase(),
      direction:   (entry.signal ?? "").toUpperCase(),
      entry:       parseFloat(entry.entry ?? "0"),
      stopLoss:    parseFloat(entry.stop_loss ?? "0"),
      takeProfit:  parseFloat(entry.take_profit ?? "0"),
      lotSize,
      confidence:  entry.confidence,
      grade,
      expiry,
      journalId:   entry.id,
    });
  } catch (err) {
    console.error("MT signal error:", err);
    return NextResponse.json({ hasSignal: false, error: "Internal error" }, { status: 500 });
  }
}
