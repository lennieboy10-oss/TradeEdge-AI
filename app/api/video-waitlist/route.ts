import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Upsert — ignore duplicate emails
    await supabase.from("video_waitlist").upsert(
      { email },
      { onConflict: "email", ignoreDuplicates: true }
    );

    // Send confirmation email
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "You're on the list — ChartIQ Elite indicator tutorial",
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#080a10;color:#fff;font-family:system-ui,-apple-system,sans-serif;margin:0;padding:0;">
  <div style="max-width:520px;margin:0 auto;padding:48px 24px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:36px;">
      <div style="width:32px;height:32px;border-radius:50%;background:#00e676;display:flex;align-items:center;justify-content:center;">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="#080a10" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <span style="font-size:17px;font-weight:700;">ChartIQ <span style="color:#00e676;">AI</span></span>
    </div>
    <div style="display:inline-block;padding:5px 14px;border-radius:99px;background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.3);margin-bottom:20px;">
      <span style="font-size:11px;font-weight:700;letter-spacing:0.13em;color:#a78bfa;font-family:monospace;">VIDEO TUTORIAL</span>
    </div>
    <h1 style="font-size:32px;font-weight:900;color:#fff;margin:0 0 12px;line-height:1.1;">You're on the list ✅</h1>
    <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 28px;">
      We'll email you the moment the full ChartIQ Elite indicator video tutorial goes live.
      You'll get a step-by-step walkthrough of installation, settings, and live backtesting examples.
    </p>
    <div style="background:#0c0f18;border:1px solid rgba(167,139,250,0.2);border-radius:16px;padding:20px;margin-bottom:28px;">
      <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">What's in the tutorial</p>
      <ul style="color:#d1d5db;font-size:14px;line-height:2;margin:0;padding-left:20px;">
        <li>Full installation walkthrough (3 minutes)</li>
        <li>Settings configuration for every asset</li>
        <li>Live backtesting on XAU/USD 1H</li>
        <li>Reading signals and confluence scores</li>
        <li>Setting up TradingView alerts</li>
      </ul>
    </div>
    <p style="color:#374151;font-size:12px;text-align:center;">ChartIQ AI · Elite member tutorial</p>
  </div>
</body>
</html>`,
      });
    } catch { /* non-fatal — still record the signup */ }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[video-waitlist]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
