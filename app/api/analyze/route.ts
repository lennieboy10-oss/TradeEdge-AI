import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";
import { checkAndSendAlerts } from "@/app/lib/alerts";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FREE_LIMIT = 5;

const TF_ORDER = ["1m", "5m", "15m", "30m", "1H", "4H", "Daily", "Weekly"] as const;
function getHigherTFs(tf: string): [string, string] {
  const idx  = TF_ORDER.indexOf(tf as (typeof TF_ORDER)[number]);
  const base = idx === -1 ? 4 : idx;
  return [
    TF_ORDER[Math.min(base + 1, TF_ORDER.length - 1)],
    TF_ORDER[Math.min(base + 2, TF_ORDER.length - 1)],
  ];
}


export async function POST(request: Request) {
  try {
    console.log("Analysis started");

    const formData = await request.formData();

    const file = (formData.get("file") ?? formData.get("image")) as File | null;
    const asset     = (formData.get("asset")     as string | null)?.trim() || null;
    const clientId  = (formData.get("client_id") as string | null)?.trim() || null;
    const timeframe = (formData.get("timeframe") as string | null)?.trim() || "1H";
    const htfBias   = ((formData.get("htf_bias") as string | null)?.trim().toUpperCase() || "UNKNOWN") as "BULLISH" | "BEARISH" | "UNKNOWN";

    if (!file) {
      console.log("No image provided — formData keys:", [...formData.keys()].join(", "));
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    console.log("Image received:", file.name, file.size, file.type);

    // ── Plan + lifetime usage check ────────────────────────────
    let isPro              = false;
    let freeAnalysesUsed   = 0;
    const supabase = getSupabase();

    if (clientId) {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("plan, trial_ends_at, free_analyses_used")
          .eq("client_id", clientId)
          .single();

        if (data) {
          const trialValid = data.plan === "trial" && data.trial_ends_at && new Date(data.trial_ends_at) > new Date();
          isPro = data.plan === "pro" || data.plan === "elite" || trialValid;
          freeAnalysesUsed = data.free_analyses_used ?? 0;

          if (!isPro && freeAnalysesUsed === 0) {
            const { count } = await supabase
              .from("journal")
              .select("id", { count: "exact", head: true })
              .eq("client_id", clientId);
            if ((count ?? 0) > 0) {
              freeAnalysesUsed = Math.min(count ?? 0, FREE_LIMIT);
              await supabase.from("profiles")
                .update({ free_analyses_used: freeAnalysesUsed })
                .eq("client_id", clientId);
              console.log(`Backfilled free_analyses_used=${freeAnalysesUsed} for client ${clientId}`);
            }
          }
        }
      } catch { /* non-fatal */ }
    }

    if (!isPro && freeAnalysesUsed >= FREE_LIMIT) {
      return NextResponse.json(
        { success: false, error: "Free analysis limit reached", used: freeAnalysesUsed, limit: FREE_LIMIT },
        { status: 429 }
      );
    }

    const bytes     = await file.arrayBuffer();
    const base64    = Buffer.from(bytes).toString("base64");
    const mediaType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

    console.log("Calling Claude API... model:claude-opus-4-5 tf:", timeframe);

    const response = await anthropic.messages.create({
      model:      "claude-opus-4-5",
      max_tokens: 2500,
      system: `You are a senior institutional trading analyst with 20 years experience at a top hedge fund. You specialise in Smart Money Concepts, price action, and risk management. You also have deep expertise in futures markets including equity index futures (ES, NQ, MES, MNQ, YM, RTY), metal futures (GC, MGC, SI), energy futures (CL, MCL, NG), bond futures (ZB, ZN, ZF), and currency futures (6E, 6B, 6J).

Your analysis must be:
- Brutally specific — exact price levels only, never ranges wider than 5 pips/points for entry
- Professionally written — like a Bloomberg terminal report
- Honest — if the setup is weak, say so clearly and return NEUTRAL
- Actionable — the trader knows exactly what to do

ANALYSIS METHODOLOGY:

1. MARKET STRUCTURE FIRST:
Identify exact swing highs and lows. State clearly whether structure is bullish (higher highs, higher lows), bearish (lower highs, lower lows), or ranging (between two clear levels). If ranging, return NEUTRAL — avoid directional trades.

2. SMART MONEY CONCEPTS:
- Fair Value Gaps: 3-candle imbalances. Return exact price range e.g. "3285-3291". Mark if filled.
- Order Blocks: last candle before institutional move. Return exact candle range and type.
- Liquidity Sweeps: price briefly breaks a key high/low then reverses (stop hunt). Return price and direction.
- Equal Highs/Lows: 2+ highs or lows at same level — liquidity pool target.
- BOS/CHoCH: confirmed break of structure (BOS) or first reversal sign (CHoCH). Return exact price.
- Market Zone: premium (top 25% of range — prefer shorts), discount (bottom 25% — prefer longs), neutral.

3. ENTRY PRECISION:
Entry must be within 5 pips/points. Give exact price and exact reason (retracement level + FVG alignment, etc.). State the confirmation required: e.g. "Wait for bearish engulfing close on 5m at this level".

4. STOP LOSS — STRUCTURE BASED ONLY:
Place stop beyond the nearest structural level — never arbitrary ATR stops. State exactly what invalidates the setup.

5. TAKE PROFIT — TWO LEVELS:
TP1: first structural target (take 50% here)
TP2: second structural target / liquidity pool (let remainder run)

6. RISK:REWARD — CALCULATE BOTH:
Calculate precisely for both TP levels. If R:R1 is below 1:1.5, return NEUTRAL.

7. PROBABILITY ASSESSMENT:
Estimate probability of reaching each TP based on confluence quality. Be conservative.

8. CONFLUENCE BREAKDOWN — SCORE EACH FACTOR /20:
- Trend alignment (is entry direction aligned with structure?)
- SMC confluence (FVGs, OBs, sweeps aligning?)
- Key level quality (how clean and significant is the level?)
- Volume confirmation (is there volume evidence?)
- Session timing (are we in optimal session for this asset?)

9. CONFIRMATION AND INVALIDATION:
State the exact trigger to wait for before entering. State the exact price level that invalidates the thesis.

10. ALTERNATIVE SCENARIO:
If the primary thesis fails, what is the plan? Where does bias flip? What is the next trade?

STRICT RULES:
- Never say "seems", "appears", "might", "could" — be definitive
- If R:R below 1:1.5 → return NEUTRAL and explain
- If structure is unclear → return NEUTRAL
- If price is in the middle of a range → return NEUTRAL
- NEUTRAL is always better than a forced signal
- For futures: express levels in both price and points where relevant`,

      messages: [{
        role:    "user",
        content: [
          {
            type:   "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: `Timeframe: ${timeframe}. Asset: ${asset ?? "unknown"}.${htfBias !== "UNKNOWN" ? ` Higher timeframe bias confirmed as ${htfBias}. Only signal trades aligned with this bias. If chart signal contradicts HTF bias, reduce confidence by 20 and add warning "Trading against higher timeframe trend".` : ""}

Return ONLY raw JSON, no markdown, no backticks:
{
  "signal": "LONG or SHORT or NEUTRAL",
  "entry": "exact price as string",
  "stopLoss": "exact price as string",
  "takeProfit1": "first TP price as string",
  "takeProfit2": "second TP price as string",
  "riskReward1": "e.g. 1:1.65",
  "riskReward2": "e.g. 1:3.65",
  "confidence": 75,
  "grade": "A+ or A or B or C or D",
  "trend": "Bullish or Bearish or Ranging",
  "structure": "exact description e.g. Lower highs at 3312, lower lows at 3256 — bearish structure confirmed",
  "keyLevels": "comma separated key price levels",
  "fvg": [{"type":"bullish or bearish","priceRange":"3285-3291","filled":false,"description":"one sentence"}],
  "orderBlocks": [{"type":"bullish or bearish","priceRange":"3300-3306","description":"one sentence"}],
  "liquiditySweep": "description or null",
  "bos": "description or null",
  "confluenceBreakdown": {
    "trendAlignment": 16,
    "smcConfluence": 20,
    "keyLevelQuality": 16,
    "volumeConfirmation": 12,
    "sessionTiming": 11
  },
  "probability": {"tp1": 65, "tp2": 45},
  "confirmation": "exact trigger to wait for e.g. Wait for bearish engulfing close on 5m below 3292",
  "invalidation": "exact price and what it means e.g. Close above 3302.50 invalidates SHORT — flip to LONG",
  "alternativeScenario": "what to do if wrong e.g. If price breaks above 3302, flip bias LONG targeting 3312",
  "warnings": ["warning 1 if any"],
  "summary": "exactly 5 sentences: 1) What is the market doing now. 2) Why this setup exists and the SMC reasoning. 3) Exact entry trigger and confirmation needed. 4) Exact invalidation level and what it means. 5) Risk management instruction.",
  "entrySession": "best session name e.g. NY Open or London Open",
  "entryTimeUTC": "HH:MM in 24hr UTC",
  "entryRationale": "1 sentence why this session is optimal",
  "waitForConfirmation": "what to wait for",
  "liquiditySweeps": [{"direction":"high or low","price":"3312","description":"one sentence"}],
  "structureBreaks": [{"type":"BOS bullish or BOS bearish or CHoCH","price":"3290","description":"one sentence"}],
  "equalLevels": [{"type":"equal highs or equal lows","price":"3308","description":"one sentence"}],
  "marketZone": "premium or discount or neutral",
  "patterns": [{"name":"pattern name","direction":"bullish or bearish","target":"measured move price","description":"one sentence"}],
  "smcFibonacci": [{"level":"0.618","price":"3285","description":"one sentence"}],
  "smc_summary": "one sentence overall SMC bias",
  "confluenceFactors": ["factor 1", "factor 2", "factor 3"]
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

    // ── Enforce HTF bias penalty ───────────────────────────────
    if (htfBias !== "UNKNOWN") {
      const sig = (parsed.signal ?? "NEUTRAL").toUpperCase();
      const isAgainst = (htfBias === "BULLISH" && sig === "SHORT") || (htfBias === "BEARISH" && sig === "LONG");
      if (isAgainst) {
        parsed.confidence = Math.max(0, (parsed.confidence ?? 50) - 20);
        const htfWarning = "Trading against higher timeframe trend";
        if (!Array.isArray(parsed.warnings)) parsed.warnings = [];
        if (!parsed.warnings.includes(htfWarning)) parsed.warnings.unshift(htfWarning);
        const c = parsed.confidence;
        parsed.grade = c >= 85 ? "A+" : c >= 70 ? "A" : c >= 55 ? "B" : c >= 40 ? "C" : "D";
        console.log(`HTF bias penalty applied — bias:${htfBias} signal:${sig} new confidence:${parsed.confidence}`);
      }
    }

    // ── SMC confidence boost ───────────────────────────────────
    const sig = (parsed.signal ?? "NEUTRAL").toUpperCase();
    if (sig !== "NEUTRAL") {
      const isLong  = sig === "LONG";
      const isShort = sig === "SHORT";
      let boost = 0;
      if (Array.isArray(parsed.liquiditySweeps) && parsed.liquiditySweeps.length > 0) boost += 10;
      if (Array.isArray(parsed.orderBlocks)     && parsed.orderBlocks.length > 0)     boost += 8;
      if (Array.isArray(parsed.fvg)             && parsed.fvg.length > 0)             boost += 7;
      const hasBOS = (parsed.structureBreaks ?? []).some((s: { type: string }) => {
        const t = (s.type ?? "").toLowerCase();
        return t.includes("bos") && ((isLong && t.includes("bull")) || (isShort && t.includes("bear")));
      });
      if (hasBOS) boost += 5;
      if ((isLong && parsed.marketZone === "discount") || (isShort && parsed.marketZone === "premium")) boost += 5;
      if (boost > 0) {
        parsed.confidence = Math.min(100, (parsed.confidence ?? 50) + boost);
        const c = parsed.confidence;
        parsed.grade = c >= 85 ? "A+" : c >= 70 ? "A" : c >= 55 ? "B" : c >= 40 ? "C" : "D";
        console.log(`SMC boost +${boost} → confidence: ${parsed.confidence}`);
      }
    }

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
        entry:       parsed.entry       ?? "N/A",
        entryType:   "Limit",
        stopLoss:    parsed.stopLoss    ?? "N/A",
        takeProfit1: parsed.takeProfit1 ?? parsed.takeProfit ?? "N/A",
        takeProfit2: parsed.takeProfit2 ?? null,
        riskReward:  parsed.riskReward1 ?? parsed.riskReward ?? "N/A",
        riskReward1: parsed.riskReward1 ?? parsed.riskReward ?? "N/A",
        riskReward2: parsed.riskReward2 ?? null,
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
      entrySession:         parsed.entrySession         ?? null,
      entryTimeUTC:         parsed.entryTimeUTC         ?? null,
      entryRationale:       parsed.entryRationale       ?? null,
      waitForConfirmation:  parsed.waitForConfirmation  ?? parsed.confirmation ?? null,
      confirmation:         parsed.confirmation         ?? parsed.waitForConfirmation ?? null,
      invalidation:         parsed.invalidation         ?? null,
      alternativeScenario:  parsed.alternativeScenario  ?? null,
      confluenceBreakdown:  parsed.confluenceBreakdown  ?? null,
      probability:          parsed.probability          ?? null,
      // SMC fields
      fvg:             Array.isArray(parsed.fvg)             ? parsed.fvg             : [],
      liquiditySweeps: Array.isArray(parsed.liquiditySweeps) ? parsed.liquiditySweeps : [],
      orderBlocks:     Array.isArray(parsed.orderBlocks)     ? parsed.orderBlocks     : [],
      structureBreaks: Array.isArray(parsed.structureBreaks) ? parsed.structureBreaks : [],
      equalLevels:     Array.isArray(parsed.equalLevels)     ? parsed.equalLevels     : [],
      marketZone:      parsed.marketZone    ?? "neutral",
      patterns:        Array.isArray(parsed.patterns)        ? parsed.patterns        : [],
      smcFibonacci:    Array.isArray(parsed.smcFibonacci)    ? parsed.smcFibonacci    : [],
      smc_summary:     parsed.smc_summary   ?? null,
    };

    const [higherTF, highestTF] = getHigherTFs(timeframe);
    const ctxPlaceholder = (tf: string) => ({
      bias: "NEUTRAL", confidence: 0, timeframe: tf,
      summary: "Higher timeframe context not analysed in this call.",
      tradeSetup: { entry: "N/A", entryType: "Limit", stopLoss: "N/A", takeProfit1: "N/A", takeProfit2: null, riskReward: "N/A", riskReward1: "N/A", riskReward2: null },
      keyLevels: { resistance: [], support: [] },
      indicators: { rsi: "Neutral", macd: "N/A", maCross: "No Cross" },
      confluences: [], confluenceChecks: [], warnings: [],
    });

    const confluence = { score: 1, total: 3, label: "Single timeframe", color: "#f59e0b", detail: `${timeframe} only` };

    if (!isPro && clientId) {
      try {
        await supabase.from("profiles")
          .update({ free_analyses_used: freeAnalysesUsed + 1 })
          .eq("client_id", clientId);
        console.log(`Usage recorded — client:${clientId} total:${freeAnalysesUsed + 1}`);
      } catch (e) { console.error("Usage increment error:", e); }
    }

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
        risk_reward:    current.tradeSetup.riskReward  !== "N/A" ? current.tradeSetup.riskReward  : null,
        summary:        current.summary || null,
        confidence:     current.confidence,
        entry_session:  current.entrySession  ?? null,
        entry_time_utc: current.entryTimeUTC  ?? null,
      };
      console.log("Journal save payload:", JSON.stringify(payload));
      const { data: jData, error: jError } = await getSupabase()
        .from("journal").insert(payload).select("id").single();
      if (jError) console.error("Journal insert error:", jError.code, jError.message);
      else { journalId = jData?.id ?? null; console.log("Journal saved:", asset, signal); }
    } catch (e) { console.error("Journal exception:", e); }

    checkAndSendAlerts({
      pair:       asset,
      signal:     bias === "BULLISH" ? "LONG" : bias === "BEARISH" ? "SHORT" : "NEUTRAL",
      confidence: current.confidence,
      entry:      current.tradeSetup.entry       !== "N/A" ? current.tradeSetup.entry       : null,
      stopLoss:   current.tradeSetup.stopLoss    !== "N/A" ? current.tradeSetup.stopLoss    : null,
      takeProfit: current.tradeSetup.takeProfit1 !== "N/A" ? current.tradeSetup.takeProfit1 : null,
      summary:    current.summary || null,
    }).catch((e) => console.error("Alerts error:", e));

    const usedNow = isPro ? null : freeAnalysesUsed + 1;

    console.log("Analysis complete — bias:", bias, "confidence:", current.confidence, "journalId:", journalId);

    return NextResponse.json({
      success: true,
      analyses: { current, higher: ctxPlaceholder(higherTF), highest: ctxPlaceholder(highestTF) },
      tfLabels:  { current: timeframe, higher: higherTF, highest: highestTF },
      confluence,
      journalId,
      usage: { used: usedNow, limit: isPro ? null : FREE_LIMIT, isPro },
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
