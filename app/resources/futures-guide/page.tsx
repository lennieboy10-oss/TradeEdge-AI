"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import AppNav from "@/app/components/AppNav";

const comparisonRows = [
  { field: "Min capital",       futures: "$1,000+ (micro)",  forex: "$100+",           stocks: "$500+",          note: "" },
  { field: "Leverage",          futures: "Up to 20:1",       forex: "Up to 500:1",     stocks: "Up to 4:1",      note: "" },
  { field: "Trading hours",     futures: "~23h/day Mon-Fri", forex: "24/5",            stocks: "6.5h/day",       note: "" },
  { field: "Tax treatment (UK)",futures: "Spread betting",   forex: "Spread betting",  stocks: "CGT applies",    note: "" },
  { field: "Commissions",       futures: "$0.85–$5/contract",forex: "Spread only",     stocks: "$0–$10/trade",   note: "" },
  { field: "Best for",          futures: "Indices, gold, oil",forex: "Currency pairs", stocks: "Long-term holds", note: "" },
];

const microRows = [
  { regular: "NQ",  regularName: "E-mini Nasdaq",   micro: "MNQ", microName: "Micro E-mini Nasdaq",  ratio: "10×", margin: "$1,700",  tickVal: "$0.50" },
  { regular: "ES",  regularName: "E-mini S&P 500",  micro: "MES", microName: "Micro E-mini S&P 500", ratio: "10×", margin: "$1,200",  tickVal: "$1.25" },
  { regular: "GC",  regularName: "Gold Futures",    micro: "MGC", microName: "Micro Gold",           ratio: "10×", margin: "$800",    tickVal: "$1.00" },
  { regular: "CL",  regularName: "Crude Oil",       micro: "MCL", microName: "Micro Crude Oil",      ratio: "10×", margin: "$600",    tickVal: "$1.00" },
];

const rolloverDates = [
  { contract: "ES / NQ / MES / MNQ", months: "Mar, Jun, Sep, Dec", rollDays: "~8 days before expiry", note: "Roll to next quarter" },
  { contract: "GC / MGC",            months: "Feb, Apr, Jun, Aug, Oct, Dec", rollDays: "~5 days before", note: "Active month varies" },
  { contract: "CL / MCL",            months: "Monthly",             rollDays: "~5 days before",         note: "High volume moves to next month" },
  { contract: "ZB / ZN",             months: "Mar, Jun, Sep, Dec",  rollDays: "~8 days before",         note: "Watch for volume shift" },
];

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 mb-6">
      <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#6b7280] mb-5">{label}</p>
      {children}
    </motion.div>
  );
}

