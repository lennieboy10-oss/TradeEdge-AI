"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useUserPlan } from "@/app/lib/plan-context";
import AppNav from "@/app/components/AppNav";

function LogoMark() {
  return (
    <div className="w-8 h-8 rounded-full bg-[#00e676] flex items-center justify-center flex-shrink-0">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="#080a10" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const proFeatures = [
  "Unlimited chart analyses",
  "No daily limits, ever",
  "Full SMC analysis (FVGs, order blocks, BOS)",
  "Annotated chart overlay",
  "Risk warnings & confluence checklist",
  "Pro deep analysis (Fibonacci, volume, momentum)",
  "Smart entry timer with session detection",
  "TradingView Pine Script export",
  "MT4/MT5 manual trade helper",
  "TradingView webhook integration",
  "Alpaca & Binance direct trading",
  "ChartIQ API key access",
  "Trade journal with win rate tracking",
  "Watchlist with price alerts",
  "Economic calendar",
  "AI coaching & chat",
  "Multi-timeframe confluence",
  "Priority support",
];

const eliteFeatures = [
  "Everything in Pro",
  "ChartIQ AI Signal System indicator",
  "Unlimited indicator downloads",
  "Future indicator updates — free",
  "Priority indicator support",
  "MT4/MT5 Expert Advisor auto-trading",
  "Full automated signal system",
  "Configurable min confidence, lot size, sessions",
  "Daily trade limit controls",
  "Kill switch with STOP confirmation",
  "All future broker integrations",
  "Unlimited automated trades",
  "Trade placed email & toast notifications",
];

function Check({ color = "#00e676" }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="flex-shrink-0 mt-0.5">
      <path d="M2 6.5l3 3L11 2.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PricingPage() {
  const { isPro } = useUserPlan();
  const [annual, setAnnual]           = useState(false);
  const [checkoutLoading, setCheckout] = useState<string | null>(null);

  async function handleCheckout(plan: string) {
    setCheckout(plan);
    try {
      const clientId = localStorage.getItem("ciq_client_id");
      if (!clientId) { setCheckout(null); return; }
      const res  = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, annual, plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { alert("Something went wrong"); }
    setCheckout(null);
  }

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <AppNav />

      <main className="pt-32 pb-24 px-6">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00e676]/30 bg-[#00e676]/10 text-[#00e676] text-xs font-semibold tracking-[0.13em] uppercase mb-4">
              Pricing
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-[#6b7280] text-lg max-w-xl mx-auto">
              Start free. Upgrade when you&apos;re ready for institutional-grade signals.
            </p>
          </motion.div>

          {/* Billing toggle */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="flex justify-center mb-10">
            <div className="flex gap-1 p-1 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {[false, true].map((a) => (
                <button key={String(a)} onClick={() => setAnnual(a)}
                  className="px-5 py-2 rounded-lg text-sm font-semibold font-dm-mono transition-all duration-150 flex items-center gap-2"
                  style={annual === a
                    ? { background: "#00e676", color: "#080a10" }
                    : { background: "transparent", color: "#6b7280" }}>
                  {a ? "Annual" : "Monthly"}
                  {a && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={annual ? { background: "rgba(8,10,16,0.2)", color: "#080a10" } : { background: "rgba(0,230,118,0.15)", color: "#00e676" }}>
                      SAVE 35%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">

            {/* Free */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="rounded-2xl border border-white/[0.07] bg-[#0c0f18] p-7 flex flex-col">
              <p className="font-dm-mono text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-2">Free</p>
              <div className="mb-1">
                <span className="text-4xl font-extrabold">£0</span>
                <span className="text-[#6b7280] text-sm ml-1">/month</span>
              </div>
              <p className="text-[#4b5563] text-xs mb-6">No card required</p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {[
                  "3 chart analyses per day",
                  "Basic signal (LONG/SHORT/NEUTRAL)",
                  "Entry, SL, TP levels",
                  "AI summary",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#9ca3af]">
                    <Check color="#4b5563" />{f}
                  </li>
                ))}
              </ul>
              <Link href="/"
                className="w-full py-3 rounded-xl text-sm font-bold text-center block transition-all"
                style={{ background: "rgba(255,255,255,0.05)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.08)" }}>
                Start Free
              </Link>
            </motion.div>

            {/* Pro */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="rounded-2xl p-7 flex flex-col relative"
              style={{ background: "linear-gradient(145deg, #0d1f15 0%, #080a10 100%)", border: "1.5px solid rgba(0,230,118,0.28)", boxShadow: "0 0 48px rgba(0,230,118,0.07)" }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="font-dm-mono text-[10px] font-bold tracking-widest px-3 py-1 rounded-full"
                  style={{ background: "#00e676", color: "#080a10" }}>MOST POPULAR</span>
              </div>
              <p className="font-dm-mono text-[10px] font-bold tracking-[0.2em] uppercase text-[#00e676] mb-2">Pro</p>
              <div className="mb-1">
                <span className="text-4xl font-extrabold text-[#00e676]">{annual ? "£149" : "£19"}</span>
                <span className="text-[#6b7280] text-sm ml-1">/{annual ? "year" : "month"}</span>
              </div>
              <p className="text-[#4b5563] text-xs mb-6">{annual ? "£12.42/month · billed annually" : "Billed monthly"}</p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#d1d5db]">
                    <Check />{f}
                  </li>
                ))}
              </ul>
              {isPro ? (
                <div className="w-full py-3 rounded-xl text-sm font-bold text-center"
                  style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.25)" }}>
                  ✓ Current Plan
                </div>
              ) : (
                <button onClick={() => handleCheckout("pro")}
                  disabled={!!checkoutLoading}
                  className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                  style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 22px rgba(0,230,118,0.3)" }}>
                  {checkoutLoading === "pro" ? "Redirecting…" : `Get Pro — ${annual ? "£149/yr" : "£19/mo"}`}
                </button>
              )}
            </motion.div>

            {/* Elite */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="rounded-2xl p-7 flex flex-col"
              style={{ background: "linear-gradient(145deg, #100d1f 0%, #080a10 100%)", border: "1.5px solid rgba(139,92,246,0.28)" }}>
              <p className="font-dm-mono text-[10px] font-bold tracking-[0.2em] uppercase mb-2" style={{ color: "#a78bfa" }}>Elite</p>
              <div className="mb-1">
                <span className="text-4xl font-extrabold" style={{ color: "#a78bfa" }}>{annual ? "£349" : "£39"}</span>
                <span className="text-[#6b7280] text-sm ml-1">/{annual ? "year" : "month"}</span>
              </div>
              <p className="text-[#4b5563] text-xs mb-6">{annual ? "£29.08/month · billed annually" : "Billed monthly"}</p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {eliteFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#d1d5db]">
                    <Check color="#a78bfa" />{f}
                  </li>
                ))}
              </ul>
              <button onClick={() => handleCheckout("elite")}
                disabled={!!checkoutLoading}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
                {checkoutLoading === "elite" ? "Redirecting…" : `Get Elite — ${annual ? "£349/yr" : "£39/mo"}`}
              </button>
            </motion.div>
          </div>

          {/* Elite indicator callout */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="rounded-2xl p-6 mb-10 flex flex-col md:flex-row items-center gap-6"
            style={{ background: "linear-gradient(135deg, #100d1f 0%, #0c0a18 100%)", border: "1.5px solid rgba(139,92,246,0.25)", boxShadow: "0 0 40px rgba(139,92,246,0.05)" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)" }}>
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <path d="M3 19L8 12L12.5 15.5L18 7" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="21" cy="5" r="3" fill="#a78bfa" fillOpacity="0.6" />
              </svg>
            </div>
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center gap-2 justify-center md:justify-start mb-1">
                <span className="text-xs font-bold tracking-[0.15em] uppercase px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(139,92,246,0.18)", color: "#a78bfa" }}>Elite Exclusive</span>
              </div>
              <p className="text-white font-bold text-base mb-1">ChartIQ AI Signal System</p>
              <p className="text-[#6b7280] text-sm leading-relaxed">
                Elite members get exclusive access to the most advanced buy/sell indicator for TradingView —
                combining SMC, FVGs, order blocks, and liquidity analysis with a 6-factor confluence engine.
              </p>
            </div>
            <Link href="/tools/elite-indicator"
              className="flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 whitespace-nowrap"
              style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.35)" }}>
              Learn More
            </Link>
          </motion.div>

          {/* FAQ */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="max-w-2xl mx-auto mb-10">
            <p className="font-dm-mono text-[10px] font-bold tracking-[0.18em] uppercase text-[#6b7280] text-center mb-6">FAQ</p>
            <div className="space-y-3">
              {[
                { q: "Can I cancel anytime?", a: "Yes. Cancel at any time from Account → Manage Subscription. You keep access until the end of your billing period." },
                { q: "Is there a free trial?", a: "New accounts get a 7-day Pro trial with no card required. Full Pro access from day one." },
                { q: "What markets are supported?", a: "Forex, crypto, commodities (gold, oil), indices, and US stocks. Any chart you can screenshot." },
                { q: "How do automated trades work?", a: "Elite users install our MT4/MT5 Expert Advisor. It polls ChartIQ every 60 seconds and places limit orders when confidence exceeds your threshold." },
              ].map((item) => (
                <div key={item.q} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-sm font-semibold text-white mb-1">{item.q}</p>
                  <p className="text-xs text-[#6b7280] leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Compliance */}
          <p className="text-[#374151] text-xs text-center max-w-2xl mx-auto leading-relaxed">
            ChartIQ AI analysis is for informational purposes only and does not constitute financial advice.
            Trading involves significant risk of loss. Never risk more than you can afford to lose.
            Past performance does not guarantee future results.
          </p>
        </div>
      </main>
    </div>
  );
}
