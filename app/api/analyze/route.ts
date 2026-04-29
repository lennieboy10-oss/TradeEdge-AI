import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/app/lib/supabase";
import { checkAndSendAlerts } from "@/app/lib/alerts";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const DAILY_LIMIT = 3;
const CALL_TIMEOUT_MS = 25_000;

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

// ── Simple prompt (user-specified) ────────────────────────────
const SIMPLE_PROMPT = `You are a trading analyst. Analyse this chart image and return ONLY a valid JSON object with exactly these fields:
{
  "signal": "LONG or SHORT or NEUTRAL",
  "entry": "price level as string",
  "stopLoss": "price level as string",
  "takeProfit": "price level as string",
  "riskReward": "ratio as string e.g. 1:2",
  "confidence": 75,
  "grade": "A+ or A or B or C or D",
  "trend": "Bullish or Bearish or Ranging",
  "keyLevels": "string describing support and resistance",
  "structure": "string describing market structure",
  "confluenceFactors": ["factor 1", "factor 2", "factor 3"],
  "warnings": ["warning if any"],
  "summary": "3-4 sentence trade summary"
}
Return ONLY the JSON. No markdown. No backticks. No explanation. Just the raw JSON object.`;

const CONTEXT_PROMPT = (tf: string) =>
  `You are a trading analyst. Analyse this ${tf} chart and return ONLY a valid JSON object:
{"signal":"LONG or SHORT or NEUTRAL","confidence":65,"trend":"Bullish or Bearish or Ranging","keyLevels":"support and resistance levels","summary":"2 sentence trend summary","confluenceFactors":["factor 1"],"warnings":[]}
Return ONLY the JSON. No markdown. No backticks.`;

// ── Map simple response → frontend AnalysisResult shape ──────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToAnalysis(raw: any, tf: string, isContext = false): Record<string, unknown> {
  const SIGNAL_TO_BIAS: Record<string, string> = {
    LONG: "BULLISH", SHORT: "BEARISH", NEUTRAL: "NEUTRAL",
    BULLISH: "BULLISH", BEARISH: "BEARISH",
  };

  const bias       = SIGNAL_TO_BIAS[(raw.signal ?? raw.bias ?? "NEUTRAL").toUpperCase()] ?? "NEUTRAL";
  const confidence = typeof raw.confidence === "number" ? raw.confidence : 50;
  const confluences = Array.isArray(raw.confluenceFactors)
    ? raw.confluenceFactors
    : Array.isArray(raw.confluences) ? raw.confluences : [];
  const warnings = Array.isArray(raw.warnings) ? raw.warnings : [];

  if (isContext) {
    return {
      bias, confidence, timeframe: tf,
      summary: raw.summary ?? "",
      tradeSetup: { entry: "N/A", entryType: "Limit", stopLoss: "N/A", takeProfit1: "N/A", riskReward: "N/A" },
      keyLevels:  { resistance: raw.keyLevels ? [raw.keyLevels] : [], support: [] },
      indicators: { rsi: "Neutral", macd: raw.trend ?? "N/A", maCross: "No Cross" },
      confluences, confluenceChecks: [], warnings,
    };
  }

  return {
    bias, confidence, timeframe: tf,
    summary:      raw.summary      ?? "",
    tradeScore:   raw.grade,
    marketStructure: raw.structure ?? "",
    tradeSetup: {
      entry:       raw.entry      ?? "N/A",
      entryType:   "Limit",
      stopLoss:    raw.stopLoss   ?? "N/A",
      takeProfit1: raw.takeProfit ?? "N/A",
      riskReward:  raw.riskReward ?? "N/A",
    },
    keyLevels: {
      resistance: raw.keyLevels ? [raw.keyLevels] : [],
      support:    [],
    },
    indicators: {
      rsi:     "Neutral",
      macd:    raw.trend   ?? "N/A",
      maCross: "No Cross",
    },
    confluences, confluenceChecks: [], warnings,
  };
}

// ── Neutral fallback ───────────────────────────────────────────
function neutralFallback(tf: string): Record<string, unknown> {
  return {
    bias: "NEUTRAL", confidence: 0, timeframe: tf,
    summary: "Analysis unavailable — please retry.",
    tradeSetup: { entry: "N/A", entryType: "Limit", stopLoss: "N/A", takeProfit1: "N/A", riskReward: "N/A" },
    keyLevels:  { resistance: [], support: [] },
    indicators: { rsi: "Neutral", macd: "N/A", maCross: "No Cross" },
    confluences: [], confluenceChecks: [],
    warnings: ["Analysis timed out — please retry"],
  };
}