function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="flex-shrink-0 mt-0.5">
      <path d="M2 6.5l3 3L11 2.5" stroke="#00e676" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function FuturesGuidePage() {
  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <AppNav />

      <main className="pt-28 pb-24 px-6">
        <div className="max-w-3xl mx-auto">

          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00e676]/30 bg-[#00e676]/10 text-[#00e676] text-xs font-semibold tracking-[0.13em] uppercase mb-5">
              Resources
            </div>
            <h1 className="font-bebas text-5xl md:text-7xl tracking-wider mb-5 leading-none">
              TRADING FUTURES<br />WITH CHARTIQ
            </h1>
            <p className="text-[#9ca3af] text-base max-w-xl mx-auto leading-relaxed">
              Everything you need to know about futures contracts — from contract specs to position sizing,
              session timing, and rollover dates.
            </p>
          </motion.div>

          {/* 1 — What are futures */}
          <Section label="1 · What are futures contracts?">
            <p className="text-[#d1d5db] text-sm leading-relaxed mb-4">
              A futures contract is a legally binding agreement to buy or sell an asset at a predetermined price on a specific date in the future. Unlike stocks, you never actually own the underlying asset — you profit or lose from the price movement.
            </p>
            <div className="space-y-2.5">
              {[
                "Standardised contracts traded on regulated exchanges (CME, CBOT, NYMEX, COMEX)",
                "You control a large amount of exposure with a relatively small margin deposit",
                "Prices move in \"ticks\" — each tick has a fixed dollar value per contract",
                "Contracts expire quarterly (or monthly for commodities) — you must roll or close before expiry",
                "Available for indices (S&P 500, Nasdaq), metals (gold, silver), energy (oil, gas), bonds, and currencies",
              ].map((f) => (
                <div key={f} className="flex items-start gap-2.5 text-sm text-[#9ca3af]">
                  <Check />{f}
                </div>
              ))}
            </div>
          </Section>

          {/* 2 — Comparison table */}
          <Section label="2 · Futures vs Forex vs Stocks">
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-left font-dm-mono text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,230,118,0.15)" }}>
                    {["", "Futures", "Forex", "Stocks"].map((h) => (
                      <th key={h} className="pb-3 pr-5 font-bold tracking-wider"
                        style={{ color: h === "Futures" ? "#00e676" : h === "" ? "#4b5563" : "#9ca3af" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((r, i) => (
                    <tr key={i} className="border-b border-white/[0.04]">
                      <td className="py-2.5 pr-5 text-[#6b7280] font-medium whitespace-nowrap">{r.field}</td>
                      <td className="py-2.5 pr-5 text-white font-semibold whitespace-nowrap">{r.futures}</td>
                      <td className="py-2.5 pr-5 text-[#9ca3af] whitespace-nowrap">{r.forex}</td>
                      <td className="py-2.5 text-[#9ca3af] whitespace-nowrap">{r.stocks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* 3 — Micro contracts */}
          <Section label="3 · Micro futures — best for beginners">
            <div className="rounded-xl p-4 mb-6"
              style={{ background: "rgba(0,230,118,0.05)", border: "1px solid rgba(0,230,118,0.15)" }}>
              <p className="text-sm text-[#d1d5db] leading-relaxed">
                Start with <span className="text-[#00e676] font-bold">MNQ or MES</span> — same markets as the big contracts but exactly 1/10th the size. Same tick structure, same sessions, same analysis — just smaller dollar risk per trade.
              </p>
            </div>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-left font-dm-mono text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["Regular", "Name", "Micro", "Name", "Ratio", "Margin", "Tick $"].map((h) => (
                      <th key={h} className="pb-3 pr-4 font-bold tracking-wider text-[#6b7280]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {microRows.map((r) => (
                    <tr key={r.regular} className="border-b border-white/[0.04]">
                      <td className="py-2.5 pr-4 text-[#9ca3af] font-semibold">{r.regular}</td>
                      <td className="py-2.5 pr-4 text-[#6b7280]">{r.regularName}</td>
                      <td className="py-2.5 pr-4 text-[#00e676] font-semibold">{r.micro}</td>
                      <td className="py-2.5 pr-4 text-[#6b7280]">{r.microName}</td>
                      <td className="py-2.5 pr-4 text-[#9ca3af]">{r.ratio}</td>
                      <td className="py-2.5 pr-4 text-white font-bold">{r.margin}</td>
                      <td className="py-2.5 text-white">{r.tickVal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* 4 — How to read futures prices */}
          <Section label="4 · How to read futures prices">
            <div className="space-y-4">
              <div className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="font-dm-mono text-xs text-[#00e676] mb-2 font-bold">NQ at 19,818.25 means…</p>
                <ul className="space-y-2 text-sm text-[#9ca3af]">
                  <li>• The E-mini Nasdaq 100 futures price is 19,818.25 index points</li>
                  <li>• Each full point move = $20 profit/loss per NQ contract</li>
                  <li>• The minimum move (tick) is 0.25 points = $5.00 per NQ, $0.50 per MNQ</li>
                  <li>• A 58-point stop = 232 ticks = $1,160 per NQ or $116 per MNQ</li>
                </ul>
              </div>
              <div className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="font-dm-mono text-xs text-[#ffd740] mb-2 font-bold">GC (Gold) at 3,312.40 means…</p>
                <ul className="space-y-2 text-sm text-[#9ca3af]">
                  <li>• Gold futures price is $3,312.40 per troy ounce</li>
                  <li>• Each full dollar move = $100 per GC contract (100 oz)</li>
                  <li>• Minimum tick is $0.10 = $10.00 per GC, $1.00 per MGC</li>
                  <li>• A $12 stop = 120 ticks = $1,200 per GC or $120 per MGC</li>
                </ul>
              </div>
            </div>
          </Section>

          {/* 5 — Contract rollover */}
          <Section label="5 · Contract rollover">
            <p className="text-sm text-[#9ca3af] leading-relaxed mb-5">
              Futures expire on a fixed date each quarter (or month for commodities). If you hold a position past expiry, your broker will close it. Roll to the next active contract 5–8 days before expiry when volume shifts.
            </p>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-left font-dm-mono text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["Contract", "Active Months", "Roll Window", "Note"].map((h) => (
                      <th key={h} className="pb-3 pr-5 font-bold tracking-wider text-[#6b7280]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rolloverDates.map((r) => (
                    <tr key={r.contract} className="border-b border-white/[0.04]">
                      <td className="py-2.5 pr-5 text-white font-semibold whitespace-nowrap">{r.contract}</td>
                      <td className="py-2.5 pr-5 text-[#9ca3af] whitespace-nowrap">{r.months}</td>
                      <td className="py-2.5 pr-5 text-[#fbbf24] whitespace-nowrap">{r.rollDays}</td>
                      <td className="py-2.5 text-[#6b7280]">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* 6 — Margin & buying power */}
          <Section label="6 · Margin and buying power">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              {[
                { symbol: "MNQ", name: "Micro Nasdaq", margin: "$1,700", exposure: "~$39,636", leverage: "~23:1", note: "Best for learning" },
                { symbol: "NQ",  name: "E-mini Nasdaq", margin: "$17,000", exposure: "~$396,365", leverage: "~23:1", note: "Professional" },
                { symbol: "MES", name: "Micro S&P 500", margin: "$1,200", exposure: "~$28,240", leverage: "~24:1", note: "Best starter contract" },
                { symbol: "MGC", name: "Micro Gold", margin: "$800", exposure: "~$33,124", leverage: "~41:1", note: "High leverage" },
              ].map((c) => (
                <div key={c.symbol} className="rounded-xl p-4"
                  style={{ background: "rgba(0,230,118,0.03)", border: "1px solid rgba(0,230,118,0.1)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-dm-mono text-sm font-bold text-[#00e676]">{c.symbol}</p>
                    <span className="font-dm-mono text-[9px] px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(0,230,118,0.1)", color: "#00e676" }}>{c.note}</span>
                  </div>
                  <p className="text-xs text-[#6b7280] mb-3">{c.name}</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-dm-mono text-[10px] text-[#4b5563]">Margin required</span>
                      <span className="font-dm-mono text-[10px] text-white font-bold">{c.margin}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-dm-mono text-[10px] text-[#4b5563]">Notional exposure</span>
                      <span className="font-dm-mono text-[10px] text-[#9ca3af]">{c.exposure}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-dm-mono text-[10px] text-[#4b5563]">Effective leverage</span>
                      <span className="font-dm-mono text-[10px] text-[#fbbf24]">{c.leverage}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl p-4"
              style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)" }}>
              <p className="font-dm-mono text-[10px] text-[#fbbf24] font-bold mb-1">Margin warning</p>
              <p className="text-xs text-[#6b7280] leading-relaxed">
                Intraday margin is often much lower than overnight margin. If you hold a futures position past 16:00 EST your broker may require you to post full overnight margin or they will close your position. Always check your broker&apos;s margin schedule.
              </p>
            </div>
          </Section>

          {/* CTA */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="text-center">
            <p className="text-[#6b7280] text-sm mb-6">Ready to calculate your futures position size?</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/calculator"
                className="px-7 py-3.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
                style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 24px rgba(0,230,118,0.3)" }}>
                Open Futures Calculator
              </Link>
              <Link href="/brokers"
                className="px-7 py-3.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
                style={{ background: "rgba(255,255,255,0.05)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.08)" }}>
                View Futures Brokers
              </Link>
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
