"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import AppNav from "@/app/components/AppNav";
import { useUserPlan } from "@/app/lib/plan-context";

// ── Types ──────────────────────────────────────────────────────
interface PropAccount {
  id: string;
  user_id: string;
  firm_name: string;
  account_size: number;
  max_daily_loss: number;
  max_drawdown: number;
  profit_target: number;
  min_trading_days: number | null;
  max_lot_size: number | null;
  news_trading: boolean;
  weekend_holding: boolean;
  consistency_rule: boolean;
  consistency_percent: number | null;
  phase: string;
  current_pnl: number;
  daily_pnl: number;
  trading_days_completed: number;
  created_at: string;
}

interface PropTrade {
  id: string;
  account_id: string;
  asset: string | null;
  direction: string | null;
  pnl: number;
  notes: string;
  traded_at: string;
  trade_date: string;
}

type View = "loading" | "portfolio" | "select-firm" | "setup" | "dashboard";
type DashTab = "dashboard" | "progress" | "guide";

// ── Firm presets ───────────────────────────────────────────────
const FIRMS = [
  {
    id: "ftmo",
    name: "FTMO",
    color: "#3b82f6",
    sizes: [10000, 25000, 50000, 100000, 200000],
    dailyLoss: 5, maxDrawdown: 10,
    profitTarget: 10, phase2Target: 5,
    minTradingDays: 10,
    consistencyRule: false, consistencyPercent: null,
    newsTrading: false, weekendHolding: false,
  },
  {
    id: "topstep",
    name: "Topstep",
    color: "#0ea5e9",
    sizes: [50000, 100000, 150000],
    dailyLoss: 4, maxDrawdown: 8,
    profitTarget: 6, phase2Target: null,
    minTradingDays: 5,
    consistencyRule: true, consistencyPercent: 30,
    newsTrading: false, weekendHolding: false,
  },
  {
    id: "apex",
    name: "Apex Trader Funding",
    color: "#8b5cf6",
    sizes: [25000, 50000, 75000, 100000, 150000, 250000, 300000],
    dailyLoss: 3, maxDrawdown: 6,
    profitTarget: 6, phase2Target: null,
    minTradingDays: 7,
    consistencyRule: false, consistencyPercent: null,
    newsTrading: false, weekendHolding: false,
  },
  {
    id: "the5ers",
    name: "The5ers",
    color: "#f59e0b",
    sizes: [4000, 10000, 20000, 40000],
    dailyLoss: 4, maxDrawdown: 8,
    profitTarget: 8, phase2Target: null,
    minTradingDays: null,
    consistencyRule: true, consistencyPercent: 30,
    newsTrading: false, weekendHolding: false,
  },
  {
    id: "fundednext",
    name: "Funded Next",
    color: "#10b981",
    sizes: [6000, 15000, 25000, 50000, 100000, 200000],
    dailyLoss: 5, maxDrawdown: 10,
    profitTarget: 10, phase2Target: 5,
    minTradingDays: 5,
    consistencyRule: false, consistencyPercent: null,
    newsTrading: false, weekendHolding: false,
  },
  {
    id: "cti",
    name: "City Traders Imperium",
    color: "#ec4899",
    sizes: [20000, 50000, 100000, 200000],
    dailyLoss: 4, maxDrawdown: 8,
    profitTarget: 10, phase2Target: null,
    minTradingDays: null,
    consistencyRule: false, consistencyPercent: null,
    newsTrading: false, weekendHolding: false,
  },
  {
    id: "custom",
    name: "Custom / Other Firm",
    color: "#6b7280",
    sizes: [],
    dailyLoss: 5, maxDrawdown: 10,
    profitTarget: 10, phase2Target: null,
    minTradingDays: 10,
    consistencyRule: false, consistencyPercent: null,
    newsTrading: false, weekendHolding: false,
    isCustom: true,
  },
] as const;

type FirmPreset = typeof FIRMS[number];

