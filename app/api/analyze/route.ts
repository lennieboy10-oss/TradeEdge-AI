import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/app/lib/supabase";
import { checkAndSendAlerts } from "@/app/lib/alerts";

export const maxDuration = 120; // Vercel Pro — three parallel vision calls need headroom

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const BIAS_TO_SIGNAL: Record<string, string> = {
  BULLISH: "LONG",
  BEARISH: "SHORT",
  NEUTRAL: "NEUTRAL",
};

const DAILY_LIMIT = 3;
const CALL_TIMEOUT_MS = 45_000; // per-call hard limit — prevents one slow call killing everything

const usageMap = new Map<string, { count: number; date: string }>();

const TF_ORDER = ["1m", "5m", "15m", "30m", "1H", "4H", "Daily", "Weekly"] as const;
function getHigherTFs(tf: string): [string, string] {
  const idx  = TF_ORDER.indexOf(tf as typeof TF_ORDER[number]);
  const base = idx === -1 ? 4 : idx;
  return [
    TF_ORDER[Math.min(base + 1, TF_ORDER.length - 1)],
    TF_ORDER[Math.min(base + 2, TF_ORDER.length - 1)],
  ];
}

// ── Fallback neutral analysis returned when a call times out / fails ──
function neutralFallback(tf: string): object {
  return {
    bias: "NEUTRAL",
    confidence: 0,
    timeframe: tf,
    summary: "Analysis unavailable | Could not complete analysis for this timeframe | N/A | Wait for a fresh chart upload | API timeout — please retry",
    tradeSetup: { entry: "N/A", entryType: "Limit", stopLoss: "N/A", takeProfit1: "N/A", riskReward: "N/A" },
    keyLevels:  { resistance: [], support: [] },
    indicators: { rsi: "Neutral", macd: "Unavailable", maCross: "No Cross" },
    confluences: [],
    confluenceChecks: [],
    warnings: ["Analysis timed out — please retry with the same chart"],
  };
}

// ── Prompts ────────────────────────────────────────────────────
function buildSystemPrompt(tf: string, role: "current" | "higher" | "highest", isPro = false): string {

  // Context timeframes — short focused prompt
  if (role !== "current") {
    const focus = role === "higher"
      ? `prevailing trend, swing highs/lows, and major S/R zones at the ${tf} level`
      : `macro trend direction and highest-timeframe key levels at the ${tf} level`;
    return `You are a professional trader. Analyse this ${tf} chart for ${focus}.

Return ONLY this JSON (no markdown, no extra text):
{"success":true,"analysis":{"bias":"BULLISH","confidence":65,"timeframe":"${tf}","summary":"2-3 sentence trend summary.","tradeSetup":{"entry":"N/A","entryType":"Limit","stopLoss":"N/A","takeProfit1":"N/A","riskReward":"N/A"},"keyLevels":{"resistance":["level 1","level 2"],"support":["level 1","level 2"]},"indicators":{"rsi":"Neutral","macd":"description","maCross":"No Cross"},"confluences":["factor 1","factor 2"],"confluenceChecks":[],"warnings":[]}}

CRITICAL: You MUST return valid JSON every single time. Never return plain text. If you cannot analyse the chart return JSON with bias "NEUTRAL" and explain in summary.`;
  }

  // Current timeframe — full analysis
  const proFields = isPro ? `"tradeScore":"A","fibonacci":{"keyLevels":["0.382 at price","0.5 at price","0.618 at price"],"context":"key fib context"},"volumeAnalysis":"volume sentence","marketStructure":"HH/HL or LH/LL sentence","momentum":"momentum sentence","priceLevels":["level 1","level 2","level 3"],"invalidationLevel":"price — reason","bestSession":"London",` : "";

  return `You are a professional institutional trader (20 yrs experience) specialising in price action and smart money concepts.

Analyse this ${tf} chart. Follow this methodology:

1. MARKET STRUCTURE: Identify trend (uptrend HH/HL, downtrend LH/LL, range). Note last BOS or CHOCH.
2. KEY LEVELS: Strongest S/R with multiple rejections. Note FVGs, round numbers.
3. ENTRY: Only if 2+ confluence factors align. If unclear set bias NEUTRAL.
4. RISK: SL beyond structure. TP at next significant level. Min R:R 1:1.5 — if below, set NEUTRAL.
5. CONFIDENCE: 5+ factors=85-100, 4=70-84, 3=55-69, 2=40-54, 1=0-39 set NEUTRAL.
6. WARNINGS: Add any of: "Chart is choppy", "Price at major resistance", "Low volume", "Against higher TF trend".

${isPro ? `7. TRADE GRADE: A+=5+confluences R:R≥1:3, A=4+ R:R≥1:2, B=3 R:R≥1.5, C=2 caution, D=avoid.` : ""}

Return ONLY this JSON structure (replace placeholder values, no markdown, no extra text):
{"success":true,"analysis":{"bias":"BULLISH","confidence":72,"timeframe":"${tf}","summary":"What chart doing now | Why good or bad entry | Exact invalidation price | What confirmation to wait for | Key risk","${isPro ? `tradeScore":"A","` : ""}tradeSetup":{"entry":"exact price","entryType":"Limit","stopLoss":"exact price","takeProfit1":"exact price","riskReward":"1:2.1"},"keyLevels":{"resistance":["price — reason","price — reason"],"support":["price — reason","price — reason"]},"indicators":{"rsi":"Neutral","macd":"description","maCross":"No Cross"},"confluences":["factor 1","factor 2"],"confluenceChecks":[{"label":"Trend aligned","passed":true},{"label":"Key level respected","passed":true},{"label":"Volume confirming","passed":false},{"label":"Higher timeframe aligned","passed":true},{"label":"Pattern confirmed","passed":false},{"label":"R:R above 1:2","passed":true}],"warnings":["warning if any"]${isPro ? `,"fibonacci":{"keyLevels":["0.382 at price","0.5 at price","0.618 at price"],"context":"key level"},"volumeAnalysis":"sentence","marketStructure":"HH/HL sentence","momentum":"sentence","priceLevels":["level 1","level 2","level 3"],"invalidationLevel":"price — reason","bestSession":"London","historicalSetups":[{"pattern":"name","asset":"asset","period":"Month Year","result":"outcome"}]` : ""}}}

CRITICAL: You MUST always return valid JSON. Never return plain text. Never return empty response. If chart is unreadable return bias NEUTRAL and explain in summary.`;
}

