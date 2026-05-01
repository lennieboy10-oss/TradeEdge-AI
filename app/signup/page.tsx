"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { getSupabaseBrowser } from "@/app/lib/supabase-browser";

type Step = "form" | "plan" | "done";
type PlanChoice = "free" | "trial";

function LogoMark() {
  return (
    <div className="w-9 h-9 rounded-full bg-[#00e676] flex items-center justify-center flex-shrink-0">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="#080a10" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Check() {
  return (
    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: "rgba(0,230,118,0.12)", border: "1px solid rgba(0,230,118,0.25)" }}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M1.5 5l2.5 2.5L8.5 2" stroke="#00e676" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const FREE_FEATURES = [
  "5 analyses to get started",
  "Basic signal + entry / SL / TP",
  "Confidence score",
  "Risk calculator",
  "Upgrade anytime",
];

const TRIAL_FEATURES = [
  "Unlimited analyses for 7 days",
  "All Pro features unlocked",
  "SMC analysis and confluences",
  "Trade journal and watchlist",
  "Economic calendar",
  "Reverts to free after 7 days",
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep]               = useState<Step>("form");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [loading, setLoading]         = useState(false);
  const [planLoading, setPlanLoading] = useState<PlanChoice | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [userId, setUserId]           = useState<string | null>(null);
  const [hasSession, setHasSession]   = useState(false);
  const [chosenPlan, setChosenPlan]   = useState<PlanChoice>("free");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const sb = getSupabaseBrowser();
    const { data, error: signUpError } = await sb.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.user?.id) setUserId(data.user.id);
    setHasSession(!!data.session);
    setStep("plan");
  }

  async function choosePlan(plan: PlanChoice) {
    setPlanLoading(plan);
    setChosenPlan(plan);

    const trialEndsAt = plan === "trial"
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    try {
      await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email, plan, trialEndsAt }),
      });
    } catch { /* non-fatal */ }

    localStorage.setItem("ciq_signup_plan", plan);

    if (hasSession) {
      router.replace(`/?welcome=${plan}`);
    } else {
      setPlanLoading(null);
      setStep("done");
    }
  }

  // ── Step 3: check email ──────────────────────────────────────
  if (step === "done") {
    return (
      <div className="min-h-screen bg-[#080a10] text-white flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-[#00e676]/10 border border-[#00e676]/30 flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M4 14.5l7 7L24 7" stroke="#00e676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#00e676]/30 bg-[#00e676]/10 text-[#00e676] text-[10px] font-bold tracking-widest uppercase mb-5">
            {chosenPlan === "trial" ? "⚡ Pro trial ready" : "🎯 Free account ready"}
          </div>
          <h1 className="font-bebas text-[48px] leading-none tracking-[0.03em] text-white mb-3">CHECK YOUR EMAIL</h1>
          <p className="text-[#6b7280] text-sm leading-relaxed mb-3">
            We sent a confirmation link to <span className="text-white font-semibold">{email}</span>. Click it to activate your account.
          </p>
          <div className="rounded-xl px-4 py-3 mb-6 text-sm"
            style={{
              background: chosenPlan === "trial" ? "rgba(0,230,118,0.06)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${chosenPlan === "trial" ? "rgba(0,230,118,0.2)" : "rgba(255,255,255,0.08)"}`,
            }}>
            {chosenPlan === "trial"
              ? "Pro trial activated! 7 days of unlimited access starts now."
              : "Welcome! You have 5 free analyses to get started."}
          </div>
          <p className="text-[#4b5563] text-xs">
            Already confirmed?{" "}
            <Link href="/login" className="text-[#00e676] hover:underline">Sign in →</Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Step 2: plan selection ───────────────────────────────────
  if (step === "plan") {
    return (
      <div className="min-h-screen bg-[#080a10] text-white flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-3xl">
          <div className="flex items-center gap-2.5 mb-10 justify-center">
            <LogoMark />
            <span className="font-bold text-[18px]">ChartIQ <span className="text-[#00e676]">AI</span></span>
          </div>

          <div className="text-center mb-10">
            <h1 className="font-bebas text-[clamp(42px,6vw,64px)] leading-none tracking-[0.04em] text-white mb-3">
              CHOOSE HOW TO START
            </h1>
            <p className="text-[#6b7280] text-sm">You can upgrade or change anytime</p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">

            {/* Free card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.3 }}
              className="rounded-2xl p-6 flex flex-col"
              style={{ background: "#0c0f18", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="mb-4">
                <span className="font-dm-mono text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }}>
                  FREE
                </span>
              </div>
              <div className="text-3xl mb-3">🎯</div>
              <h2 className="text-xl font-extrabold text-white mb-1.5">Start Free</h2>
              <p className="text-[#6b7280] text-sm mb-5">Get started with no time limit</p>
              <div className="space-y-2.5 mb-6 flex-1">
                {FREE_FEATURES.map((f) => (
                  <div key={f} className="flex items-center gap-2.5">
                    <Check />
                    <span className="text-[#9ca3af] text-sm">{f}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => choosePlan("free")}
                disabled={!!planLoading}
                className="w-full py-3.5 rounded-xl text-sm font-bold border transition-all hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                style={{ borderColor: "rgba(255,255,255,0.15)", color: "#9ca3af" }}
              >
                {planLoading === "free" ? "Setting up…" : "Start free"}
              </button>
            </motion.div>

            {/* Pro Trial card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="rounded-2xl p-6 flex flex-col relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #0c1810 0%, #0a1a12 100%)",
                border: "1px solid rgba(0,230,118,0.3)",
                boxShadow: "0 0 40px rgba(0,230,118,0.08)",
              }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(0,230,118,0.08) 0%, transparent 70%)" }} />
              <div className="mb-4">
                <span className="font-dm-mono text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(0,230,118,0.15)", color: "#00e676", border: "1px solid rgba(0,230,118,0.3)" }}>
                  RECOMMENDED
                </span>
              </div>
              <div className="text-3xl mb-3">⚡</div>
              <h2 className="text-xl font-extrabold text-white mb-1.5">Try Pro Free</h2>
              <p className="text-[#9ca3af] text-sm mb-5">Full Pro access, no card needed</p>
              <div className="space-y-2.5 mb-6 flex-1">
                {TRIAL_FEATURES.map((f) => (
                  <div key={f} className="flex items-center gap-2.5">
                    <Check />
                    <span className="text-[#d1d5db] text-sm">{f}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => choosePlan("trial")}
                disabled={!!planLoading}
                className="w-full py-3.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0"
                style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 22px rgba(0,230,118,0.35)" }}
              >
                {planLoading === "trial" ? "Activating trial…" : "Start Pro trial"}
              </button>
              <p className="text-center font-dm-mono text-[10px] text-[#4b5563] mt-2">No credit card required</p>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: email / password form ────────────────────────────
  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <div className="max-w-5xl mx-auto px-6 py-12 lg:py-20">
        <div className="flex items-center gap-2.5 mb-12 justify-center">
          <LogoMark />
          <span className="font-bold text-[18px]">ChartIQ <span className="text-[#00e676]">AI</span></span>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">
          {/* Left — value prop */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#00e676]/30 bg-[#00e676]/10 text-[#00e676] text-[10px] font-bold tracking-widest uppercase mb-5">
              FREE TO START · NO CARD NEEDED
            </div>
            <h1 className="font-bebas text-[clamp(48px,6vw,72px)] leading-[0.92] tracking-[0.03em] text-white mb-4">
              JOIN 2,400+<br />TRADERS<br /><span className="text-[#00e676]">TODAY</span>
            </h1>
            <p className="text-[#9ca3af] text-lg mb-8 leading-relaxed">
              AI-powered chart analysis. Start free or unlock a 7-day Pro trial — your choice.
            </p>
            <div className="space-y-3">
              {["Instant AI chart analysis", "Entry, stop loss & take profit levels", "Confidence score & trade grade", "SMC confluence analysis (Pro)", "Trade journal & watchlist (Pro)"].map((f) => (
                <div key={f} className="flex items-center gap-3">
                  <Check />
                  <span className="text-[#d1d5db] text-sm">{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div className="lg:sticky lg:top-8">
            <div className="rounded-2xl border border-white/[0.08] bg-[#0c0f18] p-8">
              <h2 className="text-xl font-extrabold text-white mb-1.5">Create your account</h2>
              <p className="text-[#6b7280] text-sm mb-6">Choose your plan in the next step.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[#6b7280] uppercase tracking-[0.1em] mb-1.5">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white placeholder-[#4b5563] text-sm outline-none focus:border-[#00e676]/40 focus:bg-white/[0.06] transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#6b7280] uppercase tracking-[0.1em] mb-1.5">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="At least 6 characters"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white placeholder-[#4b5563] text-sm outline-none focus:border-[#00e676]/40 focus:bg-white/[0.06] transition-all" />
                </div>

                {error && <p className="text-[#f87171] text-sm px-1">{error}</p>}

                <button type="submit" disabled={loading}
                  className="w-full py-4 rounded-xl text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 mt-2"
                  style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 28px rgba(0,230,118,0.4)" }}>
                  {loading ? "Creating account…" : "Continue →"}
                </button>
              </form>

              <div className="flex items-center gap-3 mt-5 mb-5">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-[#374151] text-[11px]">No credit card needed</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              <p className="text-center text-[#4b5563] text-xs">
                Already have an account?{" "}
                <Link href="/login" className="text-[#9ca3af] hover:text-white transition-colors">Sign in →</Link>
              </p>
            </div>
            <p className="text-center text-[#374151] text-[11px] mt-4 px-2">
              By signing up you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