// ── Utilities ─────────────────────────────────────────────────
function fmt(n: number, decimals = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPnl(n: number) {
  return `${n >= 0 ? "+" : ""}$${fmt(Math.abs(n), 2)}`;
}

function pct(part: number, whole: number) {
  if (whole === 0) return 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

function timeUntilMidnightUTC() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const diff = next.getTime() - now.getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function todayISO() { return new Date().toISOString().split("T")[0]; }

// ── Count-up hook ─────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [v, setV] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    prev.current = target;
    const diff = target - start;
    if (diff === 0) return;
    const t0 = performance.now();
    let raf: number;
    function step(now: number) {
      const t = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      setV(Math.round(start + diff * e));
      if (t < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

// ── Shared small components ────────────────────────────────────
function EliteBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-[0.18em] uppercase"
      style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
      <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24] animate-pulse" />
      Elite Exclusive
    </span>
  );
}

function PhaseBadge({ phase }: { phase: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    evaluation: { label: "PHASE 1 — EVALUATION", color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
    verification: { label: "PHASE 2 — VERIFICATION", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
    funded: { label: "FUNDED", color: "#4ade80", bg: "rgba(74,222,128,0.12)" },
  };
  const s = map[phase] ?? map.evaluation;
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase font-dm-mono"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}30` }}>
      {s.label}
    </span>
  );
}

// ── Warning banner ────────────────────────────────────────────
function WarningBanner({ level, remaining, limitName }: {
  level: "info" | "warning" | "danger" | null;
  remaining: number;
  limitName: string;
}) {
  if (!level) return null;
  const map = {
    info:    { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)", color: "#f59e0b", icon: "⚡", pulse: false,
               text: `Halfway to ${limitName} — $${fmt(remaining, 0)} remaining today. Trade carefully.` },
    warning: { bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.4)", color: "#f97316", icon: "⚠️", pulse: true,
               text: `Approaching ${limitName} — $${fmt(remaining, 0)} remaining. Consider reducing position sizes.` },
    danger:  { bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.5)",  color: "#ef4444", icon: "🛑", pulse: true,
               text: `DANGER — Only $${fmt(remaining, 0)} from ${limitName}. Strongly consider stopping now.` },
  };
  const s = map[level];
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl px-5 py-4 flex items-start gap-3 ${s.pulse ? "animate-pulse-slow" : ""}`}
      style={{ background: s.bg, border: `1px solid ${s.border}` }}>
      <span className="text-lg flex-shrink-0 mt-0.5">{s.icon}</span>
      <p className="text-sm font-semibold" style={{ color: s.color }}>{s.text}</p>
    </motion.div>
  );
}

// ── Emergency modal ───────────────────────────────────────────
function EmergencyModal({ remaining, limitName, onDismiss }: { remaining: number; limitName: string; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.95)", backdropFilter: "blur(4px)" }}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-3xl text-center p-8"
        style={{ background: "linear-gradient(135deg, #1a0a0a 0%, #120000 100%)", border: "2px solid rgba(239,68,68,0.5)", boxShadow: "0 0 60px rgba(239,68,68,0.3)" }}>
        <div className="text-5xl mb-4">🚨</div>
        <h2 className="font-bebas text-[40px] leading-none text-[#ef4444] mb-3">STOP TRADING NOW</h2>
        <p className="text-[#fca5a5] text-base leading-relaxed mb-2">
          You are <span className="font-bold text-white">${fmt(remaining, 0)}</span> from breaching your {limitName}.
        </p>
        <p className="text-[#ef4444] font-bold text-sm mb-6">
          Breaching will FAIL your evaluation.
          <br />Close all positions and stop for today.
        </p>
        <button onClick={onDismiss}
          className="w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:brightness-110"
          style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1.5px solid rgba(239,68,68,0.5)" }}>
          I understand — stopping now
        </button>
      </motion.div>
    </div>
  );
}

// ── Progress card ─────────────────────────────────────────────
function ProgressCard({
  title, used, limit, usedLabel, remaining, suffix, phase, invert = false,
}: {
  title: string; used: number; limit: number; usedLabel: string;
  remaining: string; suffix?: string; phase?: string; invert?: boolean;
}) {
  const pctUsed = invert ? pct(used, limit) : pct(used, limit);
  const barColor = invert
    ? (pctUsed >= 100 ? "#4ade80" : pctUsed >= 60 ? "#60a5fa" : "#6b7280")
    : (pctUsed >= 86 ? "#b91c1c" : pctUsed >= 71 ? "#ef4444" : pctUsed >= 51 ? "#f97316" : "#4ade80");
  const pulse = !invert && pctUsed >= 71;
  const animated = useCountUp(Math.round(pctUsed));

  return (
    <div className="rounded-2xl p-5 border border-white/[0.06]"
      style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)" }}>
      <p className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280] mb-3">{title}</p>
      <div className="flex items-end justify-between mb-3">
        <span className="font-bebas text-[34px] leading-none" style={{ color: barColor }}>{animated}%</span>
        {phase && (
          <span className="px-2 py-0.5 rounded text-[9px] font-dm-mono font-bold text-[#4ade80]"
            style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)" }}>
            {phase}
          </span>
        )}
      </div>
      <div className="h-2.5 rounded-full overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div className={`h-full rounded-full ${pulse ? "animate-pulse" : ""}`}
          initial={{ width: 0 }}
          animate={{ width: `${pctUsed}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: barColor, boxShadow: `0 0 8px ${barColor}66` }} />
      </div>
      <p className="text-[#9ca3af] text-xs font-dm-mono">{usedLabel}</p>
      <p className="text-[#6b7280] text-[11px] mt-0.5">{remaining}{suffix ? ` · ${suffix}` : ""}</p>
    </div>
  );
}

