import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

async function hashKey(key: string): Promise<string> {
  const enc = new TextEncoder().encode(key);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  try {
    const auth   = request.headers.get("Authorization") ?? "";
    const rawKey = auth.replace(/^Bearer\s+/i, "").trim();
    const body   = await request.json();

    const supabase = getSupabase();
    let userId: string | null = null;

    if (rawKey) {
      const hash = await hashKey(rawKey);
      const { data: keyRow } = await supabase
        .from("api_keys")
        .select("user_id")
        .eq("key_hash", hash)
        .eq("is_active", true)
        .single();
      userId = keyRow?.user_id ?? null;
    }

    const {
      ticket, asset, direction, entry, stopLoss,
      takeProfit, lotSize, confidence, platform,
    } = body;

    // Auto-create journal entry for placed trade
    await supabase.from("journal").insert({
      asset:       asset ?? null,
      signal:      direction ?? null,
      entry:       String(entry ?? ""),
      stop_loss:   String(stopLoss ?? ""),
      take_profit: String(takeProfit ?? ""),
      confidence:  confidence ?? null,
      notes:       `Auto-placed via ${platform ?? "MT"} EA — Ticket #${ticket ?? "?"}. Lot: ${lotSize ?? 0.1}`,
      user_id:     userId,
      summary:     `Trade placed automatically by ChartIQ EA on ${platform ?? "MetaTrader"}`,
    });

    // Send email confirmation
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .single();
      if (profile?.email) {
        await sendTradeEmail({
          to: profile.email, asset, direction, entry: String(entry),
          stopLoss: String(stopLoss), takeProfit: String(takeProfit),
          lotSize: String(lotSize), confidence, platform: platform ?? "MetaTrader",
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("MT confirm error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

async function sendTradeEmail(p: {
  to: string; asset: string; direction: string;
  entry: string; stopLoss: string; takeProfit: string;
  lotSize: string; confidence: number; platform: string;
}) {
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from   = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://trade-edge-ai.vercel.app";
    const isLong = p.direction === "BUY" || p.direction === "LONG";

    await resend.emails.send({
      from,
      to: p.to,
      subject: `Trade placed — ${p.asset} ${p.direction} via ${p.platform}`,
      html: `<!DOCTYPE html><html><body style="background:#080a10;color:#fff;font-family:system-ui,sans-serif;margin:0;padding:0;">
<div style="max-width:520px;margin:0 auto;padding:48px 24px;">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:36px;">
    <div style="width:32px;height:32px;border-radius:50%;background:#00e676;display:flex;align-items:center;justify-content:center;">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="#080a10" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <span style="font-size:17px;font-weight:700;">ChartIQ <span style="color:#00e676;">AI</span></span>
  </div>
  <div style="display:inline-flex;align-items:center;gap:8px;padding:5px 14px;border-radius:99px;background:rgba(0,230,118,0.12);border:1px solid rgba(0,230,118,0.3);margin-bottom:20px;">
    <span style="width:6px;height:6px;border-radius:50%;background:#00e676;display:inline-block;"></span>
    <span style="font-size:11px;font-weight:700;letter-spacing:0.13em;color:#00e676;font-family:monospace;">TRADE PLACED</span>
  </div>
  <h1 style="font-size:36px;font-weight:900;color:#fff;margin:0 0 8px;line-height:1.1;">
    ${p.asset}<br/><span style="color:${isLong ? "#00e676" : "#f87171"};">→ ${p.direction}</span>
  </h1>
  <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Trade placed via ${p.platform} EA · Confidence: ${p.confidence}%</p>
  <table style="width:100%;border-collapse:collapse;background:#0c0f18;border:1px solid rgba(255,255,255,0.07);border-radius:16px;overflow:hidden;margin-bottom:28px;">
    <tbody style="display:block;padding:8px 20px;">
      <tr><td style="color:#6b7280;font-size:14px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Entry</td><td style="font-family:monospace;font-size:14px;font-weight:600;color:#fff;text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${p.entry}</td></tr>
      <tr><td style="color:#6b7280;font-size:14px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Stop Loss</td><td style="font-family:monospace;font-size:14px;font-weight:600;color:#f87171;text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${p.stopLoss}</td></tr>
      <tr><td style="color:#6b7280;font-size:14px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Take Profit</td><td style="font-family:monospace;font-size:14px;font-weight:600;color:#4ade80;text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${p.takeProfit}</td></tr>
      <tr><td style="color:#6b7280;font-size:14px;padding:10px 0;">Lot Size</td><td style="font-family:monospace;font-size:14px;font-weight:600;color:#c084fc;text-align:right;padding:10px 0;">${p.lotSize}</td></tr>
    </tbody>
  </table>
  <a href="${appUrl}/journal" style="display:block;background:#00e676;color:#080a10;text-align:center;padding:16px 24px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:28px;">View Journal Entry →</a>
  <p style="color:#374151;font-size:12px;line-height:1.8;text-align:center;">ChartIQ AI signals are for informational purposes only. You are solely responsible for all trades.</p>
</div></body></html>`,
    });
  } catch { /* non-fatal */ }
}