// ── Safe JSON parse with logging ───────────────────────────────
function parseAnalysis(raw: string, tf: string): object {
  const clean = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/,      "")
    .replace(/\s*```$/,      "")
    .trim();

  console.log(`[analyze] raw response for ${tf} (first 300 chars):`, clean.slice(0, 300));

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(clean) as any;
    const analysis = parsed.analysis ?? parsed;

    // Ensure arrays always exist so frontend never crashes
    analysis.confluences     = Array.isArray(analysis.confluences)     ? analysis.confluences     : [];
    analysis.confluenceChecks = Array.isArray(analysis.confluenceChecks) ? analysis.confluenceChecks : [];
    analysis.warnings        = Array.isArray(analysis.warnings)        ? analysis.warnings        : [];
    if (!analysis.keyLevels?.resistance) analysis.keyLevels = { resistance: [], support: [] };

    return analysis;
  } catch (e) {
    console.error(`[analyze] JSON parse failed for ${tf}. Raw text:`, clean);
    console.error(`[analyze] parse error:`, e);
    return neutralFallback(tf);
  }
}

// ── Per-call timeout wrapper ───────────────────────────────────
async function makeCallWithTimeout(
  anthropic: Anthropic,
  tf: string,
  role: "current" | "higher" | "highest",
  isPro: boolean,
  mime: "image/jpeg" | "image/png" | "image/gif" | "image/webp",
  base64: string,
): Promise<string> {
  const apiCall = anthropic.messages.create({
    model:      "claude-opus-4-7",
    max_tokens: isPro && role === "current" ? 2800 : role === "current" ? 1800 : 1000,
    system:     buildSystemPrompt(tf, role, isPro && role === "current"),
    messages:   [{
      role:    "user",
      content: [
        { type: "text",  text: `Analyse this chart. Timeframe: ${tf}.` },
        { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
      ],
    }],
  });

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${CALL_TIMEOUT_MS}ms`)), CALL_TIMEOUT_MS)
  );

  const result = await Promise.race([apiCall, timeout]);
  return result.content[0].type === "text" ? result.content[0].text : "{}";
}

function getClientIP(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() ?? "unknown";
}

