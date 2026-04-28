import { NextResponse } from "next/server";
import { checkAndSendAlerts } from "@/app/lib/alerts";

export async function POST(req: Request) {
  try {
    const { pair, signal, confidence, entry, stopLoss, takeProfit, summary } = await req.json();
    const result = await checkAndSendAlerts({ pair, signal, confidence, entry, stopLoss, takeProfit, summary });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[alerts/check]", err);
    return NextResponse.json({ checked: 0, sent: 0 });
  }
}
