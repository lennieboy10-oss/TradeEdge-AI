import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";
import { checkAndSendAlerts } from "@/app/lib/alerts";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DAILY_LIMIT = 3;
const usageMap = new Map<string, { count: number; date: string }>();

const TF_ORDER = ["1m", "5m", "15m", "30m", "1H", "4H", "Daily", "Weekly"] as const;
function getHigherTFs(tf: string): [string, string] {
  const idx  = TF_ORDER.indexOf(tf as (typeof TF_ORDER)[number]);
  const base = idx === -1 ? 4 : idx;
  return [
    TF_ORDER[Math.min(base + 1, TF_ORDER.length - 1)],
    TF_ORDER[Math.min(base + 2, TF_ORDER.length - 1)],
  ];
}

function getClientIP(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  try {
    console.log("Analysis started");

    const formData = await request.formData();

    // Frontend sends the file as "file", not "image"
    const file = (formData.get("file") ?? formData.get("image")) as File | null;
    const asset     = (formData.get("asset")     as string | null)?.trim() || null;
    const clientId  = (formData.get("client_id") as string | null)?.trim() || null;
    const timeframe = (formData.get("timeframe") as string | null)?.trim() || "1H";

    if (!file) {
      console.log("No image provided — formData keys:", [...formData.keys()].join(", "));
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    console.log("Image received:", file.name, file.size, file.type);

    // ── Pro plan check ─────────────────────────────────────────
    let isPro = false;
    if (clientId) {
      try {
        const { data } = await getSupabase()
          .from("profiles").select("plan").eq("client_id", clientId).single();
        isPro = data?.plan === "pro";
      } catch { /* non-fatal */ }
    }

    // ── Rate limit ─────────────────────────────────────────────
    const ip    = getClientIP(request);
    const today = new Date().toISOString().slice(0, 10);
    if (!isPro) {
      const entry = usageMap.get(ip);
      if (!entry || entry.date !== today) usageMap.set(ip, { count: 0, date: today });
      const count = usageMap.get(ip)!.count;
      console.log(`Rate check — ip:${ip} count:${count}`);
      if (count >= DAILY_LIMIT) {
        return NextResponse.json(
          { success: false, error: "Daily limit reached", used: count, limit: DAILY_LIMIT },
          { status: 429 }
        );
      }
    }

    // ── Prepare image ──────────────────────────────────────────
    const bytes     = await file.arrayBuffer();
    const base64    = Buffer.from(bytes).toString("base64");
    const mediaType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

    console.log("Calling Claude API... model:claude-opus-4-5 tf:", timeframe);

    // ── Single Claude call ────────────────────────────────────
    const response = await anthropic.messages.create({
      model:      "claude-opus-4-5",
      max_tokens: 800,
      messages: [{
        role:    "user",
        content: [
          {
            type:   "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: `Analyse this trading chart and return ONLY a valid JSON object with no markdown, no backticks, no explanation. Just raw JSON:
{
  "signal": "LONG or SHORT or NEUTRAL",
  "entry": "price level",
  "stopLoss": "price level",
  "takeProfit": "price level",
  "riskReward": "e.g. 1:2",
  "confidence": 75,
  "grade": "A",
  "trend": "Bullish or Bearish or Ranging",
  "keyLevels": "support and resistance levels",
  "structure": "market structure description",
  "confluenceFactors": ["factor 1", "factor 2", "factor 3"],
  "warnings": ["warning if any"],
  "summary": "3-4 sentence trade summary"
}`,
          },
        ],
      }],
    });

    console.log("Claude responded");

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";
    console.log("Raw response:", rawText.substring(0, 300));

    const cleanText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    try {
      parsed = JSON.parse(cleanText);
    } catch {
      console.log("JSON parse failed. cleanText was:", cleanText);
      return NextResponse.json({ error: "Failed to parse Claude response", raw: cleanText }, { status: 500 });
    }

    console.log("Parsed signal:", parsed.signal, "confidence:", parsed.confidence);

    // ── Map flat response → shape the frontend expects ────────
    const SIGNAL_TO_BIAS: Record<string, string> = {
      LONG: "BULLISH", SHORT: "BEARISH", NEUTRAL: "NEUTRAL",
    };
    const bias = SIGNAL_TO_BIAS[(parsed.signal ?? "NEUTRAL").toUpperCase()] ?? "NEUTRAL";

    const current = {
      bias,
      confidence:   parsed.confidence   ?? 50,
      timeframe,
      summary:      parsed.summary      ?? "",
      tradeScore:   parsed.grade,
      marketStructure: parsed.structure ?? "",
      tradeSetup: {
        entry:       parsed.entry      ?? "N/A",
        entryType:   "Limit",
        stopLoss:    parsed.stopLoss   ?? "N/A",
        takeProfit1: parsed.takeProfit ?? "N/A",
        riskReward:  parsed.riskReward ?? "N/A",
      },
      keyLevels: {
        resistance: parsed.keyLevels ? [parsed.keyLevels] : [],
        support:    [],
      },
      indicators: {
        rsi:     "Neutral",
        macd:    parsed.trend ?? "N/A",
        maCross: "No Cross",
      },
      confluences:      Array.isArray(parsed.confluenceFactors) ? parsed.confluenceFactors : [],
      confluenceChecks: [],
      warnings:         Array.isArray(parsed.warnings) ? parsed.warnings : [],
    };

    // Neutral placeholder for higher/highest (not analysed in this call)
    const [higherTF, highestTF] = getHigherTFs(timeframe);
    const ctxPlaceholder = (tf: string) => ({
      bias: "NEUTRAL", confidence: 0, timeframe: tf,
      summary: "Higher timeframe context not analysed in this call.",
      tradeSetup: { entry: "N/A", entryType: "Limit", stopLoss: "N/A", takeProfit1: "N/A", riskReward: "N/A" },
      keyLevels: { resistance: [], support: [] },
      indicators: { rsi: "Neutral", macd: "N/A", maCross: "No Cross" },
      confluences: [], confluenceChecks: [], warnings: [],
    });

    const confluence = { score: 1, total: 3, label: "Single timeframe", color: "#f59e0b", detail: `${timeframe} only` };

    // ── Record usage ───────────────────────────────────────────
    if (!isPro) {
      const entry = usageMap.get(ip)!;
      entry.count += 1;
      console.log(`Usage recorded — ip:${ip} count:${entry.count}`);
    }

    // ── Journal save (non-fatal) ───────────────────────────────
    let journalId: string | null = null;
    try {
      const signal = bias === "BULLISH" ? "LONG" : bias === "BEARISH" ? "SHORT" : "NEUTRAL";
      const payload = {
        asset,
        timeframe,
        signal,
        entry:       current.tradeSetup.entry       !== "N/A" ? current.tradeSetup.entry       : null,
        stop_loss:   current.tradeSetup.stopLoss    !== "N/A" ? current.tradeSetup.stopLoss    : null,
        take_profit: current.tradeSetup.takeProfit1 !== "N/A" ? current.tradeSetup.takeProfit1 : null,
        risk_reward: current.tradeSetup.riskReward  !== "N/A" ? current.tradeSetup.riskReward  : null,
        summary:     current.summary || null,
        confidence:  current.confidence,
      };
      console.log("Journal save payload:", JSON.stringify(payload));
      const { data: jData, error: jError } = await getSupabase()
        .from("journal").insert(payload).select("id").single();
      if (jError) console.error("Journal insert error:", jError.code, jError.message);
      else { journalId = jData?.id ?? null; console.log("Journal saved id:", journalId); }
    } catch (e) { console.error("Journal exception:", e); }

    // ── Alerts (fire-and-forget) ───────────────────────────────
    checkAndSendAlerts({
      pair:       asset,
      signal:     bias === "BULLISH" ? "LONG" : bias === "BEARISH" ? "SHORT" : "NEUTRAL",
      confidence: current.confidence,
      entry:      current.tradeSetup.entry       !== "N/A" ? current.tradeSetup.entry       : null,
      stopLoss:   current.tradeSetup.stopLoss    !== "N/A" ? current.tradeSetup.stopLoss    : null,
      takeProfit: current.tradeSetup.takeProfit1 !== "N/A" ? current.tradeSetup.takeProfit1 : null,
      summary:    current.summary || null,
    }).catch((e) => console.error("Alerts error:", e));

    const usedNow = isPro ? null : (usageMap.get(ip)?.count ?? 1);

    console.log("Analysis complete — bias:", bias, "confidence:", current.confidence, "journalId:", journalId);

    return NextResponse.json({
      success: true,
      analyses: { current, higher: ctxPlaceholder(higherTF), highest: ctxPlaceholder(highestTF) },
      tfLabels:  { current: timeframe, higher: higherTF, highest: highestTF },
      confluence,
      journalId,
      usage: { used: usedNow, limit: isPro ? null : DAILY_LIMIT, isPro },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Analysis error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: { "Access-Control-Allow-Origin": "*" } });
}
