"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useUserPlan } from "@/app/lib/plan-context";
import AppNav from "@/app/components/AppNav";

// ── Static data ────────────────────────────────────────────────

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
  { n: 1, label: "Trend alignment",     desc: "EMA 20/50/200 stacked in trend direction" },
  { n: 2, label: "RSI momentum",        desc: "RSI above 50 (bull) or below 50 (bear), not overbought/oversold" },
  { n: 3, label: "Volume confirmation", desc: "Volume above 20-bar average by at least 20%" },
  { n: 4, label: "FVG or Order Block",  desc: "Price inside a Fair Value Gap or sitting on an Order Block" },
  { n: 5, label: "Liquidity sweep",     desc: "Recent sweep of equal highs/lows before reversal" },
  { n: 6, label: "Break of Structure",  desc: "Market structure broken in signal direction" },
];

const settingsRows = [
  { asset: "XAU/USD", tf: "1H",  minC: "4", atr: "1.5", session: "London / NY" },
  { asset: "XAU/USD", tf: "4H",  minC: "3", atr: "2.0", session: "Any" },
  { asset: "BTC/USD", tf: "1H",  minC: "4", atr: "2.0", session: "NY" },
  { asset: "EUR/USD", tf: "15m", minC: "4", atr: "1.2", session: "London" },
  { asset: "NAS100",  tf: "5m",  minC: "5", atr: "1.0", session: "NY Open" },
  { asset: "SPX500",  tf: "1H",  minC: "3", atr: "1.5", session: "NY" },
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

const CHECKLIST_ITEMS = [
  { id: "req_sent",  label: "Requested TradingView access" },
  { id: "acc_grant", label: "Access granted by ChartIQ team" },
  { id: "open_tv",   label: "Opened TradingView" },
  { id: "inv_tab",   label: "Found Invite-only scripts tab" },
  { id: "added",     label: "Added ChartIQ AI Signal System" },
  { id: "signals",   label: "Seeing BUY/SELL labels on chart ✅" },
  { id: "dash",      label: "Dashboard showing top right ✅" },
  { id: "conf4",     label: "Set Min Confluence to 4" },
  { id: "session",   label: "Enabled Session Filter" },
];

const TROUBLESHOOT = [
  {
    q: "I can't find the Invite-only scripts tab",
    a: "In TradingView, click Indicators at the top of the chart. You'll see tabs: All, My Scripts, Favorites, and Invite-only scripts. Scroll the tab bar right if you don't see it immediately.",
  },
  {
    q: "The indicator doesn't appear in Invite-only scripts",
    a: "Access can take a few minutes to propagate on TradingView. Wait 5 minutes and try refreshing TradingView. If it still doesn't appear after 30 minutes, email support@chartiq.app with your TradingView username.",
  },
  {
    q: "I can't see any signals on my chart",
    a: "Check these settings:\n1. Make sure Show Signals is ON in indicator settings\n2. Lower the Min Confluence to 3\n3. Turn OFF the Session Filter\n4. Make sure you are on a supported timeframe (1m, 5m, 15m, 1H, 4H, Daily)\n5. Try XAU/USD 1H — best timeframe to test",
  },
  {
    q: "I entered the wrong TradingView username",
    a: "Use the 'Change username' link on the pending status card above. We'll update your request and grant access to the correct username.",
  },
  {
    q: "The indicator disappeared from my chart",
    a: "This happens when TradingView reloads. To make it permanent:\n1. Save your chart layout in TradingView\n2. Click the cloud save icon at the top\n3. The indicator will now load automatically every time",
  },
  {
    q: "Does this repaint?",
    a: "No. The ChartIQ indicator uses confirmed candle closes for all signals. Signals only appear after a candle closes — never on live/unconfirmed candles. This means no repainting.",
  },
  {
    q: "What is the best timeframe?",
    a: "XAU/USD: 1H or 4H\nBTC/USD: 1H\nEUR/USD: 15m or 1H\nNQ/ES futures: 5m or 15m\nStocks: 1H or Daily\n\nAlways check higher timeframe bias first before entering on lower timeframe signals.",
  },
  {
    q: "How do I set up TradingView alerts?",
    a: "1. Right click your chart\n2. Click Add Alert\n3. Condition: ChartIQ BUY Signal (or SELL Signal)\n4. Notifications: Email and/or App\n5. Webhook URL (optional): paste your ChartIQ webhook URL\n6. Click Create",
  },
];

// ── Small shared components ────────────────────────────────────

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

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl p-3.5 text-sm"
      style={{ background: "rgba(0,230,118,0.06)", border: "1px solid rgba(0,230,118,0.18)" }}>
      <span className="flex-shrink-0">💡</span>
      <p className="text-[#9ca3af] leading-relaxed">{children}</p>
    </div>
  );
}

function WarnBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-xl p-3.5 text-sm"
      style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)" }}>
      <span className="flex-shrink-0">⚠️</span>
      <p className="text-[#9ca3af] leading-relaxed">{children}</p>
    </div>
  );
}

// ── Step indicator ─────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Request access" },
    { n: 2, label: "We grant access" },
    { n: 3, label: "Add to TradingView" },
  ];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
              style={
                s.n < step
                  ? { background: "#00e676", color: "#080a10" }
                  : s.n === step
                  ? { background: "rgba(0,230,118,0.15)", color: "#00e676", border: "2px solid #00e676" }
                  : { background: "rgba(255,255,255,0.05)", color: "#4b5563", border: "1px solid rgba(255,255,255,0.1)" }
              }>
              {s.n < step ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l2.5 2.5L10 2.5" stroke="#080a10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : s.n}
            </div>
            <p className="text-[10px] mt-1.5 font-dm-mono whitespace-nowrap"
              style={{ color: s.n === step ? "#00e676" : s.n < step ? "#6b7280" : "#374151" }}>
              {s.label}
            </p>
          </div>
          {i < steps.length - 1 && (
            <div className="flex-1 h-px mx-2 mb-5 transition-all"
              style={{ background: s.n < step ? "#00e676" : "rgba(255,255,255,0.07)" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Access section ─────────────────────────────────────────────

type AccessStatus = null | "none" | "pending" | "approved" | "revoked";

function AccessSection({ clientId, userEmail }: { clientId: string; userEmail: string | null }) {
  const [status,      setStatus]      = useState<AccessStatus>(null);
  const [tvUsername,  setTvUsername]  = useState("");
  const [savedUser,   setSavedUser]   = useState("");
  const [requestedAt, setRequestedAt] = useState("");
  const [approvedAt,  setApprovedAt]  = useState("");
  const [input,       setInput]       = useState("");
  const [changing,    setChanging]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState("");
  const [count,       setCount]       = useState<number | null>(null);

  const loadStatus = useCallback(async () => {
    if (!clientId) return;
    const res  = await fetch(`/api/tv-access/status?client_id=${clientId}`);
    const data = await res.json();
    if (data.status) {
      setStatus(data.status);
      setSavedUser(data.tradingview_username ?? "");
      setRequestedAt(data.requested_at ?? "");
      setApprovedAt(data.approved_at ?? "");
    } else {
      setStatus("none");
    }
  }, [clientId]);

  // Poll while pending
  useEffect(() => {
    loadStatus();
    const id = setInterval(() => {
      if (status === "pending") loadStatus();
    }, 60000);
    return () => clearInterval(id);
  }, [loadStatus, status]);

  // Fetch social proof count
  useEffect(() => {
    fetch("/api/tv-access/status", { method: "HEAD" })
      .then((r) => setCount(parseInt(r.headers.get("x-count") ?? "0", 10)))
      .catch(() => {});
  }, []);

  async function submit(username: string) {
    if (!username.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res  = await fetch("/api/tv-access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, tvUsername: username.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("pending");
        setSavedUser(username.trim());
        setRequestedAt(new Date().toISOString());
        setChanging(false);
      } else {
        setError(data.error ?? "Something went wrong");
      }
    } catch { setError("Something went wrong"); }
    setSubmitting(false);
  }

  function timeAgo(iso: string) {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return "just now";
    if (m < 60) return `${m} minutes ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hours ago`;
    return `${Math.floor(h / 24)} days ago`;
  }

  if (status === null) {
    return <div className="h-48 rounded-2xl animate-pulse" style={{ background: "#0c0f18" }} />;
  }

  const currentStep: 1 | 2 | 3 = status === "none" ? 1 : status === "pending" ? 2 : 3;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
      className="rounded-2xl p-7 mb-8"
      style={{ background: "#0d1310", border: "1.5px solid rgba(0,230,118,0.28)", boxShadow: "0 0 60px rgba(0,230,118,0.05)" }}>

      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <EliteBadge />
        <span className="font-dm-mono text-[10px] tracking-[0.2em] uppercase text-[#FFD700] font-bold">Exclusive Access</span>
      </div>
      <h2 className="font-bebas text-3xl tracking-[0.05em] text-white mb-1">GET ACCESS TO THE INDICATOR</h2>
      <p className="text-[#6b7280] text-sm mb-6 leading-relaxed">
        Enter your TradingView username and we will grant you access within 2 hours.{" "}
        <span className="text-[#4b5563]">No downloading or code copying needed.</span>
      </p>

      <StepIndicator step={currentStep} />

      {/* ── STATE: none — submission form ── */}
      {status === "none" && (
        <div>
          <label className="block font-dm-mono text-[11px] tracking-[0.18em] uppercase text-[#6b7280] mb-2">
            Your TradingView Username
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={tvUsername}
              onChange={(e) => setTvUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit(tvUsername)}
              placeholder="e.g. JamesTrader92"
              className="flex-1 px-4 py-3 rounded-xl text-white placeholder-[#374151] outline-none text-sm font-dm-mono transition-all"
              style={{ background: "rgba(0,0,0,0.4)", border: "1.5px solid rgba(255,255,255,0.1)" }}
            />
            <button
              onClick={() => submit(tvUsername)}
              disabled={submitting || !tvUsername.trim()}
              className="px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all hover:-translate-y-0.5 disabled:opacity-40"
              style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 22px rgba(0,230,118,0.3)" }}>
              {submitting ? "Sending…" : "Request Access →"}
            </button>
          </div>
          <p className="text-xs text-[#4b5563] mt-2 font-dm-mono">
            Find your username at tradingview.com/u/[your-username]
          </p>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          <TipBox>
            <strong>How to find your TradingView username:</strong><br />
            1. Go to tradingview.com · 2. Click your profile picture (top right) · 3. Click Profile<br />
            4. Your username is in the URL: tradingview.com/u/<strong>[USERNAME]</strong>
          </TipBox>
          {count !== null && count > 0 && (
            <p className="text-xs text-[#4b5563] mt-4 text-center">
              🔒 Access is exclusive to Elite members · Currently granting access to <span className="text-[#6b7280]">{count} Elite traders</span>
            </p>
          )}
        </div>
      )}

      {/* ── STATE: pending ── */}
      {status === "pending" && !changing && (
        <div>
          <div className="rounded-xl p-5 mb-4"
            style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">⏳</span>
              <div className="flex-1">
                <p className="font-bold text-white mb-1">Access request pending</p>
                <p className="text-sm text-[#9ca3af]">Submitted {timeAgo(requestedAt)}</p>
                <p className="text-sm text-[#9ca3af] mt-1">
                  TradingView username: <span className="font-dm-mono text-[#00e676]">{savedUser}</span>
                </p>
                <p className="text-xs text-[#6b7280] mt-2">We will grant access within 2 hours.</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-4 mb-4"
            style={{ background: "#0c0f18", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-sm font-semibold text-white mb-3">What happens next:</p>
            <div className="space-y-2.5">
              {[
                { done: true,  text: "Request received" },
                { done: false, text: "We grant TradingView access (within 2 hours)" },
                { done: false, text: "You receive a TradingView notification" },
                { done: false, text: "Add indicator with one click from Invite-only scripts" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2.5 text-sm">
                  {item.done
                    ? <span className="text-[#00e676] flex-shrink-0">✅</span>
                    : <span className="text-[#4b5563] flex-shrink-0">⏳</span>}
                  <span style={{ color: item.done ? "#d1d5db" : "#6b7280" }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {userEmail && (
            <p className="text-xs text-[#4b5563] mb-3">
              You will receive an email at <span className="text-[#6b7280]">{userEmail}</span> when access is granted.
            </p>
          )}
          <button onClick={() => setChanging(true)}
            className="text-xs text-[#4b5563] hover:text-[#9ca3af] transition-colors underline underline-offset-2">
            Wrong username? Change it
          </button>
        </div>
      )}

      {/* ── STATE: changing username ── */}
      {status === "pending" && changing && (
        <div>
          <p className="text-sm text-[#9ca3af] mb-3">Enter your correct TradingView username:</p>
          <div className="flex gap-3 mb-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit(input)}
              placeholder={savedUser}
              className="flex-1 px-4 py-3 rounded-xl text-white placeholder-[#374151] outline-none text-sm font-dm-mono"
              style={{ background: "rgba(0,0,0,0.4)", border: "1.5px solid rgba(255,255,255,0.1)" }}
            />
            <button
              onClick={() => submit(input)}
              disabled={submitting || !input.trim()}
              className="px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all disabled:opacity-40"
              style={{ background: "#00e676", color: "#080a10" }}>
              {submitting ? "…" : "Update"}
            </button>
          </div>
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <button onClick={() => { setChanging(false); setInput(""); }}
            className="text-xs text-[#4b5563] hover:text-[#9ca3af] transition-colors">
            ← Cancel
          </button>
        </div>
      )}

      {/* ── STATE: approved ── */}
      {status === "approved" && (
        <div>
          <div className="rounded-xl p-5 mb-5"
            style={{ background: "rgba(0,230,118,0.06)", border: "1px solid rgba(0,230,118,0.2)" }}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-bold text-white mb-1">Access granted!</p>
                <p className="text-sm text-[#9ca3af]">
                  TradingView username: <span className="font-dm-mono text-[#00e676]">{savedUser}</span>
                </p>
                {approvedAt && <p className="text-xs text-[#4b5563] mt-1">Approved {timeAgo(approvedAt)}</p>}
              </div>
            </div>
          </div>

          <p className="text-sm font-semibold text-white mb-3">How to add the indicator to your chart:</p>
          <div className="space-y-2.5 mb-5">
            {[
              "Go to TradingView → open any chart",
              "Click Indicators at the top of the chart",
              'Click the "Invite-only scripts" tab (scroll right if needed)',
              "Find ChartIQ AI Signal System → click + to add",
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-3 text-sm text-[#d1d5db]">
                <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                  style={{ background: "rgba(0,230,118,0.15)", color: "#00e676" }}>{i + 1}</span>
                {s}
              </div>
            ))}
          </div>

          <a href="https://tradingview.com" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
            style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 22px rgba(0,230,118,0.3)" }}>
            Open TradingView now →
          </a>
        </div>
      )}

      {/* ── STATE: revoked ── */}
      {status === "revoked" && (
        <div className="rounded-xl p-5"
          style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
          <p className="font-bold text-white mb-1">Access revoked</p>
          <p className="text-sm text-[#9ca3af] mb-3">
            Your Elite subscription has ended and TradingView access has been removed.
          </p>
          <Link href="/pricing"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
            style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
            Resubscribe to restore access →
          </Link>
        </div>
      )}
    </motion.div>
  );
}

// ── Quick Start Checklist ──────────────────────────────────────

function QuickStartChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ciq_install_checklist") ?? "{}");
      setChecked(saved);
    } catch { /* ignore */ }
  }, []);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem("ciq_install_checklist", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  const doneCount = Object.values(checked).filter(Boolean).length;
  const total     = CHECKLIST_ITEMS.length;
  const pct       = Math.round((doneCount / total) * 100);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="rounded-2xl p-6 mb-8"
      style={{ background: "#0c0f18", border: "1.5px solid rgba(0,230,118,0.2)" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#00e676] mb-0.5">Quick Start</p>
          <h2 className="font-bebas text-2xl tracking-wide text-white">QUICK START CHECKLIST</h2>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold" style={{ color: pct === 100 ? "#00e676" : "white" }}>{pct}%</p>
          <p className="text-[10px] text-[#4b5563]">{doneCount}/{total} done</p>
        </div>
      </div>
      <div className="h-1.5 rounded-full mb-5" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: pct === 100 ? "#00e676" : "linear-gradient(90deg, #00e676, #00b8d4)" }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {CHECKLIST_ITEMS.map((item) => (
          <button key={item.id} onClick={() => toggle(item.id)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-white/[0.03]"
            style={{ background: checked[item.id] ? "rgba(0,230,118,0.06)" : "transparent" }}>
            <div className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center transition-all"
              style={{ background: checked[item.id] ? "#00e676" : "transparent", border: checked[item.id] ? "none" : "1.5px solid rgba(255,255,255,0.15)" }}>
              {checked[item.id] && (
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M1.5 5.5l2.5 2.5L9.5 2" stroke="#080a10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-xs font-medium" style={{ color: checked[item.id] ? "#9ca3af" : "#d1d5db", textDecoration: checked[item.id] ? "line-through" : "none" }}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
      {pct === 100
        ? <p className="text-center text-sm font-bold text-[#00e676]">🎉 Setup complete — you&apos;re ready to trade!</p>
        : <p className="text-center text-xs text-[#4b5563]">Complete all steps and you are ready to trade with the ChartIQ AI Signal System</p>
      }
    </motion.div>
  );
}

// ── Troubleshoot accordion ─────────────────────────────────────

function TroubleshootItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
        <span className="text-sm font-semibold text-white pr-4">{q}</span>
        <span className="flex-shrink-0 text-[#00e676] text-lg leading-none">{open ? "−" : "+"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="c" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="px-5 pb-4 pt-0" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-sm text-[#9ca3af] leading-relaxed whitespace-pre-line pt-3">{a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Video waitlist ─────────────────────────────────────────────

function VideoSection() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [err,     setErr]     = useState("");

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/video-waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (data.success) setDone(true);
      else setErr(data.error ?? "Something went wrong");
    } catch { setErr("Something went wrong"); }
    setLoading(false);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
      className="rounded-2xl p-8 mb-8 text-center"
      style={{ background: "#0d1310", border: "1px solid rgba(0,230,118,0.2)", borderRadius: 14 }}>
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#00e676] mb-2">Coming Soon</p>
      <h2 className="font-bebas text-3xl tracking-wide text-white mb-2">📹 VIDEO TUTORIAL</h2>
      <p className="text-[#6b7280] text-sm mb-8">Watch the full setup and strategy walkthrough</p>
      <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 cursor-default"
        style={{ background: "rgba(0,230,118,0.08)", border: "2px solid rgba(0,230,118,0.2)" }}>
        <div className="w-0 h-0 ml-2" style={{ borderTop: "16px solid transparent", borderBottom: "16px solid transparent", borderLeft: "26px solid rgba(0,230,118,0.6)" }} />
      </div>
      {done ? (
        <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold"
          style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.25)" }}>
          ✓ You&apos;re on the list — we&apos;ll email you when it&apos;s live
        </div>
      ) : (
        <form onSubmit={subscribe} className="flex flex-col sm:flex-row gap-2 max-w-sm mx-auto">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required
            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder-[#4b5563] outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
          <button type="submit" disabled={loading}
            className="px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 whitespace-nowrap transition-all hover:-translate-y-0.5"
            style={{ background: "#00e676", color: "#080a10" }}>
            {loading ? "…" : "Notify me"}
          </button>
        </form>
      )}
      {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
    </motion.div>
  );
}

// ── Locked page ────────────────────────────────────────────────

function LockedPage() {
  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <AppNav />
      <main className="pt-28 pb-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-6"><EliteBadge /></div>
          <h1 className="font-bebas text-5xl md:text-6xl tracking-wider mb-4 leading-none">CHARTIQ AI SIGNAL SYSTEM</h1>
          <p className="text-[#6b7280] mb-10 text-base leading-relaxed">
            This indicator is exclusively for Elite members. Upgrade to unlock the most advanced buy/sell indicator available to retail traders.
          </p>
          <div className="relative rounded-2xl overflow-hidden mb-10 border border-white/[0.06]" style={{ background: "#0c0f18" }}>
            <div className="blur-sm pointer-events-none select-none p-8 opacity-60">
              <div className="space-y-3">
                {features.map((f) => (
                  <div key={f} className="flex items-center gap-3 text-sm text-[#d1d5db]"><Check />{f}</div>
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
        </div>
      </main>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────

export default function EliteIndicatorPage() {
  const { isElite, email } = useUserPlan();
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    setClientId(localStorage.getItem("ciq_client_id") ?? "");
  }, []);

  if (!isElite) return <LockedPage />;

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <AppNav />

      <main className="pt-28 pb-24 px-6">
        <div className="max-w-3xl mx-auto">

          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
            <div className="mb-4"><EliteBadge /></div>
            <h1 className="font-bebas text-5xl md:text-7xl tracking-wider mb-5 leading-none">CHARTIQ AI SIGNAL SYSTEM</h1>
            <p className="text-[#9ca3af] text-base md:text-lg max-w-xl mx-auto leading-relaxed">
              The most advanced buy/sell indicator available to retail traders. Combines Smart Money
              Concepts, FVGs, order blocks, and liquidity analysis into one powerful signal system.
            </p>
          </motion.div>

          {/* ── ACCESS SECTION (replaces downloads) ── */}
          {clientId && <AccessSection clientId={clientId} userEmail={email} />}

          {/* Quick start checklist */}
          <QuickStartChecklist />

          {/* Features */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 mb-8">
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#6b7280] mb-5">Features</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {features.map((f) => (
                <div key={f} className="flex items-start gap-2.5 text-sm text-[#d1d5db]"><Check />{f}</div>
              ))}
            </div>
          </motion.div>

          {/* Confluence factors */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 mb-8">
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#6b7280] mb-2">How It Works</p>
            <h3 className="text-lg font-bold mb-1">6 Confluence Factors</h3>
            <p className="text-[#6b7280] text-sm mb-6">Signal fires only when a minimum of 3 of 6 factors align.</p>
            <div className="space-y-3">
              {confluenceFactors.map((c) => (
                <div key={c.n} className="flex items-start gap-4 p-4 rounded-xl"
                  style={{ background: "rgba(0,230,118,0.04)", border: "1px solid rgba(0,230,118,0.08)" }}>
                  <span className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                    style={{ background: "rgba(0,230,118,0.15)", color: "#00e676" }}>{c.n}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{c.label}</p>
                    <p className="text-xs text-[#6b7280] mt-0.5">{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Installation guide — invite only system */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
            className="rounded-2xl p-7 mb-8"
            style={{ background: "#0c0f18", border: "1px solid rgba(255,255,255,0.07)", borderLeft: "4px solid #00e676" }}>
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#00e676] mb-2">Installation — Invite Only</p>
            <h3 className="text-lg font-bold text-white mb-4">No code copying needed</h3>
            <div className="space-y-3">
              {[
                "Enter your TradingView username in the form above",
                "We grant you access within 2 hours",
                "Open TradingView → Indicators → Invite-only scripts",
                'Find "ChartIQ AI Signal System" and click + to add',
                "Done — signals appear on your chart instantly",
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-4">
                  <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                    style={{ background: "rgba(0,230,118,0.15)", color: "#00e676" }}>{i + 1}</span>
                  <p className="text-sm text-[#d1d5db]">{s}</p>
                </div>
              ))}
            </div>
            <WarnBox>Not seeing it in Invite-only scripts? Wait 5 minutes after approval and refresh TradingView.</WarnBox>
          </motion.div>

          {/* Settings table */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 mb-8 overflow-x-auto">
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#6b7280] mb-5">Recommended Settings by Asset</p>
            <table className="w-full text-left font-dm-mono text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,230,118,0.15)" }}>
                  {["Asset", "Timeframe", "Min Confluence", "ATR SL", "Best Session"].map((h) => (
                    <th key={h} className="pb-3 pr-4 font-bold tracking-wider" style={{ color: "#00e676" }}>{h}</th>
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
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 mb-8">
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#6b7280] mb-2">Webhook Integration</p>
            <h3 className="text-lg font-bold mb-1">Connect to ChartIQ for Full Automation</h3>
            <p className="text-[#6b7280] text-sm mb-6">When the indicator fires, TradingView sends a webhook to ChartIQ for automated trade execution.</p>
            <div className="space-y-3 mb-6">
              {webhookSteps.map((s) => (
                <div key={s.step} className="flex items-start gap-4">
                  <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                    style={{ background: "rgba(0,230,118,0.12)", color: "#00e676" }}>{s.step}</span>
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
                style={{ background: "rgba(0,230,118,0.03)" }}>{webhookJson}</pre>
            </div>
          </motion.div>

          {/* Video tutorial */}
          <VideoSection />

          {/* Troubleshooting */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }} className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
              <h2 className="font-bebas text-3xl tracking-[0.06em] text-white">TROUBLESHOOTING</h2>
              <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
            </div>
            <div className="space-y-2">
              {TROUBLESHOOT.map((item) => (
                <TroubleshootItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </motion.div>

          {/* Support */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }} className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
              <h2 className="font-bebas text-3xl tracking-[0.06em] text-white">NEED HELP?</h2>
              <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {[
                { icon: "📧", title: "Email support", sub: "elite@chartiq.app", note: "Response within 24 hours", btn: "Send email", href: "mailto:elite@chartiq.app", color: "#00e676", bg: "rgba(0,230,118,0.08)", border: "rgba(0,230,118,0.2)" },
                { icon: "💬", title: "Discord community", sub: "Join 2,400+ traders", note: "", btn: "Join Discord", href: "https://discord.gg/chartiq", color: "#818cf8", bg: "rgba(88,101,242,0.1)", border: "rgba(88,101,242,0.25)" },
                { icon: "📧", title: "Priority Elite support", sub: "elite@chartiq.app", note: "Elite members get priority", btn: "Contact us", href: "mailto:elite@chartiq.app", color: "#a78bfa", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.2)" },
              ].map((card) => (
                <div key={card.title} className="rounded-2xl p-6 flex flex-col items-center text-center"
                  style={{ background: "#0c0f18", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="text-3xl mb-3">{card.icon}</span>
                  <p className="font-bold text-white mb-1">{card.title}</p>
                  <p className="text-xs font-dm-mono mb-1" style={{ color: card.color }}>{card.sub}</p>
                  {card.note && <p className="text-xs text-[#6b7280] mb-4">{card.note}</p>}
                  <div className="flex-1" />
                  <a href={card.href} target={card.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-center transition-all hover:-translate-y-0.5 mt-4"
                    style={{ background: card.bg, color: card.color, border: `1px solid ${card.border}` }}>
                    {card.btn}
                  </a>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-[#374151]">
              Questions? Email <span className="text-[#4b5563]">elite@chartiq.app</span> — we personally respond to every Elite member within 24 hours.
            </p>
          </motion.div>

          {/* Testimonial */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}
            className="rounded-2xl p-7 mb-8"
            style={{ background: "linear-gradient(135deg, #0d1820 0%, #080a10 100%)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-2xl mb-4">&ldquo;</div>
            <p className="text-[#d1d5db] text-base leading-relaxed mb-4 italic">
              I got access within an hour. The indicator is incredible — completely changed how I read charts.
              The confluence scoring means I only take high probability setups. My win rate went from 48% to 67% in the first month.
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
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
            className="rounded-2xl p-6"
            style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.18)" }}>
            <div className="flex items-start gap-3">
              <span className="text-lg flex-shrink-0">⚠️</span>
              <div>
                <p className="text-xs font-bold tracking-[0.15em] uppercase text-[#fbbf24] mb-2">Important Disclaimer</p>
                <p className="text-xs text-[#6b7280] leading-relaxed">
                  Past performance shown in backtests does not guarantee future results. Trading involves significant risk of capital loss.
                  The ChartIQ AI Signal System is a tool to assist your analysis — not a guarantee of profitable trades.
                  Always use proper risk management. Never risk more than you can afford to lose.
                </p>
              </div>
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