export async function POST(req: Request) {
  const formData  = await req.formData();
  const file      = formData.get("file")      as File;
  const asset     = (formData.get("asset")     as string | null)?.trim() || null;
  const clientId  = (formData.get("client_id") as string | null)?.trim() || null;
  const timeframe = (formData.get("timeframe") as string | null)?.trim() || "1H";

  if (!file) {
    return NextResponse.json({ error: "No file uploaded", success: false }, { status: 400 });
  }

  // ── Pro plan check ─────────────────────────────────────────────
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

  // ── Rate limit ─────────────────────────────────────────────────
  const ip    = getClientIP(req);
  const today = new Date().toISOString().slice(0, 10);

  if (!isPro) {
    const entry = usageMap.get(ip);
    if (!entry || entry.date !== today) usageMap.set(ip, { count: 0, date: today });
    const count = usageMap.get(ip)!.count;
    console.log("COUNT:", ip, count);
    if (count >= DAILY_LIMIT) {
      return NextResponse.json(
        { success: false, error: "Daily limit reached", used: count, limit: DAILY_LIMIT },
        { status: 429 }
      );
    }
  }

  // ── Analysis ───────────────────────────────────────────────────
  try {
    const bytes  = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mime   = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    const [higherTF, highestTF] = getHigherTFs(timeframe);

    console.log(`[analyze] starting 3 parallel calls — current:${timeframe} higher:${higherTF} highest:${highestTF} isPro:${isPro}`);

    // Run all three calls in parallel; each has its own 45 s timeout so one slow call can't block the others
    const [raw1, raw2, raw3] = await Promise.all([
      makeCallWithTimeout(anthropic, timeframe,  "current",  isPro, mime, base64).catch((e) => { console.error("[analyze] current call failed:", e.message); return "{}"; }),
      makeCallWithTimeout(anthropic, higherTF,   "higher",   false, mime, base64).catch((e) => { console.error("[analyze] higher call failed:",  e.message); return "{}"; }),
      makeCallWithTimeout(anthropic, highestTF,  "highest",  false, mime, base64).catch((e) => { console.error("[analyze] highest call failed:", e.message); return "{}"; }),
    ]);

    const current = parseAnalysis(raw1, timeframe) as Record<string, unknown>;
    const higher  = parseAnalysis(raw2, higherTF)  as Record<string, unknown>;
    const highest = parseAnalysis(raw3, highestTF) as Record<string, unknown>;

    // Guarantee bias exists so downstream code never crashes
    if (!current.bias) current.bias = "NEUTRAL";
    if (!higher.bias)  higher.bias  = "NEUTRAL";
    if (!highest.bias) highest.bias = "NEUTRAL";

    const biases = [current.bias, higher.bias, highest.bias] as string[];
    const bull   = biases.filter((b) => b === "BULLISH").length;
    const bear   = biases.filter((b) => b === "BEARISH").length;
    const top    = Math.max(bull, bear);
    const dir    = bull > bear ? "bullish" : bear > bull ? "bearish" : "mixed";
    const confluence = top === 3
      ? { score: 3, total: 3, label: "Strong confluence",   color: "#00e676", detail: `3/3 ${dir} confluence` }
      : top === 2
      ? { score: 2, total: 3, label: "Moderate confluence", color: "#f59e0b", detail: `2/3 ${dir} confluence` }
      : { score: 1, total: 3, label: "No confluence",       color: "#ef4444", detail: "All timeframes disagree" };

    // ── Record usage ───────────────────────────────────────────
    if (!isPro) {
      const entry = usageMap.get(ip)!;
      entry.count += 1;
      console.log("COUNT:", ip, entry.count);
    }

    // ── Save to journal (non-fatal) ────────────────────────────
    let journalId: string | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setup  = (current as any).tradeSetup ?? {};
      const signal = BIAS_TO_SIGNAL[current.bias as string] ?? current.bias ?? null;
      const payload = {
        asset,
        timeframe:   (current.timeframe as string)   ?? timeframe,
        signal,
        entry:       setup.entry       ?? null,
        stop_loss:   setup.stopLoss    ?? null,
        take_profit: setup.takeProfit1 ?? null,
        risk_reward: setup.riskReward  ?? null,
        summary:     (current.summary as string)     ?? null,
        confidence:  typeof current.confidence === "number" ? current.confidence : null,
      };
      console.log("[journal] saving:", JSON.stringify(payload));
      const { data: jData, error: jError } = await getSupabase()
        .from("journal")
        .insert(payload)
        .select("id")
        .single();
      if (jError) console.error("[journal] insert error:", jError.code, jError.message);
      else { journalId = jData?.id ?? null; console.log("[journal] saved id:", journalId); }
    } catch (saveErr) {
      console.error("[journal] exception:", saveErr);
    }

    // Fire-and-forget alerts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setup = (current as any).tradeSetup ?? {};
    checkAndSendAlerts({
      pair:       asset,
      signal:     BIAS_TO_SIGNAL[current.bias as string] ?? (current.bias as string) ?? "",
      confidence: typeof current.confidence === "number" ? current.confidence : 0,
      entry:      setup.entry       ?? null,
      stopLoss:   setup.stopLoss    ?? null,
      takeProfit: setup.takeProfit1 ?? null,
      summary:    (current.summary as string) ?? null,
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
    console.error("[analyze] outer catch:", error);
    return NextResponse.json({ success: false, error: "Analysis failed — please try again" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: { "Access-Control-Allow-Origin": "*" } });
}
