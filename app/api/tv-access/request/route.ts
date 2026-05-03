import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const resend     = new Resend(process.env.RESEND_API_KEY);
const FROM       = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const APP_URL    = process.env.NEXT_PUBLIC_APP_URL ?? "https://trade-edge-ai.vercel.app";

export async function POST(req: Request) {
  try {
    const { clientId, tvUsername } = await req.json();
    if (!clientId || !tvUsername?.trim()) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = getSupabase();
    const username = tvUsername.trim();

    // Verify Elite plan
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, plan")
      .eq("client_id", clientId)
      .single();

    if (!profile || profile.plan !== "elite") {
      return NextResponse.json({ error: "Elite plan required" }, { status: 403 });
    }

    const email = profile.email ?? null;
    const now   = new Date().toISOString();

    // Upsert — update username if request already exists
    const { data, error } = await supabase
      .from("tradingview_access")
      .upsert(
        { user_id: clientId, email, tradingview_username: username, status: "pending", requested_at: now },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Email to user
    if (email) {
      resend.emails.send({
        from: FROM,
        to: email,
        subject: "ChartIQ Elite — TradingView access requested",
        html: userRequestEmail(username, email),
      }).catch(() => {});
    }

    // Email to admin
    if (ADMIN_EMAIL) {
      resend.emails.send({
        from: FROM,
        to: ADMIN_EMAIL,
        subject: `New Elite indicator access request — ${username}`,
        html: adminNotifyEmail(email ?? "unknown", username, now, APP_URL),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, status: data.status, tvUsername: data.tradingview_username });
  } catch (err) {
    console.error("[tv-access/request]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// ── Email templates ────────────────────────────────────────────

function userRequestEmail(username: string, _email: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="background:#080a10;color:#fff;font-family:system-ui,sans-serif;margin:0;padding:0;">
<div style="max-width:520px;margin:0 auto;padding:48px 24px;">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:36px;">
    <div style="width:32px;height:32px;border-radius:50%;background:#00e676;display:flex;align-items:center;justify-content:center;">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="#080a10" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <span style="font-size:17px;font-weight:700;">ChartIQ <span style="color:#00e676;">AI</span></span>
  </div>
  <div style="display:inline-block;padding:5px 14px;border-radius:99px;background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.3);margin-bottom:20px;">
    <span style="font-size:11px;font-weight:700;letter-spacing:0.13em;color:#a78bfa;font-family:monospace;">ELITE INDICATOR</span>
  </div>
  <h1 style="font-size:32px;font-weight:900;color:#fff;margin:0 0 12px;line-height:1.1;">Access request received ✅</h1>
  <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 24px;">
    We have received your request for access to the <strong style="color:#fff;">ChartIQ AI Signal System</strong>.
  </p>
  <div style="background:#0c0f18;border:1px solid rgba(0,230,118,0.2);border-radius:16px;padding:20px;margin-bottom:24px;">
    <p style="color:#6b7280;font-size:13px;margin:0 0 4px;">TradingView username</p>
    <p style="color:#00e676;font-family:monospace;font-size:20px;font-weight:700;margin:0;">${username}</p>
  </div>
  <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 24px;">
    We will grant you access within <strong style="color:#fff;">2 hours</strong>. You will receive a TradingView notification when access is ready.
  </p>
  <div style="background:#0c0f18;border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:20px;margin-bottom:28px;">
    <p style="color:#6b7280;font-size:13px;margin:0 0 12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">Once approved:</p>
    <ol style="color:#d1d5db;font-size:14px;line-height:2;margin:0;padding-left:20px;">
      <li>Go to <strong style="color:#fff;">tradingview.com</strong> and open any chart</li>
      <li>Click <strong style="color:#fff;">Indicators</strong> at the top of the chart</li>
      <li>Click the <strong style="color:#fff;">Invite-only scripts</strong> tab</li>
      <li>Find <strong style="color:#fff;">ChartIQ AI Signal System</strong></li>
      <li>Click the + button to add it to your chart</li>
    </ol>
  </div>
  <p style="color:#374151;font-size:12px;text-align:center;">ChartIQ AI · Elite member support · elite@chartiq.app</p>
</div>
</body></html>`;
}

function adminNotifyEmail(email: string, username: string, timestamp: string, appUrl: string) {
  const dt = new Date(timestamp).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="background:#080a10;color:#fff;font-family:system-ui,sans-serif;margin:0;padding:0;">
<div style="max-width:520px;margin:0 auto;padding:48px 24px;">
  <h1 style="font-size:24px;font-weight:900;color:#fff;margin:0 0 20px;">New indicator access request</h1>
  <div style="background:#0c0f18;border:1px solid rgba(0,230,118,0.2);border-radius:16px;padding:20px;margin-bottom:24px;">
    <p style="color:#6b7280;font-size:13px;margin:0 0 4px;">ChartIQ email</p>
    <p style="color:#fff;font-size:16px;font-weight:600;margin:0 0 16px;">${email}</p>
    <p style="color:#6b7280;font-size:13px;margin:0 0 4px;">TradingView username</p>
    <p style="color:#00e676;font-family:monospace;font-size:20px;font-weight:700;margin:0 0 16px;">${username}</p>
    <p style="color:#6b7280;font-size:13px;margin:0 0 4px;">Requested at</p>
    <p style="color:#9ca3af;font-size:14px;margin:0;">${dt}</p>
  </div>
  <div style="background:#0c0f18;border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:20px;margin-bottom:24px;">
    <p style="color:#6b7280;font-size:13px;margin:0 0 12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">To grant access on TradingView:</p>
    <ol style="color:#d1d5db;font-size:14px;line-height:2;margin:0;padding-left:20px;">
      <li>Open TradingView and go to your ChartIQ script</li>
      <li>Click <strong style="color:#fff;">Manage Access</strong></li>
      <li>Add username: <strong style="color:#00e676;font-family:monospace;">${username}</strong></li>
    </ol>
  </div>
  <a href="${appUrl}/admin/indicator-access" style="display:block;background:#00e676;color:#080a10;text-align:center;padding:14px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:12px;">Open Admin Dashboard →</a>
</div>
</body></html>`;
}
