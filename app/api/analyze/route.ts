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

    // Frontend sends the file as "file", not "image"
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

          // ── Backfill for pre-existing users (runs once per user) ──
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

    // ── Lifetime free limit ────────────────────────────────────
    if (!isPro && freeAnalysesUsed >= FREE_LIMIT) {
      return NextResponse.json(
        { success: false, error: "Free analysis limit reached", used: freeAnalysesUsed, limit: FREE_LIMIT },
        { status: 429 }
      );
    }

    // ── Prepare image ──────────────────────────────────────────
    const bytes     = await file.arrayBuffer();
    const base64    = Buffer.from(bytes).toString("base64");
    const mediaType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

    console.log("Calling Claude API... model:claude-opus-4-5 tf:", timeframe);

    // ── Single Claude call ────────────────────────────────────
    const response = await anthropic.messages.create({
      model:      "claude-opus-4-5",
      max_tokens: 2000,
      system: `You are a professional trader specialising in price action and smart money concepts (SMC). You are also an expert in futures markets including equity index futures (ES, NQ, MES, MNQ, YM, RTY), metal futures (GC, MGC, SI), energy futures (CL, MCL, NG), bond futures (ZB, ZN, ZF), agricultural futures (ZC, ZW, ZS), and currency futures (6E, 6B, 6J). Analyse charts carefully and precisely.

Rules:
- Only signal LONG or SHORT if there is genuine confluence of at least 2-3 factors
- If chart is choppy, unclear or R:R is below 1:1.5 signal NEUTRAL
- Place stop loss beyond nearest structural level
- Place take profit at next significant level
- Be specific with exact price levels visible on chart

Grade the setup:
A+ = perfect setup 85+ confidence
A = strong setup 70-84 confidence
B = decent setup 55-69 confidence
C = weak setup 40-54 confidence
D = avoid below 40 confidence

When analysing futures charts:
- Express key levels in both price AND points where relevant (e.g. "SL at 19,760 — 58 points below entry")
- Consider the specific session for that futures contract (equity futures: NY Open 09:30 EST, metals: London/COMEX 08:20 EST, oil: NYMEX 09:00 EST, bonds: CBOT 08:20 EST)
- Note if price is near a contract high/low as these are key liquidity targets
- Micro contracts (MNQ, MES, MGC, MCL) are 1/10th the size — adjust position sizing guidance accordingly
- Prop firm traders often have max daily loss rules — factor this in when suggesting position sizes

SMC ANALYSIS — only report what you can clearly see:
- FVGs: 3-candle imbalances where middle candle moves strongly leaving a gap. Return exact price range e.g. "3285-3291". Mark if filled.
- Order Blocks: last bearish candle before strong bullish move (bullish OB) or last bullish candle before strong bearish move (bearish OB). Return price range.
- Liquidity Sweeps: price briefly breaks a key high/low then immediately reverses (stop hunt). Return the price and whether it swept highs or lows.
- BOS: confirmed break of previous swing high (bullish) or low (bearish). Return price.
- CHoCH: first sign of trend reversal, not yet confirmed. Return price.
- Equal Highs/Lows: 2+ highs or lows at same level (liquidity pool). Return price.
- Market Zone: premium (top 25% of range, prefer shorts), discount (bottom 25%, prefer longs), or neutral.
- Traditional Patterns: H&S, double top/bottom, bull/bear flag, wedge, triangle — only if clearly visible. Include measured move target price.
- Fibonacci: if clear swing is visible, key retracement levels (0.382, 0.5, 0.618, 0.786) with prices.`,
      messages: [{
        role:    "user",
        content: [
          {
            type:   "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: `Timeframe: ${timeframe}. Asset: ${asset ?? "unknown"}.${htfBias !== "UNKNOWN" ? ` The trader has confirmed the higher timeframe trend is ${htfBias}. Only suggest trades that align with this bias. If the chart signal goes against the higher timeframe bias, reduce confidence by 20 points and add a warning: "Trading against higher timeframe trend".` : ""} Return ONLY raw JSON no markdown no backticks:
{"signal":"LONG or SHORT or NEUTRAL","entry":"price","stopLoss":"price","takeProfit":"price","riskReward":"1:2","confidence":75,"grade":"A","trend":"Bullish or Bearish or Ranging","keyLevels":"support and resistance","structure":"market structure","confluenceFactors":["factor 1","factor 2","factor 3"],"warnings":["warning if any"],"summary":"5 sentences: what chart shows. Why entry is valid or not. Exact invalidation level. Confirmation to wait for. Key risk.","entrySession":"best session name e.g. NY Open or London Open or Asian Session or London/NY Overlap","entryTimeUTC":"HH:MM in 24hr UTC e.g. 13:30","entryRationale":"1 sentence: why this session is optimal for this specific asset and setup","waitForConfirmation":"what to wait for before entering e.g. Wait for 15m candle close above 3295","fvg":[{"type":"bullish or bearish","priceRange":"e.g. 3285-3291","filled":false,"description":"one sentence"}],"liquiditySweeps":[{"direction":"high or low","price":"3312","description":"one sentence"}],"orderBlocks":[{"type":"bullish or bearish","priceRange":"3300-3306","description":"one sentence"}],"structureBreaks":[{"type":"BOS bullish or BOS bearish or CHoCH","price":"3290","description":"one sentence"}],"equalLevels":[{"type":"equal highs or equal lows","price":"3308","description":"one sentence"}],"marketZone":"premium or discount or neutral","patterns":[{"name":"pattern name","direction":"bullish or bearish","target":"measured move price","description":"one sentence"}],"smcFibonacci":[{"level":"0.618","price":"3285","description":"one sentence"}],"smc_summary":"one sentence overall SMC bias"}`,
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
        // Re-grade after confidence reduction
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
      entrySession:         parsed.entrySession         ?? null,
      entryTimeUTC:         parsed.entryTimeUTC         ?? null,
      entryRationale:       parsed.entryRationale       ?? null,
      waitForConfirmation:  parsed.waitForConfirmation  ?? null,
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

    // ── Increment lifetime usage ───────────────────────────────
    if (!isPro && clientId) {
      try {
        await supabase.from("profiles")
          .update({ free_analyses_used: freeAnalysesUsed + 1 })
          .eq("client_id", clientId);
        console.log(`Usage recorded — client:${clientId} total:${freeAnalysesUsed + 1}`);
      } catch (e) { console.error("Usage increment error:", e); }
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
