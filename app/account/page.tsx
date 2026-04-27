"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

function LogoMark() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#4338ca] flex items-center justify-center flex-shrink-0">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

type UserData = { plan: string; email: string | null; totalAnalyses: number };

export default function Account() {
  const [clientId, setClientId]   = useState<string | null>(null);
  const [userData, setUserData]   = useState<UserData>({ plan: "free", email: null, totalAnalyses: 0 });
  const [loading,  setLoading]    = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    let id = localStorage.getItem("ciq_client_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("ciq_client_id", id);
    }
    setClientId(id);

    fetch(`/api/user/plan?client_id=${id}`)
      .then((r) => r.json())
      .then((d: UserData) => {
        setUserData(d);
        localStorage.setItem("ciq_plan", d.plan ?? "free");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handlePortal() {
    if (!clientId) return;
    setPortalLoading(true);
    try {
      const res  = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error ?? "Portal unavailable");
    } catch { alert("Something went wrong"); }
    setPortalLoading(false);
  }

  async function handleUpgrade() {
    if (!clientId) return;
    setCheckoutLoading(true);
    try {
      const res  = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { alert("Something went wrong"); }
    setCheckoutLoading(false);
  }

  const isPro = userData.plan === "pro";

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 nav-glass">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-bold text-[17px] text-white">
              ChartIQ <span className="text-[#f5c518]">AI</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {isPro && (
              <span className="font-dm-mono text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full"
                style={{ background: "rgba(0,230,118,0.12)", color: "#00e676", border: "1px solid rgba(0,230,118,0.25)" }}>
                PRO
              </span>
            )}
            <Link href="/" className="btn-purple px-5 py-2 text-sm hidden md:inline-flex">
              Analyze Chart
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-24 px-6">
        <div className="max-w-lg mx-auto">

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#7c3aed]/30 bg-[#7c3aed]/10 text-[#a78bfa] text-xs font-semibold tracking-[0.13em] uppercase mb-4">
              Account
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Your Plan</h1>
            <p className="text-[#6b7280] text-sm mt-1">
              {userData.email ?? "No email on file"}
            </p>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="skeleton h-24 rounded-2xl" />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              {/* Plan card */}
              <div className="rounded-2xl p-6 border"
                style={{
                  borderColor: isPro ? "rgba(0,230,118,0.25)" : "rgba(255,255,255,0.07)",
                  background:  isPro ? "rgba(0,230,118,0.04)" : "#0c0f18",
                }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[#6b7280] text-[10px] uppercase tracking-[0.12em] font-semibold mb-1">
                      Current Plan
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-extrabold" style={{ color: isPro ? "#00e676" : "white" }}>
                        {isPro ? "Pro" : "Free"}
                      </p>
                      {isPro && (
                        <span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full font-dm-mono"
                          style={{ background: "rgba(0,230,118,0.15)", color: "#00e676" }}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[#6b7280] text-sm mt-1">
                      {isPro ? "Unlimited analyses" : "3 analyses / day"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#6b7280] text-[10px] uppercase tracking-[0.12em] font-semibold mb-1">
                      Price
                    </p>
                    <p className="font-dm-mono text-xl font-bold text-white">
                      {isPro ? "£19/mo" : "Free"}
                    </p>
                  </div>
                </div>

                {isPro ? (
                  <button
                    onClick={handlePortal}
                    disabled={portalLoading}
                    className="w-full py-3 rounded-xl text-sm font-semibold border border-white/[0.12] text-white hover:bg-white/[0.06] transition-all duration-150 disabled:opacity-50"
                  >
                    {portalLoading ? "Opening portal…" : "Manage subscription →"}
                  </button>
                ) : (
                  <button
                    onClick={handleUpgrade}
                    disabled={checkoutLoading}
                    className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
                    style={{ background: "#00e676", color: "#080c0a", boxShadow: "0 0 22px rgba(0,230,118,0.3)" }}
                  >
                    {checkoutLoading ? "Redirecting…" : "Upgrade to Pro — £19/mo"}
                  </button>
                )}
              </div>

              {/* Stats card */}
              <div className="rounded-2xl p-6 border border-white/[0.07] bg-[#0c0f18]">
                <p className="text-[#6b7280] text-[10px] uppercase tracking-[0.12em] font-semibold mb-4">
                  Usage Stats
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                    <p className="text-[28px] font-extrabold text-[#f5c518] leading-none mb-1">
                      {userData.totalAnalyses}
                    </p>
                    <p className="text-[#6b7280] text-xs">Total Analyses</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                    <p className="text-[28px] font-extrabold leading-none mb-1"
                      style={{ color: isPro ? "#00e676" : "#f5c518" }}>
                      {isPro ? "∞" : "3"}
                    </p>
                    <p className="text-[#6b7280] text-xs">Daily Limit</p>
                  </div>
                </div>
              </div>

              {/* Pro features */}
              {!isPro && (
                <div className="rounded-2xl p-6 border border-[#7c3aed]/20 bg-[#7c3aed]/[0.04]">
                  <p className="text-[#a78bfa] text-[10px] uppercase tracking-[0.12em] font-semibold mb-3">
                    Pro includes
                  </p>
                  <ul className="space-y-2">
                    {[
                      "Unlimited chart analyses",
                      "No daily limits, ever",
                      "Full risk & reward analysis",
                      "Priority support",
                    ].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-[#d1d5db]">
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="flex-shrink-0">
                          <path d="M2 6.5l3 3L11 2.5" stroke="#7c3aed" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-center pt-2">
                <Link href="/" className="text-[#4b5563] text-sm hover:text-[#9ca3af] transition-colors">
                  ← Back to analyzer
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
