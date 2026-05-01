"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
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

// ── API Keys Section ──────────────────────────────────────────
function APIKeysSection({ clientId, userId }: { clientId: string | null; userId?: string | null }) {
  const [keys, setKeys]         = useState<{ id: string; created_at: string; last_used: string | null }[]>([]);
  const [newKey, setNewKey]     = useState<string | null>(null);
  const [generating, setGen]    = useState(false);
  const [newKeyCopied, setNKC]  = useState(false);
  const { isPro } = useUserPlan();

  useEffect(() => {
    if (!clientId) return;
    const id = userId ?? clientId;
    fetch(`/api/apikeys?${userId ? "userId" : "clientId"}=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => setKeys(d.keys ?? []));
  }, [clientId, userId]);

  async function generate() {
    if (!clientId) return;
    setGen(true);
    const res  = await fetch("/api/apikeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, userId }),
    });
    const data = await res.json();
    if (data.key) {
      setNewKey(data.key);
      // Reload list
      const id = userId ?? clientId;
      fetch(`/api/apikeys?${userId ? "userId" : "clientId"}=${encodeURIComponent(id)}`)
        .then((r) => r.json()).then((d) => setKeys(d.keys ?? []));
    }
    setGen(false);
  }

  async function revoke(id: string) {
    await fetch("/api/apikeys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }

  if (!isPro) {
    return (
      <div id="apikeys" className="rounded-2xl p-6 border border-white/[0.07] bg-[#0c0f18]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[#6b7280] text-[10px] uppercase tracking-[0.12em] font-semibold">API Keys</p>
          <span className="font-dm-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }}>
            PRO
          </span>
        </div>
        <p className="text-[#4b5563] text-sm">Upgrade to Pro to generate API keys for the MetaTrader EA.</p>
      </div>
    );
  }

  return (
    <div id="apikeys" className="rounded-2xl p-6 border border-white/[0.07] bg-[#0c0f18]">
      <p className="text-[#6b7280] text-[10px] uppercase tracking-[0.12em] font-semibold mb-1">API Keys</p>
      <p className="text-[#4b5563] text-xs mb-4">Used to authenticate the MetaTrader EA and TradingView webhooks.</p>

      {/* New key banner */}
      {newKey && (
        <div className="rounded-xl p-4 mb-4 border"
          style={{ background: "rgba(0,230,118,0.06)", borderColor: "rgba(0,230,118,0.25)" }}>
          <p className="text-[#00e676] text-xs font-semibold mb-2">Your new API key — copy it now, it won&apos;t be shown again</p>
          <div className="flex gap-2">
            <code className="flex-1 font-dm-mono text-[11px] text-[#00e676] px-3 py-2 rounded-lg truncate"
              style={{ background: "rgba(0,230,118,0.08)", border: "1px solid rgba(0,230,118,0.15)" }}>
              {newKey}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(newKey); setNKC(true); setTimeout(() => setNKC(false), 2000); }}
              className="px-3 py-2 rounded-lg text-xs font-bold flex-shrink-0 transition-all"
              style={newKeyCopied ? { background: "rgba(0,230,118,0.15)", color: "#00e676", border: "1px solid rgba(0,230,118,0.3)" } : { background: "#00e676", color: "#080a10" }}>
              {newKeyCopied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-[#4b5563] text-[10px] mt-2">The key starts with ciq_ and is 36 characters total.</p>
        </div>
      )}

      {/* Key list */}
      {keys.length > 0 && (
        <div className="space-y-2 mb-4">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <div>
                <p className="font-dm-mono text-[11px] text-[#9ca3af]">ciq_••••••••••••••••••••••••••••••</p>
                <p className="font-dm-mono text-[9px] text-[#4b5563] mt-0.5">
                  Created {new Date(k.created_at).toLocaleDateString()}
                  {k.last_used ? ` · Last used ${new Date(k.last_used).toLocaleDateString()}` : ""}
                </p>
              </div>
              <button onClick={() => revoke(k.id)}
                className="text-[#4b5563] hover:text-[#f87171] transition-colors text-xs font-semibold">
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      <button onClick={generate} disabled={generating}
        className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
        style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }}>
        {generating ? "Generating…" : keys.length > 0 ? "Generate New Key" : "Generate API Key"}
      </button>
    </div>
  );
}

// ── Automation Section ─────────────────────────────────────────
function AutomationSection({ clientId }: { clientId: string | null }) {
  const { isElite } = useUserPlan();
  const [settings, setSettings] = useState({
    enabled:       false,
    min_confidence: 85,
    max_position:  "100",
    daily_limit:   3,
    sessions:      ["london", "ny"],
    pairs:         "XAUUSD, EURUSD, GBPUSD",
  });
  const [disclaimer, setDisclaimer] = useState(false);
  const [accepted, setAccepted]     = useState(false);
  const [stopConfirm, setStopConfirm] = useState(false);
  const [stopInput, setStopInput]   = useState("");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);

  const sessionOptions = [
    { key: "asian",  label: "Asian" },
    { key: "london", label: "London" },
    { key: "ny",     label: "New York" },
  ];

  function toggleSession(s: string) {
    setSettings((prev) => ({
      ...prev,
      sessions: prev.sessions.includes(s) ? prev.sessions.filter((x) => x !== s) : [...prev.sessions, s],
    }));
  }

  async function handleSave() {
    if (!clientId) return;
    setSaving(true);
    await fetch("/api/automation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: clientId, ...settings }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleKillSwitch() {
    if (stopInput !== "STOP") return;
    setSettings((prev) => ({ ...prev, enabled: false }));
    await handleSave();
    setStopConfirm(false);
    setStopInput("");
  }

  if (!isElite) {
    return (
      <div className="rounded-2xl p-6 border border-white/[0.07] bg-[#0c0f18]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[#6b7280] text-[10px] uppercase tracking-[0.12em] font-semibold">Automation</p>
          <span className="font-dm-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}>
            ELITE
          </span>
        </div>
        <p className="text-[#4b5563] text-sm mb-3">Full automated signal system — configure auto-trading for your MT4/MT5 EA.</p>
        <Link href="/pricing"
          className="block w-full py-2.5 rounded-xl text-sm font-bold text-center transition-all hover:-translate-y-0.5"
          style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.25)" }}>
          Upgrade to Elite →
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Disclaimer modal */}
      {disclaimer && !accepted && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4"
          style={{ background: "rgba(4,6,10,0.94)", backdropFilter: "blur(16px)" }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: "#080c0a", border: "1px solid rgba(251,191,36,0.3)", boxShadow: "0 0 60px rgba(251,191,36,0.07)" }}>
            <div className="px-6 py-5">
              <div className="flex items-center gap-2 mb-4">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 2L1.5 15.5h15L9 2z" stroke="#fbbf24" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M9 7v4M9 13.5v.5" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <p className="font-bold text-[#fbbf24] text-sm uppercase tracking-[0.1em]">Automated Trading Risk Warning</p>
              </div>
              <div className="text-sm text-[#9ca3af] leading-relaxed space-y-3 mb-5">
                <p>Automated trading involves significant financial risk and may result in substantial losses.</p>
                <p>ChartIQ AI signals are for informational purposes only and do not constitute financial advice.</p>
                <p className="font-semibold text-white">By enabling automated trading you confirm:</p>
                <ul className="space-y-1.5 ml-2">
                  {[
                    "You understand the risks involved",
                    "You are solely responsible for all trades placed",
                    "You will never automate more than you can afford to lose completely",
                    "You will monitor your automated trades regularly",
                  ].map((s) => <li key={s} className="flex items-start gap-2 text-[#6b7280]"><span className="text-[#fbbf24] mt-0.5">·</span>{s}</li>)}
                </ul>
                <p className="text-[#4b5563] text-xs">ChartIQ accepts no liability for any losses incurred through automated trading. Past performance does not guarantee future results.</p>
              </div>
              <label className="flex items-start gap-3 mb-5 cursor-pointer">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 accent-[#fbbf24]" />
                <span className="text-sm text-[#9ca3af]">I understand and accept these risks</span>
              </label>
              <div className="flex gap-3">
                <button onClick={() => setDisclaimer(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-white/[0.1] text-[#6b7280] hover:text-white transition-colors">
                  Cancel
                </button>
                <button onClick={() => { if (accepted) setDisclaimer(false); }}
                  disabled={!accepted}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                  style={{ background: "#fbbf24", color: "#080a10" }}>
                  Enable Automation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kill switch modal */}
      {stopConfirm && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4"
          style={{ background: "rgba(4,6,10,0.9)", backdropFilter: "blur(16px)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "#080c0a", border: "1px solid rgba(239,68,68,0.3)" }}>
            <p className="font-bold text-[#f87171] mb-2">Stop All Automated Trading</p>
            <p className="text-[#6b7280] text-sm mb-4">Type <strong className="text-white">STOP</strong> to confirm. All pending EA orders will still execute — cancel them manually in MT.</p>
            <input value={stopInput} onChange={(e) => setStopInput(e.target.value)}
              placeholder="Type STOP"
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.09] text-white text-sm font-dm-mono mb-4 outline-none focus:border-[#f87171]/40"
            />
            <div className="flex gap-3">
              <button onClick={() => { setStopConfirm(false); setStopInput(""); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-white/[0.1] text-[#6b7280]">
                Cancel
              </button>
              <button onClick={handleKillSwitch} disabled={stopInput !== "STOP"}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 transition-all"
                style={{ background: "#f87171", color: "white" }}>
                STOP Trading
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl p-6 border border-white/[0.07] bg-[#0c0f18]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[#6b7280] text-[10px] uppercase tracking-[0.12em] font-semibold">Automation Settings</p>
          <span className="font-dm-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}>
            ELITE
          </span>
        </div>

        {/* Master toggle */}
        <div className="flex items-center justify-between py-3 border-b border-white/[0.05] mb-4">
          <div>
            <p className="text-sm font-semibold text-white">Enable automated trading</p>
            <p className="text-[#4b5563] text-xs">MT EA will place trades automatically</p>
          </div>
          <button
            onClick={() => {
              if (!settings.enabled && !accepted) { setDisclaimer(true); return; }
              setSettings((p) => ({ ...p, enabled: !p.enabled }));
            }}
            className={`relative w-12 h-6 rounded-full transition-all duration-200 ${settings.enabled ? "bg-[#a78bfa]" : "bg-white/[0.1]"}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${settings.enabled ? "left-7" : "left-1"}`} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Min confidence */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-[#9ca3af]">Min confidence</label>
              <span className="font-dm-mono text-[#a78bfa] text-sm font-semibold">{settings.min_confidence}%</span>
            </div>
            <input type="range" min={75} max={95} value={settings.min_confidence}
              onChange={(e) => setSettings((p) => ({ ...p, min_confidence: parseInt(e.target.value) }))}
              className="w-full accent-[#a78bfa]" />
            <div className="flex justify-between font-dm-mono text-[10px] text-[#4b5563] mt-1">
              <span>75%</span><span>95%</span>
            </div>
          </div>

          {/* Max position */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm text-[#9ca3af] block mb-1.5">Max position size (£/$)</label>
              <input type="number" value={settings.max_position}
                onChange={(e) => setSettings((p) => ({ ...p, max_position: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm font-dm-mono outline-none focus:border-[#a78bfa]/30" />
            </div>
            <div className="flex-1">
              <label className="text-sm text-[#9ca3af] block mb-1.5">Daily trade limit</label>
              <div className="flex gap-1">
                {[1,2,3,5,10].map((n) => (
                  <button key={n} onClick={() => setSettings((p) => ({ ...p, daily_limit: n }))}
                    className="flex-1 py-2 rounded-lg text-xs font-bold font-dm-mono transition-all"
                    style={settings.daily_limit === n ? { background: "#a78bfa", color: "white" } : { background: "rgba(255,255,255,0.04)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.07)" }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Allowed pairs */}
          <div>
            <label className="text-sm text-[#9ca3af] block mb-1.5">Allowed pairs (comma separated)</label>
            <input type="text" value={settings.pairs}
              onChange={(e) => setSettings((p) => ({ ...p, pairs: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm font-dm-mono outline-none focus:border-[#a78bfa]/30" />
          </div>

          {/* Sessions */}
          <div>
            <label className="text-sm text-[#9ca3af] block mb-2">Trading sessions</label>
            <div className="flex gap-2">
              {sessionOptions.map((s) => (
                <button key={s.key}
                  onClick={() => toggleSession(s.key)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                  style={settings.sessions.includes(s.key)
                    ? { background: "#a78bfa", color: "white" }
                    : { background: "rgba(255,255,255,0.04)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.07)" }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Save */}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
            style={saved ? { background: "rgba(0,230,118,0.12)", color: "#00e676", border: "1px solid rgba(0,230,118,0.3)" } : { background: "#a78bfa", color: "white" }}>
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save Settings"}
          </button>

          {/* Kill switch */}
          <button onClick={() => setStopConfirm(true)}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all border"
            style={{ borderColor: "rgba(239,68,68,0.3)", color: "#f87171", background: "rgba(239,68,68,0.06)" }}>
            ⚠ Kill Switch — Stop All Automated Trading
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main Account Page ─────────────────────────────────────────
export default function Account() {
  const { plan, isPro, email, totalAnalyses } = useUserPlan();
  const [clientId, setClientId]               = useState<string | null>(null);
  const [portalLoading, setPortalLoading]     = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [annual, setAnnual]                   = useState(false);
  const [copied, setCopied]                   = useState(false);

  useEffect(() => {
    let id = localStorage.getItem("ciq_client_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("ciq_client_id", id);
    }
    setClientId(id);
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
        body: JSON.stringify({ clientId, annual }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { alert("Something went wrong"); }
    setCheckoutLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      {/* Nav */}
      <AppNav />

      <main className="pt-32 pb-24 px-6">
        <div className="max-w-lg mx-auto">

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00e676]/30 bg-[#00e676]/10 text-[#00e676] text-xs font-semibold tracking-[0.13em] uppercase mb-4">
              Account
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Your Plan</h1>
            <p className="text-[#6b7280] text-sm mt-1">
              {email ?? "No email on file"}
            </p>
          </div>

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
                      {plan === "elite" ? "Elite" : isPro ? "Pro" : "Free"}
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
                    {plan === "elite" ? "£39/mo" : isPro ? "£19/mo" : "Free"}
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
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => setAnnual(false)}
                      className="flex-1 py-2 rounded-lg font-dm-mono text-xs font-bold transition-all"
                      style={!annual ? { background: "#00e676", color: "#080a10" } : { background: "rgba(255,255,255,0.05)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.09)" }}>
                      Monthly · £19/mo
                    </button>
                    <button onClick={() => setAnnual(true)}
                      className="flex-1 py-2 rounded-lg font-dm-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                      style={annual ? { background: "#00e676", color: "#080a10" } : { background: "rgba(255,255,255,0.05)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.09)" }}>
                      Annual · £149/yr
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                        style={{ background: annual ? "rgba(8,10,16,0.25)" : "rgba(0,230,118,0.15)", color: annual ? "#080a10" : "#00e676" }}>
                        SAVE 35%
                      </span>
                    </button>
                  </div>
                  {annual && (
                    <p className="font-dm-mono text-[10px] text-[#9ca3af] text-center mb-3">
                      Launch price — increases to £249/yr on 1st June 2026
                    </p>
                  )}
                  <button
                    onClick={handleUpgrade}
                    disabled={checkoutLoading}
                    className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
                    style={{ background: "#00e676", color: "#080c0a", boxShadow: "0 0 22px rgba(0,230,118,0.3)" }}
                  >
                    {checkoutLoading ? "Redirecting…" : annual ? "Upgrade to Pro — £149/yr" : "Upgrade to Pro — £19/mo"}
                  </button>
                </>
              )}
            </div>

            {/* Stats card */}
            <div className="rounded-2xl p-6 border border-white/[0.07] bg-[#0c0f18]">
              <p className="text-[#6b7280] text-[10px] uppercase tracking-[0.12em] font-semibold mb-4">
                Usage Stats
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                  <p className="text-[28px] font-extrabold text-[#00e676] leading-none mb-1">
                    {totalAnalyses}
                  </p>
                  <p className="text-[#6b7280] text-xs">Total Analyses</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                  <p className="text-[28px] font-extrabold leading-none mb-1" style={{ color: "#00e676" }}>
                    {isPro ? "∞" : "3"}
                  </p>
                  <p className="text-[#6b7280] text-xs">Daily Limit</p>
                </div>
              </div>
            </div>

            {/* Pro features teaser */}
            {!isPro && (
              <div className="rounded-2xl p-6 border border-[#00e676]/20 bg-[#00e676]/[0.04]">
                <p className="text-[#00e676] text-[10px] uppercase tracking-[0.12em] font-semibold mb-3">
                  Pro includes
                </p>
                <ul className="space-y-2">
                  {[
                    "Unlimited chart analyses",
                    "SMC overlay, Pine Script export, MT trade helper",
                    "Alpaca & Binance direct trading",
                    "TradingView webhook integration",
                    "Full risk & reward analysis",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[#d1d5db]">
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="flex-shrink-0">
                        <path d="M2 6.5l3 3L11 2.5" stroke="#00e676" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* API Keys */}
            <APIKeysSection clientId={clientId} />

            {/* Automation */}
            <AutomationSection clientId={clientId} />

            {/* Referral card */}
            <div className="rounded-2xl p-6 border border-white/[0.07] bg-[#0c0f18]">
              <p className="text-[#6b7280] text-[10px] uppercase tracking-[0.12em] font-semibold mb-3">
                Refer a friend · Earn free analyses
              </p>
              <p className="text-white text-sm font-semibold mb-1">Share ChartIQ and earn free analyses</p>
              <p className="text-[#6b7280] text-xs mb-4 leading-relaxed">
                When someone signs up via your link, both of you get 7 bonus analyses.
              </p>
              {clientId ? (
                <div className="flex gap-2">
                  <div className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] font-dm-mono text-[11px] text-[#6b7280] truncate">
                    {typeof window !== "undefined" ? `${window.location.origin}/?ref=${clientId.slice(0, 8)}` : `chartiq.ai/?ref=${clientId.slice(0, 8)}`}
                  </div>
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/?ref=${clientId.slice(0, 8)}`;
                      navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 flex-shrink-0"
                    style={{ background: copied ? "rgba(0,230,118,0.15)" : "#00e676", color: copied ? "#00e676" : "#080a10", border: copied ? "1px solid rgba(0,230,118,0.3)" : "none" }}>
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              ) : (
                <div className="h-10 skeleton rounded-xl" />
              )}
            </div>

            <div className="text-center pt-2">
              <Link href="/" className="text-[#4b5563] text-sm hover:text-[#9ca3af] transition-colors">
                ← Back to analyzer
              </Link>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
