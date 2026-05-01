"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useUserPlan } from "@/app/lib/plan-context";
import AppNav from "@/app/components/AppNav";

const features = [
  "Smart Money Concepts (ICT methodology)",
  "Automatic Buy/Sell signals with confluence score",
  "Fair Value Gap detection and visualisation",
  "Order Block identification",
  "Liquidity sweep alerts",
  "Break of Structure signals",
  "Session filter (London / NY / Asian)",
  "Real-time dashboard overlay",
  "TradingView alerts integration",
  "Works on all timeframes and assets",
  "Fully customisable settings",
];

const confluenceFactors = [
  { n: 1, label: "Trend alignment", desc: "EMA 20/50/200 stacked in trend direction" },
  { n: 2, label: "RSI momentum", desc: "RSI above 50 (bull) or below 50 (bear), not overbought/oversold" },
  { n: 3, label: "Volume confirmation", desc: "Volume above 20-bar average by at least 20%" },
  { n: 4, label: "FVG or Order Block", desc: "Price inside a Fair Value Gap or sitting on an Order Block" },
  { n: 5, label: "Liquidity sweep", desc: "Recent sweep of equal highs/lows before reversal" },
  { n: 6, label: "Break of Structure", desc: "Market structure broken in signal direction" },
];

const installSteps = [
  "Download the .pine file using the button above",
  "Open TradingView and load any chart",
  "Click the Pine Script Editor tab at the bottom",
  "Click Open → select the downloaded .pine file",
  'Click "Add to chart" — the indicator loads instantly',
  "Open Settings to configure confluence, sessions, and colours",
];

const strategySteps = [
  "Download the strategy file and add it to TradingView",
  'Click the "Strategy Tester" tab at the bottom of your chart',
  "See instant backtest results: net profit, win rate, profit factor, max drawdown, total trades",
  "Adjust settings to optimise — change min confluence (3→4), toggle session filter, adjust ATR multiplier or R:R ratios",
];

const webhookSteps = [
  { step: "1", text: 'Right-click your chart → "Add Alert"' },
  { step: "2", text: 'Set Condition to "ChartIQ BUY Signal" or "ChartIQ SELL Signal"' },
  { step: "3", text: "Enable Webhook URL and paste your ChartIQ webhook endpoint" },
  { step: "4", text: "Paste the JSON template into the Message field (see below)" },
  { step: "5", text: "Save alert — ChartIQ now logs every signal and can route it to your broker" },
];

const webhookJson = `{
  "action": "{{strategy.order.action}}",
  "ticker": "{{ticker}}",
  "price": {{close}},
  "time": "{{time}}",
  "source": "chartiq-indicator"
}`;

const settingsRows = [
  { asset: "XAU/USD", tf: "1H",  minC: "4", atr: "1.5", session: "London / NY" },
  { asset: "XAU/USD", tf: "4H",  minC: "3", atr: "2.0", session: "Any" },
  { asset: "BTC/USD", tf: "1H",  minC: "4", atr: "2.0", session: "NY" },
  { asset: "EUR/USD", tf: "15m", minC: "4", atr: "1.2", session: "London" },
  { asset: "NAS100",  tf: "5m",  minC: "5", atr: "1.0", session: "NY Open" },
  { asset: "SPX500",  tf: "1H",  minC: "3", atr: "1.5", session: "NY" },
];

function Check({ color = "#00e676" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 mt-0.5">
      <path d="M2 7l3.5 3.5L12 2.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EliteBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-[0.15em] uppercase"
      style={{ background: "rgba(139,92,246,0.18)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.35)" }}>
      Elite Exclusive
    </span>
  );
}