// ── Log trade modal ───────────────────────────────────────────
function LogTradeModal({ accountId, clientId, onClose, onSaved }: {
  accountId: string; clientId: string | null;
  onClose: () => void; onSaved: (trade: PropTrade) => void;
}) {
  const [form, setForm] = useState({ asset: "", direction: "LONG", pnl: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.pnl) { setErr("P&L is required"); return; }
    setSaving(true); setErr("");
    try {
      const res = await fetch(`/api/prop-firm/${accountId}/trades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, pnl: parseFloat(form.pnl), user_id: clientId }),
      });
      const d = await res.json();
      if (d.success) { onSaved(d.trade); onClose(); }
      else setErr(d.error ?? "Failed to save");
    } catch { setErr("Network error"); }
    setSaving(false);
  }

  const field = "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-sm font-dm-mono outline-none focus:border-[#00e676]/40 transition-colors placeholder-[#374151]";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(8,10,16,0.92)", backdropFilter: "blur(12px)" }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl border border-white/10 p-6"
        style={{ background: "linear-gradient(145deg, #0d1117 0%, #080a10 100%)" }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-white text-lg">Log Trade</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-[#4b5563] hover:text-white hover:bg-white/[0.08] transition-all">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-1.5">Asset</label>
              <input className={field} value={form.asset} onChange={(e) => setForm(f => ({ ...f, asset: e.target.value }))} placeholder="XAU/USD" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-1.5">Direction</label>
              <select className={field} value={form.direction} onChange={(e) => setForm(f => ({ ...f, direction: e.target.value }))}>
                <option value="LONG">LONG</option>
                <option value="SHORT">SHORT</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-1.5">P&L ($) *</label>
            <input className={field} type="number" step="0.01" value={form.pnl}
              onChange={(e) => setForm(f => ({ ...f, pnl: e.target.value }))} placeholder="+250.00 or -120.00" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-1.5">Notes</label>
            <input className={field} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
          </div>
          {err && <p className="text-[#f87171] text-xs font-dm-mono">{err}</p>}
          <button type="submit" disabled={saving}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 disabled:opacity-50 mt-1"
            style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 20px rgba(0,230,118,0.25)" }}>
            {saving ? "Saving…" : "Log Trade"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ── Firm selection grid ────────────────────────────────────────
function FirmGrid({ onSelect }: { onSelect: (firm: FirmPreset) => void }) {
  return (
    <div>
      <p className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280] mb-5">Select Your Firm</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {FIRMS.map((firm) => (
          <motion.button key={firm.id} whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(firm as FirmPreset)}
            className="rounded-2xl p-5 text-left border transition-all hover:border-opacity-60 group"
            style={{ background: "rgba(255,255,255,0.02)", borderColor: `${firm.color}25` }}>
            {"isCustom" in firm && firm.isCustom ? (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: "rgba(107,114,128,0.15)", border: "1px solid rgba(107,114,128,0.3)" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 2v14M2 9h14" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 font-bebas text-lg"
                style={{ background: `${firm.color}18`, border: `1px solid ${firm.color}35`, color: firm.color }}>
                {firm.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <p className="font-bold text-white text-sm leading-tight mb-1">{firm.name}</p>
            {"isCustom" in firm && firm.isCustom ? (
              <p className="text-[#4b5563] text-xs">Enter rules manually</p>
            ) : (
              <p className="font-dm-mono text-[10px] text-[#6b7280]">{firm.dailyLoss}% daily · {firm.maxDrawdown}% DD</p>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ── Setup form ────────────────────────────────────────────────
function SetupForm({ firm, clientId, onSaved, onBack }: {
  firm: FirmPreset; clientId: string | null;
  onSaved: (account: PropAccount) => void; onBack: () => void;
}) {
  const isCustom = "isCustom" in firm && firm.isCustom;
  const [size,          setSize]          = useState(firm.sizes[0] ? String(firm.sizes[0]) : "");
  const [customSize,    setCustomSize]    = useState("");
  const [dailyLoss,     setDailyLoss]     = useState(String(firm.dailyLoss));
  const [maxDD,         setMaxDD]         = useState(String(firm.maxDrawdown));
  const [profitTarget,  setProfitTarget]  = useState(String(firm.profitTarget));
  const [minDays,       setMinDays]       = useState(firm.minTradingDays != null ? String(firm.minTradingDays) : "");
  const [maxLot,        setMaxLot]        = useState("");
  const [newsTrading,   setNewsTrading]   = useState<boolean>(firm.newsTrading);
  const [weekendHold,   setWeekendHold]   = useState<boolean>(firm.weekendHolding);
  const [consistency,   setConsistency]   = useState(firm.consistencyRule);
  const [consPct,       setConsPct]       = useState(String(firm.consistencyPercent ?? 30));
  const [phase,         setPhase]         = useState("evaluation");
  const [firmName,      setFirmName]      = useState(isCustom ? "" : firm.name);
  const [saving,        setSaving]        = useState(false);
  const [err,           setErr]           = useState("");

  const accountSize = parseFloat(customSize || size || "0");
  const dailyLossAmt = accountSize * (parseFloat(dailyLoss) / 100);
  const maxDDAmt     = accountSize * (parseFloat(maxDD) / 100);
  const profitAmt    = accountSize * (parseFloat(profitTarget) / 100);

  // When phase changes for FTMO/FundedNext, adjust profit target
  const hasPhase2 = "phase2Target" in firm && firm.phase2Target != null;
  useEffect(() => {
    if (hasPhase2) {
      setProfitTarget(phase === "verification" ? String((firm as typeof FIRMS[0]).phase2Target) : String(firm.profitTarget));
    }
  }, [phase, hasPhase2, firm]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!firmName.trim()) { setErr("Firm name required"); return; }
    if (!accountSize)     { setErr("Account size required"); return; }
    setSaving(true); setErr("");
    try {
      const res = await fetch("/api/prop-firm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id:           clientId,
          firm_name:           firmName,
          account_size:        accountSize,
          max_daily_loss:      parseFloat(dailyLoss),
          max_drawdown:        parseFloat(maxDD),
          profit_target:       parseFloat(profitTarget),
          min_trading_days:    minDays ? parseInt(minDays) : null,
          max_lot_size:        maxLot ? parseFloat(maxLot) : null,
          news_trading:        newsTrading,
          weekend_holding:     weekendHold,
          consistency_rule:    consistency,
          consistency_percent: consistency ? parseFloat(consPct) : null,
          phase,
        }),
      });
      const d = await res.json();
      if (d.success) onSaved(d.account);
      else setErr(d.error ?? "Failed to save");
    } catch { setErr("Network error"); }
    setSaving(false);
  }

  const field = "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-sm font-dm-mono outline-none focus:border-[#fbbf24]/40 transition-colors";
  const label = "block text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7280] mb-1.5";

  function Toggle({ value, onChange, label: lbl }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-[#9ca3af]">{lbl}</span>
        <button type="button" onClick={() => onChange(!value)}
          className="relative w-10 h-5 rounded-full transition-colors"
          style={{ background: value ? "#00e676" : "rgba(255,255,255,0.1)" }}>
          <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
            style={{ left: value ? "calc(100% - 18px)" : "2px" }} />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-[#6b7280] hover:text-white text-sm mb-6 transition-colors">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bebas text-lg"
          style={{ background: `${firm.color}18`, border: `1px solid ${firm.color}35`, color: firm.color }}>
          {firmName.slice(0, 2).toUpperCase() || "?"}
        </div>
        <div>
          <h2 className="font-bold text-white text-xl">{isCustom ? "Custom Firm Setup" : firm.name}</h2>
          <p className="text-[#4b5563] text-xs">Configure your account rules</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {isCustom && (
          <div>
            <label className={label}>Firm Name *</label>
            <input className={field} value={firmName} onChange={(e) => setFirmName(e.target.value)} placeholder="e.g. My Prop Firm" />
          </div>
        )}

        <div>
          <label className={label}>Account Size *</label>
          {firm.sizes.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {firm.sizes.map((s) => (
                  <button type="button" key={s}
                    onClick={() => { setSize(String(s)); setCustomSize(""); }}
                    className="px-3 py-1.5 rounded-lg text-sm font-dm-mono font-bold transition-all"
                    style={size === String(s) && !customSize ? { background: "#fbbf24", color: "#080a10" } : { background: "rgba(255,255,255,0.06)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }}>
                    ${fmt(s)}
                  </button>
                ))}
              </div>
              <input className={field} type="number" value={customSize} onChange={(e) => { setCustomSize(e.target.value); setSize(""); }}
                placeholder="Or enter custom size…" />
            </div>
          ) : (
            <input className={field} type="number" value={customSize} onChange={(e) => setCustomSize(e.target.value)} placeholder="e.g. 100000" />
          )}
          {accountSize > 0 && (
            <p className="font-dm-mono text-[10px] text-[#4b5563] mt-1.5">
              Daily loss limit: <span className="text-[#f87171]">${fmt(dailyLossAmt, 0)}</span> ·
              Max DD: <span className="text-[#f87171] ml-1">${fmt(maxDDAmt, 0)}</span> ·
              Target: <span className="text-[#4ade80] ml-1">${fmt(profitAmt, 0)}</span>
            </p>
          )}
        </div>

        <div>
          <label className={label}>Phase</label>
          <div className="flex gap-2">
            {["evaluation", "verification", "funded"].map((p) => (
              <button type="button" key={p}
                onClick={() => setPhase(p)}
                className="flex-1 py-2 rounded-xl text-xs font-dm-mono font-bold transition-all capitalize"
                style={phase === p ? { background: "#fbbf24", color: "#080a10" } : { background: "rgba(255,255,255,0.05)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.08)" }}>
                {p === "evaluation" ? "Phase 1" : p === "verification" ? "Phase 2" : "Funded"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={label}>Max Daily Loss %</label>
            <input className={field} type="number" step="0.1" value={dailyLoss} onChange={(e) => setDailyLoss(e.target.value)} />
          </div>
          <div>
            <label className={label}>Max Drawdown %</label>
            <input className={field} type="number" step="0.1" value={maxDD} onChange={(e) => setMaxDD(e.target.value)} />
          </div>
          <div>
            <label className={label}>Profit Target %</label>
            <input className={field} type="number" step="0.1" value={profitTarget} onChange={(e) => setProfitTarget(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Min Trading Days</label>
            <input className={field} type="number" value={minDays} onChange={(e) => setMinDays(e.target.value)} placeholder="None" />
          </div>
          <div>
            <label className={label}>Max Lot / Contract</label>
            <input className={field} type="number" step="0.01" value={maxLot} onChange={(e) => setMaxLot(e.target.value)} placeholder="None" />
          </div>
        </div>

        <div className="rounded-xl p-4 space-y-1" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="font-dm-mono text-[10px] text-[#6b7280] uppercase tracking-wider mb-2">Trading Rules</p>
          <Toggle value={newsTrading} onChange={setNewsTrading} label="News trading allowed" />
          <Toggle value={weekendHold} onChange={setWeekendHold} label="Weekend holding allowed" />
          <Toggle value={consistency} onChange={setConsistency} label="Consistency rule applies" />
          {consistency && (
            <div className="pt-2">
              <label className={label}>Max single day % of profit target</label>
              <input className={field} type="number" step="1" value={consPct} onChange={(e) => setConsPct(e.target.value)} />
            </div>
          )}
        </div>

        {err && <p className="text-[#f87171] text-xs font-dm-mono">{err}</p>}

        <button type="submit" disabled={saving}
          className="w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 disabled:opacity-50"
          style={{ background: "#fbbf24", color: "#080a10", boxShadow: "0 0 24px rgba(251,191,36,0.25)" }}>
          {saving ? "Saving…" : "Start Tracking →"}
        </button>
      </form>
    </div>
  );
}

// ── Consistency card ──────────────────────────────────────────
function ConsistencyCard({ account, todayPnl }: { account: PropAccount; todayPnl: number }) {
  if (!account.consistency_rule || !account.consistency_percent) return null;
  const cap = account.account_size * (account.profit_target / 100) * (account.consistency_percent / 100);
  const pctUsed = pct(todayPnl, cap);
  const color = pctUsed >= 90 ? "#ef4444" : pctUsed >= 70 ? "#f97316" : "#4ade80";
  return (
    <div className="rounded-2xl p-5 border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
      <p className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280] mb-1">Consistency Rule</p>
      <p className="text-[#4b5563] text-xs mb-3">No single day can exceed {account.consistency_percent}% of your profit target</p>
      <div className="flex items-center justify-between mb-2">
        <span className="font-dm-mono text-sm text-white">Today: {fmtPnl(todayPnl)}</span>
        <span className="font-dm-mono text-sm font-bold" style={{ color }}>Cap: ${fmt(cap, 0)}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${pctUsed}%` }}
          transition={{ duration: 0.8 }} style={{ background: color }} />
      </div>
      {pctUsed >= 70 && (
        <p className="text-xs mt-2 font-dm-mono" style={{ color }}>
          {pctUsed >= 90 ? `⚠️ $${fmt(cap - todayPnl, 0)} from consistency limit — stop now` : `$${fmt(cap - todayPnl, 0)} remaining before consistency cap`}
        </p>
      )}
    </div>
  );
}

