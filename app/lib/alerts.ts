import { getSupabase } from "./supabase";
import { sendAlertEmail } from "./resend";

interface AlertCheckParams {
  pair: string | null;
  signal: string;
  confidence: number;
  entry?: string | null;
  stopLoss?: string | null;
  takeProfit?: string | null;
  summary?: string | null;
}

export async function checkAndSendAlerts(params: AlertCheckParams) {
  const { pair, signal, confidence, entry, stopLoss, takeProfit, summary } = params;
  if (!pair) return { checked: 0, sent: 0 };

  const { data: entries } = await getSupabase()
    .from("watchlist")
    .select("*")
    .ilike("pair", pair.trim())
    .eq("alerts_enabled", true);

  if (!entries?.length) return { checked: 0, sent: 0 };

  let sent = 0;
  for (const w of entries) {
    const signalMatch     = w.alert_signal && w.alert_signal === signal;
    const confidenceMatch = w.alert_confidence != null && confidence >= w.alert_confidence;
    if ((signalMatch || confidenceMatch) && w.alert_email) {
      try {
        await sendAlertEmail({ to: w.alert_email, pair, signal, entry, stopLoss, takeProfit, confidence, summary });
        sent++;
      } catch (e) {
        console.error("[alerts] email failed:", e);
      }
    }
  }
  return { checked: entries.length, sent };
}
