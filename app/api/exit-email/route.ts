import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Add to Resend audience if configured
    const audienceId = process.env.RESEND_AUDIENCE_ID;
    if (audienceId) {
      try {
        await (resend.contacts as any).create({ email, audienceId, unsubscribed: false });
      } catch { /* non-fatal */ }
    }

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your 3 bonus analyses — ChartIQ AI ⚡",
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
    <div style="display:inline-block;padding:5px 14px;border-radius:99px;background:rgba(0,230,118,0.12);border:1px solid rgba(0,230,118,0.3);margin-bottom:20px;">
      <span style="font-size:11px;font-weight:700;letter-spacing:0.13em;color:#00e676;font-family:monospace;">3 BONUS ANALYSES</span>
    </div>
    <h1 style="font-size:36px;font-weight:900;color:#fff;margin:0 0 12px;line-height:1.1;">Here are your bonus analyses ⚡</h1>
    <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 28px;">
      We've added 3 bonus analyses to your account. Just visit ChartIQ AI and start uploading charts — your bonus analyses are ready to use.
    </p>
    <div style="background:#0c0f18;border:1px solid rgba(0,230,118,0.2);border-radius:16px;padding:20px;margin-bottom:28px;">
      <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">Your bonus</p>
      <p style="color:#00e676;font-family:monospace;font-size:28px;font-weight:700;margin:0;">+3 free analyses</p>
    </div>
    <a href="${appUrl}" style="display:block;background:#00e676;color:#080a10;text-align:center;padding:16px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:32px;">Start Analysing →</a>
    <p style="color:#374151;font-size:12px;text-align:center;">ChartIQ AI · AI-powered chart analysis</p>
  </div>
</body>
</html>`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[exit-email]", err);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
