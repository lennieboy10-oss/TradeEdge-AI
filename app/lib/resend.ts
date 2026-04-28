import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Update FROM_EMAIL to a verified sender on your Resend domain for production.
// For local testing with free tier, use "onboarding@resend.dev" (sends to your Resend account email only).
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

interface AlertEmailParams {
  to: string;
  pair: string;
  signal: string;
  entry?: string | null;
  stopLoss?: string | null;
  takeProfit?: string | null;
  confidence?: number | null;
  summary?: string | null;
}

export async function sendAlertEmail(params: AlertEmailParams) {
  const { to, pair, signal, entry, stopLoss, takeProfit, confidence, summary } = params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const signalColor =
    signal === "LONG"  ? "#00e676" :
    signal === "SHORT" ? "#f87171" : "#f59e0b";

  const rows = [
    entry      ? `<tr><td style="color:#6b7280;font-size:14px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Entry</td><td style="font-family:monospace;font-size:14px;font-weight:600;color:#ffffff;text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${entry}</td></tr>` : "",
    stopLoss   ? `<tr><td style="color:#6b7280;font-size:14px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Stop Loss</td><td style="font-family:monospace;font-size:14px;font-weight:600;color:#f87171;text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${stopLoss}</td></tr>` : "",
    takeProfit ? `<tr><td style="color:#6b7280;font-size:14px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Take Profit</td><td style="font-family:monospace;font-size:14px;font-weight:600;color:#4ade80;text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${takeProfit}</td></tr>` : "",
    confidence != null ? `<tr><td style="color:#6b7280;font-size:14px;padding:10px 0;">Confidence</td><td style="font-family:monospace;font-size:14px;font-weight:600;color:#00e676;text-align:right;padding:10px 0;">${confidence}%</td></tr>` : "",
  ].filter(Boolean).join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#080a10;color:#ffffff;font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;margin:0;padding:0;">
  <div style="max-width:520px;margin:0 auto;padding:48px 24px;">

    <div style="display:flex;align-items:center;gap:10px;margin-bottom:36px;">
      <div style="width:32px;height:32px;border-radius:50%;background:#00e676;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="#080a10" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <span style="font-size:17px;font-weight:700;color:#ffffff;">ChartIQ <span style="color:#f5c518;">AI</span></span>
    </div>

    <div style="display:inline-flex;align-items:center;gap:8px;padding:5px 14px;border-radius:99px;background:rgba(0,230,118,0.12);border:1px solid rgba(0,230,118,0.3);margin-bottom:20px;">
      <span style="width:6px;height:6px;border-radius:50%;background:#00e676;display:inline-block;"></span>
      <span style="font-size:11px;font-weight:700;letter-spacing:0.13em;color:#00e676;font-family:monospace;">ALERT TRIGGERED</span>
    </div>

    <h1 style="font-size:38px;font-weight:900;letter-spacing:0.04em;color:#ffffff;margin:0 0 8px 0;line-height:1.1;">
      ${pair}<br/><span style="color:${signalColor};">→ ${signal}</span>
    </h1>
    <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 28px 0;">Your alert condition was met on a new analysis.</p>

    ${rows ? `<table style="width:100%;border-collapse:collapse;background:#0c0f18;border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:8px 20px;margin-bottom:24px;overflow:hidden;">
      <tbody style="display:block;padding:8px 20px;">${rows}</tbody>
    </table>` : ""}

    ${summary ? `<div style="padding:16px 20px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin-bottom:28px;">
      <p style="color:#9ca3af;font-size:13px;line-height:1.7;margin:0;">${summary}</p>
    </div>` : ""}

    <a href="${appUrl}/?asset=${encodeURIComponent(pair)}#analyze"
      style="display:block;background:#00e676;color:#080a10;text-align:center;padding:16px 24px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:32px;box-shadow:0 0 28px rgba(0,230,118,0.28);">
      Analyse ${pair} Now →
    </a>

    <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;text-align:center;">
      <p style="color:#374151;font-size:12px;line-height:1.8;margin:0;">
        You received this because alerts are enabled for <strong style="color:#4b5563;">${pair}</strong> on ChartIQ AI.<br/>
        <a href="${appUrl}/watchlist" style="color:#4b5563;text-decoration:underline;">Manage alerts</a>
      </p>
    </div>

  </div>
</body>
</html>`;

  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `ChartIQ Alert — ${pair} signal changed to ${signal}`,
    html,
  });
}
