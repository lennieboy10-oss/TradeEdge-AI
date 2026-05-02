"use client";

import Link from "next/link";

interface ProLockedPageProps {
  icon: React.ReactNode;
  heading: string;
  subtext: string;
  features: string[];
  ctaLabel: string;
  clientId?: string | null;
}

export function ProLockedPage({ icon, heading, subtext, features, ctaLabel, clientId }: ProLockedPageProps) {
  function handleUpgrade() {
    if (!clientId) { window.location.href = "/signup"; return; }
    fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, plan: "pro" }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.url) window.location.href = d.url; });
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] px-6 py-20 text-center">
      {/* Lock halo */}
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ background: "rgba(0,230,118,0.06)", border: "1px solid rgba(0,230,118,0.2)" }}>
        {icon}
      </div>

      {/* Pro badge */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#00e676]/30 bg-[#00e676]/10 text-[#00e676] text-[10px] font-bold tracking-widest uppercase mb-4">
        PRO ONLY
      </div>

      <h2 className="font-bebas text-[52px] md:text-[64px] leading-none tracking-[0.04em] text-white mb-4">
        {heading}
      </h2>
      <p className="text-[#6b7280] text-base max-w-md leading-relaxed mb-8">
        {subtext}
      </p>

      {/* Feature list */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0c0f18] p-6 max-w-sm w-full text-left mb-6">
        <ul className="space-y-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2.5 text-sm text-[#d1d5db]">
              <span className="text-[#00e676] flex-shrink-0">✅</span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Social proof */}
      <p className="font-dm-mono text-[11px] text-[#4b5563] mb-5">
        2,400+ Pro traders are tracking their edge right now
      </p>

      {/* CTA */}
      <button
        onClick={handleUpgrade}
        className="px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 mb-3"
        style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 22px rgba(0,230,118,0.35)" }}>
        {ctaLabel}
      </button>
      <Link href="/" className="text-[#4b5563] text-xs hover:text-[#9ca3af] transition-colors">
        ← Back to analyzer
      </Link>
    </div>
  );
}
