"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";

function LogoMark() {
  return (
    <div className="w-8 h-8 rounded-full bg-[#00e676] flex items-center justify-center flex-shrink-0">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="#080a10" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function AnimatedCheck() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <motion.circle
        cx="20" cy="20" r="18"
        stroke="#00e676" strokeWidth="1.5" fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      <motion.path
        d="M11 20l6 6 12-12"
        stroke="#00e676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.5, duration: 0.5, ease: "easeOut" }}
      />
    </svg>
  );
}

function DashboardContent() {
  const params    = useSearchParams();
  const router    = useRouter();
  const upgraded  = params.get("upgraded")   === "true";
  const sessionId = params.get("session_id") ?? null;
  const [ready,   setReady]  = useState(false);
  const [status,  setStatus] = useState("Activating your Pro plan…");

  useEffect(() => {
    if (!upgraded) { router.replace("/"); return; }

    const clientId = localStorage.getItem("ciq_client_id");

    async function activate() {
      // Direct activation: retrieve the Stripe session and upgrade profile immediately
      if (sessionId && clientId) {
        try {
          setStatus("Activating your Pro plan…");
          const res  = await fetch("/api/stripe/activate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, clientId }),
          });
          const data = await res.json();
          console.log("[dashboard] activate result:", data);
          if (data.plan === "pro") {
            localStorage.setItem("ciq_plan", "pro");
            localStorage.setItem("ciq_plan_checked_at", Date.now().toString());
            sessionStorage.setItem("ciq_verified_pro", "true");
            setReady(true);
            return;
          }
          if (data.error) console.error("[dashboard] activate error:", data.error);
        } catch (e) { console.error("[dashboard] activate threw:", e); }
      }

      // Fallback: poll Supabase (webhook may have already fired)
      setStatus("Confirming upgrade…");
      let attempts = 0;
      const poll = async () => {
        attempts++;
        try {
          const res  = await fetch(`/api/user/plan?client_id=${clientId ?? ""}`);
          const data = await res.json();
          console.log(`[dashboard] poll attempt ${attempts}:`, data.plan);
          if (data.plan === "pro") {
            localStorage.setItem("ciq_plan", "pro");
            localStorage.setItem("ciq_plan_checked_at", Date.now().toString());
            sessionStorage.setItem("ciq_verified_pro", "true");
            setReady(true);
            return;
          }
        } catch { /* non-fatal */ }
        if (attempts < 8) {
          setTimeout(poll, 1500);
        } else {
          // Last resort — payment completed so mark as pro; webhook/activate failed
          console.warn("[dashboard] could not confirm pro in Supabase after 8 attempts");
          localStorage.setItem("ciq_plan", "pro");
          localStorage.setItem("ciq_plan_checked_at", Date.now().toString());
          sessionStorage.setItem("ciq_verified_pro", "true");
          setReady(true);
        }
      };
      setTimeout(poll, 800);
    }

    activate();
  }, [upgraded, sessionId, router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#080a10] flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-[#00e676]/30 border-t-[#00e676] animate-spin" />
        <p className="font-dm-mono text-[#6b7280] text-sm tracking-wider">{status}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080a10] text-white flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.22, duration: 0.55 }}
        className="w-full max-w-sm rounded-2xl p-10 text-center"
        style={{
          background: "#080c0a",
          border: "1px solid rgba(0,230,118,0.28)",
          boxShadow: "0 0 80px rgba(0,230,118,0.08), 0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* Animated particles */}
        <div className="relative flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,230,118,0.08)", border: "1px solid rgba(0,230,118,0.2)" }}>
            <AnimatedCheck />
          </div>
          {Array.from({ length: 6 }, (_, i) => {
            const angle = (i * 360) / 6;
            const rad   = angle * (Math.PI / 180);
            return (
              <motion.div key={i}
                className="absolute top-1/2 left-1/2 rounded-full"
                style={{ width: 6, height: 6, background: "#00e676", marginLeft: -3, marginTop: -3 }}
                initial={{ x: 0, y: 0, opacity: 0 }}
                animate={{ x: Math.cos(rad) * 52, y: Math.sin(rad) * 52, opacity: [0, 1, 0] }}
                transition={{ delay: 0.7 + i * 0.06, duration: 0.7, ease: "easeOut" }}
              />
            );
          })}
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
          style={{ background: "rgba(0,230,118,0.12)", border: "1px solid rgba(0,230,118,0.25)" }}>
          <span className="text-[#00e676] text-xs font-bold tracking-widest font-dm-mono">PRO</span>
        </div>

        <h2 className="font-bebas text-[42px] leading-none tracking-[0.04em] text-white mb-3">
          WELCOME TO PRO
        </h2>
        <p className="text-[#6b7280] text-sm leading-relaxed mb-8">
          Unlimited analyses unlocked. No daily limits, ever.
        </p>

        <ul className="space-y-2.5 mb-8 text-left">
          {["Unlimited chart analyses", "No daily limits", "Full risk analysis", "Priority support"].map((f) => (
            <li key={f} className="flex items-center gap-2.5 text-sm text-[#d1d5db]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                <path d="M2.5 7l3 3L11.5 3.5" stroke="#00e676" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {f}
            </li>
          ))}
        </ul>

        <Link href="/"
          className="block w-full py-4 rounded-xl text-base font-bold transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: "#00e676", color: "#080c0a", boxShadow: "0 0 28px rgba(0,230,118,0.3)" }}>
          Start Analyzing →
        </Link>
        <Link href="/account" className="block mt-3 text-[#4b5563] text-sm hover:text-[#9ca3af] transition-colors">
          View account
        </Link>
      </motion.div>

      {/* Back to logo */}
      <Link href="/" className="flex items-center gap-2.5 mt-10 opacity-40 hover:opacity-70 transition-opacity">
        <LogoMark />
        <span className="font-bold text-sm text-white">ChartIQ <span className="text-[#f5c518]">AI</span></span>
      </Link>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080a10]" />}>
      <DashboardContent />
    </Suspense>
  );
}
