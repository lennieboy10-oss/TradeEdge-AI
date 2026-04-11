import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded", success: false },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an elite professional trading analyst with 20+ years of experience.

Return STRICTLY valid JSON with this exact structure:
{
  "success": true,
  "analysis": {
    "bias": "BULLISH | BEARISH | NEUTRAL",
    "confidence": 0-100,
    "timeframe": "e.g. 4H, 1D",
    "summary": "2-3 sentence professional summary",
    "tradeSetup": {
      "entry": "price or zone",
      "entryType": "Limit | Market",
      "stopLoss": "price",
      "takeProfit1": "price",
      "riskReward": "1:X ratio"
    },
    "keyLevels": {
      "resistance": ["R1 price", "R2 price"],
      "support": ["S1 price", "S2 price"]
    },
    "indicators": {
      "rsi": "Overbought | Oversold | Neutral",
      "macd": "description",
      "maCross": "Golden Cross | Death Cross | No Cross"
    },
    "confluences": ["Factor 1", "Factor 2"],
    "warnings": ["Risk factor 1"]
  }
}

CRITICAL: Return ONLY valid JSON - no markdown, no text outside the JSON.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this chart professionally:" },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const content = response.choices[0].message.content?.trim() || "{}";
    let cleanContent = content.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleanContent);
    if (!parsed.hasOwnProperty("success")) parsed.success = true;

    return NextResponse.json(parsed, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "Analysis failed" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}