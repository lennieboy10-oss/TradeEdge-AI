import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const maxDuration = 120;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const clientId = (formData.get("client_id") as string | null) ?? null;

    const files: { file: File; label: string }[] = [];
    for (let i = 1; i <= 6; i++) {
      const file = formData.get(`chart_${i}`) as File | null;
      const label = (formData.get(`label_${i}`) as string | null) || `Chart ${i}`;
      if (file) files.push({ file, label });
    }

    if (files.length < 2) {
      return NextResponse.json({ error: "Upload at least 2 charts" }, { status: 400 });
    }

    // Analyse each chart individually in parallel
    const individualResults = await Promise.allSettled(
      files.map(async ({ file, label }) => {
        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        const mime = file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

        const msg = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 300,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
              {
                type: "text",
                text: `Analyse this trading chart (${label}). Return ONLY JSON (no markdown):
{"asset":"detected name or '${label}'","bias":"BULLISH"|"BEARISH"|"NEUTRAL","confidence":0-100,"signal":"LONG"|"SHORT"|"NEUTRAL","entry":"price","stopLoss":"price","takeProfit":"price","setupType":"e.g. Break and Retest","summary":"1 concise sentence"}`,
              },
            ],
          }],
        });

        const raw = (msg.content[0] as { type: string; text: string }).text;
        const cleaned = raw.replace(/```json\n?|\n?```|```/g, "").trim();
        const parsed = JSON.parse(cleaned.match(/\{[\s\S]+\}/)?.[0] ?? cleaned) as Record<string, unknown>;
        return { label, ...parsed };
      })
    );

    const individual = individualResults
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<Record<string, unknown>>).value);

    if (individual.length === 0) {
      return NextResponse.json({ error: "All chart analyses failed" }, { status: 500 });
    }

    // Combined analysis
    const summaries = individual
      .map((a, i) => `Chart ${i + 1} (${a.label}): ${a.bias} — ${a.signal} — ${a.confidence}% confidence — ${a.summary}`)
      .join("\n");

    const combinedMsg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `${individual.length} trading chart analyses:\n\n${summaries}\n\nReturn ONLY JSON (no markdown):
{"overallBias":"BULLISH"|"BEARISH"|"MIXED","confluenceScore":0-100,"strongestSetup":"asset name","correlations":["desc1","desc2"],"conflicts":["desc1"],"summary":"2-3 sentences of combined market outlook"}`,
      }],
    });

    const combinedRaw = (combinedMsg.content[0] as { type: string; text: string }).text;
    const combinedCleaned = combinedRaw.replace(/```json\n?|\n?```|```/g, "").trim();
    const combined = JSON.parse(combinedCleaned.match(/\{[\s\S]+\}/)?.[0] ?? combinedCleaned) as Record<string, unknown>;

    // Save to journal if user is logged in
    if (clientId) {
      try {
        const supabase = getSupabase();
        const strongest = individual.find((a) => String(a.asset ?? a.label) === String(combined.strongestSetup)) ?? individual[0];
        await supabase.from("journal").insert({
          user_id: clientId,
          asset: String(combined.strongestSetup ?? "Multi-chart"),
          timeframe: "Multi",
          signal: String(strongest.signal ?? "NEUTRAL"),
          entry: String(strongest.entry ?? ""),
          stop_loss: String(strongest.stopLoss ?? ""),
          take_profit: String(strongest.takeProfit ?? ""),
          risk_reward: "",
          summary: `Multi-chart analysis (${individual.length} charts). Confluence: ${combined.confluenceScore}%. ${combined.summary}`,
          confidence: Number(combined.confluenceScore) || 0,
        });
      } catch { /* journal save is optional */ }
    }

    return NextResponse.json({ individual, combined });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
