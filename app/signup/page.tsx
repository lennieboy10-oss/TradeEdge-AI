"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowser } from "@/app/lib/supabase-browser";

function LogoMark() {
  return (
    <div className="w-9 h-9 rounded-full bg-[#00e676] flex items-center justify-center flex-shrink-0">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="#080a10" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const PRO_FEATURES = [
  "Unlimited AI chart analyses",
  "Multi-timeframe confluence analysis",
  "Full risk & reward breakdown",
  "Trade journal with performance tracking",
  "Watchlist with price alerts",
  "Economic calendar integration",
  "Trade grade & confluence checklist",
  "Priority support & early access",
];

export default function SignupPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [done,     setDone]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const sb = getSupabaseBrowser();
    const { data, error: signUpError } = await sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;

    if (userId) {
      try {
        await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, email }),
        });
      } catch { /* non-fatal */ }
    }

    if (data.session) {
      router.replace("/");
    } else {
      setDone(true);
    }

    setLoading(false);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#080a10] text-white flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-[#00e676]/10 border border-[#00e676]/30 flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M4 14.5l7 7L24 7" stroke="#00e676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="font-bebas text-[48px] leading-none tracking-[0.03em] text-white mb-3">CHECK YOUR EMAIL</h1>
          <p className="text-[#6b7280] text-sm leading-relaxed mb-6">
            We sent a confirmation link to <span className="text-white font-semibold">{email}</span>.
            Click the link to activate your 7-day free trial.
          </p>
          <p className="text-[#4b5563] text-xs">
            Already confirmed?{" "}
            <Link href="/login" className="text-[#00e676] hover:underline">Sign in →</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <div className="max-w-5xl mx-auto px-6 py-12 lg:py-20">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-12 justify-center">
          <LogoMark />
          <span className="font-bold text-[18px]">ChartIQ <span className="text-[#00e676]">AI</span></span>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">

          {/* Left — value prop */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#00e676]/30 bg-[#00e676]/10 text-[#00e676] text-[10px] font-bold tracking-widest uppercase mb-5">
              7-DAY FREE TRIAL · NO CARD NEEDED
            </div>

            <h1 className="font-bebas text-[clamp(48px,6vw,72px)] leading-[0.92] tracking-[0.03em] text-white mb-4">
              START YOUR<br />FREE 7 DAY<br /><span className="text-[#00e676]">TRIAL</span>
            </h1>

            <p className="text-[#9ca3af] text-lg mb-8 leading-relaxed">
              Full Pro access. No credit card required. Cancel anytime.
            </p>

            {/* Feature list */}
            <div className="space-y-3">
              {PRO_FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(0,230,118,0.12)", border: "1px solid rgba(0,230,118,0.25)" }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5l2.5 2.5L8.5 2" stroke="#00e676" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-[#d1d5db] text-sm">{f}</span>
                </div>
              ))}
            </div>

            <p className="font-dm-mono text-[11px] text-[#4b5563] mt-8">
              2,400+ Pro traders are tracking their edge right now
            </p>
          </div>

          {/* Right — form */}
          <div className="lg:sticky lg:top-8">
            <div className="rounded-2xl border border-white/[0.08] bg-[#0c0f18] p-8">
              <h2 className="text-xl font-extrabold text-white mb-1.5">Create your account</h2>
              <p className="text-[#6b7280] text-sm mb-6">Free for 7 days, then £19/mo.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[#6b7280] uppercase tracking-[0.1em] mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white placeholder-[#4b5563] text-sm outline-none focus:border-[#00e676]/40 focus:bg-white/[0.06] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#6b7280] uppercase tracking-[0.1em] mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white placeholder-[#4b5563] text-sm outline-none focus:border-[#00e676]/40 focus:bg-white/[0.06] transition-all"
                  />
                </div>

                {error && (
                  <p className="text-[#f87171] text-sm px-1">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-xl text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 mt-2"
                  style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 28px rgba(0,230,118,0.4)" }}
                >
                  {loading ? "Creating your account…" : "Start free trial →"}
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
