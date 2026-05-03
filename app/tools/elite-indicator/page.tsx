"use client";

import { useState, useEffect } from "react";
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
  { n: 1, label: "Trend alignment",    desc: "EMA 20/50/200 stacked in trend direction" },
  { n: 2, label: "RSI momentum",       desc: "RSI above 50 (bull) or below 50 (bear), not overbought/oversold" },
  { n: 3, label: "Volume confirmation",desc: "Volume above 20-bar average by at least 20%" },
  { n: 4, label: "FVG or Order Block", desc: "Price inside a Fair Value Gap or sitting on an Order Block" },
  { n: 5, label: "Liquidity sweep",    desc: "Recent sweep of equal highs/lows before reversal" },
  { n: 6, label: "Break of Structure", desc: "Market structure broken in signal direction" },
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
  { id: "dl_ind",    label: "Downloaded chartiq-indicator.pine" },
  { id: "open_tv",  label: "Opened TradingView" },
  { id: "open_ch",  label: "Opened XAU/USD 1H chart" },
  { id: "open_pe",  label: "Opened Pine Script Editor" },
  { id: "new_ind",  label: "Created new Indicator" },
  { id: "del_code", label: "Deleted default code" },
  { id: "paste",    label: "Pasted ChartIQ code" },
  { id: "add_ch",   label: "Clicked Add to chart" },
  { id: "signals",  label: "Seeing BUY/SELL labels on chart ✅" },
  { id: "dash",     label: "Dashboard showing top right ✅" },
  { id: "conf4",    label: "Set Min Confluence to 4" },
  { id: "session",  label: "Enabled Session Filter" },
];

