import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const SYMBOL_MAP: Record<string, string> = {
  XAUUSD: "GC=F",    XAGUSD: "SI=F",
  BTCUSD: "BTC-USD", ETHUSD: "ETH-USD", SOLUSD: "SOL-USD",
  EURUSD: "EURUSD=X", GBPUSD: "GBPUSD=X", USDJPY: "JPY=X",
  AUDUSD: "AUDUSD=X", USDCAD: "CAD=X",   USDCHF: "CHF=X",
  NZDUSD: "NZDUSD=X", GBPJPY: "GBPJPY=X", EURJPY: "EURJPY=X",
  EURGBP: "EURGBP=X", OILUSD: "CL=F",    SPX500: "^GSPC",
  US500:  "^GSPC",    NAS100: "^IXIC",   XBTUSD: "BTC-USD",
  AAPL: "AAPL", NVDA: "NVDA", TSLA: "TSLA", MSFT: "MSFT",
  AMZN: "AMZN", GOOGL: "GOOGL", META: "META",
};

function pairToYf(pair: string): string {
  const clean = pair.replace(/[\/\-\s]/g, "").toUpperCase();
  return SYMBOL_MAP[clean] ?? clean;
}

// In-process cache keyed by symbol
const cache = new Map<string, { points: number[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const pair = req.nextUrl.searchParams.get("pair") ?? "";
  if (!pair) return Response.json({ points: [] });

  const yf  = pairToYf(pair);
  const hit = cache.get(yf);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return Response.json({ points: hit.points });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yf)}?interval=30m&range=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return Response.json({ points: [] });

    const data = await res.json();
    const closes: (number | null)[] = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const valid = closes.filter((v): v is number => v !== null && isFinite(v));
    if (valid.length < 2) return Response.json({ points: [] });

    // Downsample to 20 points max
    const step  = Math.max(1, Math.floor(valid.length / 20));
    const sampled = valid.filter((_, i) => i % step === 0).slice(-20);

    // Normalize to [0, 1]
    const min = Math.min(...sampled);
    const max = Math.max(...sampled);
    const range = max - min || 1;
    const points = sampled.map((v) => (v - min) / range);

    cache.set(yf, { points, ts: Date.now() });
    return Response.json({ points });
  } catch {
    return Response.json({ points: [] });
  }
}