// ── Claude call with per-call timeout ─────────────────────────
async function callClaude(
  systemPrompt: string,
  tf: string,
  mime: "image/jpeg" | "image/png" | "image/gif" | "image/webp",
  base64: string,
  maxTokens: number,
): Promise<string> {
  const apiCall = anthropic.messages.create({
    model:      "claude-opus-4-7",
    max_tokens: maxTokens,
    system:     systemPrompt,
    messages:   [{
      role:    "user",
      content: [
        { type: "text",  text: `Chart timeframe: ${tf}` },
        { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
      ],
    }],
  });

  const timer = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Call timeout after ${CALL_TIMEOUT_MS}ms`)), CALL_TIMEOUT_MS)
  );

  const result = await Promise.race([apiCall, timer]);
  return result.content[0].type === "text" ? result.content[0].text : "{}";
}

// ── Parse raw text → analysis object ──────────────────────────
function parseRaw(raw: string, tf: string, isContext = false): Record<string, unknown> {
  // Strip markdown fences if present
  const clean = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/,      "")
    .replace(/\s*```$/,      "")
    .trim();

  console.log(`[analyze] raw[${tf}] (first 400 chars):`, clean.slice(0, 400));

  try {
    const parsed = JSON.parse(clean);
    // Handle {success:true, analysis:{...}} wrapper if present
    const data = parsed.analysis ?? parsed;
    return mapToAnalysis(data, tf, isContext);
  } catch (e) {
    console.error(`[analyze] JSON parse FAILED for ${tf}. Full raw:`, clean);
    console.error(`[analyze] parse error:`, e);
    return neutralFallback(tf);
  }
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
        .from("profiles").select("plan").eq("client_id", clientId).single();
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
    console.log(`[analyze] rate check — ip:${ip} count:${count}`);
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
    console.log(`[analyze] START — tf:${timeframe} higher:${higherTF} highest:${highestTF} isPro:${isPro} imageSize:${bytes.byteLength}`);

    // Three parallel calls — simple prompts = fast responses
    const [raw1, raw2, raw3] = await Promise.all([
      callClaude(SIMPLE_PROMPT,           timeframe, mime, base64, 600)
        .catch((e) => { console.error("[analyze] current FAILED:", e.message); return "{}"; }),
      callClaude(CONTEXT_PROMPT(higherTF),  higherTF,  mime, base64, 300)
        .catch((e) => { console.error("[analyze] higher FAILED:",  e.message); return "{}"; }),
      callClaude(CONTEXT_PROMPT(highestTF), highestTF, mime, base64, 300)
        .catch((e) => { console.error("[analyze] highest FAILED:", e.message); return "{}"; }),
    ]);

    console.log(`[analyze] all calls returned`);

    const current = parseRaw(raw1, timeframe, false);
    const higher  = parseRaw(raw2, higherTF,  true);
    const highest = parseRaw(raw3, highestTF, true);

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
      console.log(`[analyze] usage recorded — ip:${ip} count:${entry.count}`);
    }

    // ── Journal save (non-fatal) ───────────────────────────────
    let journalId: string | null = null;
    try {
      const setup  = (current.tradeSetup as Record<string, string>) ?? {};
      const signal = current.bias === "BULLISH" ? "LONG" : current.bias === "BEARISH" ? "SHORT" : "NEUTRAL";
      const payload = {
        asset,
        timeframe:   (current.timeframe as string) ?? timeframe,
        signal,
        entry:       setup.entry       ?? null,
        stop_loss:   setup.stopLoss    ?? null,
        take_profit: setup.takeProfit1 ?? null,
        risk_reward: setup.riskReward  ?? null,
        summary:     (current.summary as string) ?? null,
        confidence:  typeof current.confidence === "number" ? current.confidence : null,
      };
      console.log("[journal] save payload:", JSON.stringify(payload));
      const { data: jData, error: jError } = await getSupabase()
        .from("journal").insert(payload).select("id").single();
      if (jError) console.error("[journal] error:", jError.code, jError.message);
      else { journalId = jData?.id ?? null; console.log("[journal] saved id:", journalId); }
    } catch (e) { console.error("[journal] exception:", e); }

    // ── Alerts (fire-and-forget) ───────────────────────────────
    const setup = (current.tradeSetup as Record<string, string>) ?? {};
    checkAndSendAlerts({
      pair:       asset,
      signal:     current.bias === "BULLISH" ? "LONG" : current.bias === "BEARISH" ? "SHORT" : "NEUTRAL",
      confidence: typeof current.confidence === "number" ? current.confidence : 0,
      entry:      setup.entry       ?? null,
      stopLoss:   setup.stopLoss    ?? null,
      takeProfit: setup.takeProfit1 ?? null,
      summary:    (current.summary as string) ?? null,
    }).catch((e) => console.error("[alerts]", e));

    const usedNow = isPro ? null : (usageMap.get(ip)?.count ?? 1);
    console.log(`[analyze] DONE — bias:${current.bias} confidence:${current.confidence} journalId:${journalId}`);

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
