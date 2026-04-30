import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = getSupabase();

    const asset      = body.asset ?? body.symbol ?? body.ticker ?? null;
    const signal     = body.signal ?? body.direction ?? body.action ?? null;
    const entry      = body.entry  ?? body.price    ?? body.close  ?? null;
    const stopLoss   = body.stopLoss  ?? body.stop_loss  ?? body.sl  ?? null;
    const takeProfit = body.takeProfit ?? body.take_profit ?? body.tp ?? null;
    const confidence = parseInt(body.confidence ?? "0", 10) || null;
    const timeframe  = body.timeframe ?? body.interval ?? null;
    const message    = body.message ?? null;
    const apiKey     = body.apiKey ?? body.api_key ?? null;

    // Look up user by API key if provided
    let userId: string | null = null;
    let userEmail: string | null = null;

    if (apiKey) {
      const hash = await hashKey(apiKey);
      const { data: keyRow } = await supabase
        .from("api_keys")
        .select("user_id")
        .eq("key_hash", hash)
        .eq("is_active", true)
        .single();
      if (keyRow) {
        userId = keyRow.user_id;
        // Update last_used
        await supabase
          .from("api_keys")
          .update({ last_used: new Date().toISOString() })
          .eq("key_hash", hash);
        // Get email for notification
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", userId)
          .single();
        userEmail = profile?.email ?? null;
      }
    }

    // Save to journal
    const insertData: Record<string, unknown> = {
      asset,
      signal:      signal?.toUpperCase() ?? null,
      entry,
      stop_loss:   stopLoss,
      take_profit: takeProfit,
      confidence,
      timeframe,
      summary:     message ?? `TradingView webhook alert for ${asset ?? "unknown"}`,
      notes:       "Auto-saved via TradingView webhook",
      user_id:     userId,
    };
    // Remove nullish
    Object.keys(insertData).forEach((k) => insertData[k] === null && delete insertData[k]);

    const { data: journalRow } = await supabase
      .from("journal")
      .insert(insertData)
      .select("id")
      .single();

    // Send email if we have a user
    if (userEmail && asset && signal) {
      await sendWebhookEmail({ to: userEmail, asset, signal, entry, stopLoss, takeProfit, confidence, message });
    }

    return NextResponse.json({ success: true, journalId: journalRow?.id ?? null });
  } catch (err) {
    console.error("TV webhook error:", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

async function hashKey(key: string): Promise<string> {
  const enc = new TextEncoder().encode(key);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendWebhookEmail(p: {
  to: string; asset: string; signal: string;
  entry?: string | null; stopLoss?: string | null; takeProfit?: string | null;
  confidence?: number | null; message?: string | null;
}) {
  try {
    const { Resend } = await import("resend");
    const resend  = new Resend(process.env.RESEND_API_KEY);
    const from    = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "https://trade-edge-ai.vercel.app";
    const sigColor = p.signal === "LONG" || p.signal === "BUY" ? "#00e676" : "#f87171";

    await resend.emails.send({
      from,
      to: p.to,
      subject: `TradingView Alert — ${p.asset} ${p.signal}`,
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
    <span style="font-size:11px;font-weight:700;letter-spacing:0.13em;color:#00e676;font-family:monospace;">TRADINGVIEW ALERT</span>
  </div>
  <h1 style="font-size:36px;font-weight:900;color:#fff;margin:0 0 8px;line-height:1.1;">
    ${p.asset}<br/><span style="color:${sigColor};">→ ${p.signal}</span>
  </h1>
  <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Your TradingView alert has been triggered and saved to your ChartIQ journal.</p>
  ${[
    p.entry      ? `<tr><td style="color:#6b7280;font-size:14px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Entry</td><td style="font-family:monospace;font-size:14px;font-weight:600;color:#fff;text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${p.entry}</td></tr>` : "",
    p.stopLoss   ? `<tr><td style="color:#6b7280;font-size:14px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Stop Loss</td><td style="font-family:monospace;font-size:14px;font-weight:600;color:#f87171;text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${p.stopLoss}</td></tr>` : "",
    p.takeProfit ? `<tr><td style="color:#6b7280;font-size:14px;padding:10px 0;">Take Profit</td><td style="font-family:monospace;font-size:14px;font-weight:600;color:#4ade80;text-align:right;padding:10px 0;">${p.takeProfit}</td></tr>` : "",
  ].filter(Boolean).join("").length ? `<table style="width:100%;border-collapse:collapse;background:#0c0f18;border:1px solid rgba(255,255,255,0.07);border-radius:16px;overflow:hidden;margin-bottom:24px;"><tbody style="display:block;padding:8px 20px;">${[
    p.entry      ? `<tr><td style="color:#6b7280;font-size:14px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Entry</td><td style="font-family:monospace;font-size:14px;font-weight:600;color:#fff;text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${p.entry}</td></tr>` : "",
    p.stopLoss   ? `<tr><td style="color:#6b7280;font-size:14px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Stop Loss</td><td style="font-family:monospace;font-size:14px;font-weight:600;color:#f87171;text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${p.stopLoss}</td></tr>` : "",
    p.takeProfit ? `<tr><td style="color:#6b7280;font-size:14px;padding:10px 0;">Take Profit</td><td style="font-family:monospace;font-size:14px;font-weight:600;color:#4ade80;text-align:right;padding:10px 0;">${p.takeProfit}</td></tr>` : "",
  ].filter(Boolean).join("")}</tbody></table>` : ""}
  ${p.message ? `<div style="padding:16px 20px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin-bottom:28px;"><p style="color:#9ca3af;font-size:13px;line-height:1.7;margin:0;">${p.message}</p></div>` : ""}
  <a href="${appUrl}/journal" style="display:block;background:#00e676;color:#080a10;text-align:center;padding:16px 24px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:32px;">View in Journal →</a>
  <p style="color:#374151;font-size:12px;text-align:center;">Auto-saved to your ChartIQ journal via webhook.</p>
</div></body></html>`,
    });
  } catch { /* non-fatal */ }
}
