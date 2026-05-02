import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/app/lib/supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ScanCategory = "forex" | "crypto" | "stocks" | "commodities";

export interface ScanAsset {
  symbol: string;
  display: string;
  category: ScanCategory;
}

export interface ScannerResult {
  id: string;
  created_at: string;
  asset: string;
  category: ScanCategory;
  timeframe: string;
  signal: "LONG" | "SHORT" | "NEUTRAL";
  confidence: number;
  grade: string;
  entry: string;
  stop_loss: string;
  take_profit: string;
  risk_reward: string;
  summary: string;
  setup_type: string;
  has_setup: boolean;
  is_active: boolean;
}

export const SCAN_ASSETS: ScanAsset[] = [
  { symbol: "GC=F",     display: "XAU/USD",  category: "commodities" },
  { symbol: "BTC-USD",  display: "BTC/USD",  category: "crypto"      },
  { symbol: "ETH-USD",  display: "ETH/USD",  category: "crypto"      },
  { symbol: "EURUSD=X", display: "EUR/USD",  category: "forex"       },
  { symbol: "GBPUSD=X", display: "GBP/USD",  category: "forex"       },
  { symbol: "USDJPY=X", display: "USD/JPY",  category: "forex"       },
  { symbol: "NQ=F",     display: "NAS100",   category: "stocks"      },
  { symbol: "ES=F",     display: "SPX500",   category: "stocks"      },
  { symbol: "AAPL",     display: "AAPL",     category: "stocks"      },
  { symbol: "NVDA",     display: "NVDA",     category: "stocks"      },
  { symbol: "TSLA",     display: "TSLA",     category: "stocks"      },
];

async function fetchOHLCV(symbol: string): Promise<string | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1h&range=2d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; scanner/1.0)" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp ?? [];
    const q = result.indicators?.quote?.[0] ?? {};
    const o: number[] = q.open ?? [];
    const h: number[] = q.high ?? [];
    const l: number[] = q.low ?? [];
    const c: number[] = q.close ?? [];
    const v: number[] = q.volume ?? [];

    const total = timestamps.length;
    const start = Math.max(0, total - 24);
    const lines: string[] = [];
    for (let i = start; i < total; i++) {
      lines.push(`O:${o[i]?.toFixed(4) ?? 0} H:${h[i]?.toFixed(4) ?? 0} L:${l[i]?.toFixed(4) ?? 0} C:${c[i]?.toFixed(4) ?? 0} V:${v[i] ?? 0}`);
    }

    const price = result.meta?.regularMarketPrice ?? c[c.length - 1];
    return `Current: ${price}\nLast ${lines.length} 1H candles (OHLCV, newest last):\n${lines.join("\n")}`;
  } catch {
    return null;
  }
}

async function analyzeAsset(display: string, ohlcv: string): Promise<Record<string, unknown>> {
  const prompt = `Analyse this OHLCV price data for ${display} on 1H timeframe. Identify if there is a high quality trading setup based on:
- Recent price structure (HH/HL or LH/LL)
- Key support and resistance levels
- Momentum (accelerating or slowing)
- Volume patterns if available
- Distance from key levels

${ohlcv}

Return ONLY a JSON object (no markdown, no code blocks):
{"hasSetup":false,"signal":"NEUTRAL","confidence":30,"grade":"D","entry":"0","stopLoss":"0","takeProfit":"0","riskReward":"1:1","summary":"No clear setup","keyLevel":"0","setupType":"None"}

Rules: hasSetup=true only if confidence>=75. Be strict.`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text;
  const cleaned = raw.replace(/```json\n?|\n?```|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]+\}/);
    if (m) return JSON.parse(m[0]);
    return { hasSetup: false, signal: "NEUTRAL", confidence: 0, grade: "D", entry: "0", stopLoss: "0", takeProfit: "0", riskReward: "1:1", summary: "Parse error", keyLevel: "0", setupType: "None" };
  }
}

export async function runScan(): Promise<{ scanned: number; withSetups: number }> {
  const supabase = getSupabase();

  // Deactivate previous scan
  await supabase.from("scanner_results").update({ is_active: false }).eq("is_active", true);

  // Fetch all price data in parallel
  const fetched = await Promise.allSettled(
    SCAN_ASSETS.map((a) => fetchOHLCV(a.symbol).then((ohlcv) => ({ a, ohlcv })))
  );

  // Analyse in batches of 4 to avoid rate limits
  const items = fetched
    .filter((r): r is PromiseFulfilledResult<{ a: ScanAsset; ohlcv: string | null }> =>
      r.status === "fulfilled" && r.value.ohlcv !== null)
    .map((r) => r.value);

  const results: { asset: ScanAsset; analysis: Record<string, unknown> }[] = [];
  for (let i = 0; i < items.length; i += 4) {
    const batch = items.slice(i, i + 4);
    const settled = await Promise.allSettled(
      batch.map((item) => analyzeAsset(item.a.display, item.ohlcv!).then((analysis) => ({ asset: item.a, analysis })))
    );
    for (const r of settled) {
      if (r.status === "fulfilled") results.push(r.value);
    }
  }

  let withSetups = 0;
  const rows = results.map(({ asset, analysis }) => {
    const row = {
      asset: asset.display,
      category: asset.category,
      timeframe: "1H",
      signal: (analysis.signal as string) ?? "NEUTRAL",
      confidence: Number(analysis.confidence) || 0,
      grade: (analysis.grade as string) ?? "D",
      entry: String(analysis.entry ?? ""),
      stop_loss: String(analysis.stopLoss ?? ""),
      take_profit: String(analysis.takeProfit ?? ""),
      risk_reward: String(analysis.riskReward ?? ""),
      summary: String(analysis.summary ?? ""),
      setup_type: String(analysis.setupType ?? ""),
      has_setup: Boolean(analysis.hasSetup),
      is_active: true,
    };
    if (row.has_setup) withSetups++;
    return row;
  });

  if (rows.length > 0) await supabase.from("scanner_results").insert(rows);
  return { scanned: rows.length, withSetups };
}

export async function getLatestResults(): Promise<ScannerResult[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("scanner_results")
    .select("*")
    .eq("is_active", true)
    .order("confidence", { ascending: false });
  return (data ?? []) as ScannerResult[];
}
