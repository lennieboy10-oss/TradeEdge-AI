import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const resend      = new Resend(process.env.RESEND_API_KEY);
const FROM        = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

export async function POST(req: Request) {
  try {
    const { requestId, adminClientId, bulkIds } = await req.json();

    // Verify admin
    if (!adminClientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const supabase = getSupabase();

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("client_id", adminClientId)
      .single();

    if (!adminProfile?.email || adminProfile.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date().toISOString();

    // Bulk or single approve
    const ids: string[] = bulkIds ?? (requestId ? [requestId] : []);
    if (ids.length === 0) return NextResponse.json({ error: "No IDs provided" }, { status: 400 });

    const { data: updated, error } = await supabase
      .from("tradingview_access")
      .update({ status: "approved", approved_at: now })
      .in("id", ids)
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Send approval emails
    for (const row of updated ?? []) {
      if (row.email) {
        resend.emails.send({
          from: FROM,
          to: row.email,
          subject: "ChartIQ Elite — TradingView access granted! 🎉",
          html: approvalEmail(row.tradingview_username ?? ""),
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, count: updated?.length ?? 0 });
  } catch (err) {
    console.error("[tv-access/approve]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

function approvalEmail(username: string) {
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
  <div style="display:inline-block;padding:5px 14px;border-radius:99px;background:rgba(0,230,118,0.12);border:1px solid rgba(0,230,118,0.3);margin-bottom:20px;">
    <span style="font-size:11px;font-weight:700;letter-spacing:0.13em;color:#00e676;font-family:monospace;">ACCESS GRANTED</span>
  </div>
  <h1 style="font-size:32px;font-weight:900;color:#fff;margin:0 0 12px;line-height:1.1;">Your access is ready! 🎉</h1>
  <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 24px;">
    Your access to the <strong style="color:#fff;">ChartIQ AI Signal System</strong> has been granted for username <strong style="color:#00e676;font-family:monospace;">${username}</strong>.
  </p>
  <div style="background:#0c0f18;border:1px solid rgba(0,230,118,0.2);border-radius:16px;padding:20px;margin-bottom:24px;">
    <p style="color:#6b7280;font-size:13px;margin:0 0 12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">How to add it to your chart:</p>
    <table style="width:100%;border-collapse:collapse;">
      ${[
        ["STEP 1", "Go to tradingview.com and open any chart"],
        ["STEP 2", "Click Indicators at the top of the chart"],
        ["STEP 3", "Click the Invite-only scripts tab (scroll right if needed)"],
        ["STEP 4", "Find ChartIQ AI Signal System and click + to add"],
        ["STEP 5", "Look for green BUY ▲ and red SELL ▼ labels — you're live!"],
      ].map(([step, text]) => `
      <tr>
        <td style="padding:8px 12px 8px 0;vertical-align:top;white-space:nowrap;">
          <span style="background:rgba(0,230,118,0.15);color:#00e676;font-family:monospace;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;">${step}</span>
        </td>
        <td style="padding:8px 0;color:#d1d5db;font-size:14px;line-height:1.5;">${text}</td>
      </tr>`).join("")}
    </table>
  </div>
  <div style="background:#0c0f18;border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:20px;margin-bottom:28px;">
    <p style="color:#6b7280;font-size:13px;margin:0 0 12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">Recommended settings:</p>
    <table style="width:100%;border-collapse:collapse;font-family:monospace;font-size:13px;">
      ${[
        ["Min Confluence", "4"],
        ["Session Filter", "ON (London + NY)"],
        ["Show Dashboard", "ON"],
        ["Show FVG",       "ON"],
        ["Show OB",        "ON"],
      ].map(([s, v]) => `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
        <td style="padding:6px 0;color:#6b7280;">${s}</td>
        <td style="padding:6px 0;color:#00e676;text-align:right;">${v}</td>
      </tr>`).join("")}
    </table>
  </div>
  <p style="color:#374151;font-size:12px;text-align:center;">Need help? Reply to this email — we personally assist every Elite member.</p>
</div>
</body></html>`;
}
