"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

type CalcAssetType = "forex" | "crypto" | "stocks" | "gold";
type CalcCurrency  = "GBP" | "USD" | "EUR";
const CURRENCY_SYMBOLS: Record<CalcCurrency, string> = { GBP: "£", USD: "$", EUR: "€" };

function detectCalcAsset(asset: string): CalcAssetType {
  const up = (asset ?? "").toUpperCase().replace(/\s/g, "");
  if (up.includes("XAU") || up.includes("GOLD") || up.includes("OIL") || up.includes("WTI")) return "gold";
  const cryptoKeys = ["BTC","ETH","SOL","DOGE","ADA","XRP","AVAX","LTC","LINK","DOT","BNB","MATIC"];
  if (cryptoKeys.some((c) => up.includes(c))) return "crypto";
  if (up.includes("/") || /^[A-Z]{6}$/.test(up)) return "forex";
  return "stocks";
}

function parseNum(s: string): number {
  const n = parseFloat(String(s ?? "").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

type CalcResult = { sizeLabel: string; profit1: number; rr1: number; marginRequired: number; slPips?: number };

function doCalc(
  type: CalcAssetType, riskAmt: number, entry: number, sl: number, tp: number, asset: string
): CalcResult | null {
  const slDist = Math.abs(entry - sl);
  const tpDist = Math.abs(tp - entry);
  if (slDist === 0 || entry === 0) return null;
  const rr1 = tpDist / slDist;
  if (type === "forex") {
    const isJpy     = asset.toUpperCase().includes("JPY");
    const pipSize   = isJpy ? 0.01 : 0.0001;
    const pipPerLot = isJpy ? 1000 : 10;
    const slPips    = slDist / pipSize;
    const lots      = riskAmt / (slPips * pipPerLot);
    return { sizeLabel: `${lots.toFixed(2)} lots`, profit1: (tpDist / pipSize) * pipPerLot * lots, rr1, marginRequired: lots * 100_000 * entry * 0.01, slPips };
  }
  if (type === "crypto") {
    const up   = asset.toUpperCase().replace(/\s/g, "");
    const coin = up.split("/")[0] || up.slice(0, 3) || "COIN";
    const units = riskAmt / slDist;
    return { sizeLabel: `${units.toFixed(4)} ${coin}`, profit1: tpDist * units, rr1, marginRequired: units * entry * 0.1 };
  }
  if (type === "stocks") {
    const shares = Math.max(1, Math.floor(riskAmt / slDist));
    return { sizeLabel: `${shares.toLocaleString()} shares`, profit1: tpDist * shares, rr1, marginRequired: shares * entry * 0.25 };
  }
  const oz = riskAmt / slDist;
  return { sizeLabel: `${oz.toFixed(2)} oz`, profit1: tpDist * oz, rr1, marginRequired: oz * entry * 0.005 };
}

function WhatIfScenarios({
  balance, sym, asset, assetType, entryVal, slVal, tp1Val,
}: {
  balance: number; sym: string; asset: string; assetType: CalcAssetType;
  entryVal: number; slVal: number; tp1Val: number;
}) {
  return (
    <div>
      <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#6b7280] font-semibold mb-3">
        What If Scenarios
      </p>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Conservative", riskPct: 0.5, color: "#4ade80" },
          { label: "Standard",     riskPct: 1,   color: "#00e676" },
          { label: "Aggressive",   riskPct: 2,   color: "#f59e0b" },
        ].map((sc) => {
          const riskAmt = balance * sc.riskPct / 100;
          const calc    = doCalc(assetType, riskAmt, entryVal, slVal, tp1Val, asset);
          return (
            <div key={sc.label} className="rounded-xl p-3 text-center"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="font-dm-mono text-[9px] uppercase tracking-wider text-[#6b7280] mb-1.5">{sc.label}</p>
              <p className="font-dm-mono text-[10px] font-bold mb-1.5" style={{ color: sc.color }}>{sc.riskPct}% risk</p>
              <p className="font-dm-mono text-xs font-bold text-white truncate">{calc?.sizeLabel ?? "—"}</p>
              <p className="font-dm-mono text-xs mt-1 text-[#00e676]">+{sym}{(calc?.profit1 ?? 0).toFixed(0)}</p>
              <p className="font-dm-mono text-xs text-[#f87171]">-{sym}{riskAmt.toFixed(0)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CalculatorPage() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [isPro, setIsPro]       = useState(false);

  const [balance, setBalance]     = useState("10000");
  const [currency, setCurrency]   = useState<CalcCurrency>("GBP");
  const [riskPct, setRiskPct]     = useState(1);
  const [assetStr, setAssetStr]   = useState("EUR/USD");
  const [entryStr, setEntryStr]   = useState("");
  const [slStr, setSlStr]         = useState("");
  const [tp1Str, setTp1Str]       = useState("");
  const [assetType, setAssetType] = useState<CalcAssetType>("forex");

  useEffect(() => {
    const id = localStorage.getItem("ciq_client_id");
    const b  = localStorage.getItem("ciq_calc_balance");
    const c  = localStorage.getItem("ciq_calc_currency");
    if (b) setBalance(b);
    if (c) setCurrency(c as CalcCurrency);
    if (id) {
      setClientId(id);
      fetch(`/api/user/plan?client_id=${id}`)
        .then((r) => r.json())
        .then((d) => { if (d.plan === "pro") setIsPro(true); })
        .catch(() => {});
    }
  }, []);

  useEffect(() => { localStorage.setItem("ciq_calc_balance", balance); }, [balance]);
  useEffect(() => { localStorage.setItem("ciq_calc_currency", currency); }, [currency]);
  useEffect(() => { setAssetType(detectCalcAsset(assetStr)); }, [assetStr]);

  const sym        = CURRENCY_SYMBOLS[currency];
  const balVal     = parseNum(balance);
  const riskAmount = balVal * riskPct / 100;
  const entryVal   = parseNum(entryStr);
  const slVal      = parseNum(slStr);
  const tp1Val     = parseNum(tp1Str);
  const calc       = (balVal > 0 && entryVal > 0 && slVal > 0 && tp1Val > 0)
    ? doCalc(assetType, riskAmount, entryVal, slVal, tp1Val, assetStr)
    : null;

  const slDist   = Math.abs(entryVal - slVal);
  const tp1Dist  = Math.abs(tp1Val - entryVal);
  const totalD   = slDist + tp1Dist;
  const slBarPct = totalD > 0 ? (slDist / totalD) * 100 : 50;
  const tpBarPct = 100 - slBarPct;

  const inputBase = "w-full px-3 py-2.5 rounded-xl font-dm-mono text-sm text-white focus:outline-none transition-colors";

  function upgradeFn() {
    if (!clientId) return;
    fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) })
      .then((r) => r.json()).then((d) => { if (d.url) window.location.href = d.url; });
  }

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 nav-glass">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#00e676] flex items-center justify-center flex-shrink-0">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="#080a10" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-bold text-[17px] text-white">ChartIQ <span className="text-[#f5c518]">AI</span></span>
          </a>
          <span className="text-[#4b5563] text-sm hidden md:inline">/ Position Calculator</span>
          <div className="ml-auto hidden md:flex items-center gap-5">
            {[["Watchlist", "/watchlist"], ["Calendar", "/calendar"], ["Journal", "/journal"]].map(([l, h]) => (
              <a key={l} href={h} className="text-sm text-[#6b7280] hover:text-white transition-colors">{l}</a>
            ))}
            <a href="/#analyze" className="btn-purple px-4 py-2 text-sm">Analyze Chart</a>
          </div>
        </div>
      </nav>

      <main className="pt-28 pb-20 px-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-10">
            <p className="font-dm-mono text-[10px] uppercase tracking-[0.2em] text-[#00e676] mb-2">Position Sizing</p>
            <h1 className="font-bebas text-[52px] leading-none tracking-[0.04em] text-white mb-3">
              POSITION CALCULATOR
            </h1>
            <p className="text-[#6b7280] text-sm leading-relaxed max-w-md">
              Plan any trade before you open it. Enter your account size, risk tolerance,
              and price levels to get exact position sizing.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="p-6 rounded-2xl"
            style={{ background: "#0d1310", border: "1px solid rgba(0,230,118,0.14)" }}
          >
            {/* Asset + type selector */}
            <div className="flex flex-wrap items-end gap-3 mb-5">
              <div className="flex-1 min-w-[160px]">
                <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#6b7280] font-semibold mb-1.5">Asset / Symbol</p>
                <input type="text" value={assetStr} onChange={(e) => setAssetStr(e.target.value)}
                  placeholder="EUR/USD, BTC/USD, AAPL…"
                  className={`${inputBase} focus:border-[#00e676]/60`}
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(["forex", "crypto", "stocks", "gold"] as const).map((t) => (
                  <button key={t} onClick={() => setAssetType(t)}
                    className="font-dm-mono text-[10px] uppercase px-2.5 py-2.5 rounded-lg border transition-all"
                    style={assetType === t
                      ? { background: "#00e676", color: "#080a10", borderColor: "#00e676", fontWeight: 700 }
                      : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)", color: "#6b7280" }}>
                    {t === "gold" ? "XAU" : t}
                  </button>
                ))}
              </div>
            </div>

            {/* Account + risk */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="col-span-2">
                <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#6b7280] font-semibold mb-1.5">Account Balance</p>
                <div className="flex gap-2">
                  <select value={currency} onChange={(e) => setCurrency(e.target.value as CalcCurrency)}
                    className="px-2.5 py-2.5 rounded-xl font-dm-mono text-xs font-bold text-[#00e676] focus:outline-none cursor-pointer"
                    style={{ background: "rgba(0,230,118,0.08)", border: "1px solid rgba(0,230,118,0.2)" }}>
                    {(["GBP", "USD", "EUR"] as const).map((c) => (
                      <option key={c} value={c}>{CURRENCY_SYMBOLS[c]} {c}</option>
                    ))}
                  </select>
                  <input type="number" value={balance} onChange={(e) => setBalance(e.target.value)}
                    placeholder="10000"
                    className={`${inputBase} flex-1 focus:border-[#00e676]/60`}
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
                </div>
              </div>

              <div className="col-span-2">
                <div className="flex justify-between items-center mb-1.5">
                  <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#6b7280] font-semibold">Risk %</p>
                  <span className="font-dm-mono text-[11px] font-bold text-[#00e676]">{riskPct}% = {sym}{riskAmount.toFixed(0)} at risk</span>
                </div>
                <input type="range" min="0.5" max="5" step="0.5" value={riskPct}
                  onChange={(e) => setRiskPct(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: "#00e676" }} />
                <div className="flex justify-between font-dm-mono text-[9px] text-[#4b5563] mt-1">
                  {["0.5%","1%","2%","3%","4%","5%"].map((v) => <span key={v}>{v}</span>)}
                </div>
              </div>

              <div>
                <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#6b7280] font-semibold mb-1.5">Entry Price</p>
                <input type="text" value={entryStr} onChange={(e) => setEntryStr(e.target.value)}
                  placeholder="1.08450"
                  className={`${inputBase} focus:border-[#00e676]/60`}
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
              </div>

              <div>
                <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#f87171] font-semibold mb-1.5">Stop Loss</p>
                <input type="text" value={slStr} onChange={(e) => setSlStr(e.target.value)}
                  placeholder="1.08100"
                  className={`${inputBase} focus:border-[#f87171]/60`}
                  style={{ background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.14)" }} />
              </div>

              <div className="col-span-2">
                <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#4ade80] font-semibold mb-1.5">Take Profit</p>
                <input type="text" value={tp1Str} onChange={(e) => setTp1Str(e.target.value)}
                  placeholder="1.09150"
                  className={`${inputBase} focus:border-[#4ade80]/60`}
                  style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.14)" }} />
              </div>
            </div>

            {/* Results */}
            {calc ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl p-5 text-center"
                    style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)" }}>
                    <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#f87171] font-semibold mb-2">Max Loss</p>
                    <p className="font-dm-mono text-[32px] font-bold text-[#f87171] leading-none">{sym}{riskAmount.toFixed(2)}</p>
                    <p className="font-dm-mono text-[10px] text-[#4b5563] mt-1.5">{riskPct}% of balance</p>
                  </div>
                  <div className="rounded-2xl p-5 text-center"
                    style={{ background: "rgba(0,230,118,0.06)", border: "1px solid rgba(0,230,118,0.15)" }}>
                    <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#00e676] font-semibold mb-2">Potential Profit</p>
                    <p className="font-dm-mono text-[32px] font-bold text-[#00e676] leading-none">{sym}{calc.profit1.toFixed(2)}</p>
                    <p className="font-dm-mono text-[10px] text-[#4b5563] mt-1.5">RR 1:{calc.rr1.toFixed(2)}</p>
                  </div>
                </div>

                <div className={`grid gap-3 ${assetType === "forex" ? "grid-cols-3" : "grid-cols-2"}`}>
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] mb-1">Position Size</p>
                    <p className="font-dm-mono text-sm font-bold text-white">{calc.sizeLabel}</p>
                  </div>
                  {assetType === "forex" && calc.slPips !== undefined && (
                    <div className="rounded-xl p-3 text-center"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] mb-1">SL Pips</p>
                      <p className="font-dm-mono text-sm font-bold text-white">{calc.slPips.toFixed(0)}</p>
                    </div>
                  )}
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] mb-1">Margin Est.</p>
                    <p className="font-dm-mono text-sm font-bold text-white">{sym}{calc.marginRequired.toFixed(0)}</p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-dm-mono text-[10px] mb-1.5">
                    <span className="text-[#f87171]">Risk {slBarPct.toFixed(0)}%</span>
                    <span className="text-[#6b7280]">Risk vs Reward</span>
                    <span className="text-[#00e676]">Reward {tpBarPct.toFixed(0)}%</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden flex">
                    <div className="h-full" style={{ width: `${slBarPct}%`, background: "linear-gradient(90deg, #dc2626, #f87171)" }} />
                    <div className="h-full" style={{ width: `${tpBarPct}%`, background: "linear-gradient(90deg, #4ade80, #00e676)" }} />
                  </div>
                </div>

                {isPro ? (
                  <WhatIfScenarios balance={balVal} sym={sym} asset={assetStr} assetType={assetType}
                    entryVal={entryVal} slVal={slVal} tp1Val={tp1Val} />
                ) : (
                  <div className="relative rounded-xl overflow-hidden"
                    style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-4"
                      style={{ backdropFilter: "blur(6px)", background: "rgba(8,10,16,0.75)" }}>
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="mb-2">
                        <rect x="2.5" y="9.5" width="17" height="11" rx="2.5" stroke="#00e676" strokeWidth="1.3"/>
                        <path d="M7 9.5V7a4 4 0 018 0v2.5" stroke="#00e676" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                      <p className="text-white text-xs font-bold mb-1">Pro Feature</p>
                      <p className="text-[#6b7280] text-[11px] mb-3">Upgrade to unlock What If scenarios</p>
                      <button onClick={upgradeFn}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:-translate-y-0.5"
                        style={{ background: "#00e676", color: "#080a10" }}>
                        Upgrade to Pro
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3 p-4 pointer-events-none select-none" style={{ filter: "blur(4px)" }}>
                      {["Conservative","Standard","Aggressive"].map((s) => (
                        <div key={s} className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.025)" }}>
                          <p className="font-dm-mono text-[9px] text-[#6b7280] mb-1">{s}</p>
                          <p className="font-dm-mono text-sm font-bold text-white">0.12 lots</p>
                          <p className="font-dm-mono text-xs text-[#00e676]">+{sym}480</p>
                          <p className="font-dm-mono text-xs text-[#f87171]">-{sym}100</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/[0.07] p-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <rect x="1" y="1" width="20" height="20" rx="4" stroke="#374151" strokeWidth="1.3"/>
                    <path d="M6 8h10M6 11h10M6 14h6" stroke="#374151" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="font-dm-mono text-[#4b5563] text-xs">Fill in entry, stop loss and take profit to calculate position size</p>
              </div>
            )}
          </motion.div>

          <p className="font-dm-mono text-[10px] text-center text-[#4b5563] mt-6">
            Margin estimates are approximate. Always verify with your broker. · <a href="/#analyze" className="hover:text-[#6b7280] transition-colors">Analyze a chart →</a>
          </p>
        </div>
      </main>
    </div>
  );
}
