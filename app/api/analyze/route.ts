import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/app/lib/supabase";
import { checkAndSendAlerts } from "@/app/lib/alerts";

export const maxDuration = 120; // seconds — three parallel Claude calls can take 30–60 s

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const BIAS_TO_SIGNAL: Record<string, string> = {
  BULLISH: "LONG",
  BEARISH: "SHORT",
  NEUTRAL: "NEUTRAL",
};

const DAILY_LIMIT = 3;

// Simple in-memory rate limit: IP → { count, date "YYYY-MM-DD" }
const usageMap = new Map<string, { count: number; date: string }>();

// Timeframe hierarchy
const TF_ORDER = ["1m", "5m", "15m", "30m", "1H", "4H", "Daily", "Weekly"] as const;
function getHigherTFs(tf: string): [string, string] {
  const idx = TF_ORDER.indexOf(tf as typeof TF_ORDER[number]);
  const base = idx === -1 ? 4 : idx; // default to 1H index
  return [
    TF_ORDER[Math.min(base + 1, TF_ORDER.length - 1)],
    TF_ORDER[Math.min(base + 2, TF_ORDER.length - 1)],
  ];
}

function buildSystemPrompt(tf: string, role: "current" | "higher" | "highest"): string {
  const focus =
    role === "current"
      ? `Focus on entry precision, candlestick patterns, momentum indicators, and immediate price action at the ${tf} level.`
      : role === "higher"
      ? `Focus on the prevailing trend direction, key swing highs/lows, major support/resistance zones, and overall market structure from a ${tf} perspective.`
      : `Focus on the macro market direction, highest-timeframe key levels, and long-term trend context from a ${tf} perspective.`;

  return `You are an elite professional trading analyst with 20+ years of experience. Analyse this chart as if it were a ${tf} chart. ${focus}

Return STRICTLY valid JSON with this exact structure:
{
  "success": true,
  "analysis": {
    "bias": "BULLISH | BEARISH | NEUTRAL",
    "confidence": <integer 0-100>,
    "timeframe": "${tf}",
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

CONFIDENCE SCORING RUBRIC:
90-100: Extremely clear setup — multiple confirming factors align.
70-89: Good setup — most factors align with minor conflicts.
50-69: Moderate setup — some conflicting signals.
0-49: Weak/unclear setup — avoid or reduce size.

CRITICAL: Return ONLY valid JSON — no markdown, no text outside JSON.`;
}

function calcConfluence(biases: string[]): { score: number; total: number; label: string; color: string; detail: string } {
  const bull = biases.filter((b) => b === "BULLISH").length;
  const bear = biases.filter((b) => b === "BEARISH").length;
  const top  = Math.max(bull, bear);
  const dir  = bull > bear ? "bullish" : bear > bull ? "bearish" : "mixed";
  if (top === 3) return { score: 3, total: 3, label: "Strong confluence",   color: "#00e676", detail: `3/3 ${dir} confluence` };
  if (top === 2) return { score: 2, total: 3, label: "Moderate confluence", color: "#f59e0b", detail: `2/3 ${dir} confluence` };
  return            { score: 1, total: 3, label: "No confluence",          color: "#ef4444", detail: "All timeframes disagree" };
}

function getClientIP(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() ?? "unknown";
}

