export const dynamic = "force-dynamic";

type Sym = { label: string; yf: string; decimals: number };

const SYMBOLS: Sym[] = [
  { label: "XAU/USD", yf: "GC=F",      decimals: 2 },
  { label: "BTC/USD", yf: "BTC-USD",   decimals: 0 },
  { label: "ETH/USD", yf: "ETH-USD",   decimals: 2 },
  { label: "EUR/USD", yf: "EURUSD=X",  decimals: 4 },
  { label: "GBP/USD", yf: "GBPUSD=X",  decimals: 4 },
  { label: "USD/JPY", yf: "JPY=X",     decimals: 2 },
  { label: "SOL/USD", yf: "SOL-USD",   decimals: 2 },
  { label: "AAPL",    yf: "AAPL",      decimals: 2 },
  { label: "NVDA",    yf: "NVDA",      decimals: 2 },
  { label: "TSLA",    yf: "TSLA",      decimals: 2 },
  { label: "SPX500",  yf: "^GSPC",     decimals: 2 },
  { label: "OIL/USD", yf: "CL=F",      decimals: 2 },
];

const FALLBACK = [
  { label: "XAU/USD", price: "3,312.40", change:  0.38 },
  { label: "BTC/USD", price: "94,850",   change:  1.24 },
  { label: "ETH/USD", price: "1,812.55", change: -0.76 },
  { label: "EUR/USD", price: "1.0842",   change: -0.12 },
  { label: "GBP/USD", price: "1.2658",   change:  0.08 },
  { label: "USD/JPY", price: "143.22",   change: -0.31 },
  { label: "SOL/USD", price: "148.30",   change:  2.14 },
  { label: "AAPL",    price: "207.15",   change:  0.54 },
  { label: "NVDA",    price: "117.40",   change:  1.87 },
  { label: "TSLA",    price: "281.90",   change: -1.32 },
  { label: "SPX500",  price: "5,648.10", change:  0.22 },
  { label: "OIL/USD", price: "64.78",    change: -0.45 },
];

function fmt(price: number, decimals: number) {
  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const BROWSER = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "*/*",
};

// Module-level crumb cache — reuse across requests in the same serverless instance
// This is the key fix: fetching a fresh crumb on every request triggers Yahoo's 429
let crumbCache: { crumb: string; cookieStr: string; ts: number } | null = null;
const CRUMB_TTL = 12 * 60 * 1000; // 12 minutes

async function getYahooCrumb(): Promise<{ crumb: string; cookieStr: string }> {
  if (crumbCache && Date.now() - crumbCache.ts < CRUMB_TTL) {
    return crumbCache;
  }

  const pageRes = await fetch("https://finance.yahoo.com/", {
    headers: { ...BROWSER, Accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    cache:    "no-store",
  });

  type H = Headers & { getSetCookie?: () => string[] };
  const h = pageRes.headers as H;
  const rawCookies = typeof h.getSetCookie === "function"
    ? h.getSetCookie()
    : [h.get("set-cookie") ?? ""].filter(Boolean);

  const cookieStr = rawCookies.map((c) => c.split(";")[0]).join("; ");
  if (!cookieStr) throw new Error("no cookies from Yahoo homepage");

  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { ...BROWSER, Cookie: cookieStr },
    cache:   "no-store",
  });
  if (!crumbRes.ok) throw new Error(`crumb HTTP ${crumbRes.status}`);

  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb.length > 30 || crumb.startsWith("<")) throw new Error("bad crumb");

  crumbCache = { crumb, cookieStr, ts: Date.now() };
  return crumbCache;
}

// ── Yahoo Finance with crumb auth ─────────────────────────────
async function fetchViaYahoo(): Promise<Record<string, { price: number; change: number }> | null> {
  const { crumb, cookieStr } = await getYahooCrumb();

  const qs  = SYMBOLS.map((s) => encodeURIComponent(s.yf)).join(",");
  const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${qs}&crumb=${encodeURIComponent(crumb)}`;

  const quotesRes = await fetch(url, {
    headers: { ...BROWSER, Cookie: cookieStr },
    cache:   "no-store",
  });

  // If quotes fail with 401/403 the crumb expired — bust cache and retry once
  if (quotesRes.status === 401 || quotesRes.status === 403) {
    crumbCache = null;
    const retry = await getYahooCrumb();
    const r2 = await fetch(
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${qs}&crumb=${encodeURIComponent(retry.crumb)}`,
      { headers: { ...BROWSER, Cookie: retry.cookieStr }, cache: "no-store" }
    );
    if (!r2.ok) throw new Error(`quotes HTTP ${r2.status} (retry)`);
    const json2 = await r2.json();
    const out2: Record<string, { price: number; change: number }> = {};
    for (const q of json2?.quoteResponse?.result ?? []) {
      out2[q.symbol] = { price: q.regularMarketPrice, change: q.regularMarketChangePercent };
    }
    return out2;
  }

  if (!quotesRes.ok) throw new Error(`quotes HTTP ${quotesRes.status}`);

  const json = await quotesRes.json();
  const out: Record<string, { price: number; change: number }> = {};
  for (const q of json?.quoteResponse?.result ?? []) {
    out[q.symbol] = { price: q.regularMarketPrice, change: q.regularMarketChangePercent };
  }
  return out;
}

// ── Binance for crypto (always free, no key) ──────────────────
async function fetchViaBinance(): Promise<Record<string, { price: number; change: number }>> {
  const pairs = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  const res = await fetch(
    `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(pairs))}`,
    { cache: "no-store" }
  );
  if (!res.ok) return {};
  const data: Array<{ symbol: string; lastPrice: string; priceChangePercent: string }> =
    await res.json();

  const map: Record<string, { price: number; change: number }> = {};
  const labelMap: Record<string, string> = {
    BTCUSDT: "BTC-USD",
    ETHUSDT: "ETH-USD",
    SOLUSDT: "SOL-USD",
  };
  for (const t of data) {
    map[labelMap[t.symbol] ?? t.symbol] = {
      price:  parseFloat(t.lastPrice),
      change: parseFloat(t.priceChangePercent),
    };
  }
  return map;
}

// ── Main handler ──────────────────────────────────────────────
export async function GET() {
  let bySymbol: Record<string, { price: number; change: number }> = {};
  let yahooOk = false;

  // 1. Try Yahoo Finance (forex, stocks, gold, indices)
  try {
    const yf = await fetchViaYahoo();
    if (yf && Object.keys(yf).length > 0) {
      bySymbol = { ...yf };
      yahooOk  = true;
    }
  } catch (err) {
    console.error("[ticker] Yahoo Finance failed:", err);
  }

  // 2. Always overlay Binance for crypto — it's faster and never 429s
  try {
    const bin = await fetchViaBinance();
    bySymbol = { ...bySymbol, ...bin };
  } catch (err) {
    console.error("[ticker] Binance failed:", err);
  }

  const live  = Object.keys(bySymbol).length > 0;
  const items = SYMBOLS.map((s, i) => {
    const q = bySymbol[s.yf];
    if (!q) return FALLBACK[i];
    return {
      label:  s.label,
      price:  fmt(q.price, s.decimals),
      change: parseFloat(q.change.toFixed(2)),
    };
  });

  console.log(`[ticker] live:${live} yahooOk:${yahooOk} symbols:${Object.keys(bySymbol).length}`);
  return Response.json({ items, live });
}