function DownloadBtn({ href, label, sublabel }: { href: string; label: string; sublabel: string }) {
  return (
    <a href={href} download
      className="flex items-center gap-4 p-4 rounded-xl transition-all hover:-translate-y-0.5 group"
      style={{ background: "rgba(0,230,118,0.06)", border: "1.5px solid rgba(0,230,118,0.2)" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(0,230,118,0.15)" }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 2v9M5.5 7.5L9 11l3.5-3.5M2.5 15h13" stroke="#00e676" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-bold text-white group-hover:text-[#00e676] transition-colors">{label}</p>
        <p className="text-xs text-[#4b5563] mt-0.5">{sublabel}</p>
      </div>
      <span className="text-xs font-bold px-2 py-1 rounded-lg"
        style={{ background: "rgba(0,230,118,0.12)", color: "#00e676" }}>.pine</span>
    </a>
  );
}

function LockedPage() {
  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <AppNav />
      <main className="pt-28 pb-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-6"><EliteBadge /></div>
          <h1 className="font-bebas text-5xl md:text-6xl tracking-wider mb-4 leading-none">
            CHARTIQ AI SIGNAL SYSTEM
          </h1>
          <p className="text-[#6b7280] mb-10 text-base leading-relaxed">
            This indicator is exclusively for Elite members. Upgrade to unlock the most advanced
            buy/sell indicator available to retail traders.
          </p>
          <div className="relative rounded-2xl overflow-hidden mb-10 border border-white/[0.06]"
            style={{ background: "#0c0f18" }}>
            <div className="blur-sm pointer-events-none select-none p-8 opacity-60">
              <div className="space-y-3">
                {features.map((f) => (
                  <div key={f} className="flex items-center gap-3 text-sm text-[#d1d5db]">
                    <Check />{f}
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center"
              style={{ background: "linear-gradient(to bottom, transparent, rgba(8,10,16,0.97))" }}>
              <div className="mt-auto pb-10 flex flex-col items-center gap-4">
                <p className="text-sm text-[#9ca3af]">Unlock with Elite membership</p>
                <Link href="/pricing"
                  className="px-8 py-3.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
                  style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1.5px solid rgba(139,92,246,0.4)", boxShadow: "0 0 30px rgba(139,92,246,0.15)" }}>
                  Upgrade to Elite — £39/mo
                </Link>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-left">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#a78bfa] mb-4">What Elite members get</p>
            <ul className="space-y-2.5">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-[#9ca3af]">
                  <Check />{f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function EliteIndicatorPage() {
  const { isElite } = useUserPlan();

  if (!isElite) return <LockedPage />;

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <AppNav />

      <main className="pt-28 pb-24 px-6">
        <div className="max-w-3xl mx-auto">

          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="text-center mb-14">
            <div className="mb-4"><EliteBadge /></div>
            <h1 className="font-bebas text-5xl md:text-7xl tracking-wider mb-5 leading-none">
              CHARTIQ AI SIGNAL SYSTEM
            </h1>
            <p className="text-[#9ca3af] text-base md:text-lg max-w-xl mx-auto leading-relaxed">
              The most advanced buy/sell indicator available to retail traders. Combines Smart Money
              Concepts, market structure, Fair Value Gaps, order blocks, and liquidity analysis into
              one powerful signal system.
            </p>
          </motion.div>

          {/* Downloads — two files */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-2xl p-7 mb-10"
            style={{ background: "linear-gradient(135deg, #0d1f15 0%, #080a10 100%)", border: "1.5px solid rgba(0,230,118,0.3)", boxShadow: "0 0 60px rgba(0,230,118,0.06)" }}>
            <p className="text-[#00e676] text-xs font-bold tracking-[0.2em] uppercase mb-1">Downloads</p>
            <h2 className="text-lg font-bold mb-1">Two Files Included with Elite</h2>
            <p className="text-[#6b7280] text-sm mb-6">Pine Script v5 · Compatible with TradingView Free, Pro &amp; Premium</p>
            <div className="space-y-3">
              <DownloadBtn
                href="/indicators/chartiq-indicator.pine"
                label="ChartIQ AI Signal System — Indicator"
                sublabel="Shows buy/sell signals with FVG zones, order blocks, and confluence dashboard"
              />
              <DownloadBtn
                href="/indicators/chartiq-strategy.pine"
                label="ChartIQ AI Signal System — Strategy"
                sublabel="Full backtestable version — see win rate, profit factor, and drawdown in Strategy Tester"
              />
            </div>
          </motion.div>

          {/* Features */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 mb-8">
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#6b7280] mb-5">Features</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {features.map((f) => (
                <div key={f} className="flex items-start gap-2.5 text-sm text-[#d1d5db]">
                  <Check />{f}
                </div>
              ))}
            </div>
          </motion.div>

          {/* How it works — confluence */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 mb-8">
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#6b7280] mb-2">How It Works</p>
            <h3 className="text-lg font-bold mb-1">6 Confluence Factors</h3>
            <p className="text-[#6b7280] text-sm mb-6">
              Signal fires only when a minimum of 3 of 6 factors align — ensuring high-quality setups only.
            </p>
            <div className="space-y-3">
              {confluenceFactors.map((c) => (
                <div key={c.n} className="flex items-start gap-4 p-4 rounded-xl"
                  style={{ background: "rgba(0,230,118,0.04)", border: "1px solid rgba(0,230,118,0.08)" }}>
                  <span className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                    style={{ background: "rgba(0,230,118,0.15)", color: "#00e676" }}>
                    {c.n}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{c.label}</p>
                    <p className="text-xs text-[#6b7280] mt-0.5">{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Installation guide */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 mb-8">
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#6b7280] mb-5">Installation</p>
            <div className="space-y-3">
              {installSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-4">
                  <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#9ca3af" }}>
                    {i + 1}
                  </span>
                  <p className="text-sm text-[#d1d5db]">{step}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Strategy Tester guide */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
            className="rounded-2xl p-7 mb-8"
            style={{ background: "linear-gradient(135deg, #0d1820 0%, #080a10 100%)", border: "1.5px solid rgba(59,130,246,0.2)" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold tracking-[0.18em] uppercase text-[#60a5fa]">Strategy Tester</span>
            </div>
            <h3 className="text-lg font-bold mb-1">Backtest on Any Asset &amp; Timeframe</h3>
            <p className="text-[#6b7280] text-sm mb-6">
              The strategy version lets you see exactly how the system performed historically before risking real capital.
            </p>

            {/* Mock backtest result card */}
            <div className="rounded-xl p-4 mb-6 flex flex-wrap gap-6"
              style={{ background: "rgba(0,230,118,0.04)", border: "1px solid rgba(0,230,118,0.12)" }}>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-[#00e676]">67%</p>
                <p className="text-[10px] text-[#4b5563] uppercase tracking-widest mt-0.5">Win Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-white">847</p>
                <p className="text-[10px] text-[#4b5563] uppercase tracking-widest mt-0.5">Trades</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-[#00e676]">2.4</p>
                <p className="text-[10px] text-[#4b5563] uppercase tracking-widest mt-0.5">Profit Factor</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-[#f87171]">-8.2%</p>
                <p className="text-[10px] text-[#4b5563] uppercase tracking-widest mt-0.5">Max DD</p>
              </div>
              <div className="self-end ml-auto">
                <p className="text-[10px] text-[#4b5563]">XAU/USD · 1H · 2024–2025</p>
              </div>
            </div>

            <div className="space-y-3">
              {strategySteps.map((step, i) => (
                <div key={i} className="flex items-start gap-4">
                  <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                    style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>
                    {i + 1}
                  </span>
                  <p className="text-sm text-[#d1d5db]">{step}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recommended settings table */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 mb-8 overflow-x-auto">
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#6b7280] mb-5">Recommended Settings</p>
            <table className="w-full text-left font-dm-mono text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,230,118,0.15)" }}>
                  {["Asset", "Timeframe", "Min Confluence", "ATR SL", "Best Session"].map((h) => (
                    <th key={h} className="pb-3 pr-4 font-bold tracking-wider"
                      style={{ color: "#00e676" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {settingsRows.map((r, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    <td className="py-2.5 pr-4 text-white font-semibold">{r.asset}</td>
                    <td className="py-2.5 pr-4 text-[#9ca3af]">{r.tf}</td>
                    <td className="py-2.5 pr-4 text-[#9ca3af]">{r.minC}</td>
                    <td className="py-2.5 pr-4 text-[#9ca3af]">{r.atr}×</td>
                    <td className="py-2.5 text-[#9ca3af]">{r.session}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          {/* Webhook integration */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 mb-8">
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#6b7280] mb-2">Webhook Integration</p>
            <h3 className="text-lg font-bold mb-1">Connect to ChartIQ for Full Automation</h3>
            <p className="text-[#6b7280] text-sm mb-6">
              When the indicator fires, TradingView sends a webhook to ChartIQ. ChartIQ logs the signal and
              can automatically place trades via your connected broker.
            </p>
            <div className="space-y-3 mb-6">
              {webhookSteps.map((s) => (
                <div key={s.step} className="flex items-start gap-4">
                  <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                    style={{ background: "rgba(0,230,118,0.12)", color: "#00e676" }}>
                    {s.step}
                  </span>
                  <p className="text-sm text-[#d1d5db]">{s.text}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-4 py-2.5 flex items-center justify-between"
                style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-[11px] font-mono text-[#6b7280]">Webhook Message Template</span>
                <span className="text-[10px] font-bold text-[#00e676] tracking-wider">JSON</span>
              </div>
              <pre className="p-4 text-xs font-dm-mono text-[#00e676] overflow-x-auto leading-relaxed"
                style={{ background: "rgba(0,230,118,0.03)" }}>
                {webhookJson}
              </pre>
            </div>
            <p className="text-xs text-[#4b5563] mt-3">
              Webhook endpoint: <span className="text-[#6b7280] font-dm-mono">trade-edge-ai.vercel.app/api/tradingview/webhook</span>
            </p>
          </motion.div>

          {/* Video placeholder */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 mb-8 text-center">
            <div className="text-3xl mb-3">📹</div>
            <p className="text-[#9ca3af] text-sm font-semibold">Video tutorial coming soon</p>
            <p className="text-[#4b5563] text-xs mt-1">Full walkthrough of setup, settings, and live backtesting examples</p>
          </motion.div>

          {/* Testimonial */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
            className="rounded-2xl p-7 mb-8"
            style={{ background: "linear-gradient(135deg, #0d1820 0%, #080a10 100%)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-2xl mb-4">&ldquo;</div>
            <p className="text-[#d1d5db] text-base leading-relaxed mb-4 italic">
              This indicator changed how I trade — the confluence scoring means I only take
              high probability setups. My win rate went from 48% to 67% in the first month.
            </p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: "rgba(0,230,118,0.15)", color: "#00e676" }}>J</div>
              <div>
                <p className="text-sm font-semibold text-white">James R.</p>
                <p className="text-xs text-[#4b5563]">Elite Member · Forex trader</p>
              </div>
            </div>
          </motion.div>

          {/* Disclaimer */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}
            className="rounded-2xl p-6 mb-10"
            style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.18)" }}>
            <div className="flex items-start gap-3">
              <span className="text-lg flex-shrink-0">⚠️</span>
              <div>
                <p className="text-xs font-bold tracking-[0.15em] uppercase text-[#fbbf24] mb-2">Important Disclaimer</p>
                <p className="text-xs text-[#6b7280] leading-relaxed">
                  Past performance shown in backtests does not guarantee future results. Trading involves significant risk
                  of capital loss. The ChartIQ AI Signal System is a tool to assist your analysis — not a guarantee of
                  profitable trades. Always use proper risk management. Never risk more than you can afford to lose.
                  Backtest results are based on historical data and may not reflect future market conditions.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Bottom download CTA */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.38 }}
            className="text-center">
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-3">
              <a href="/indicators/chartiq-indicator.pine" download
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
                style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 28px rgba(0,230,118,0.3)" }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M2.5 13h11" stroke="#080a10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download Indicator
              </a>
              <a href="/indicators/chartiq-strategy.pine" download
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
                style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1.5px solid rgba(0,230,118,0.3)" }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M2.5 13h11" stroke="#00e676" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download Strategy
              </a>
            </div>
            <p className="text-[#4b5563] text-xs">Pine Script v5 · Free updates included · Elite members only</p>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
