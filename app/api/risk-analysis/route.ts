import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const { winRate, rr, riskPct, capital } = await request.json();

    const prompt = `A trader has these verified statistics:
- Win rate: ${winRate}%
- Average R:R achieved: ${rr}:1
- Risk per trade: ${riskPct}%
- Account size: ${capital}

Give direct, personalised risk management advice:
1. Is their edge sufficient for long-term profitability?
2. What single change would most reduce their risk of ruin?
3. What is the maximum safe risk% per trade for their stats?
Keep it under 80 words. Be blunt and specific — no hedging.`;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (msg.content[0] as { type: string; text: string }).text;
    return NextResponse.json({ recommendation: text });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