const TROUBLESHOOT = [
  {
    q: "I see a red error in Pine Editor",
    a: `The most common error is 'not a valid statement' caused by commas in price numbers. Download a fresh copy of the indicator — we have fixed this issue.\n\nStill having problems? Email us at support@chartiq.app and we will personally fix your file within 24 hours.`,
  },
  {
    q: "I can't see any signals on my chart",
    a: `Check these settings:\n1. Make sure Show Signals is ON in indicator settings\n2. Lower the Min Confluence to 3\n3. Turn OFF the Session Filter\n4. Make sure you are on a supported timeframe (1m, 5m, 15m, 1H, 4H, Daily)\n5. Try a different asset — XAU/USD 1H is the best to test on`,
  },
  {
    q: "The indicator disappeared from my chart",
    a: `This happens when TradingView reloads. To make it permanent:\n1. Save your chart layout in TradingView\n2. Click the cloud save icon at the top\n3. The indicator will now load automatically every time`,
  },
  {
    q: "The strategy tester shows 0 trades",
    a: `Change the date range in Strategy Tester settings:\n1. Click the gear icon in Strategy Tester\n2. Set date range to last 1 year\n3. Make sure you are on the correct timeframe (1H recommended)\n4. Lower Min Confluence to 3`,
  },
  {
    q: "Can I use this on mobile TradingView?",
    a: `Pine Script Editor is only available on TradingView desktop (web browser). Once installed on desktop the indicator will show on mobile automatically if you save your chart layout.`,
  },
  {
    q: "Does this repaint?",
    a: `No. The ChartIQ indicator uses confirmed candle closes for all signals. Signals only appear after a candle closes — never on live/unconfirmed candles. This means no repainting.`,
  },
  {
    q: "What is the best timeframe?",
    a: `Our recommended timeframes by asset:\nXAU/USD: 1H or 4H\nBTC/USD: 1H\nEUR/USD: 15m or 1H\nNQ/ES futures: 5m or 15m\nStocks: 1H or Daily\n\nAlways check higher timeframe bias first before entering on lower timeframe signals.`,
  },
  {
    q: "How do I set up TradingView alerts?",
    a: `1. Right click your chart\n2. Click Add Alert\n3. Condition: ChartIQ BUY Signal (or SELL Signal)\n4. Notifications: Email and/or App\n5. Webhook URL (optional): paste your ChartIQ webhook URL for automation\n6. Click Create\n\nYou will now get notified whenever the indicator fires a signal.`,
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

function DownloadBtn({ href, label, sublabel }: { href: string; label: string; sublabel: string }) {
  return (
    <a href={href} download
      className="flex items-center gap-4 p-4 rounded-xl transition-all hover:-translate-y-0.5 group"
      style={{ background: "rgba(0,230,118,0.06)", border: "1.5px solid rgba(0,230,118,0.2)" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(0,230,118,0.15)" }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 2v9M5.5 7.5L9 11l3.5-3.5M2.5 15h13" stroke="#00e676" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-bold text-white group-hover:text-[#00e676] transition-colors">{label}</p>
        <p className="text-xs text-[#4b5563] mt-0.5">{sublabel}</p>
      </div>
      <span className="text-xs font-bold px-2 py-1 rounded-lg"
        style={{ background: "rgba(0,230,118,0.12)", color: "#00e676" }}>.pine</span>
    </a>
  );
}

// ── Tip / Warning boxes ────────────────────────────────────────

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
    <div className="mt-4 flex items-start gap-2.5 rounded-xl p-3.5 text-sm"
      style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)" }}>
      <span className="flex-shrink-0">⚠️</span>
      <p className="text-[#9ca3af] leading-relaxed">{children}</p>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl p-3.5 text-sm"
      style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)" }}>
      <span className="flex-shrink-0">ℹ️</span>
      <p className="text-[#9ca3af] leading-relaxed">{children}</p>
    </div>
  );
}

// ── Install step card ──────────────────────────────────────────

function InstallStepCard({
  number, icon, title, description, visual, tip, warn, info,
}: {
  number: number;
  icon: string;
  title: string;
  description: React.ReactNode;
  visual?: React.ReactNode;
  tip?: string;
  warn?: string;
  info?: string;
}) {
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "#0c0f18", border: "1px solid rgba(255,255,255,0.06)", borderLeft: "4px solid #00e676" }}>
      <div className="p-6">
        <div className="flex items-start gap-4 mb-4">
          <span className="font-bebas text-5xl leading-none flex-shrink-0" style={{ color: "rgba(0,230,118,0.25)" }}>
            {String(number).padStart(2, "0")}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{icon}</span>
              <h3 className="text-base font-bold text-white">{title}</h3>
            </div>
            <div className="text-sm text-[#9ca3af] leading-relaxed">{description}</div>
          </div>
        </div>
        {visual && (
          <div className="rounded-xl p-4 mt-2"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {visual}
          </div>
        )}
        {tip  && <TipBox>{tip}</TipBox>}
        {warn && <WarnBox>{warn}</WarnBox>}
        {info && <InfoBox>{info}</InfoBox>}
      </div>
    </div>
  );
}

// ── Mock visuals ───────────────────────────────────────────────

function MockFileIcon() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-12 rounded-lg flex flex-col items-center justify-center text-xs font-bold"
        style={{ background: "rgba(0,230,118,0.1)", border: "1px solid rgba(0,230,118,0.3)" }}>
        <span className="text-[#00e676] text-[9px] font-dm-mono">.pine</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-white">chartiq-indicator.pine</p>
        <p className="text-xs text-[#4b5563]">Pine Script v5 · 42KB</p>
      </div>
      <div className="ml-auto w-6 h-6 rounded-full flex items-center justify-center"
        style={{ background: "rgba(0,230,118,0.15)" }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l2.5 2.5L10 2.5" stroke="#00e676" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function MockChartArea() {
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "#131722" }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-xs text-white font-semibold">XAUUSD · 1H</span>
        <span className="text-xs text-[#4b5563] ml-auto">TradingView</span>
      </div>
      <div className="p-3 flex items-end gap-1 h-20">
        {[40, 55, 45, 65, 50, 70, 60, 75, 55, 80, 65, 85].map((h, i) => (
          <div key={i} className="flex-1 rounded-sm"
            style={{ height: `${h}%`, background: i % 3 === 0 ? "rgba(248,113,113,0.6)" : "rgba(0,230,118,0.6)" }} />
        ))}
      </div>
    </div>
  );
}

