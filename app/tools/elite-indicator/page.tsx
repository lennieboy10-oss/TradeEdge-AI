"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useUserPlan } from "@/app/lib/plan-context";
import AppNav from "@/app/components/AppNav";

const comingFeatures = [
  "Smart Money Concepts (ICT methodology)",
  "Automatic Buy/Sell signals",
  "Fair Value Gap detection",
  "Order Block identification",
  "Liquidity sweep alerts",
  "Break of Structure signals",
  "Session filter (London / NY / Asian)",
  "Real-time dashboard overlay",
  "TradingView alerts integration",
  "Works on all timeframes and assets",
];

function EliteBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-[0.18em] uppercase"
      style={{ background: "rgba(139,92,246,0.18)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.35)" }}>
      <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] animate-pulse" />
      Elite Exclusive
    </span>
  );
}

function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="flex-shrink-0 mt-0.5">
      <path d="M2 6.5l3 3L11 2.5" stroke="#00e676" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Locked page (Free / Pro) ───────────────────────────────────

function LockedPage() {
  return (
    <div className="min-h-screen bg-[#080c0a] text-white">
      <AppNav />
      <main className="pt-28 pb-24 px-6">
        <div className="max-w-xl mx-auto text-center">
          <div className="mb-5"><EliteBadge /></div>
          <h1 className="font-bebas text-5xl md:text-6xl tracking-wider mb-4 leading-none">CHARTIQ AI SIGNAL SYSTEM</h1>
          <p className="text-[#6b7280] mb-10 text-base leading-relaxed">
            This indicator is exclusively for Elite members. Upgrade to unlock the most advanced buy/sell indicator available to retail traders.
          </p>
          <div className="relative rounded-2xl overflow-hidden mb-10" style={{ background: "#0c0f18", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="blur-sm pointer-events-none select-none p-8 opacity-50 space-y-3">
              {comingFeatures.map((f) => (
                <div key={f} className="flex items-center gap-3 text-sm text-[#d1d5db]"><Check />{f}</div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-end justify-center pb-8"
              style={{ background: "linear-gradient(to bottom, transparent 20%, rgba(12,15,24,0.98))" }}>
              <div className="w-full flex flex-col items-center gap-4 mt-auto">
                <p className="text-sm text-[#9ca3af]">Unlock with Elite membership</p>
                <Link href="/pricing"
                  className="px-8 py-3.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
                  style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1.5px solid rgba(139,92,246,0.4)", boxShadow: "0 0 30px rgba(139,92,246,0.15)" }}>
                  Upgrade to Elite — £39/mo
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Coming Soon page (Elite) ───────────────────────────────────

function ComingSoonPage() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [err, setErr]         = useState("");

  // Launch date: 2 weeks from May 4 2026
  const launchDate = new Date("2026-05-18");
  const launchLabel = launchDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/video-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (data.success) setDone(true);
      else setErr(data.error ?? "Something went wrong");
    } catch {
      setErr("Something went wrong — please try again");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen text-white" style={{ background: "#080c0a" }}>
      <AppNav />

      {/* Glow backdrop */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(0,230,118,0.06) 0%, transparent 70%)" }} />
      </div>

      <main className="relative pt-28 pb-24 px-6">
        <div className="max-w-xl mx-auto">

          {/* Badge */}
          <motion.div className="flex justify-center mb-6"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <EliteBadge />
          </motion.div>

          {/* Heading */}
          <motion.div className="text-center mb-8"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <h1 className="font-bebas text-[clamp(52px,10vw,88px)] leading-none tracking-[0.04em] text-white">
              CHARTIQ AI
            </h1>
            <h1 className="font-bebas text-[clamp(52px,10vw,88px)] leading-none tracking-[0.04em] text-white mb-4">
              SIGNAL SYSTEM
            </h1>
            <motion.p
              className="font-dm-mono text-lg font-bold tracking-[0.25em] uppercase"
              style={{ color: "#00e676" }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}>
              ● COMING SOON
            </motion.p>
          </motion.div>

          {/* Description */}
          <motion.p className="text-center text-[#9ca3af] text-sm leading-relaxed mb-10 max-w-md mx-auto"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.16 }}>
            We are putting the finishing touches on the most advanced buy/sell indicator available
            to retail traders. Built exclusively for ChartIQ Elite members.
          </motion.p>

          {/* Feature list */}
          <motion.div className="rounded-2xl p-6 mb-8"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ background: "#0d1310", border: "1px solid rgba(0,230,118,0.12)" }}>
            <p className="font-dm-mono text-[10px] font-bold tracking-[0.2em] uppercase text-[#00e676] mb-4">
              What&apos;s included
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {comingFeatures.map((f, i) => (
                <motion.div key={f}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.22 + i * 0.04 }}
                  className="flex items-start gap-2.5 text-sm text-[#d1d5db]">
                  <Check />{f}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Countdown */}
          <motion.div className="rounded-2xl p-4 mb-8 flex items-center justify-center gap-3"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }}
            style={{ background: "rgba(0,230,118,0.04)", border: "1px solid rgba(0,230,118,0.15)" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
              <circle cx="7" cy="7" r="5.5" stroke="#00e676" strokeWidth="1.2"/>
              <path d="M7 4.5V7l2 1.5" stroke="#00e676" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <p className="font-dm-mono text-sm text-[#9ca3af]">
              Launching approximately <span className="text-white font-bold">{launchLabel}</span>
            </p>
          </motion.div>

          {/* Email form */}
          <motion.div className="rounded-2xl p-6 mb-8"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}
            style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="font-dm-mono text-[10px] font-bold tracking-[0.18em] uppercase text-[#6b7280] mb-1.5">
              Notify me on launch
            </p>
            <p className="text-sm text-[#9ca3af] mb-4">
              Get notified the moment it launches — we will email you with install instructions.
            </p>

            {done ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className="flex items-start gap-3 px-4 py-3.5 rounded-xl"
                style={{ background: "rgba(0,230,118,0.08)", border: "1px solid rgba(0,230,118,0.25)" }}>
                <span className="text-lg flex-shrink-0">✅</span>
                <div>
                  <p className="font-bold text-white text-sm mb-0.5">You are on the list!</p>
                  <p className="text-xs text-[#9ca3af]">We will email you the moment it goes live.</p>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={subscribe} className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  required
                  className="flex-1 px-4 py-3 rounded-xl text-white text-sm placeholder-[#374151] outline-none font-dm-mono transition-all"
                  style={{ background: "rgba(0,0,0,0.5)", border: "1.5px solid rgba(255,255,255,0.1)" }}
                />
                <button type="submit" disabled={loading}
                  className="px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all hover:-translate-y-0.5 disabled:opacity-50"
                  style={{ background: "#00e676", color: "#080c0a", boxShadow: "0 0 20px rgba(0,230,118,0.3)" }}>
                  {loading ? "Saving…" : "Notify me →"}
                </button>
              </form>
            )}
            {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
          </motion.div>

          {/* Footer */}
          <motion.p className="text-center text-xs text-[#374151]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.44 }}>
            Questions? Email{" "}
            <a href="mailto:elite@chartiq.app" className="text-[#4b5563] hover:text-[#9ca3af] transition-colors">
              elite@chartiq.app
            </a>
          </motion.p>

        </div>
      </main>
    </div>
  );
}

// ── Entry point ────────────────────────────────────────────────

export default function EliteIndicatorPage() {
  const { isElite } = useUserPlan();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  if (!isElite) return <LockedPage />;
  return <ComingSoonPage />;
}