export async function POST(req: Request) {
  const formData   = await req.formData();
  const file       = formData.get("file")       as File;
  const asset      = (formData.get("asset")      as string | null)?.trim() || null;
  const clientId   = (formData.get("client_id")  as string | null)?.trim() || null;
  const timeframe  = (formData.get("timeframe")  as string | null)?.trim() || "1H";

  if (!file) {
    return NextResponse.json({ error: "No file uploaded", success: false }, { status: 400 });
  }

  // ── Pro plan check ────────────────────────────────────────────
  let isPro = false;
  if (clientId) {
    try {
      const { data } = await getSupabase()
        .from("profiles")
        .select("plan")
        .eq("client_id", clientId)
        .single();
      isPro = data?.plan === "pro";
    } catch { /* non-fatal */ }
  }

  // ── Rate limit ───────────────────────────────────────────────
  const ip    = getClientIP(req);
  const today = new Date().toISOString().slice(0, 10);

  if (!isPro) {
    const entry = usageMap.get(ip);
    if (!entry || entry.date !== today) {
      usageMap.set(ip, { count: 0, date: today });
    }
    const count = usageMap.get(ip)!.count;
    console.log("COUNT:", ip, count);

    if (count >= DAILY_LIMIT) {
      return NextResponse.json(
        { success: false, error: "Daily limit reached", used: count, limit: DAILY_LIMIT },
        { status: 429 }
      );
    }
  }

  // ── Analysis ─────────────────────────────────────────────────
  try {
    const bytes    = await file.arrayBuffer();
    const base64   = Buffer.from(bytes).toString("base64");
    const mime     = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    const [higherTF, highestTF] = getHigherTFs(timeframe);

    const makeCall = (tf: string, role: "current" | "higher" | "highest") =>
      anthropic.messages.create({
        model:      "claude-opus-4-7",
        max_tokens: 1500,
        system:     buildSystemPrompt(tf, role),
        messages:   [{
          role:    "user",
          content: [
            { type: "text",  text: `Analyse this chart as a ${tf} timeframe:` },
            { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
          ],
        }],
      });

    const [r1, r2, r3] = await Promise.all([
      makeCall(timeframe, "current"),
      makeCall(higherTF,  "higher"),
      makeCall(highestTF, "highest"),
    ]);

    function parseAnalysis(r: typeof r1) {
      const raw   = r.content[0].type === "text" ? r.content[0].text : "{}";
      const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
      return JSON.parse(clean).analysis ?? {};
    }

    const current = parseAnalysis(r1);
    const higher  = parseAnalysis(r2);
    const highest = parseAnalysis(r3);

    const confluence = calcConfluence([current.bias, higher.bias, highest.bias]);

    // ── Record usage ─────────────────────────────────────────
    if (!isPro) {
      const entry = usageMap.get(ip)!;
      entry.count += 1;
      console.log("COUNT:", ip, entry.count);
    }

    // ── Save to journal ──────────────────────────────────────
    let journalId: string | null = null;
    try {
      const signal = BIAS_TO_SIGNAL[current.bias] ?? current.bias ?? null;
      const payload = {
        asset,
        timeframe:   current.timeframe               ?? timeframe,
        signal,
        entry:       current.tradeSetup?.entry       ?? null,
        stop_loss:   current.tradeSetup?.stopLoss    ?? null,
        take_profit: current.tradeSetup?.takeProfit1 ?? null,
        risk_reward: current.tradeSetup?.riskReward  ?? null,
        summary:     current.summary                 ?? null,
        confidence:  typeof current.confidence === "number" ? current.confidence : null,
      };
      console.log("[journal] attempting save with payload:", JSON.stringify(payload));

      const { data: jData, error: jError } = await getSupabase()
        .from("journal")
        .insert(payload)
        .select("id")
        .single();

      console.log("[journal] supabase response — data:", jData, "error:", jError);

      if (jError) {
        console.error("[journal] insert error code:", jError.code, "message:", jError.message, "details:", jError.details);
      } else {
        journalId = jData?.id ?? null;
        console.log("[journal] saved successfully, id:", journalId, "asset:", asset, "signal:", signal);
      }
    } catch (saveErr) {
      console.error("[journal] unexpected exception:", saveErr);
    }

    // Fire-and-forget alert check (non-blocking)
    checkAndSendAlerts({
      pair:       asset,
      signal:     BIAS_TO_SIGNAL[current.bias] ?? current.bias ?? "",
      confidence: typeof current.confidence === "number" ? current.confidence : 0,
      entry:      current.tradeSetup?.entry       ?? null,
      stopLoss:   current.tradeSetup?.stopLoss    ?? null,
      takeProfit: current.tradeSetup?.takeProfit1 ?? null,
      summary:    current.summary                 ?? null,
    }).catch((e) => console.error("[alerts]", e));

    const usedNow = isPro ? null : (usageMap.get(ip)?.count ?? 1);
    return NextResponse.json(
      {
        success: true,
        analyses: { current, higher, highest },
        tfLabels: { current: timeframe, higher: higherTF, highest: highestTF },
        confluence,
        journalId,
        usage: { used: usedNow, limit: isPro ? null : DAILY_LIMIT, isPro },
      },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "Analysis failed" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: { "Access-Control-Allow-Origin": "*" } });
}
