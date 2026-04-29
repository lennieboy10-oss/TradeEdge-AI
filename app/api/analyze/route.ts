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

function buildSystemPrompt(tf: string, role: "current" | "higher" | "highest", isPro = false): string {

  // ── Context (higher/highest) — focused trend-reading prompt ──
  if (role !== "current") {
    const focus = role === "higher"
      ? `Focus on prevailing trend direction, key swing highs/lows, major support/resistance zones, and overall market structure from a ${tf} perspective.`
      : `Focus on the macro market direction, highest-timeframe key levels, and long-term trend context from a ${tf} perspective.`;
    const summaryLabel = role === "higher" ? "Context Summary" : "Macro Summary";
    return `You are a professional institutional trader with 20 years of experience. Analyse this chart as a ${tf} timeframe. ${focus}

Return STRICTLY valid JSON:
{
  "success": true,
  "analysis": {
    "bias": "BULLISH | BEARISH | NEUTRAL",
    "confidence": <integer 0-100>,
    "timeframe": "${tf}",
    "summary": "${summaryLabel} in 2-3 sentences: what is the dominant trend, where are the major levels, and what does the macro structure say about directional bias?",
    "tradeSetup": { "entry": "N/A", "entryType": "Limit", "stopLoss": "N/A", "takeProfit1": "N/A", "riskReward": "N/A" },
    "keyLevels": { "resistance": ["major resistance level", "secondary resistance"], "support": ["major support level", "secondary support"] },
    "indicators": { "rsi": "Overbought | Oversold | Neutral", "macd": "brief description", "maCross": "Golden Cross | Death Cross | No Cross" },
    "confluences": ["Trend factor 1", "Trend factor 2"],
    "confluenceChecks": [],
    "warnings": ["Risk factor if any"]
  }
}

CRITICAL: Return ONLY valid JSON — no markdown, no text outside JSON.`;
  }

  // ── Current timeframe — full SMC/price-action methodology ────
  const proFields = isPro ? `
    "tradeScore": "A+ | A | B | C | D",
    "fibonacci": {
      "keyLevels": ["0.382 at exact price", "0.5 at exact price", "0.618 at exact price"],
      "context": "One sentence on the most significant Fibonacci level to watch"
    },
    "volumeAnalysis": "One sentence — is volume confirming the move or diverging?",
    "marketStructure": "One sentence — HH/HL or LH/LL breakdown with the most recent swing points named and exact prices",
    "momentum": "One sentence — is momentum building, fading, or showing divergence?",
    "priceLevels": [
      "Level 1: exact price — why it matters",
      "Level 2: exact price — why it matters",
      "Level 3: exact price — why it matters"
    ],
    "invalidationLevel": "exact price — one sentence: why the setup fails if price reaches here",
    "bestSession": "London | New York | Asian",
    "historicalSetups": [
      { "pattern": "pattern name", "asset": "asset or market", "period": "Month Year", "result": "what happened — approximate pip/% move and duration" },
      { "pattern": "pattern name", "asset": "asset or market", "period": "Month Year", "result": "what happened" }
    ],` : "";

  const summaryInstruction = isPro
    ? `"summary": "Exactly 5 points separated by ' | ': (1) What the chart is doing right now in one sentence. (2) Why this is or is not a good entry. (3) The exact price level that invalidates the setup. (4) What confirmation to wait for before entering. (5) One specific risk the trader must be aware of.",`
    : `"summary": "Exactly 5 points separated by ' | ': (1) What the chart is doing right now. (2) Why this is or is not a good entry. (3) The exact invalidation level. (4) What confirmation to wait for. (5) One key risk.",`;

  return `You are a professional institutional trader with 20 years of experience trading forex, commodities, crypto, and stocks. You specialise in price action, market structure, and smart money concepts (SMC).

Analyse this ${tf} chart using the following exact methodology:

STEP 1 — MARKET STRUCTURE:
- Is price in an uptrend (HH/HL), downtrend (LH/LL), or range?
- Identify the most recent Break of Structure (BOS) or Change of Character (CHOCH)
- Is price respecting structure or breaking it?

STEP 2 — KEY LEVELS:
- Identify the strongest support and resistance — areas with multiple rejections
- Note any Fair Value Gaps (FVG), imbalances, round numbers, or psychological levels
- Be specific — use exact price numbers visible on the chart

STEP 3 — ENTRY LOGIC:
- Only recommend an entry if at least 2-3 confluence factors align
- Valid entry: structural level + momentum + volume confirmation, OR key level + pattern + trend alignment
- If no clear high-probability setup exists, set bias to NEUTRAL and explain why in the summary
- Do not force a trade — NEUTRAL is a valid and often correct answer

STEP 4 — RISK MANAGEMENT:
- Stop loss must be placed beyond a structural level — never arbitrary
- Take profit must be at the next significant level — never arbitrary
- MINIMUM acceptable R:R is 1:1.5 — if below this, set bias to NEUTRAL
- If chart is choppy, ranging, or unclear, set bias to NEUTRAL

STEP 5 — CONFIDENCE SCORING:
5+ factors aligning = 85-100 (very high)
4 factors = 70-84 (high)
3 factors = 55-69 (moderate)
2 factors = 40-54 (low)
1 or fewer = 0-39 (very low → set bias to NEUTRAL)

STEP 6 — CONFLUENCE CHECKLIST (confluenceChecks array):
Assess each factor honestly as true/false based on what you can see:
1. "Trend aligned" — does the trade direction match the ${tf} trend?
2. "Key level respected" — is price at a meaningful support/resistance?
3. "Volume confirming" — does volume support the move (if visible)?
4. "Higher timeframe aligned" — does the broader bias support this trade?
5. "Pattern confirmed" — is there a clear chart pattern at this level?
6. "R:R above 1:2" — is the risk/reward ratio 1:2 or better?

${isPro ? `STEP 7 — TRADE GRADE (tradeScore):
A+: 5+ confluences, R:R ≥ 1:3, crystal-clear structure
A:  4+ confluences, R:R ≥ 1:2
B:  3 confluences, R:R ≥ 1:1.5
C:  2 confluences, proceed with caution
D:  0-1 confluences, do not trade` : ""}

WARNINGS: Add to the warnings array any of:
- "Chart is choppy — low probability setup"
- "Price at major resistance — wait for break and retest"
- "Low volume — move not confirmed"
- "Against the higher timeframe trend"
- Any other genuine risk you identify

Return STRICTLY valid JSON with this exact structure:
{
  "success": true,
  "analysis": {
    "bias": "BULLISH | BEARISH | NEUTRAL",
    "confidence": <integer 0-100>,
    "timeframe": "${tf}",
    ${summaryInstruction}${proFields}
    "tradeSetup": {
      "entry": "exact price or zone",
      "entryType": "Limit | Market",
      "stopLoss": "exact price",
      "takeProfit1": "exact price",
      "riskReward": "1:X ratio"
    },
    "keyLevels": {
      "resistance": ["exact price — why it matters", "exact price — why it matters"],
      "support": ["exact price — why it matters", "exact price — why it matters"]
    },
    "indicators": {
      "rsi": "Overbought | Oversold | Neutral",
      "macd": "one sentence description",
      "maCross": "Golden Cross | Death Cross | No Cross"
    },
    "confluences": ["Specific factor 1", "Specific factor 2"${isPro ? ', "Specific factor 3", "Specific factor 4"' : ""}],
    "confluenceChecks": [
      {"label": "Trend aligned",           "passed": true},
      {"label": "Key level respected",     "passed": true},
      {"label": "Volume confirming",       "passed": false},
      {"label": "Higher timeframe aligned","passed": true},
      {"label": "Pattern confirmed",       "passed": false},
      {"label": "R:R above 1:2",          "passed": true}
    ],
    "warnings": ["Specific warning 1", "Specific warning 2"]
  }
}

CRITICAL RULES:
- Never force a trade — NEUTRAL is valid and often the correct answer
- If confidence < 40 set bias to NEUTRAL
- If R:R < 1:1.5 set bias to NEUTRAL and explain in warnings
- Be specific with prices — use exact numbers visible on the chart
- Quality over quantity — one A+ trade beats five C trades
- Return ONLY valid JSON — no markdown, no text outside JSON.`;
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

    const makeCall = (tf: string, role: "current" | "higher" | "highest", proCall = false) =>
      anthropic.messages.create({
        model:      "claude-opus-4-7",
        max_tokens: proCall ? 3000 : role === "current" ? 2000 : 1200,
        system:     buildSystemPrompt(tf, role, proCall),
        messages:   [{
          role:    "user",
          content: [
            { type: "text",  text: `Analyse this chart as a ${tf} timeframe:` },
            { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
          ],
        }],
      });

    const [r1, r2, r3] = await Promise.all([
      makeCall(timeframe, "current", isPro),
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
