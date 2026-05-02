"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import AppNav from "@/app/components/AppNav";
import { detectFutures, getFuturesSymbol, type FuturesSpec } from "@/app/lib/futures-specs";
import { useUserPlan } from "@/app/lib/plan-context";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

type CalcAssetType = "forex" | "crypto" | "stocks" | "gold" | "futures";
type CalcCurrency  = "GBP" | "USD" | "EUR";
const CURRENCY_SYMBOLS: Record<CalcCurrency, string> = { GBP: "£", USD: "$", EUR: "€" };

function detectCalcAsset(asset: string): CalcAssetType {
  const up = (asset ?? "").toUpperCase().replace(/\s/g, "");
  if (detectFutures(asset)) return "futures";
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

type CalcResult = {
  sizeLabel: string;
  profit1: number;
  rr1: number;
  marginRequired: number;
  slPips?: number;
  // futures-specific
  contracts?: number;
  rawContracts?: number;
  dollarRiskPerContract?: number;
  pointsAtRisk?: number;
  ticksAtRisk?: number;
  spec?: FuturesSpec;
  microContracts?: number;
  microDollarRisk?: number;
};

function doCalc(
  type: CalcAssetType, riskAmt: number, entry: number, sl: number, tp: number, asset: string
): CalcResult | null {
  const slDist = Math.abs(entry - sl);
  const tpDist = Math.abs(tp - entry);
  if (slDist === 0 || entry === 0) return null;
  const rr1 = tpDist / slDist;

  if (type === "futures") {
    const spec = detectFutures(asset);
    if (!spec) return null;
    const pointsAtRisk = slDist;
    const ticksAtRisk  = pointsAtRisk / spec.tickSize;
    const dollarRiskPerContract = ticksAtRisk * spec.tickValue;
    const rawContracts = riskAmt / dollarRiskPerContract;
    const contracts    = Math.floor(rawContracts);
    const profitDollars = contracts > 0
      ? (tpDist / spec.tickSize) * spec.tickValue * contracts
      : 0;
    // Micro alternative
    let microContracts: number | undefined;
    let microDollarRisk: number | undefined;
    if (spec.microSymbol) {
      const microSpec = detectFutures(spec.microSymbol);
      if (microSpec) {
        const microTicksAtRisk = pointsAtRisk / microSpec.tickSize;
        const microRiskPerContract = microTicksAtRisk * microSpec.tickValue;
        microContracts = Math.floor(riskAmt / microRiskPerContract);
        microDollarRisk = microRiskPerContract;
      }
    }
    return {
      sizeLabel: `${contracts} contract${contracts !== 1 ? "s" : ""}`,
      profit1: profitDollars,
      rr1,
      marginRequired: contracts * spec.margin,
      contracts,
      rawContracts,
      dollarRiskPerContract,
      pointsAtRisk,
      ticksAtRisk,
      spec,
      microContracts,
      microDollarRisk,
    };
  }

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
  // gold / commodities
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
          { label: "Aggressive",   riskPct: 2,   color: "#9ca3af" },
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

function FuturesContractInfo({ spec, symbol }: { spec: FuturesSpec; symbol: string }) {
  return (
    <div className="rounded-xl p-4 mb-4"
      style={{ background: "rgba(0,230,118,0.04)", border: "1px solid rgba(0,230,118,0.15)" }}>
      <p className="font-dm-mono text-[9px] uppercase tracking-[0.15em] text-[#00e676] font-bold mb-2">
        Detected: {spec.name} ({symbol})
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        {[
          { label: "Exchange",    value: spec.exchange },
          { label: "Tick size",   value: `${spec.tickSize} points` },
          { label: "Tick value",  value: `$${spec.tickValue.toFixed(2)}` },
          { label: "Point value", value: `$${spec.pointValue.toFixed(0)}` },
          { label: "Typical margin", value: `$${spec.margin.toLocaleString()}` },
          { label: "Best session",   value: spec.bestSession },
        ].map((r) => (
          <div key={r.label} className="flex justify-between items-center">
            <span className="font-dm-mono text-[10px] text-[#6b7280]">{r.label}</span>
            <span className="font-dm-mono text-[10px] font-bold text-white">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CalculatorPage() {
  const { isElite } = useUserPlan();
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

  // Tick calculator
  const [tickEntry, setTickEntry] = useState("");
  const [tickStop,  setTickStop]  = useState("");

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

  const futuresSpec   = assetType === "futures" ? detectFutures(assetStr) : null;
  const futuresSymbol = assetType === "futures" ? getFuturesSymbol(assetStr) : "";

  const slDist   = Math.abs(entryVal - slVal);
  const tp1Dist  = Math.abs(tp1Val - entryVal);
  const totalD   = slDist + tp1Dist;
  const slBarPct = totalD > 0 ? (slDist / totalD) * 100 : 50;
  const tpBarPct = 100 - slBarPct;

  // Tick calculator values
  const tickEntryVal = parseNum(tickEntry);
  const tickStopVal  = parseNum(tickStop);
  const tickSpec     = futuresSpec;
  const tickPoints   = tickSpec && tickEntryVal && tickStopVal ? Math.abs(tickEntryVal - tickStopVal) : null;
  const tickTicks    = tickPoints && tickSpec ? tickPoints / tickSpec.tickSize : null;
  const tickDollar   = tickTicks && tickSpec ? tickTicks * tickSpec.tickValue : null;

  const inputBase = "w-full px-3 py-2.5 rounded-xl font-dm-mono text-sm text-white focus:outline-none transition-colors";

  function upgradeFn() {
    if (!clientId) return;
    fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) })
      .then((r) => r.json()).then((d) => { if (d.url) window.location.href = d.url; });
  }

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <AppNav />

      <main className="pt-28 pb-20 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-10">
            <p className="font-dm-mono text-[10px] uppercase tracking-[0.2em] text-[#00e676] mb-2">Position Sizing</p>
            <h1 className="font-bebas text-[52px] leading-none tracking-[0.04em] text-white mb-3">
              POSITION CALCULATOR
            </h1>
            <p className="text-[#6b7280] text-sm leading-relaxed max-w-md">
              Plan any trade before you open it. Supports forex, crypto, stocks, commodities, and futures contracts.
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
                  placeholder="EUR/USD, BTC/USD, NQ, ES, GC…"
                  className={`${inputBase} focus:border-[#00e676]/60`}
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(["forex", "crypto", "stocks", "gold", "futures"] as const).map((t) => (
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

            {/* Futures contract info */}
            {assetType === "futures" && futuresSpec && (
              <FuturesContractInfo spec={futuresSpec} symbol={futuresSymbol} />
            )}

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
                  placeholder={assetType === "futures" ? "19818.00" : "1.08450"}
                  className={`${inputBase} focus:border-[#00e676]/60`}
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
              </div>

              <div>
                <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#f87171] font-semibold mb-1.5">Stop Loss</p>
                <input type="text" value={slStr} onChange={(e) => setSlStr(e.target.value)}
                  placeholder={assetType === "futures" ? "19760.00" : "1.08100"}
                  className={`${inputBase} focus:border-[#f87171]/60`}
                  style={{ background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.14)" }} />
              </div>

              <div className="col-span-2">
                <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#4ade80] font-semibold mb-1.5">Take Profit</p>
                <input type="text" value={tp1Str} onChange={(e) => setTp1Str(e.target.value)}
                  placeholder={assetType === "futures" ? "19934.00" : "1.09150"}
                  className={`${inputBase} focus:border-[#4ade80]/60`}
                  style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.14)" }} />
              </div>
            </div>

            {/* Results */}
            {calc ? (
              <div className="space-y-4">
                {/* Main P&L cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl p-5 text-center"
                    style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)" }}>
                    <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#f87171] font-semibold mb-2">Max Loss</p>
                    <p className="font-dm-mono text-[32px] font-bold text-[#f87171] leading-none">{sym}{riskAmount.toFixed(0)}</p>
                    <p className="font-dm-mono text-[10px] text-[#4b5563] mt-1.5">{riskPct}% of balance</p>
                  </div>
                  <div className="rounded-2xl p-5 text-center"
                    style={{ background: "rgba(0,230,118,0.06)", border: "1px solid rgba(0,230,118,0.15)" }}>
                    <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#00e676] font-semibold mb-2">Potential Profit</p>
                    <p className="font-dm-mono text-[32px] font-bold text-[#00e676] leading-none">{sym}{calc.profit1.toFixed(0)}</p>
                    <p className="font-dm-mono text-[10px] text-[#4b5563] mt-1.5">RR 1:{calc.rr1.toFixed(2)}</p>
                  </div>
                </div>

                {/* Futures-specific breakdown */}
                {assetType === "futures" && calc.spec && (
                  <div className="space-y-3">
                    {/* Contracts breakdown */}
                    <div className="rounded-xl p-4"
                      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] mb-3">Contract Breakdown</p>
                      <div className="space-y-2">
                        {[
                          { label: "Points at risk",            value: `${calc.pointsAtRisk?.toFixed(2)} pts` },
                          { label: "Ticks at risk",             value: `${calc.ticksAtRisk?.toFixed(0)} ticks` },
                          { label: "Dollar risk / contract",    value: `$${calc.dollarRiskPerContract?.toFixed(2)}` },
                          { label: "Contracts",                 value: `${calc.contracts} ${futuresSymbol}`, highlight: true },
                          { label: "Margin required",           value: `$${calc.marginRequired.toLocaleString()}` },
                          { label: "Account used in margin",    value: `${((calc.marginRequired / balVal) * 100).toFixed(1)}%`,
                            warn: (calc.marginRequired / balVal) > 0.5 },
                          { label: "Dollar profit at TP",       value: `$${((tp1Dist / (calc.spec?.tickSize ?? 1)) * (calc.spec?.tickValue ?? 1) * (calc.contracts ?? 0)).toFixed(0)}` },
                        ].map((r) => (
                          <div key={r.label} className="flex justify-between items-center">
                            <span className="font-dm-mono text-[10px] text-[#6b7280]">{r.label}</span>
                            <span className={`font-dm-mono text-[10px] font-bold ${r.highlight ? "text-[#00e676]" : r.warn ? "text-[#fbbf24]" : "text-white"}`}>
                              {r.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Warning: 0 contracts */}
                    {(calc.contracts ?? 0) === 0 && (
                      <div className="rounded-xl p-3"
                        style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.22)" }}>
                        <p className="font-dm-mono text-[10px] text-[#fbbf24] font-bold mb-1">Minimum 1 contract</p>
                        <p className="font-dm-mono text-[10px] text-[#6b7280]">
                          1 {futuresSymbol} risks ${calc.dollarRiskPerContract?.toFixed(0)} ({((calc.dollarRiskPerContract ?? 0) / balVal * 100).toFixed(1)}% of account) — reduce stop distance or increase account size
                        </p>
                      </div>
                    )}

                    {/* Margin warning */}
                    {(calc.contracts ?? 0) > 0 && calc.marginRequired / balVal > 0.5 && (
                      <div className="rounded-xl p-3"
                        style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.22)" }}>
                        <p className="font-dm-mono text-[10px] text-[#fbbf24]">
                          Margin exceeds 50% of account — consider reducing contracts
                        </p>
                      </div>
                    )}

                    {/* Micro alternative */}
                    {calc.spec.microSymbol && calc.microDollarRisk && (
                      <div className="rounded-xl p-4"
                        style={{ background: "rgba(0,230,118,0.03)", border: "1px solid rgba(0,230,118,0.12)" }}>
                        <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#00e676] mb-2">
                          Micro Alternative — {calc.spec.microSymbol}
                        </p>
                        <div className="space-y-1.5">
                          <div className="flex justify-between">
                            <span className="font-dm-mono text-[10px] text-[#6b7280]">Risk per micro contract</span>
                            <span className="font-dm-mono text-[10px] text-white font-bold">${calc.microDollarRisk.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-dm-mono text-[10px] text-[#6b7280]">Recommended contracts</span>
                            <span className="font-dm-mono text-[10px] text-[#00e676] font-bold">{calc.microContracts} {calc.spec.microSymbol}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-dm-mono text-[10px] text-[#6b7280]">Total risk</span>
                            <span className="font-dm-mono text-[10px] text-white font-bold">
                              ${((calc.microContracts ?? 0) * calc.microDollarRisk).toFixed(0)} ({(((calc.microContracts ?? 0) * calc.microDollarRisk) / balVal * 100).toFixed(2)}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Non-futures size + SL pips */}
                {assetType !== "futures" && (
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
                )}

                {/* Risk/reward bar */}
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

          {/* Tick Calculator — shown when futures selected */}
          {assetType === "futures" && futuresSpec && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="mt-6 p-6 rounded-2xl"
              style={{ background: "#0d1310", border: "1px solid rgba(0,230,118,0.1)" }}>
              <p className="font-dm-mono text-[10px] uppercase tracking-[0.18em] text-[#00e676] font-bold mb-4">Tick Calculator</p>
              <p className="text-[#6b7280] text-xs mb-4">How many ticks is my stop?</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#6b7280] font-semibold mb-1.5">Entry</p>
                  <input type="text" value={tickEntry} onChange={(e) => setTickEntry(e.target.value)}
                    placeholder="19818.00"
                    className={`${inputBase} focus:border-[#00e676]/60`}
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
                </div>
                <div>
                  <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#f87171] font-semibold mb-1.5">Stop</p>
                  <input type="text" value={tickStop} onChange={(e) => setTickStop(e.target.value)}
                    placeholder="19760.00"
                    className={`${inputBase} focus:border-[#f87171]/60`}
                    style={{ background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.14)" }} />
                </div>
              </div>
              {tickPoints !== null && tickTicks !== null && tickDollar !== null ? (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Points", value: tickPoints.toFixed(2) },
                    { label: "Ticks",  value: tickTicks.toFixed(0) },
                    { label: "$/contract", value: `$${tickDollar.toFixed(2)}` },
                  ].map((r) => (
                    <div key={r.label} className="rounded-xl p-3 text-center"
                      style={{ background: "rgba(0,230,118,0.05)", border: "1px solid rgba(0,230,118,0.12)" }}>
                      <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] mb-1">{r.label}</p>
                      <p className="font-dm-mono text-sm font-bold text-[#00e676]">{r.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-dm-mono text-[#4b5563] text-xs text-center">Enter entry and stop prices above</p>
              )}
            </motion.div>
          )}

          <p className="font-dm-mono text-[10px] text-center text-[#4b5563] mt-6">
            Margin estimates are approximate. Always verify with your broker. ·{" "}
            <a href="/#analyze" className="hover:text-[#6b7280] transition-colors">Analyze a chart →</a>
          </p>

          {/* ── Risk of Ruin ── */}
          <RiskOfRuin isElite={isElite} currency={currency} clientId={clientId} />

        </div>
      </main>
    </div>
  );
}

// ── Monte Carlo math ────────────────────────────────────────────

interface SimResult {
  paths: number[][];
  ror: number;
  dd25: number;
  dd50: number;
  expectedGrowth: number;
  maxExpectedDD: number;
  recommendedRisk: number;
}

function simulate(winRate: number, rr: number, riskPct: number, numTrades: number): SimResult {
  const NUM_SIMS = 80;
  const win  = winRate / 100;
  const gain = (riskPct / 100) * rr;
  const loss = riskPct / 100;

  const paths: number[][] = [];
  let ruinCount = 0, dd25Count = 0, dd50Count = 0;
  const finalValues: number[] = [];
  const maxDDs: number[] = [];

  for (let s = 0; s < NUM_SIMS; s++) {
    const path = [1.0];
    let peak = 1.0, maxDD = 0;

    for (let t = 0; t < numTrades; t++) {
      const prev = path[path.length - 1];
      if (prev <= 0.001) { path.push(0); continue; }
      const nv = Math.random() < win ? prev * (1 + gain) : prev * (1 - loss);
      path.push(Math.max(0, nv));
      if (path[path.length - 1] > peak) peak = path[path.length - 1];
      const dd = (peak - path[path.length - 1]) / peak;
      if (dd > maxDD) maxDD = dd;
    }

    const final = path[path.length - 1];
    const minV  = Math.min(...path);
    if (final <= 0.05) ruinCount++;
    if (minV <= 0.75) dd25Count++;
    if (minV <= 0.50) dd50Count++;
    finalValues.push(final);
    maxDDs.push(maxDD);
    paths.push(path);
  }

  finalValues.sort((a, b) => a - b);
  maxDDs.sort((a, b) => a - b);
  const medianFinal = finalValues[Math.floor(NUM_SIMS / 2)];
  const medianMaxDD = maxDDs[Math.floor(NUM_SIMS / 2)];

  // Recommended risk: halve until ROR < 5%, cap at 2%
  let recRisk = riskPct;
  for (let i = 0; i < 8 && recRisk > 0.25; i++) {
    const testGain = (recRisk / 100) * rr;
    const testLoss = recRisk / 100;
    let testRuin = 0;
    for (let s = 0; s < 40; s++) {
      let eq = 1;
      for (let t = 0; t < numTrades; t++) eq = Math.random() < win ? eq * (1 + testGain) : eq * (1 - testLoss);
      if (eq <= 0.05) testRuin++;
    }
    if ((testRuin / 40) * 100 < 5) break;
    recRisk = Math.max(0.25, recRisk * 0.7);
  }

  return {
    paths,
    ror: (ruinCount / NUM_SIMS) * 100,
    dd25: (dd25Count / NUM_SIMS) * 100,
    dd50: (dd50Count / NUM_SIMS) * 100,
    expectedGrowth: (medianFinal - 1) * 100,
    maxExpectedDD: medianMaxDD * 100,
    recommendedRisk: Math.round(recRisk * 4) / 4, // round to nearest 0.25
  };
}

// ── Risk of Ruin component ──────────────────────────────────────

function RiskOfRuin({ isElite, currency, clientId }: { isElite: boolean; currency: string; clientId: string | null }) {
  const sym = { GBP: "£", USD: "$", EUR: "€" }[currency] ?? "$";

  const [winRate, setWinRate]   = useState(55);
  const [rr, setRr]             = useState(1.5);
  const [riskPct, setRiskPct]   = useState(1);
  const [capital, setCapital]   = useState("10000");
  const [numTrades, setNumTrades] = useState(200);
  const [aiRec, setAiRec]       = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const result = useMemo(
    () => simulate(winRate, rr, riskPct, numTrades),
    [winRate, rr, riskPct, numTrades]
  );

  // Build chart data (sample every 5 trades, 20 paths max)
  const chartData = useMemo(() => {
    const STEP = Math.max(1, Math.floor(numTrades / 40));
    const pathsToShow = result.paths.slice(0, 20);
    const medianPath = [...result.paths]
      .sort((a, b) => (a[a.length - 1] ?? 0) - (b[b.length - 1] ?? 0))
      [Math.floor(result.paths.length / 2)] ?? [];

    const points = [];
    for (let t = 0; t <= numTrades; t += STEP) {
      const point: Record<string, number> = { trade: t };
      pathsToShow.forEach((p, i) => { point[`s${i}`] = Math.round((p[t] ?? p[p.length - 1]) * 1000) / 1000; });
      point.median = Math.round((medianPath[t] ?? medianPath[medianPath.length - 1]) * 1000) / 1000;
      points.push(point);
    }
    return { points, pathsToShow, medianPath };
  }, [result, numTrades]);

  const rorColor = result.ror <= 10 ? "#4ade80" : result.ror <= 25 ? "#fbbf24" : result.ror <= 50 ? "#f87171" : "#dc2626";
  const rorLabel = result.ror <= 10 ? "LOW RISK" : result.ror <= 25 ? "MODERATE RISK" : result.ror <= 50 ? "HIGH RISK" : "CRITICAL";

  async function getAiRec() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/risk-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winRate, rr, riskPct, capital: `${sym}${capital}` }),
      });
      const data = await res.json();
      setAiRec(data.recommendation ?? null);
    } catch { /* ignore */ }
    finally { setAiLoading(false); }
  }

  const inputBase = "w-full px-3 py-2.5 rounded-xl font-dm-mono text-sm text-white focus:outline-none transition-colors";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="mt-8 rounded-2xl overflow-hidden"
      style={{ border: "1px solid rgba(251,191,36,0.2)" }}
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-4"
        style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.06), rgba(8,10,16,0))" }}>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-bebas text-[28px] tracking-[0.06em] text-white">RISK OF RUIN ANALYSIS</h2>
          <span className="px-2 py-0.5 rounded-full font-dm-mono text-[9px] font-bold tracking-widest"
            style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" }}>
            ELITE
          </span>
        </div>
        <p className="text-[#6b7280] text-xs leading-relaxed">
          Mathematical probability of blowing your account based on your trading statistics
        </p>
      </div>

      {/* Content — blurred for non-Elite */}
      <div className="relative">
        {!isElite && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-6"
            style={{ backdropFilter: "blur(8px)", background: "rgba(8,10,16,0.8)" }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="mb-3">
              <rect x="3" y="12" width="22" height="14" rx="3" stroke="#fbbf24" strokeWidth="1.4"/>
              <path d="M9 12V9a5 5 0 0110 0v3" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <p className="font-bebas text-2xl tracking-[0.06em] text-white mb-1">ELITE FEATURE</p>
            <p className="text-[#6b7280] text-xs mb-4">Risk of Ruin analysis requires an Elite plan</p>
            <a href="/pricing"
              className="px-5 py-2.5 rounded-xl font-dm-mono text-xs font-bold transition-all hover:-translate-y-0.5"
              style={{ background: "#fbbf24", color: "#080a10" }}>
              Upgrade to Elite — £39/mo
            </a>
          </div>
        )}

        <div className={`px-6 pb-6 space-y-6 ${!isElite ? "pointer-events-none select-none" : ""}`}
          style={!isElite ? { filter: "blur(4px)" } : {}}>

          {/* Inputs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            <div>
              <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#6b7280] font-semibold mb-1.5">Win Rate %</p>
              <div className="flex items-center gap-2">
                <input type="range" min={10} max={90} step={1} value={winRate}
                  onChange={(e) => setWinRate(+e.target.value)}
                  className="flex-1 h-2 rounded-full appearance-none cursor-pointer" style={{ accentColor: "#fbbf24" }} />
                <span className="font-dm-mono text-sm font-bold text-white w-10 text-right">{winRate}%</span>
              </div>
            </div>
            <div>
              <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#6b7280] font-semibold mb-1.5">Avg R:R</p>
              <div className="flex items-center gap-2">
                <input type="range" min={0.5} max={5} step={0.1} value={rr}
                  onChange={(e) => setRr(+e.target.value)}
                  className="flex-1 h-2 rounded-full appearance-none cursor-pointer" style={{ accentColor: "#fbbf24" }} />
                <span className="font-dm-mono text-sm font-bold text-white w-10 text-right">1:{rr.toFixed(1)}</span>
              </div>
            </div>
            <div>
              <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#6b7280] font-semibold mb-1.5">Risk / Trade %</p>
              <div className="flex items-center gap-2">
                <input type="range" min={0.25} max={5} step={0.25} value={riskPct}
                  onChange={(e) => setRiskPct(+e.target.value)}
                  className="flex-1 h-2 rounded-full appearance-none cursor-pointer" style={{ accentColor: "#fbbf24" }} />
                <span className="font-dm-mono text-sm font-bold text-white w-10 text-right">{riskPct}%</span>
              </div>
            </div>
            <div>
              <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#6b7280] font-semibold mb-1.5">Capital</p>
              <input type="number" value={capital} onChange={(e) => setCapital(e.target.value)}
                className={`${inputBase} focus:border-[#fbbf24]/50`}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
            </div>
            <div>
              <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#6b7280] font-semibold mb-1.5">Trades to simulate</p>
              <div className="flex items-center gap-2">
                <input type="range" min={100} max={1000} step={50} value={numTrades}
                  onChange={(e) => setNumTrades(+e.target.value)}
                  className="flex-1 h-2 rounded-full appearance-none cursor-pointer" style={{ accentColor: "#fbbf24" }} />
                <span className="font-dm-mono text-sm font-bold text-white w-10 text-right">{numTrades}</span>
              </div>
            </div>
          </div>

          {/* Main ROR result */}
          <div className="rounded-2xl p-6 text-center"
            style={{ background: `${rorColor}0d`, border: `1px solid ${rorColor}30` }}>
            <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: rorColor }}>Risk of Ruin</p>
            <p className="font-bebas text-[72px] leading-none mb-1" style={{ color: rorColor }}>{result.ror.toFixed(0)}%</p>
            <p className="font-dm-mono text-sm font-bold tracking-[0.1em]" style={{ color: rorColor }}>{rorLabel}</p>
            <p className="font-dm-mono text-[10px] text-[#4b5563] mt-2">
              Probability of losing 95%+ of account over {numTrades} trades
            </p>
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "25% DD Prob",    val: `${result.dd25.toFixed(0)}%`,            color: "#fbbf24" },
              { label: "50% DD Prob",    val: `${result.dd50.toFixed(0)}%`,            color: "#f87171" },
              { label: "Expected Growth", val: `${result.expectedGrowth >= 0 ? "+" : ""}${result.expectedGrowth.toFixed(0)}%`, color: result.expectedGrowth >= 0 ? "#4ade80" : "#f87171" },
              { label: "Max Exp. DD",    val: `${result.maxExpectedDD.toFixed(0)}%`,   color: "#9ca3af" },
            ].map(({ label, val, color }) => (
              <div key={label} className="rounded-xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] mb-1">{label}</p>
                <p className="font-dm-mono text-lg font-bold" style={{ color }}>{val}</p>
              </div>
            ))}
          </div>

          {/* Monte Carlo chart */}
          <div>
            <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#6b7280] font-semibold mb-3">
              Monte Carlo Simulation (80 paths)
            </p>
            <div className="rounded-2xl p-4"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData.points}>
                  <XAxis dataKey="trade" tick={{ fontFamily: "dm-mono", fontSize: 9, fill: "#4b5563" }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fontFamily: "dm-mono", fontSize: 9, fill: "#4b5563" }} tickLine={false} axisLine={false} domain={[0, "auto"]} width={44} />
                  <Tooltip
                    formatter={(v) => [`${((Number(v) - 1) * 100).toFixed(1)}%`, ""]}
                    labelFormatter={(l) => `Trade ${l}`}
                    contentStyle={{ background: "#0d1310", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "monospace", fontSize: 11 }}
                  />
                  <ReferenceLine y={1} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                  {chartData.pathsToShow.map((p, i) => (
                    <Line key={i} dataKey={`s${i}`} stroke={p[p.length - 1] <= 0.05 ? "#f87171" : "#4ade80"}
                      strokeOpacity={0.18} dot={false} strokeWidth={1} isAnimationActive={false} />
                  ))}
                  <Line dataKey="median" stroke="white" strokeWidth={2} dot={false} isAnimationActive={false} strokeOpacity={0.9} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 justify-center">
                <span className="flex items-center gap-1.5 font-dm-mono text-[9px] text-[#4ade80]"><span className="inline-block w-6 h-0.5 bg-[#4ade80] opacity-60" />Profitable paths</span>
                <span className="flex items-center gap-1.5 font-dm-mono text-[9px] text-[#f87171]"><span className="inline-block w-6 h-0.5 bg-[#f87171] opacity-60" />Blowup paths</span>
                <span className="flex items-center gap-1.5 font-dm-mono text-[9px] text-white"><span className="inline-block w-6 h-0.5 bg-white" />Median outcome</span>
              </div>
            </div>
          </div>

          {/* What-if scenarios */}
          <div>
            <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#6b7280] font-semibold mb-3">What If</p>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                { label: `Increase R:R from 1:${rr.toFixed(1)} to 1:${(rr * 1.4).toFixed(1)}`, newRr: rr * 1.4, newRisk: riskPct },
                { label: `Reduce risk from ${riskPct}% to ${Math.max(0.25, riskPct * 0.5).toFixed(2)}%`, newRr: rr, newRisk: Math.max(0.25, riskPct * 0.5) },
              ].map(({ label, newRr, newRisk }) => {
                const r2 = simulate(winRate, newRr, newRisk, numTrades);
                const improvement = result.ror - r2.ror;
                return (
                  <div key={label} className="rounded-xl p-4"
                    style={{ background: "rgba(0,230,118,0.04)", border: "1px solid rgba(0,230,118,0.12)" }}>
                    <p className="font-dm-mono text-[10px] text-[#9ca3af] mb-2">{label}</p>
                    <p className="font-dm-mono text-sm">
                      <span className="text-white font-bold">ROR drops: </span>
                      <span style={{ color: improvement > 0 ? "#4ade80" : "#f87171" }}>
                        {result.ror.toFixed(0)}% → {r2.ror.toFixed(0)}%
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommended risk */}
          <div className="rounded-xl p-4"
            style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)" }}>
            <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#60a5fa] mb-1">Recommended max risk per trade</p>
            <p className="font-dm-mono text-2xl font-bold text-white">{result.recommendedRisk}%</p>
            <p className="font-dm-mono text-[10px] text-[#6b7280] mt-1">Keeps risk of ruin below 5% with your win rate and R:R</p>
          </div>

          {/* AI recommendations */}
          <div className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#6b7280] font-semibold">
                AI Recommendations
              </p>
              {!aiRec && (
                <button onClick={getAiRec} disabled={aiLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-dm-mono text-[10px] font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                  style={{ background: "rgba(0,230,118,0.1)", border: "1px solid rgba(0,230,118,0.25)", color: "#00e676" }}>
                  {aiLoading ? (
                    <><span className="w-3 h-3 rounded-full border-2 border-[#00e676]/30 border-t-[#00e676] animate-spin" />Analysing…</>
                  ) : "Get AI analysis →"}
                </button>
              )}
            </div>
            {aiRec ? (
              <p className="text-[#d1d5db] text-sm leading-relaxed">{aiRec}</p>
            ) : (
              <p className="font-dm-mono text-[10px] text-[#4b5563]">
                Click above to get personalised recommendations based on your stats
              </p>
            )}
          </div>

        </div>
      </div>
    </motion.div>
  );
}