function MockPineEditorBar() {
  return (
    <div className="rounded-lg overflow-hidden text-xs font-dm-mono" style={{ background: "#1e222d" }}>
      <div className="flex items-center gap-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {["Strategy Tester", "Pine Editor", "Alert Sounds"].map((tab) => (
          <div key={tab} className="px-4 py-2.5 text-[11px]"
            style={tab === "Pine Editor"
              ? { background: "#131722", color: "#00e676", borderBottom: "2px solid #00e676" }
              : { color: "#6b7280" }}>
            {tab}
          </div>
        ))}
      </div>
    </div>
  );
}

function MockPineToolbar() {
  return (
    <div className="rounded-lg overflow-hidden text-xs font-dm-mono" style={{ background: "#1e222d" }}>
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {["Open ▼", "Save", "Publish"].map((btn) => (
          <div key={btn} className="px-3 py-1 rounded text-[11px] cursor-default"
            style={btn === "Open ▼"
              ? { background: "rgba(0,230,118,0.15)", color: "#00e676", border: "1px solid rgba(0,230,118,0.3)" }
              : { background: "rgba(255,255,255,0.05)", color: "#6b7280" }}>
            {btn}
          </div>
        ))}
      </div>
      <div className="px-3 py-1.5 text-[10px] text-[#4b5563]">
        //@version=5<br />
        indicator(&quot;My Script&quot;, overlay=true)
      </div>
    </div>
  );
}

function MockCodeBeforeAfter() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className="text-[10px] text-[#6b7280] mb-1.5 font-dm-mono">BEFORE (default)</p>
        <div className="rounded-lg p-3 text-[10px] font-dm-mono leading-relaxed"
          style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.15)", color: "#6b7280" }}>
          //@version=5<br />
          indicator(&quot;My Script&quot;)<br />
          plot(close)
        </div>
      </div>
      <div>
        <p className="text-[10px] text-[#00e676] mb-1.5 font-dm-mono">AFTER (pasted)</p>
        <div className="rounded-lg p-3 text-[10px] font-dm-mono leading-relaxed"
          style={{ background: "rgba(0,230,118,0.05)", border: "1px solid rgba(0,230,118,0.2)", color: "#00e676" }}>
          //@version=5<br />
          indicator(&quot;ChartIQ AI<br />
          Signal System&quot;, ...)<br />
          // 500+ lines...
        </div>
      </div>
    </div>
  );
}

function MockAddToChart() {
  return (
    <div className="flex items-center gap-3">
      <div className="px-5 py-2 rounded text-sm font-semibold cursor-default"
        style={{ background: "#2962ff", color: "white" }}>
        Add to chart
      </div>
      <p className="text-xs text-[#4b5563]">← Click this button in Pine Editor</p>
    </div>
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
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
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

      {/* Progress bar */}
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
              style={{
                background: checked[item.id] ? "#00e676" : "transparent",
                border: checked[item.id] ? "none" : "1.5px solid rgba(255,255,255,0.15)",
              }}>
              {checked[item.id] && (
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M1.5 5.5l2.5 2.5L9.5 2" stroke="#080a10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-xs font-medium"
              style={{ color: checked[item.id] ? "#9ca3af" : "#d1d5db", textDecoration: checked[item.id] ? "line-through" : "none" }}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {pct === 100
        ? <p className="text-center text-sm font-bold text-[#00e676]">🎉 Setup complete — you&apos;re ready to trade!</p>
        : <p className="text-center text-xs text-[#4b5563]">Complete all steps above and you are ready to trade with the ChartIQ AI Signal System</p>
      }
    </motion.div>
  );
}

// ── Troubleshoot accordion item ────────────────────────────────

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
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}>
            <div className="px-5 pb-4 pt-0" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-sm text-[#9ca3af] leading-relaxed whitespace-pre-line pt-3">{a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Video waitlist section ─────────────────────────────────────

function VideoSection() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState("");

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/video-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) { setDone(true); }
      else setError(data.error ?? "Something went wrong");
    } catch { setError("Something went wrong"); }
    setLoading(false);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
      className="rounded-2xl p-8 mb-8 text-center"
      style={{ background: "#0d1310", border: "1px solid rgba(0,230,118,0.2)", borderRadius: 14 }}>
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#00e676] mb-2">Coming Soon</p>
      <h2 className="font-bebas text-3xl tracking-wide text-white mb-2">📹 VIDEO TUTORIAL</h2>
      <p className="text-[#6b7280] text-sm mb-8">Watch the full installation and setup walkthrough</p>

      {/* Play button */}
      <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 cursor-default"
        style={{ background: "rgba(0,230,118,0.08)", border: "2px solid rgba(0,230,118,0.2)" }}>
        <div className="w-0 h-0 ml-2"
          style={{ borderTop: "16px solid transparent", borderBottom: "16px solid transparent", borderLeft: "26px solid rgba(0,230,118,0.6)" }} />
      </div>

      <p className="text-[#4b5563] text-sm mb-6">Full video tutorial coming soon</p>

      {done ? (
        <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold"
          style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.25)" }}>
          ✓ You&apos;re on the list — we&apos;ll email you when it&apos;s live
        </div>
      ) : (
        <form onSubmit={subscribe} className="flex flex-col sm:flex-row gap-2 max-w-sm mx-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder-[#4b5563] outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <button type="submit" disabled={loading}
            className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50 whitespace-nowrap"
            style={{ background: "#00e676", color: "#080a10" }}>
            {loading ? "…" : "Notify me"}
          </button>
        </form>
      )}
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      {!done && <p className="text-[#4b5563] text-xs mt-3">Subscribe to be notified when the tutorial goes live</p>}
    </motion.div>
  );
}