// ── Progress tab ──────────────────────────────────────────────
function ProgressTab({ account, todayPnl }: { account: PropAccount; todayPnl: number }) {
  const accountSize    = account.account_size;
  const profitAmt      = accountSize * (account.profit_target / 100);
  const dailyAvg       = account.current_pnl > 0 && account.trading_days_completed > 0
    ? account.current_pnl / account.trading_days_completed : 0;
  const daysRemaining  = dailyAvg > 0
    ? Math.ceil((profitAmt - account.current_pnl) / dailyAvg)
    : null;
  const drawdownUsed   = Math.max(0, -account.current_pnl);
  const ddPct          = pct(drawdownUsed, accountSize * (account.max_drawdown / 100));
  const failRisk       = Math.min(95, Math.round(ddPct * 0.6 + (account.trading_days_completed === 0 ? 15 : 0)));
  const riskLabel      = failRisk < 20 ? "LOW" : failRisk < 50 ? "MODERATE" : "HIGH";
  const riskColor      = failRisk < 20 ? "#4ade80" : failRisk < 50 ? "#f59e0b" : "#ef4444";

  const totalDays = account.min_trading_days;
  const daysNeeded = totalDays ? Math.max(0, totalDays - account.trading_days_completed) : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-6 border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
        <p className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280] mb-4">Evaluation Status</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: "Trading Days", value: `${account.trading_days_completed}/${totalDays ?? "∞"}`, good: totalDays ? account.trading_days_completed >= totalDays : true },
            { label: "Daily Breaches", value: "0", good: true },
            { label: "DD Breaches", value: "0", good: true },
            { label: "Profit Achieved", value: `$${fmt(Math.max(0, account.current_pnl), 0)} / $${fmt(profitAmt, 0)}`, good: account.current_pnl >= profitAmt },
            { label: "P&L Progress", value: `${Math.round(pct(Math.max(0, account.current_pnl), profitAmt))}%`, good: account.current_pnl > 0 },
            { label: "Status", value: account.current_pnl >= profitAmt ? "✅ TARGET HIT" : "ON TRACK", good: true },
          ].map(({ label, value, good }) => (
            <div key={label} className="rounded-xl p-3 border" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}>
              <p className="font-dm-mono text-[9px] text-[#4b5563] uppercase tracking-wider mb-1">{label}</p>
              <p className="font-dm-mono text-sm font-bold" style={{ color: good ? "#4ade80" : "#f87171" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <p className="font-dm-mono text-[10px] text-[#6b7280] mb-2">Profit target progress</p>
        <div className="h-3 rounded-full overflow-hidden mb-1" style={{ background: "rgba(255,255,255,0.06)" }}>
          <motion.div className="h-full rounded-full" initial={{ width: 0 }}
            animate={{ width: `${pct(Math.max(0, account.current_pnl), profitAmt)}%` }}
            transition={{ duration: 1 }} style={{ background: "#4ade80", boxShadow: "0 0 8px rgba(74,222,128,0.4)" }} />
        </div>
        <div className="flex justify-between">
          <span className="font-dm-mono text-[10px] text-[#374151]">$0</span>
          <span className="font-dm-mono text-[10px] text-[#374151]">${fmt(profitAmt, 0)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Projected completion */}
        <div className="rounded-2xl p-5 border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280] mb-3">Projected Completion</p>
          {daysRemaining != null && daysRemaining > 0 ? (
            <>
              <p className="font-bebas text-[40px] leading-none text-[#60a5fa] mb-1">{daysRemaining}</p>
              <p className="text-[#9ca3af] text-xs mb-3">more trading days at current pace</p>
              <p className="text-[#6b7280] text-xs leading-relaxed">
                At your current average of {fmtPnl(dailyAvg)}/day, you need ${fmt(Math.max(0, profitAmt - account.current_pnl), 0)} more.
                {daysNeeded > 0 && ` You still need ${daysNeeded} more trading days minimum.`}
              </p>
            </>
          ) : account.current_pnl >= profitAmt ? (
            <p className="text-[#4ade80] font-bold text-sm">🎉 Profit target reached!</p>
          ) : (
            <p className="text-[#4b5563] text-sm font-dm-mono">Log trades to see projection</p>
          )}
        </div>

        {/* Risk of failure */}
        <div className="rounded-2xl p-5 border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280] mb-3">Risk of Failure</p>
          <div className="flex items-center gap-3 mb-3">
            <span className="font-bebas text-[40px] leading-none" style={{ color: riskColor }}>{failRisk}%</span>
            <span className="px-2 py-0.5 rounded text-xs font-bold font-dm-mono" style={{ color: riskColor, background: `${riskColor}18` }}>{riskLabel}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: `${failRisk}%`, background: riskColor }} />
          </div>
          <p className="text-[#6b7280] text-xs">Based on current drawdown usage and trading patterns.</p>
        </div>
      </div>

      {/* Trading days tracker */}
      {totalDays && (
        <div className="rounded-2xl p-5 border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280] mb-4">
            Trading Days — {account.trading_days_completed}/{totalDays} completed
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: totalDays }).map((_, i) => (
              <div key={i} className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-dm-mono font-bold"
                style={i < account.trading_days_completed
                  ? { background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.35)", color: "#4ade80" }
                  : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#374151" }}>
                {i < account.trading_days_completed ? "✓" : i + 1}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Guide tab ─────────────────────────────────────────────────
function GuideTab() {
  const tips = [
    { n: 1, tip: "Never risk more than 1% per trade — consistency beats home runs every time." },
    { n: 2, tip: "Stop trading after 2 losses in a single day — protect your daily limit buffer." },
    { n: 3, tip: "Avoid trading 30 minutes before and after major news events." },
    { n: 4, tip: "Tuesday–Thursday tend to produce the cleanest setups — treat Monday and Friday carefully." },
    { n: 5, tip: "Keep position sizes consistent — don't size up when you're on a winning streak." },
    { n: 6, tip: "Journal every single trade — the log keeps you accountable and reveals patterns." },
    { n: 7, tip: "Take profits — don't let winners reverse into breakeven or losses." },
    { n: 8, tip: "Aim for 8% not 10% — give yourself a buffer so one bad day doesn't sink you." },
    { n: 9, tip: "Quality over quantity — 2–3 high-conviction trades beat 10 mediocre ones." },
    { n: 10, tip: "Treat the evaluation like a funded account from day one — build the habit now." },
  ];

  const rules = [
    { firm: "FTMO", rule: "Daily loss 5%, Max DD 10%, Profit 10% Phase 1, 5% Phase 2, Min 10 days" },
    { firm: "Topstep", rule: "Daily loss 4%, Max DD 8%, Profit 6%, No single day > 30% of target, Min 5 days" },
    { firm: "Apex", rule: "Daily loss 3%, Max DD 6%, Profit 6%, Min 7 days" },
    { firm: "The5ers", rule: "Daily loss 4%, Max DD 8%, Profit 8%, Consistency rule applies" },
    { firm: "Funded Next", rule: "Daily loss 5%, Max DD 10%, Profit 10%/5%, Min 5 days" },
    { firm: "CTI", rule: "Daily loss 4%, Max DD 8%, Profit 10%" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
        <p className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280] mb-5">10 Tips for Passing Your Evaluation</p>
        <div className="space-y-3">
          {tips.map(({ n, tip }) => (
            <div key={n} className="flex items-start gap-4 py-3 border-b border-white/[0.04] last:border-0">
              <span className="font-bebas text-[22px] leading-none text-[#00e676] flex-shrink-0 w-6">{n}</span>
              <p className="text-[#d1d5db] text-sm leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl p-6 border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
        <p className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280] mb-4">Quick Reference — Firm Rules</p>
        <div className="space-y-2">
          {rules.map(({ firm, rule }) => (
            <div key={firm} className="flex items-start gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
              <span className="font-dm-mono text-xs font-bold text-white w-24 flex-shrink-0">{firm}</span>
              <p className="text-[#6b7280] text-xs">{rule}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Portfolio overview ────────────────────────────────────────
function PortfolioOverview({ accounts, onSelect, onAdd, onDelete }: {
  accounts: PropAccount[]; onSelect: (a: PropAccount) => void;
  onAdd: () => void; onDelete: (id: string) => void;
}) {
  const totalCapital = accounts.reduce((s, a) => s + a.account_size, 0);
  const totalPnl     = accounts.reduce((s, a) => s + (a.current_pnl ?? 0), 0);
  const funded       = accounts.filter((a) => a.phase === "funded").length;
  const evaluations  = accounts.filter((a) => a.phase !== "funded").length;

  return (
    <div className="space-y-6">
      {accounts.length > 1 && (
        <div className="rounded-2xl p-5 border" style={{ background: "linear-gradient(145deg, rgba(251,191,36,0.04) 0%, rgba(255,255,255,0.01) 100%)", borderColor: "rgba(251,191,36,0.15)" }}>
          <p className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#fbbf24] mb-4">Portfolio Overview</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Capital", value: `$${fmt(totalCapital)}`, color: "#fbbf24" },
              { label: "Combined P&L", value: fmtPnl(totalPnl), color: totalPnl >= 0 ? "#4ade80" : "#f87171" },
              { label: "Evaluations", value: String(evaluations), color: "#60a5fa" },
              { label: "Funded", value: String(funded), color: "#4ade80" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className="font-dm-mono text-[9px] text-[#4b5563] uppercase tracking-wider mb-1">{label}</p>
                <p className="font-bebas text-[28px] leading-none" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((account) => {
          const dailyLossAmt = account.account_size * (account.max_daily_loss / 100);
          const profitAmt    = account.account_size * (account.profit_target / 100);
          const pnlPct       = pct(Math.max(0, account.current_pnl), profitAmt);
          const firm         = FIRMS.find((f) => f.name === account.firm_name);
          const color        = firm?.color ?? "#00e676";

          return (
            <motion.div key={account.id} whileHover={{ y: -2 }}
              className="rounded-2xl p-5 border border-white/[0.07] cursor-pointer"
              style={{ background: "rgba(255,255,255,0.02)" }}
              onClick={() => onSelect(account)}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-bold text-white text-base">{account.firm_name}</p>
                  <p className="font-dm-mono text-xs text-[#4b5563]">${fmt(account.account_size)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <PhaseBadge phase={account.phase} />
                  <button onClick={(e) => { e.stopPropagation(); if (confirm("Delete this account?")) onDelete(account.id); }}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[#4b5563] hover:text-[#f87171] transition-colors">
                    <svg width="11" height="12" viewBox="0 0 11 12" fill="none">
                      <path d="M1 2.5h9M3.5 2.5V1.5h4v1M2 2.5l.75 8h6.5L10 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-dm-mono text-[10px] text-[#4b5563]">Profit target</span>
                    <span className="font-dm-mono text-[10px] text-[#4ade80]">{Math.round(pnlPct)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pnlPct}%`, background: color }} />
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-dm-mono text-[#6b7280]">P&L</span>
                  <span className="font-dm-mono font-bold" style={{ color: account.current_pnl >= 0 ? "#4ade80" : "#f87171" }}>
                    {fmtPnl(account.current_pnl ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-dm-mono text-[#6b7280]">Daily limit</span>
                  <span className="font-dm-mono text-[#9ca3af]">${fmt(dailyLossAmt, 0)}</span>
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Add new */}
        <motion.button whileHover={{ y: -2 }} onClick={onAdd}
          className="rounded-2xl p-5 border border-dashed border-white/[0.1] flex flex-col items-center justify-center gap-3 text-[#4b5563] hover:text-[#9ca3af] hover:border-white/20 transition-all min-h-[160px]">
          <div className="w-10 h-10 rounded-xl border border-current flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <span className="font-dm-mono text-sm font-bold">Add Account</span>
        </motion.button>
      </div>
    </div>
  );
}

// ── Locked page ───────────────────────────────────────────────
function LockedPage() {
  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <AppNav />
      <main className="pt-28 pb-24 px-6">
        <div className="max-w-xl mx-auto text-center">
          <div className="mb-5"><EliteBadge /></div>
          <h1 className="font-bebas text-5xl md:text-[68px] tracking-wider mb-4 leading-none">PROP FIRM MODE</h1>
          <p className="text-[#6b7280] mb-10 text-base leading-relaxed max-w-md mx-auto">
            Track your funded account evaluation in real time. Never breach your rules again.
          </p>

          <div className="rounded-2xl p-6 mb-8 text-left"
            style={{ background: "#0c0f18", border: "1px solid rgba(251,191,36,0.12)" }}>
            <p className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#fbbf24] mb-4">What&apos;s included</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                "Real-time daily loss tracking",
                "Max drawdown monitoring",
                "Profit target progress",
                "Warning system before breaches",
                "Multiple account tracking",
                "AI coaching tips",
                "Consistency rule checker",
                "All major firms pre-configured",
                "Manual P&L trade log",
                "Evaluation progress timeline",
              ].map((f) => (
                <div key={f} className="flex items-center gap-2.5 text-sm text-[#d1d5db]">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="flex-shrink-0">
                    <path d="M2 6.5l3 3L11 2.5" stroke="#fbbf24" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {f}
                </div>
              ))}
            </div>
          </div>

          <p className="text-[#4b5563] text-sm mb-6">Less than the cost of one failed evaluation — £39/month</p>
          <Link href="/pricing"
            className="inline-block px-10 py-4 rounded-xl font-bold text-base transition-all hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)", color: "#080a10", boxShadow: "0 0 32px rgba(251,191,36,0.3)" }}>
            Upgrade to Elite
          </Link>
        </div>
      </main>
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────
function Dashboard({
  account, trades, clientId, onRefresh, onBack,
}: {
  account: PropAccount; trades: PropTrade[]; clientId: string | null;
  onRefresh: () => void; onBack: () => void;
}) {
  const [tab,          setTab]          = useState<DashTab>("dashboard");
  const [showTrade,    setShowTrade]    = useState(false);
  const [emergency,    setEmergency]    = useState<{ remaining: number; name: string } | null>(null);
  const [dismissedEm,  setDismissedEm]  = useState(false);
  const [localTrades,  setLocalTrades]  = useState<PropTrade[]>(trades);
  const [resetTime,    setResetTime]    = useState(timeUntilMidnightUTC());

  useEffect(() => { setLocalTrades(trades); }, [trades]);
  useEffect(() => {
    const t = setInterval(() => setResetTime(timeUntilMidnightUTC()), 60000);
    return () => clearInterval(t);
  }, []);

  const todayStr    = todayISO();
  const todayTrades = localTrades.filter((t) => t.trade_date === todayStr);
  const todayPnl    = todayTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);

  const acctSize         = account.account_size;
  const maxDailyLossAmt  = acctSize * (account.max_daily_loss / 100);
  const maxDDAmt         = acctSize * (account.max_drawdown / 100);
  const profitTargetAmt  = acctSize * (account.profit_target / 100);

  const dailyLossUsed = Math.max(0, -todayPnl);
  const drawdownUsed  = Math.max(0, -account.current_pnl);
  const profitAchieved = Math.max(0, account.current_pnl);

  const dailyPct  = pct(dailyLossUsed, maxDailyLossAmt);
  const ddPct     = pct(drawdownUsed,  maxDDAmt);

  // Warning levels
  const warningLevel = (p: number): "info" | "warning" | "danger" | null =>
    p >= 85 ? "danger" : p >= 70 ? "warning" : p >= 50 ? "info" : null;

  const dailyWarning = warningLevel(dailyPct);
  const ddWarning    = warningLevel(ddPct);

  // Emergency modal at 95%
  useEffect(() => {
    if (!dismissedEm && dailyPct >= 95) {
      setEmergency({ remaining: maxDailyLossAmt - dailyLossUsed, name: "daily loss limit" });
    } else if (!dismissedEm && ddPct >= 95) {
      setEmergency({ remaining: maxDDAmt - drawdownUsed, name: "max drawdown" });
    }
  }, [dailyPct, ddPct, dismissedEm, maxDailyLossAmt, dailyLossUsed, maxDDAmt, drawdownUsed]);

  function handleTradeSaved(trade: PropTrade) {
    setLocalTrades((prev) => [trade, ...prev]);
    onRefresh();
  }

  async function handleDeleteTrade(tradeId: string, tradePnl: number) {
    if (!confirm("Delete this trade?")) return;
    await fetch(`/api/prop-firm/${account.id}/trades?trade_id=${tradeId}`, { method: "DELETE" });
    setLocalTrades((prev) => prev.filter((t) => t.id !== tradeId));
    onRefresh();
    void tradePnl;
  }

  const firm = FIRMS.find((f) => f.name === account.firm_name);
  const color = firm?.color ?? "#00e676";

  // AI tips
  const tips = useMemo(() => {
    const t: string[] = [];
    if (todayTrades.length >= 3) t.push(`You have taken ${todayTrades.length} trades today. Consider your win rate drops after multiple trades — think carefully before entering again.`);
    if (account.trading_days_completed > 0 && profitAchieved / account.trading_days_completed < (profitTargetAmt / 30))
      t.push(`You are ahead of pace. Take it slow — you have ${account.min_trading_days ? account.min_trading_days - account.trading_days_completed : "many"} days of quality trading left.`);
    if (dailyPct === 0 && account.trading_days_completed > 3)
      t.push("Your risk management is excellent — you have not hit any daily loss today.");
    if (ddPct > 50) t.push("Your drawdown is above 50%. Consider reducing position sizes until you have more buffer.");
    t.push("Aim for 2–3 quality setups per day. Overtrading is the number one reason evaluations fail.");
    return t.slice(0, 4);
  }, [account, todayTrades, profitAchieved, profitTargetAmt, dailyPct, ddPct]);

  return (
    <div>
      {emergency && !dismissedEm && (
        <EmergencyModal remaining={emergency.remaining} limitName={emergency.name}
          onDismiss={() => { setDismissedEm(true); setEmergency(null); }} />
      )}
      {showTrade && <LogTradeModal accountId={account.id} clientId={clientId} onClose={() => setShowTrade(false)} onSaved={handleTradeSaved} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <button onClick={onBack} className="flex items-center gap-2 text-[#4b5563] hover:text-white text-xs font-dm-mono mb-2 transition-colors">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            All Accounts
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-bebas text-[32px] leading-none text-white tracking-wider">{account.firm_name}</h2>
            <PhaseBadge phase={account.phase} />
          </div>
          <p className="font-dm-mono text-sm text-[#4b5563] mt-1">${fmt(account.account_size)} account</p>
        </div>
        <button onClick={() => setShowTrade(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 self-start"
          style={{ background: "#fbbf24", color: "#080a10", boxShadow: "0 0 20px rgba(251,191,36,0.25)" }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Log Trade
        </button>
      </div>

      {/* Warnings */}
      <div className="space-y-2 mb-6">
        <AnimatePresence>
          {dailyWarning && (
            <WarningBanner key="daily" level={dailyWarning} remaining={maxDailyLossAmt - dailyLossUsed} limitName="daily loss limit" />
          )}
          {ddWarning && (
            <WarningBanner key="dd" level={ddWarning} remaining={maxDDAmt - drawdownUsed} limitName="max drawdown" />
          )}
        </AnimatePresence>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {(["dashboard", "progress", "guide"] as DashTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-semibold font-dm-mono transition-all capitalize"
            style={tab === t ? { background: color, color: "#080a10" } : { color: "#6b7280" }}>
            {t}
          </button>
        ))}
      </div>

      {/* Dashboard tab */}
      {tab === "dashboard" && (
        <div className="space-y-5">
          {/* 4 Progress cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ProgressCard
              title="Daily Loss"
              used={dailyLossUsed} limit={maxDailyLossAmt}
              usedLabel={`$${fmt(dailyLossUsed, 0)} of $${fmt(maxDailyLossAmt, 0)} used`}
              remaining={`$${fmt(maxDailyLossAmt - dailyLossUsed, 0)} remaining`}
              suffix={`Resets in ${resetTime}`}
            />
            <ProgressCard
              title="Max Drawdown"
              used={drawdownUsed} limit={maxDDAmt}
              usedLabel={`$${fmt(drawdownUsed, 0)} of $${fmt(maxDDAmt, 0)}`}
              remaining={`$${fmt(maxDDAmt - drawdownUsed, 0)} before breach`}
            />
            <ProgressCard
              title="Profit Target"
              used={profitAchieved} limit={profitTargetAmt}
              usedLabel={`$${fmt(profitAchieved, 0)} of $${fmt(profitTargetAmt, 0)}`}
              remaining={profitAchieved >= profitTargetAmt ? "✅ TARGET REACHED" : `$${fmt(profitTargetAmt - profitAchieved, 0)} to target`}
              phase={profitAchieved >= profitTargetAmt ? "PASSED" : undefined}
              invert
            />
            <ProgressCard
              title="Trading Days"
              used={account.trading_days_completed}
              limit={account.min_trading_days ?? Math.max(account.trading_days_completed, 10)}
              usedLabel={`${account.trading_days_completed} of ${account.min_trading_days ?? "∞"} days`}
              remaining={account.min_trading_days
                ? `${Math.max(0, account.min_trading_days - account.trading_days_completed)} more needed`
                : "No minimum required"}
              invert
            />
          </div>

          {/* Account summary */}
          <div className="rounded-2xl p-5 border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
            <p className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280] mb-4">Account Summary</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Starting Balance", value: `$${fmt(acctSize)}`, color: "#9ca3af" },
                { label: "Current Balance",  value: `$${fmt(acctSize + account.current_pnl)}`, color: account.current_pnl >= 0 ? "#4ade80" : "#f87171" },
                { label: "Net P&L",          value: `${fmtPnl(account.current_pnl)} (${((account.current_pnl / acctSize) * 100).toFixed(2)}%)`, color: account.current_pnl >= 0 ? "#4ade80" : "#f87171" },
                { label: "Today&apos;s P&L", value: fmtPnl(todayPnl), color: todayPnl >= 0 ? "#4ade80" : "#f87171" },
                { label: "Trades Today",     value: String(todayTrades.length), color: "#9ca3af" },
                { label: "Trading Days",     value: String(account.trading_days_completed), color: "#9ca3af" },
                { label: "Max Lot",          value: account.max_lot_size ? String(account.max_lot_size) : "Unlimited", color: "#9ca3af" },
                { label: "Phase",            value: account.phase, color: "#60a5fa" },
              ].map(({ label, value, color: c }) => (
                <div key={label}>
                  <p className="font-dm-mono text-[9px] text-[#4b5563] uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="font-dm-mono text-sm font-bold" style={{ color: c }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Consistency */}
          <ConsistencyCard account={account} todayPnl={todayPnl} />

          {/* Today's trade log */}
          <div className="rounded-2xl p-5 border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280]">Today&apos;s Trades</p>
                <p className="font-dm-mono text-xs text-[#4b5563] mt-0.5">
                  {todayTrades.length} trades · Net: <span style={{ color: todayPnl >= 0 ? "#4ade80" : "#f87171" }}>{fmtPnl(todayPnl)}</span>
                </p>
              </div>
              <button onClick={() => setShowTrade(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}>
                + Add Trade
              </button>
            </div>
            {todayTrades.length === 0 ? (
              <p className="text-[#374151] text-sm font-dm-mono">No trades logged today</p>
            ) : (
              <div className="space-y-2">
                {todayTrades.map((trade) => (
                  <div key={trade.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                    <div className="flex items-center gap-3">
                      {trade.direction && (
                        <span className="font-dm-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: trade.direction === "LONG" ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", color: trade.direction === "LONG" ? "#4ade80" : "#f87171" }}>
                          {trade.direction}
                        </span>
                      )}
                      <span className="font-dm-mono text-sm text-[#9ca3af]">{trade.asset ?? "—"}</span>
                      {trade.notes && <span className="text-[#374151] text-xs">{trade.notes}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-dm-mono text-sm font-bold" style={{ color: trade.pnl >= 0 ? "#4ade80" : "#f87171" }}>
                        {fmtPnl(trade.pnl)}
                      </span>
                      <button onClick={() => handleDeleteTrade(trade.id, trade.pnl)}
                        className="w-6 h-6 flex items-center justify-center text-[#4b5563] hover:text-[#f87171] transition-colors">
                        <svg width="10" height="11" viewBox="0 0 11 12" fill="none">
                          <path d="M1 2.5h9M3.5 2.5V1.5h4v1M2 2.5l.75 8h6.5L10 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI tips */}
          <div className="rounded-2xl p-5 border" style={{ background: "rgba(255,255,255,0.02)", borderColor: `${color}18` }}>
            <p className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280] mb-4">Coaching Tips for Your Evaluation</p>
            <div className="space-y-3">
              {tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ borderColor: `${color}40`, background: `${color}10` }}>
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3l2 2 4-4" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <p className="text-[#d1d5db] text-sm leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "progress" && <ProgressTab account={account} todayPnl={todayPnl} />}
      {tab === "guide"    && <GuideTab />}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function PropFirmPage() {
  const { isElite } = useUserPlan();
  const [mounted,    setMounted]    = useState(false);
  const [view,       setView]       = useState<View>("loading");
  const [accounts,   setAccounts]   = useState<PropAccount[]>([]);
  const [clientId,   setClientId]   = useState<string | null>(null);
  const [activeId,   setActiveId]   = useState<string | null>(null);
  const [setupFirm,  setSetupFirm]  = useState<FirmPreset | null>(null);
  const [todayTrades, setTodayTrades] = useState<PropTrade[]>([]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !isElite) return;
    const id = localStorage.getItem("ciq_client_id");
    setClientId(id);
    if (!id) { setView("portfolio"); return; }

    fetch(`/api/prop-firm?client_id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.accounts?.length > 0) {
          setAccounts(d.accounts);
          setActiveId(d.accounts[0].id);
          setView("dashboard");
        } else {
          setView("portfolio");
        }
      })
      .catch(() => setView("portfolio"));
  }, [mounted, isElite]);

  // Load today's trades when active account changes
  useEffect(() => {
    if (!activeId) return;
    const today = todayISO();
    fetch(`/api/prop-firm/${activeId}/trades?date=${today}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setTodayTrades(d.trades ?? []); });
  }, [activeId]);

  const activeAccount = accounts.find((a) => a.id === activeId) ?? null;

  function handleAccountSaved(account: PropAccount) {
    setAccounts((prev) => [account, ...prev]);
    setActiveId(account.id);
    setSetupFirm(null);
    setView("dashboard");
  }

  async function handleDeleteAccount(id: string) {
    await fetch(`/api/prop-firm/${id}`, { method: "DELETE" });
    const remaining = accounts.filter((a) => a.id !== id);
    setAccounts(remaining);
    if (activeId === id) {
      setActiveId(remaining[0]?.id ?? null);
      setView(remaining.length > 0 ? "dashboard" : "portfolio");
    }
  }

  function refreshAccount() {
    if (!activeId) return;
    fetch(`/api/prop-firm?client_id=${encodeURIComponent(clientId ?? "")}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setAccounts(d.accounts ?? []); });
  }

  if (!mounted) return null;
  if (!isElite)  return <LockedPage />;

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <AppNav />

      {/* Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(251,191,36,0.04) 0%, transparent 70%)" }} />
      </div>

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-20">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="mb-3"><EliteBadge /></div>
            <h1 className="font-bebas text-[clamp(40px,6vw,64px)] leading-none tracking-[0.03em] text-white">
              PROP FIRM <span style={{ color: "#fbbf24" }}>MODE</span>
            </h1>
            <p className="text-[#6b7280] text-sm mt-2 max-w-md">
              Track your evaluation in real time. Never breach your rules again.
            </p>
          </div>

          {/* Account switcher */}
          {accounts.length > 0 && view === "dashboard" && (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={activeId ?? ""}
                onChange={(e) => { setActiveId(e.target.value); setTodayTrades([]); }}
                className="px-3 py-2 rounded-xl text-sm font-dm-mono text-white outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.firm_name} ${fmt(a.account_size)} — {a.phase}</option>
                ))}
              </select>
              <button
                onClick={() => setView("portfolio")}
                className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: "rgba(255,255,255,0.04)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.08)" }}>
                All Accounts
              </button>
            </div>
          )}
        </div>

        {/* Loading */}
        {view === "loading" && (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
              <path d="M12 2a10 10 0 0110 10" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        )}

        {/* Portfolio / add accounts */}
        {(view === "portfolio" || view === "select-firm") && (
          <div className="space-y-8">
            {view === "portfolio" && (
              <PortfolioOverview
                accounts={accounts}
                onSelect={(a) => { setActiveId(a.id); setView("dashboard"); }}
                onAdd={() => setView("select-firm")}
                onDelete={handleDeleteAccount}
              />
            )}
            {view === "select-firm" && !setupFirm && (
              <div>
                <button onClick={() => setView("portfolio")}
                  className="flex items-center gap-2 text-[#6b7280] hover:text-white text-sm mb-6 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Back
                </button>
                <FirmGrid onSelect={(f) => setSetupFirm(f)} />
              </div>
            )}
            {setupFirm && (
              <SetupForm
                firm={setupFirm}
                clientId={clientId}
                onSaved={handleAccountSaved}
                onBack={() => setSetupFirm(null)}
              />
            )}
          </div>
        )}

        {/* Setup directly from empty state */}
        {view === "setup" && setupFirm && (
          <SetupForm
            firm={setupFirm}
            clientId={clientId}
            onSaved={handleAccountSaved}
            onBack={() => { setSetupFirm(null); setView("select-firm"); }}
          />
        )}

        {/* Dashboard */}
        {view === "dashboard" && activeAccount && (
          <Dashboard
            account={activeAccount}
            trades={todayTrades}
            clientId={clientId}
            onRefresh={refreshAccount}
            onBack={() => setView("portfolio")}
          />
        )}

        {/* No accounts yet */}
        {view === "portfolio" && accounts.length === 0 && !setupFirm && (
          <div className="mt-4" />
        )}
      </main>
    </div>
  );
}
