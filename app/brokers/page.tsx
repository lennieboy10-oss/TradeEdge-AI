"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useUserPlan } from "@/app/lib/plan-context";
import { AuthNavButtons } from "@/app/providers";

function LogoMark() {
  return (
    <div className="w-8 h-8 rounded-full bg-[#00e676] flex items-center justify-center flex-shrink-0">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="#080a10" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function WebhookUrl() {
  const [copied, setCopied] = useState(false);
  const url = "https://trade-edge-ai.vercel.app/api/tradingview/webhook";
  return (
    <div className="flex gap-2">
      <div className="flex-1 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.07] font-dm-mono text-[11px] text-[#6b7280] truncate">
        {url}
      </div>
      <button
        onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="px-3 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 flex-shrink-0"
        style={copied ? { background: "rgba(0,230,118,0.12)", color: "#00e676", border: "1px solid rgba(0,230,118,0.3)" } : { background: "#00e676", color: "#080a10" }}>
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export default function BrokersPage() {
  const { isPro } = useUserPlan();

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 nav-glass">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-bold text-[17px] text-white">ChartIQ <span className="text-[#00e676]">AI</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-[#6b7280] hover:text-white transition-colors">← Analyzer</Link>
            <AuthNavButtons />
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-24 px-6">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00e676]/30 bg-[#00e676]/10 text-[#00e676] text-xs font-semibold tracking-[0.13em] uppercase mb-4">
              Integrations
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-3">Brokers & Platforms</h1>
            <p className="text-[#6b7280] text-base max-w-xl">
              Connect ChartIQ AI to your trading platform. Sync signals, auto-trade, and track everything in your journal.
            </p>
          </motion.div>

          {/* ── SECTION 1: Direct Broker Connections ─── */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <p className="font-dm-mono text-[10px] font-bold tracking-[0.18em] uppercase text-[#6b7280]">Section 1</p>
              <div className="h-px flex-1 bg-white/[0.06]" />
              <p className="font-dm-mono text-[11px] font-bold tracking-widest text-white">Direct Broker Connections</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Alpaca */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="rounded-2xl border border-white/[0.07] bg-[#0c0f18] p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: "rgba(255,230,0,0.1)", border: "1px solid rgba(255,230,0,0.2)" }}>
                      🦙
                    </div>
                    <div>
                      <p className="font-bold text-white">Alpaca</p>
                      <p className="text-[#6b7280] text-xs">US Stocks & Crypto</p>
                    </div>
                  </div>
                  <span className="font-dm-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }}>
                    PRO
                  </span>
                </div>
                <p className="text-[#6b7280] text-sm mb-4 leading-relaxed">
                  Place orders directly to Alpaca from your ChartIQ analysis. Paper trading supported.
                </p>
                {isPro ? (
                  <Link href="/account#alpaca"
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-center block transition-all hover:-translate-y-0.5"
                    style={{ background: "#00e676", color: "#080a10" }}>
                    Connect Alpaca
                  </Link>
                ) : (
                  <Link href="/pricing"
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-center block transition-all"
                    style={{ background: "rgba(255,255,255,0.05)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.08)" }}>
                    Upgrade to Pro to Connect
                  </Link>
                )}
              </motion.div>

              {/* Binance */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="rounded-2xl border border-white/[0.07] bg-[#0c0f18] p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: "rgba(243,186,47,0.1)", border: "1px solid rgba(243,186,47,0.2)" }}>
                      🔶
                    </div>
                    <div>
                      <p className="font-bold text-white">Binance</p>
                      <p className="text-[#6b7280] text-xs">Crypto Spot & Futures</p>
                    </div>
                  </div>
                  <span className="font-dm-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }}>
                    PRO
                  </span>
                </div>
                <p className="text-[#6b7280] text-sm mb-4 leading-relaxed">
                  Connect your Binance account via API key. Supports spot, futures, and margin orders.
                </p>
                {isPro ? (
                  <Link href="/account#binance"
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-center block transition-all hover:-translate-y-0.5"
                    style={{ background: "#f3ba2f", color: "#080a10" }}>
                    Connect Binance
                  </Link>
                ) : (
                  <Link href="/pricing"
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-center block transition-all"
                    style={{ background: "rgba(255,255,255,0.05)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.08)" }}>
                    Upgrade to Pro to Connect
                  </Link>
                )}
              </motion.div>
            </div>
          </section>

          {/* ── SECTION 2: Charting Platforms ─── */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <p className="font-dm-mono text-[10px] font-bold tracking-[0.18em] uppercase text-[#6b7280]">Section 2</p>
              <div className="h-px flex-1 bg-white/[0.06]" />
              <p className="font-dm-mono text-[11px] font-bold tracking-widest text-white">Charting Platforms</p>
            </div>

            {/* TradingView */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="rounded-2xl border mb-4 overflow-hidden"
              style={{ borderColor: "rgba(33,150,243,0.22)", background: "#0a0d14" }}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(33,150,243,0.1)", border: "1px solid rgba(33,150,243,0.2)" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M3 17l4-8 4 4 4-6 4 4" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-white">TradingView</p>
                      <p className="text-[#6b7280] text-xs">Webhook Alerts + Pine Script</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-dm-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(33,150,243,0.12)", color: "#42a5f5", border: "1px solid rgba(33,150,243,0.2)" }}>
                      WEBHOOK
                    </span>
                    <span className="font-dm-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(33,150,243,0.12)", color: "#42a5f5", border: "1px solid rgba(33,150,243,0.2)" }}>
                      SCRIPT
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
                  <div>
                    <p className="text-[#9ca3af] text-sm mb-2 font-semibold">Webhook URL</p>
                    <p className="text-[#6b7280] text-xs mb-3 leading-relaxed">
                      Paste this URL into TradingView alert settings. Alerts auto-save to your journal.
                    </p>
                    <WebhookUrl />
                  </div>
                  <div>
                    <p className="text-[#9ca3af] text-sm mb-2 font-semibold">Setup Steps</p>
                    <ol className="space-y-1.5">
                      {[
                        "Create alert on any indicator or price level",
                        'Enable "Webhook URL" in Alert Actions',
                        "Paste the URL above",
                        'Set Message to include your API key (see below)',
                        "Alert fires → auto-saved to your journal",
                      ].map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[#6b7280]">
                          <span className="font-dm-mono text-[#00e676] text-[10px] mt-0.5 flex-shrink-0">{i + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                {/* Alert message format */}
                <div className="rounded-xl p-4 mb-4"
                  style={{ background: "rgba(33,150,243,0.05)", border: "1px solid rgba(33,150,243,0.14)" }}>
                  <p className="font-dm-mono text-[10px] text-[#42a5f5] font-bold uppercase tracking-wider mb-2">
                    TradingView Alert Message Format
                  </p>
                  <pre className="font-dm-mono text-[11px] text-[#9ca3af] leading-relaxed whitespace-pre-wrap">{`{"apiKey":"YOUR_CHARTIQ_API_KEY","asset":"{{ticker}}","signal":"BUY","entry":"{{close}}","timeframe":"{{interval}}","message":"{{strategy.order.alert_message}}"}`}</pre>
                  <p className="text-[#4b5563] text-[10px] mt-2">Replace YOUR_CHARTIQ_API_KEY with your key from <Link href="/account#apikeys" className="text-[#42a5f5] hover:underline">Account → API Keys</Link></p>
                </div>

                <div className="flex gap-3">
                  <a href="https://tradingview.com" target="_blank" rel="noopener noreferrer"
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-center transition-all hover:-translate-y-0.5"
                    style={{ background: "rgba(33,150,243,0.12)", color: "#42a5f5", border: "1px solid rgba(33,150,243,0.22)" }}>
                    Open TradingView
                  </a>
                  <Link href="/tools/pine-scripts"
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-center transition-all hover:-translate-y-0.5"
                    style={{ background: "#00e676", color: "#080a10" }}>
                    Pine Script Library
                  </Link>
                </div>
              </div>
            </motion.div>

            {/* MT4 & MT5 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { name: "MetaTrader 4", version: "mt4", subtitle: "Auto-trade via Expert Advisor", color: "#7b52e8", bg: "rgba(123,82,232,0.1)", border: "rgba(123,82,232,0.22)", emoji: "📈" },
                { name: "MetaTrader 5", version: "mt5", subtitle: "Auto-trade via Expert Advisor", color: "#9b72f8", bg: "rgba(155,114,248,0.1)", border: "rgba(155,114,248,0.22)", emoji: "📊" },
              ].map((mt, idx) => (
                <motion.div key={mt.version}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + idx * 0.08 }}
                  className="rounded-2xl border p-6"
                  style={{ borderColor: mt.border, background: "#0a0d14" }}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                        style={{ background: mt.bg, border: `1px solid ${mt.border}` }}>
                        {mt.emoji}
                      </div>
                      <div>
                        <p className="font-bold text-white">{mt.name}</p>
                        <p className="text-[#6b7280] text-xs">{mt.subtitle}</p>
                      </div>
                    </div>
                    <span className="font-dm-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full"
                      style={{ background: `${mt.bg}`, color: mt.color, border: `1px solid ${mt.border}` }}>
                      EA DOWNLOAD
                    </span>
                  </div>

                  <ul className="space-y-1.5 mb-5">
                    {[
                      "Polls ChartIQ every 60 seconds",
                      "Auto-places trades at 80%+ confidence",
                      "Configurable lot size & min confidence",
                      "Enable/disable toggle in EA inputs",
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-[#6b7280]">
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="flex-shrink-0 mt-0.5">
                          <path d="M2 5.5l2 2.5L9 2" stroke={mt.color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className="flex gap-2">
                    <a href={`/api/mt/ea?version=${mt.version}`}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-center transition-all hover:-translate-y-0.5"
                      style={{ background: mt.color, color: "white" }}>
                      Download {mt.version.toUpperCase()} EA
                    </a>
                    <Link href="/brokers/metatrader"
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
                      style={{ background: "rgba(255,255,255,0.05)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.08)" }}>
                      Guide
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* ── SECTION 3: Coming Soon ─── */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <p className="font-dm-mono text-[10px] font-bold tracking-[0.18em] uppercase text-[#6b7280]">Section 3</p>
              <div className="h-px flex-1 bg-white/[0.06]" />
              <p className="font-dm-mono text-[11px] font-bold tracking-widest text-[#4b5563]">Coming Soon</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { name: "Interactive Brokers", icon: "🏦" },
                { name: "Trading 212", icon: "🟢" },
                { name: "cTrader", icon: "📉" },
                { name: "NinjaTrader", icon: "🥷" },
                { name: "eToro", icon: "🟢" },
                { name: "ThinkOrSwim", icon: "🤔" },
              ].map((b) => (
                <div key={b.name}
                  className="rounded-2xl border border-white/[0.04] p-4 flex items-center gap-3 opacity-40">
                  <span className="text-xl grayscale">{b.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-[#6b7280]">{b.name}</p>
                    <p className="font-dm-mono text-[9px] text-[#374151] tracking-wider">Coming soon</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Compliance */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="mt-12 rounded-2xl p-5 border border-white/[0.05] bg-white/[0.02]">
            <p className="text-[#374151] text-xs leading-relaxed text-center">
              ChartIQ AI analysis is for informational purposes only and does not constitute financial advice.
              Trading involves significant risk of loss. Never risk more than you can afford to lose.
              Automated trading features are provided as tools only — you are solely responsible for all trading decisions and outcomes.
            </p>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