// ── Locked page ────────────────────────────────────────────��───

function LockedPage() {
  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <AppNav />
      <main className="pt-28 pb-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-6"><EliteBadge /></div>
          <h1 className="font-bebas text-5xl md:text-6xl tracking-wider mb-4 leading-none">
            CHARTIQ AI SIGNAL SYSTEM
          </h1>
          <p className="text-[#6b7280] mb-10 text-base leading-relaxed">
            This indicator is exclusively for Elite members. Upgrade to unlock the most advanced
            buy/sell indicator available to retail traders.
          </p>
          <div className="relative rounded-2xl overflow-hidden mb-10 border border-white/[0.06]"
            style={{ background: "#0c0f18" }}>
            <div className="blur-sm pointer-events-none select-none p-8 opacity-60">
              <div className="space-y-3">
                {features.map((f) => (
                  <div key={f} className="flex items-center gap-3 text-sm text-[#d1d5db]">
                    <Check />{f}
                  </div>
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
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-left">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#a78bfa] mb-4">What Elite members get</p>
            <ul className="space-y-2.5">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-[#9ca3af]">
                  <Check />{f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────

export default function EliteIndicatorPage() {
  const { isElite } = useUserPlan();

  if (!isElite) return <LockedPage />;

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <AppNav />

      <main className="pt-28 pb-24 px-6">
        <div className="max-w-3xl mx-auto">

          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10">
            <div className="mb-4"><EliteBadge /></div>
            <h1 className="font-bebas text-5xl md:text-7xl tracking-wider mb-5 leading-none">
              CHARTIQ AI SIGNAL SYSTEM
            </h1>
            <p className="text-[#9ca3af] text-base md:text-lg max-w-xl mx-auto leading-relaxed">
              The most advanced buy/sell indicator available to retail traders. Combines Smart Money
              Concepts, market structure, Fair Value Gaps, order blocks, and liquidity analysis into
              one powerful signal system.
            </p>
          </motion.div>

          {/* Downloads */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
            className="rounded-2xl p-7 mb-8"
            style={{ background: "linear-gradient(135deg, #0d1f15 0%, #080a10 100%)", border: "1.5px solid rgba(0,230,118,0.3)", boxShadow: "0 0 60px rgba(0,230,118,0.06)" }}>
            <p className="text-[#00e676] text-xs font-bold tracking-[0.2em] uppercase mb-1">Downloads</p>
            <h2 className="text-lg font-bold mb-1">Two Files Included with Elite</h2>
            <p className="text-[#6b7280] text-sm mb-6">Pine Script v5 · Compatible with TradingView Free, Pro &amp; Premium</p>
            <div className="space-y-3">
              <DownloadBtn
                href="/indicators/chartiq-indicator.pine"
                label="ChartIQ AI Signal System — Indicator"
                sublabel="Shows buy/sell signals with FVG zones, order blocks, and confluence dashboard"
              />
              <DownloadBtn
                href="/indicators/chartiq-strategy.pine"
                label="ChartIQ AI Signal System — Strategy"
                sublabel="Full backtestable version — see win rate, profit factor, and drawdown in Strategy Tester"
              />
            </div>
          </motion.div>

          {/* ── PART 5: Quick Start Checklist ── */}
          <QuickStartChecklist />

          {/* Features */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 mb-8">
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#6b7280] mb-5">Features</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {features.map((f) => (
                <div key={f} className="flex items-start gap-2.5 text-sm text-[#d1d5db]">
                  <Check />{f}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Confluence */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 mb-8">
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#6b7280] mb-2">How It Works</p>
            <h3 className="text-lg font-bold mb-1">6 Confluence Factors</h3>
            <p className="text-[#6b7280] text-sm mb-6">
              Signal fires only when a minimum of 3 of 6 factors align — ensuring high-quality setups only.
            </p>
            <div className="space-y-3">
              {confluenceFactors.map((c) => (
                <div key={c.n} className="flex items-start gap-4 p-4 rounded-xl"
                  style={{ background: "rgba(0,230,118,0.04)", border: "1px solid rgba(0,230,118,0.08)" }}>
                  <span className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                    style={{ background: "rgba(0,230,118,0.15)", color: "#00e676" }}>
                    {c.n}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{c.label}</p>
                    <p className="text-xs text-[#6b7280] mt-0.5">{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── PART 1: HOW TO INSTALL IN 3 MINUTES ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
            className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1" style={{ background: "rgba(0,230,118,0.15)" }} />
              <div className="text-center">
                <h2 className="font-bebas text-3xl tracking-[0.06em] text-white">HOW TO INSTALL IN 3 MINUTES</h2>
                <p className="text-xs text-[#4b5563] mt-0.5">Step-by-step guide — takes about 3 minutes</p>
              </div>
              <div className="h-px flex-1" style={{ background: "rgba(0,230,118,0.15)" }} />
            </div>

            <div className="space-y-4">
              <InstallStepCard
                number={1} icon="⬇️"
                title="Download your indicator file"
                description="Click the Download Indicator button above. A file called chartiq-indicator.pine will save to your Downloads folder."
                visual={<MockFileIcon />}
                warn="File not downloading? Right-click the button and select Save Link As"
              />

              <InstallStepCard
                number={2} icon="📊"
                title="Open TradingView and your chart"
                description="Go to tradingview.com and open any chart. We recommend starting with XAU/USD on the 1H timeframe to test the indicator."
                visual={<MockChartArea />}
                tip="The indicator works best on XAU/USD, NQ, ES, BTC on the 1H or 4H timeframe"
              />

              <InstallStepCard
                number={3} icon="💻"
                title="Open the Pine Script Editor"
                description={
                  <span>
                    At the bottom of your TradingView chart look for the <strong className="text-white">Pine Editor</strong> tab. Click it to open the code editor.
                    <br /><br />
                    <span className="text-[#4b5563]">Can&apos;t find it? Look for these tabs at the bottom of your chart:</span>
                    <span className="block font-dm-mono text-xs mt-1 text-[#6b7280]">Strategy Tester | <span className="text-[#00e676]">Pine Editor</span> | Alert Sounds</span>
                  </span>
                }
                visual={<MockPineEditorBar />}
              />

              <InstallStepCard
                number={4} icon="✨"
                title="Create a new indicator"
                description='In the Pine Script Editor click the Open button (folder icon) at the top left. Then select New indicator from the dropdown.'
                visual={<MockPineToolbar />}
                info="When asked what type select INDICATOR not Strategy — the indicator version is for viewing signals on your chart"
              />

              <InstallStepCard
                number={5} icon="📋"
                title="Replace the code"
                description={
                  <ol className="space-y-1 list-none mt-1">
                    {[
                      "Press Cmd+A (Mac) or Ctrl+A (Windows) to select ALL existing code",
                      "Press Delete or Backspace to remove it",
                      "Open your Downloads folder and find chartiq-indicator.pine",
                      "Open it with any text editor (TextEdit on Mac, Notepad on Windows)",
                      "Press Cmd+A / Ctrl+A to select all, then Cmd+C / Ctrl+C to copy",
                      "Go back to TradingView Pine Editor",
                      "Press Cmd+V / Ctrl+V to paste",
                    ].map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-[#00e676] flex-shrink-0 font-bold">{i + 1}.</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                }
                visual={<MockCodeBeforeAfter />}
              />

              <InstallStepCard
                number={6} icon="🚀"
                title="Add to your chart"
                description='Click the Add to chart button at the top of the Pine Editor. The indicator will load on your chart in seconds.'
                visual={<MockAddToChart />}
                tip={undefined}
                info={undefined}
                warn={undefined}
              />
            </div>

            {/* What you will see */}
            <div className="mt-4 rounded-2xl p-5"
              style={{ background: "rgba(0,230,118,0.04)", border: "1px solid rgba(0,230,118,0.15)" }}>
              <p className="text-sm font-bold text-white mb-3">✅ What you will see on your chart</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  "Green ▲ BUY labels below candles",
                  "Red ▼ SELL labels above candles",
                  "Green shaded FVG zones",
                  "Red shaded FVG zones",
                  "Dashboard panel top right",
                  "BOS labels at structure breaks",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-[#d1d5db]">
                    <Check />{item}
                  </div>
                ))}
              </div>
              <WarnBox>Seeing a red error? The most common cause is commas in price numbers. Contact support and we will fix your file instantly.</WarnBox>
            </div>

            {/* Step 7 — Settings */}
            <div className="mt-4">
              <InstallStepCard
                number={7} icon="⚙️"
                title="Customise your settings"
                description='Click the Settings icon (⚙️) next to the indicator name at the top of your chart to customise.'
                visual={
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-dm-mono">
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(0,230,118,0.15)" }}>
                          {["Setting", "Recommended", "Description"].map((h) => (
                            <th key={h} className="pb-2 pr-4 text-left font-bold" style={{ color: "#00e676" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ["Min Confluence", "4",   "Higher = fewer better signals"],
                          ["Session Filter", "ON",  "Only trade London and NY"],
                          ["RSI Filter",     "ON",  "Momentum confirmation"],
                          ["ATR Stop Mult",  "1.5", "Stop loss distance"],
                          ["Show Dashboard", "ON",  "Top right info panel"],
                          ["Show FVG",       "ON",  "Fair value gap zones"],
                          ["Show OB",        "ON",  "Order block boxes"],
                        ].map(([s, r, d]) => (
                          <tr key={s} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <td className="py-2 pr-4 text-white">{s}</td>
                            <td className="py-2 pr-4" style={{ color: "#00e676" }}>{r}</td>
                            <td className="py-2 text-[#6b7280]">{d}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                }
                tip="Start with minimum confluence of 4 for higher quality signals. Reduce to 3 if you want more signals."
              />
            </div>
          </motion.div>

          {/* ── PART 2: Strategy Tester Guide ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-2xl p-7 mb-8"
            style={{ background: "linear-gradient(135deg, #0d1820 0%, #080a10 100%)", border: "1.5px solid rgba(59,130,246,0.2)" }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1" style={{ background: "rgba(96,165,250,0.15)" }} />
              <h2 className="font-bebas text-2xl tracking-[0.06em] text-white whitespace-nowrap">HOW TO BACKTEST THE STRATEGY VERSION</h2>
              <div className="h-px flex-1" style={{ background: "rgba(96,165,250,0.15)" }} />
            </div>

            {/* Mock backtest stats */}
            <div className="rounded-xl p-4 mb-6 flex flex-wrap gap-6"
              style={{ background: "rgba(0,230,118,0.04)", border: "1px solid rgba(0,230,118,0.12)" }}>
              {[
                { v: "67%", l: "Win Rate", c: "#00e676" },
                { v: "847", l: "Trades",   c: "white"   },
                { v: "2.4", l: "Profit Factor", c: "#00e676" },
                { v: "-8.2%", l: "Max DD", c: "#f87171" },
              ].map((s) => (
                <div key={s.l} className="text-center">
                  <p className="text-2xl font-extrabold" style={{ color: s.c }}>{s.v}</p>
                  <p className="text-[10px] text-[#4b5563] uppercase tracking-widest mt-0.5">{s.l}</p>
                </div>
              ))}
              <div className="self-end ml-auto">
                <p className="text-[10px] text-[#4b5563]">XAU/USD · 1H · 2024–2025</p>
              </div>
            </div>

            <div className="space-y-4">
              {[
                {
                  n: 1, title: "Download strategy file",
                  body: 'Click Download Strategy above — saves as chartiq-strategy.pine',
                },
                {
                  n: 2, title: "Install same as indicator",
                  body: 'Follow steps 1–5 above but when asked select STRATEGY not Indicator',
                },
                {
                  n: 3, title: "Open Strategy Tester",
                  body: 'After adding to chart click the Strategy Tester tab at the bottom of TradingView — same area as Pine Editor',
                },
                {
                  n: 4, title: "Read the results",
                  body: null,
                },
                {
                  n: 5, title: "Optimise settings",
                  body: null,
                },
              ].map((step) => (
                <div key={step.n} className="flex items-start gap-4 p-4 rounded-xl"
                  style={{ background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.1)" }}>
                  <span className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                    style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>
                    {step.n}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white mb-1">{step.title}</p>
                    {step.body && <p className="text-sm text-[#9ca3af]">{step.body}</p>}

                    {step.n === 4 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        {[
                          ["Net Profit",    "Total money made/lost"],
                          ["Win Rate",      "% of trades that were winners — aim for above 50%"],
                          ["Profit Factor", "Gross profit ÷ gross loss — above 1.5 is good"],
                          ["Max Drawdown",  "Biggest losing streak — below 20% is good"],
                          ["Total Trades",  "Need at least 50 trades for reliable results"],
                        ].map(([metric, desc]) => (
                          <div key={metric} className="rounded-lg p-3"
                            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <p className="text-xs font-bold text-white">{metric}</p>
                            <p className="text-[11px] text-[#6b7280] mt-0.5">{desc}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {step.n === 5 && (
                      <div className="space-y-2 mt-2">
                        {[
                          { label: "Conservative", params: "Min Confluence 4 · Session ON · RSI ON", outcome: "Fewer trades, higher win rate" },
                          { label: "Balanced",      params: "Min Confluence 3 · Session ON · RSI ON", outcome: "More trades, good win rate" },
                          { label: "Aggressive",    params: "Min Confluence 3 · Session OFF · RSI OFF", outcome: "Most trades, lower win rate" },
                        ].map((combo) => (
                          <div key={combo.label} className="rounded-lg p-3"
                            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <p className="text-xs font-bold text-white">{combo.label}</p>
                            <p className="text-[11px] font-dm-mono text-[#6b7280] mt-0.5">{combo.params}</p>
                            <p className="text-[11px] text-[#9ca3af] mt-0.5">→ {combo.outcome}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recommended settings table */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
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
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 mb-8">
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#6b7280] mb-2">Webhook Integration</p>
            <h3 className="text-lg font-bold mb-1">Connect to ChartIQ for Full Automation</h3>
            <p className="text-[#6b7280] text-sm mb-6">
              When the indicator fires, TradingView sends a webhook to ChartIQ. ChartIQ logs the signal and
              can automatically place trades via your connected broker.
            </p>
            <div className="space-y-3 mb-6">
              {webhookSteps.map((s) => (
                <div key={s.step} className="flex items-start gap-4">
                  <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                    style={{ background: "rgba(0,230,118,0.12)", color: "#00e676" }}>
                    {s.step}
                  </span>
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
                style={{ background: "rgba(0,230,118,0.03)" }}>
                {webhookJson}
              </pre>
            </div>
            <p className="text-xs text-[#4b5563] mt-3">
              Webhook endpoint: <span className="text-[#6b7280] font-dm-mono">trade-edge-ai.vercel.app/api/tradingview/webhook</span>
            </p>
          </motion.div>

          {/* ── PART 3: Video Tutorial ── */}
          <VideoSection />

          {/* ── PART 4: Troubleshooting ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
            className="mb-8">
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

          {/* ── PART 6: Support ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}
            className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
              <h2 className="font-bebas text-3xl tracking-[0.06em] text-white">NEED HELP?</h2>
              <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Email */}
              <div className="rounded-2xl p-6 flex flex-col items-center text-center"
                style={{ background: "#0c0f18", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="text-3xl mb-3">📧</span>
                <p className="font-bold text-white mb-1">Email support</p>
                <p className="text-xs text-[#4b5563] mb-1">support@chartiq.app</p>
                <p className="text-xs text-[#6b7280] mb-4">Response within 24 hours</p>
                <a href="mailto:support@chartiq.app"
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-center transition-all hover:-translate-y-0.5"
                  style={{ background: "rgba(0,230,118,0.08)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }}>
                  Send email
                </a>
              </div>

              {/* Discord */}
              <div className="rounded-2xl p-6 flex flex-col items-center text-center"
                style={{ background: "#0c0f18", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="text-3xl mb-3">💬</span>
                <p className="font-bold text-white mb-1">Discord community</p>
                <p className="text-xs text-[#6b7280] mb-4">Join 2,400+ traders helping each other</p>
                <a href="https://discord.gg/chartiq" target="_blank" rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-center transition-all hover:-translate-y-0.5"
                  style={{ background: "rgba(88,101,242,0.1)", color: "#818cf8", border: "1px solid rgba(88,101,242,0.25)" }}>
                  Join Discord
                </a>
              </div>

              {/* Live chat */}
              <div className="rounded-2xl p-6 flex flex-col items-center text-center"
                style={{ background: "#0c0f18", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="text-3xl mb-3">💬</span>
                <p className="font-bold text-white mb-1">Live chat</p>
                <p className="text-xs text-[#6b7280] mb-4">Chat with us directly</p>
                <a href="mailto:support@chartiq.app"
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-center transition-all hover:-translate-y-0.5"
                  style={{ background: "rgba(0,230,118,0.08)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }}>
                  Start chat
                </a>
              </div>
            </div>
          </motion.div>

          {/* Testimonial */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}
            className="rounded-2xl p-7 mb-8"
            style={{ background: "linear-gradient(135deg, #0d1820 0%, #080a10 100%)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-2xl mb-4">&ldquo;</div>
            <p className="text-[#d1d5db] text-base leading-relaxed mb-4 italic">
              This indicator changed how I trade — the confluence scoring means I only take
              high probability setups. My win rate went from 48% to 67% in the first month.
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
            className="rounded-2xl p-6 mb-10"
            style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.18)" }}>
            <div className="flex items-start gap-3">
              <span className="text-lg flex-shrink-0">⚠️</span>
              <div>
                <p className="text-xs font-bold tracking-[0.15em] uppercase text-[#fbbf24] mb-2">Important Disclaimer</p>
                <p className="text-xs text-[#6b7280] leading-relaxed">
                  Past performance shown in backtests does not guarantee future results. Trading involves significant risk
                  of capital loss. The ChartIQ AI Signal System is a tool to assist your analysis — not a guarantee of
                  profitable trades. Always use proper risk management. Never risk more than you can afford to lose.
                  Backtest results are based on historical data and may not reflect future market conditions.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Bottom download CTA */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="text-center">
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-3">
              <a href="/indicators/chartiq-indicator.pine" download
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
                style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 28px rgba(0,230,118,0.3)" }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M2.5 13h11" stroke="#080a10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download Indicator
              </a>
              <a href="/indicators/chartiq-strategy.pine" download
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
                style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1.5px solid rgba(0,230,118,0.3)" }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M2.5 13h11" stroke="#00e676" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download Strategy
              </a>
            </div>
            <p className="text-[#4b5563] text-xs">Pine Script v5 · Free updates included · Elite members only</p>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
