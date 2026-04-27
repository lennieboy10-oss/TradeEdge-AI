import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/app/lib/supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const BIAS_TO_SIGNAL: Record<string, string> = {
  BULLISH: "LONG",
  BEARISH: "SHORT",
  NEUTRAL: "NEUTRAL",
};

const DAILY_LIMIT = 3;

// ── In-memory counter (fallback when Supabase is unavailable) ──
// Key: IP address. Value: { count, dateStr in user's local timezone }.
// Resets automatically when the local date string changes (i.e. past midnight).
const memoryCounter = new Map<string, { count: number; dateStr: string }>();

function getLocalDateStr(tz: string): string {
  try {
    return new Date().toLocaleDateString("sv", { timeZone: tz }); // "YYYY-MM-DD"
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function memoryGet(ip: string, dateStr: string): number {
  const entry = memoryCounter.get(ip);
  if (!entry || entry.dateStr !== dateStr) return 0;
  return entry.count;
}

function memoryIncrement(ip: string, dateStr: string): void {
  memoryCounter.set(ip, { count: memoryGet(ip, dateStr) + 1, dateStr });
}

function getClientIP(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() ?? "unknown";
}

// Returns UTC timestamp for local midnight in the given timezone.
function getLocalMidnight(tz: string): Date {
  try {
    const now  = new Date();
    const hour = parseInt(new Intl.DateTimeFormat("en", { timeZone: tz, hour: "2-digit",   hour12: false }).format(now));
    const min  = parseInt(new Intl.DateTimeFormat("en", { timeZone: tz, minute: "2-digit"                }).format(now));
    const sec  = parseInt(new Intl.DateTimeFormat("en", { timeZone: tz, second: "2-digit"                }).format(now));
    const elapsedMs = (hour * 3600 + min * 60 + sec) * 1000 + now.getMilliseconds();
    return new Date(now.getTime() - elapsedMs);
  } catch {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  }
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file     = formData.get("file")      as File;
  const asset    = (formData.get("asset")     as string | null)?.trim() || null;
  const clientId = (formData.get("client_id") as string | null)?.trim() || null;
  const clientTZ = (formData.get("timezone")  as string | null)?.trim() || "UTC";

  if (!file) {
    return NextResponse.json({ error: "No file uploaded", success: false }, { status: 400 });
  }

  // ── Pro plan check (skips rate limit) ────────────────────────
  let isPro = false;
  if (clientId) {
    try {
      const { data, error } = await getSupabase()
        .from("profiles")
        .select("plan")
        .eq("client_id", clientId)
        .single();
      if (error) console.error("[pro-check] supabase error:", error.message);
      isPro = data?.plan === "pro";
    } catch (err) {
      console.error("[pro-check] failed:", err);
    }
  }

  // ── IP rate limit (free users only) ─────────────────────────
  const ip       = getClientIP(req);
  const dateStr  = getLocalDateStr(clientTZ);
  const dayStart = getLocalMidnight(clientTZ);
  const dayEnd   = new Date(dayStart.getTime() + 86_400_000);

  let usedToday    = 0;
  let usingMemory  = false;

  if (!isPro) {
    // Primary: Supabase
    const { count, error: countErr } = await getSupabase()
      .from("anonymous_analyses")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", dayStart.toISOString())
      .lt("created_at", dayEnd.toISOString());

    if (countErr) {
      console.error("[rate-limit] supabase count failed — using memory fallback:", countErr.message);
      usedToday   = memoryGet(ip, dateStr);
      usingMemory = true;
    } else {
      usedToday = count ?? 0;
      // Keep memory in sync so fallback is accurate if Supabase drops mid-session
      memoryCounter.set(ip, { count: usedToday, dateStr });
    }

    console.log(`[rate-limit] ip=${ip} date=${dateStr} usedToday=${usedToday} limit=${DAILY_LIMIT} source=${usingMemory ? "memory" : "supabase"}`);

    if (usedToday >= DAILY_LIMIT) {
      console.log(`[rate-limit] BLOCKED ip=${ip}`);
      return NextResponse.json(
        { success: false, error: "Daily limit reached", used: usedToday, limit: DAILY_LIMIT },
        { status: 429 }
      );
    }
  }

  // ── Analysis ─────────────────────────────────────────────────
  try {
    const bytes    = await file.arrayBuffer();
    const base64   = Buffer.from(bytes).toString("base64");
    const mimeType = file.type;

    const response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2000,
      system: `You are an elite professional trading analyst with 20+ years of experience.

Return STRICTLY valid JSON with this exact structure:
{
  "success": true,
  "analysis": {
    "bias": "BULLISH | BEARISH | NEUTRAL",
    "confidence": <integer 0-100>,
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

CONFIDENCE SCORING RUBRIC — use this exact scale for the "confidence" field:
90-100: Extremely clear setup. Multiple confirming factors align — clean trend, confirmed volume, textbook levels, high-probability pattern.
70-89: Good setup. Most factors align with only minor conflicting signals.
50-69: Moderate setup. Some conflicting signals or unclear structure. Trade carefully.
0-49: Weak or unclear setup. Choppy price action, conflicting indicators, messy levels. Avoid or significantly reduce size.

Base confidence on: trend clarity (obvious vs choppy), volume confirmation, cleanliness of support/resistance, and how many independent factors agree.

CRITICAL: Return ONLY valid JSON - no markdown, no text outside the JSON.`,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this chart professionally:" },
            { type: "image", source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64 } },
          ],
        },
      ],
    });

    const content = (response.content[0].type === "text" ? response.content[0].text : "{}").trim();
    const clean   = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsed = JSON.parse(clean);
    if (!Object.prototype.hasOwnProperty.call(parsed, "success")) parsed.success = true;

    // ── Record usage (free users only) ──────────────────────
    if (!isPro) {
      memoryIncrement(ip, dateStr); // always increment memory — instant, reliable
      const { error: insertErr } = await getSupabase().from("anonymous_analyses").insert({ ip });
      if (insertErr) console.error("[rate-limit] supabase insert failed:", insertErr.message);
      console.log(`[rate-limit] recorded ip=${ip} memory=${memoryGet(ip, dateStr)}`);
    }

    // ── Save to journal ──────────────────────────────────────
    if (parsed.success && parsed.analysis) {
      const { analysis } = parsed;
      try {
        await getSupabase().from("journal").insert({
          asset,
          timeframe:   analysis.timeframe               ?? null,
          signal:      BIAS_TO_SIGNAL[analysis.bias]    ?? analysis.bias ?? null,
          entry:       analysis.tradeSetup?.entry       ?? null,
          stop_loss:   analysis.tradeSetup?.stopLoss    ?? null,
          take_profit: analysis.tradeSetup?.takeProfit1 ?? null,
          risk_reward: analysis.tradeSetup?.riskReward  ?? null,
          summary:     analysis.summary                 ?? null,
          confidence:  typeof analysis.confidence === "number" ? analysis.confidence : null,
        });
      } catch (saveErr) {
        console.error("[journal] save failed:", saveErr);
      }
    }

    return NextResponse.json(
      { ...parsed, usage: { used: isPro ? null : usedToday + 1, limit: isPro ? null : DAILY_LIMIT, isPro } },
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
