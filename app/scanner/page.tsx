"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import AppNav from "@/app/components/AppNav";
import { useUserPlan } from "@/app/lib/plan-context";
import type { ScannerResult, ScanCategory } from "@/app/lib/scanner-logic";

// ── Helpers ────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function countdownFrom(iso: string): string {
  const next = new Date(iso).getTime() + 3600_000;
  const remaining = Math.max(0, next - Date.now());
  const m = Math.floor(remaining / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  return `${m}m ${s}s`;
}

const GRADE_COLOR: Record<string, string> = {
  "A+": "#ffd740", "A": "#f59e0b", "B": "#60a5fa", "C": "#9ca3af", "D": "#6b7280",
};

const SIGNAL_COLOR = { LONG: "#00e676", SHORT: "#f87171", NEUTRAL: "#9ca3af" };

// ── Locked page for non-Elite ──────────────────────────────────

function LockedPage() {
  return (
    <div className="min-h-screen bg-[#080a10] text-white flex flex-col">
      <AppNav />
      <div className="flex-1 flex items-center justify-center px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
            style={{ background: "rgba(0,230,118,0.08)", border: "1px solid rgba(0,230,118,0.2)" }}>
            <span className="text-3xl">📡</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-4 font-dm-mono text-[10px] font-bold tracking-widest"
            style={{ background: "rgba(0,230,118,0.1)", border: "1px solid rgba(0,230,118,0.25)", color: "#00e676" }}>
            ELITE ONLY
          </div>
          <h1 className="font-bebas text-[48px] tracking-[0.04em] text-white leading-none mb-4">
            MARKET SCANNER
          </h1>
          <p className="text-[#6b7280] text-sm leading-relaxed mb-8">
            AI scans 11 markets every hour for A+ setups — so you never miss one.
            Upgrade to Elite to unlock real-time scanning.
          </p>
          {/* Blurred preview */}
          <div className="relative rounded-2xl overflow-hidden mb-8"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ filter: "blur(6px)", pointerEvents: "none", userSelect: "none" }}
              className="grid grid-cols-2 gap-3 p-4">
              {["XAU/USD", "BTC/USD", "EUR/USD", "NAS100"].map((a) => (
                <div key={a} className="rounded-xl p-3"
                  style={{ background: "rgba(0,230,118,0.06)", border: "1px solid rgba(0,230,118,0.15)" }}>
                  <p className="font-bebas text-xl text-white">{a}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-full font-dm-mono text-[9px] font-bold text-[#080a10] bg-[#00e676]">LONG</span>
                    <span className="px-2 py-0.5 rounded-full font-dm-mono text-[9px] font-bold text-[#080a10] bg-[#ffd740]">A+</span>
                  </div>
                  <p className="font-dm-mono text-[10px] text-[#6b7280] mt-2">88% confidence</p>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(8,10,16,0.7)" }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="mr-2">
                <rect x="2" y="9" width="16" height="10" rx="2" stroke="#00e676" strokeWidth="1.3"/>
                <path d="M6 9V6.5a4 4 0 018 0V9" stroke="#00e676" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <Link href="/pricing"
            className="inline-block w-full py-3.5 rounded-2xl font-bebas text-[18px] tracking-[0.06em] transition-all hover:-translate-y-0.5"
            style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 30px rgba(0,230,118,0.3)" }}>
            UPGRADE TO ELITE — £39/MO
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

// ── Signal badge ───────────────────────────────────────────────

function SignalBadge({ signal }: { signal: string }) {
  const color = SIGNAL_COLOR[signal as keyof typeof SIGNAL_COLOR] ?? "#9ca3af";
  return (
    <span className="px-2 py-0.5 rounded-full font-dm-mono text-[9px] font-bold"
      style={{ background: `${color}20`, border: `1px solid ${color}40`, color }}>
      {signal}
    </span>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const color = GRADE_COLOR[grade] ?? "#6b7280";
  return (
    <span className="px-2 py-0.5 rounded-full font-dm-mono text-[9px] font-bold"
      style={{ background: `${color}20`, border: `1px solid ${color}50`, color }}>
      {grade}
    </span>
  );
}

// ── Setup card ─────────────────────────────────────────────────

function SetupCard({ r, onView }: { r: ScannerResult; onView: (r: ScannerResult) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 flex flex-col gap-3 cursor-default"
      style={{ background: "#0d1310", border: "1px solid rgba(0,230,118,0.15)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bebas text-[22px] tracking-[0.04em] text-white leading-none">{r.asset}</p>
          <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] mt-0.5">{r.setup_type}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <SignalBadge signal={r.signal} />
          <GradeBadge grade={r.grade} />
        </div>
      </div>

      {/* Confidence bar */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280]">Confidence</span>
          <span className="font-dm-mono text-[10px] font-bold text-[#00e676]">{r.confidence}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.05]">
          <div className="h-full rounded-full"
            style={{ width: `${r.confidence}%`, background: `linear-gradient(90deg, #00b84a, #00e676)` }} />
        </div>
      </div>

      {/* Levels */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Entry",  val: r.entry,     color: "#9ca3af" },
          { label: "SL",     val: r.stop_loss, color: "#f87171" },
          { label: "TP",     val: r.take_profit, color: "#4ade80" },
        ].map((row) => (
          <div key={row.label} className="rounded-xl p-2 text-center"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="font-dm-mono text-[8px] uppercase tracking-wider mb-0.5" style={{ color: row.color }}>{row.label}</p>
            <p className="font-dm-mono text-[10px] font-bold text-white truncate">{row.val}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="font-dm-mono text-[9px] text-[#4b5563]">Detected {timeAgo(r.created_at)}</p>
        <button onClick={() => onView(r)}
          className="px-3 py-1.5 rounded-lg font-dm-mono text-[10px] font-bold transition-all hover:-translate-y-0.5"
          style={{ background: "rgba(0,230,118,0.1)", border: "1px solid rgba(0,230,118,0.25)", color: "#00e676" }}>
          View analysis →
        </button>
      </div>
    </motion.div>
  );
}

// ── No-setup card ──────────────────────────────────────────────

function NoSetupCard({ r }: { r: ScannerResult }) {
  return (
    <div className="rounded-2xl p-5 opacity-40"
      style={{ background: "#0a0c12", border: "1px solid rgba(255,255,255,0.05)" }}>
      <p className="font-bebas text-[22px] tracking-[0.04em] text-white leading-none mb-1">{r.asset}</p>
      <p className="font-dm-mono text-[10px] text-[#4b5563] mb-3">No setup detected</p>
      <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.04] mb-1">
        <div className="h-full rounded-full bg-[#374151]" style={{ width: `${r.confidence}%` }} />
      </div>
      <p className="font-dm-mono text-[9px] text-[#374151]">{r.confidence}% — below threshold</p>
    </div>
  );
}

// ── Analysis modal ─────────────────────────────────────────────

function AnalysisModal({ r, onClose }: { r: ScannerResult; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8,10,16,0.85)" }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        className="w-full max-w-lg rounded-2xl p-6 overflow-y-auto max-h-[90vh]"
        style={{ background: "#0d1310", border: "1px solid rgba(0,230,118,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="font-bebas text-[32px] tracking-[0.04em] text-white leading-none">{r.asset}</p>
            <p className="font-dm-mono text-[10px] uppercase tracking-widest text-[#6b7280] mt-0.5">{r.setup_type} · {r.timeframe}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <SignalBadge signal={r.signal} />
            <GradeBadge grade={r.grade} />
            <button onClick={onClose} className="ml-2 w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition-colors">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2l6 6M8 2L2 8" stroke="#9ca3af" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Confidence */}
        <div className="rounded-xl p-4 mb-4"
          style={{ background: "rgba(0,230,118,0.06)", border: "1px solid rgba(0,230,118,0.15)" }}>
          <div className="flex justify-between items-center mb-2">
            <span className="font-dm-mono text-[10px] uppercase tracking-widest text-[#6b7280]">Confidence</span>
            <span className="font-dm-mono text-xl font-bold text-[#00e676]">{r.confidence}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-white/[0.06]">
            <div className="h-full rounded-full" style={{ width: `${r.confidence}%`, background: "linear-gradient(90deg, #00b84a, #00e676)" }} />
          </div>
        </div>

        {/* Levels grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: "Entry Price",   val: r.entry,         color: "#9ca3af" },
            { label: "Risk/Reward",   val: r.risk_reward,   color: "#9ca3af" },
            { label: "Stop Loss",     val: r.stop_loss,     color: "#f87171" },
            { label: "Take Profit",   val: r.take_profit,   color: "#4ade80" },
          ].map((row) => (
            <div key={row.label} className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="font-dm-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: row.color }}>{row.label}</p>
              <p className="font-dm-mono text-sm font-bold text-white">{row.val || "—"}</p>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="rounded-xl p-4 mb-4"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] mb-2">AI Summary</p>
          <p className="text-[#d1d5db] text-sm leading-relaxed">{r.summary}</p>
        </div>

        <div className="flex gap-3">
          <Link href={`/calculator?entry=${r.entry}&sl=${r.stop_loss}&tp=${r.take_profit}`}
            className="flex-1 py-2.5 rounded-xl text-center font-dm-mono text-xs font-bold transition-all hover:-translate-y-0.5"
            style={{ background: "rgba(0,230,118,0.1)", border: "1px solid rgba(0,230,118,0.25)", color: "#00e676" }}>
            Open in Calculator →
          </Link>
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl font-dm-mono text-xs text-[#6b7280] transition-colors hover:text-white"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Filter chip ────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-lg font-dm-mono text-[10px] uppercase tracking-wider font-semibold border transition-all"
      style={active
        ? { background: "#00e676", color: "#080a10", borderColor: "#00e676" }
        : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)", color: "#6b7280" }}>
      {label}
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────

const MANUAL_SCAN_KEY = "ciq_scanner_manual";
const DAILY_LIMIT = 3;

function getDailyCounts(): { date: string; count: number } {
  try {
    const stored = JSON.parse(localStorage.getItem(MANUAL_SCAN_KEY) ?? "{}");
    const today = new Date().toDateString();
    return { date: today, count: stored[today] ?? 0 };
  } catch { return { date: new Date().toDateString(), count: 0 }; }
}

function incrementDailyCount() {
  try {
    const today = new Date().toDateString();
    const stored = JSON.parse(localStorage.getItem(MANUAL_SCAN_KEY) ?? "{}");
    stored[today] = (stored[today] ?? 0) + 1;
    localStorage.setItem(MANUAL_SCAN_KEY, JSON.stringify(stored));
  } catch { /* ignore */ }
}

export default function ScannerPage() {
  const { isElite } = useUserPlan();

  const [results, setResults]             = useState<ScannerResult[]>([]);
  const [lastScan, setLastScan]           = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);
  const [scanning, setScanning]           = useState(false);
  const [modalResult, setModalResult]     = useState<ScannerResult | null>(null);
  const [catFilter, setCatFilter]         = useState<"all" | ScanCategory>("all");
  const [gradeFilter, setGradeFilter]     = useState<"all" | "A+" | "A" | "B">("all");
  const [signalFilter, setSignalFilter]   = useState<"all" | "LONG" | "SHORT">("all");
  const [countdown, setCountdown]         = useState("—");
  const [manualUsed, setManualUsed]       = useState(0);

  useEffect(() => {
    const { count } = getDailyCounts();
    setManualUsed(count);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!lastScan) return;
    const id = setInterval(() => setCountdown(countdownFrom(lastScan)), 1000);
    setCountdown(countdownFrom(lastScan));
    return () => clearInterval(id);
  }, [lastScan]);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch("/api/scanner");
      const data = await res.json();
      setResults(data.results ?? []);
      setLastScan(data.lastScan ?? null);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (isElite) fetchResults(); else setLoading(false); }, [isElite, fetchResults]);

  async function handleManualScan() {
    const { count } = getDailyCounts();
    if (count >= DAILY_LIMIT) return;
    setScanning(true);
    try {
      const res = await fetch("/api/scanner", { method: "POST" });
      const data = await res.json();
      setResults(data.results ?? []);
      setLastScan(data.lastScan ?? null);
      incrementDailyCount();
      setManualUsed(count + 1);
    } catch { /* ignore */ }
    finally { setScanning(false); }
  }

  if (!isElite && !loading) return <LockedPage />;

  // Filter results
  const filtered = results.filter((r) => {
    if (catFilter !== "all" && r.category !== catFilter) return false;
    if (gradeFilter !== "all" && r.grade !== gradeFilter) return false;
    if (signalFilter !== "all" && r.signal !== signalFilter) return false;
    return true;
  });

  const withSetups = filtered.filter((r) => r.has_setup);
  const noSetups   = filtered.filter((r) => !r.has_setup);
  const manualLeft = DAILY_LIMIT - manualUsed;

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <AppNav />

      <main className="max-w-6xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-4 font-dm-mono text-[10px] font-bold tracking-widest"
            style={{ background: "rgba(0,230,118,0.1)", border: "1px solid rgba(0,230,118,0.25)", color: "#00e676" }}>
            ELITE ONLY
          </div>
          <h1 className="font-bebas text-[clamp(40px,5vw,64px)] tracking-[0.04em] text-white leading-none mb-2">
            MARKET SCANNER
          </h1>
          <p className="text-[#6b7280] text-base max-w-xl leading-relaxed">
            AI scanning 11 markets every hour for A+ setups — so you never miss one
          </p>
        </div>

        {/* Status bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] mb-0.5">Last scan</p>
              <p className="font-dm-mono text-sm font-bold text-white">
                {lastScan ? timeAgo(lastScan) : "Never"}
              </p>
            </div>
            <div>
              <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] mb-0.5">Next scan in</p>
              <p className="font-dm-mono text-sm font-bold text-[#00e676]">{lastScan ? countdown : "—"}</p>
            </div>
            <div>
              <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] mb-0.5">Active setups</p>
              <p className="font-dm-mono text-sm font-bold text-white">{withSetups.length}</p>
            </div>
          </div>
          <button
            onClick={handleManualScan}
            disabled={scanning || manualLeft <= 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-dm-mono text-xs font-bold transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "rgba(0,230,118,0.12)", border: "1px solid rgba(0,230,118,0.3)", color: "#00e676" }}>
            {scanning ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-[#00e676]/30 border-t-[#00e676] animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M6.5 4v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                Scan now ({manualLeft} left today)
              </>
            )}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          <div className="flex gap-1.5 flex-wrap">
            {(["all", "forex", "crypto", "stocks", "commodities"] as const).map((c) => (
              <Chip key={c} label={c === "all" ? "All" : c.charAt(0).toUpperCase() + c.slice(1)}
                active={catFilter === c} onClick={() => setCatFilter(c)} />
            ))}
          </div>
          <div className="w-px bg-white/[0.07] mx-1 hidden sm:block" />
          <div className="flex gap-1.5 flex-wrap">
            {(["all", "A+", "A", "B"] as const).map((g) => (
              <Chip key={g} label={g === "all" ? "All grades" : `Grade ${g}`}
                active={gradeFilter === g} onClick={() => setGradeFilter(g)} />
            ))}
          </div>
          <div className="w-px bg-white/[0.07] mx-1 hidden sm:block" />
          <div className="flex gap-1.5 flex-wrap">
            {(["all", "LONG", "SHORT"] as const).map((s) => (
              <Chip key={s} label={s === "all" ? "All signals" : s}
                active={signalFilter === s} onClick={() => setSignalFilter(s)} />
            ))}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-[#00e676]/20 border-t-[#00e676] animate-spin" />
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">📡</p>
            <p className="font-bebas text-3xl tracking-[0.04em] text-white mb-2">NO SCAN DATA YET</p>
            <p className="text-[#6b7280] text-sm mb-6">The hourly cron runs automatically. Hit "Scan now" for an immediate scan.</p>
            <button onClick={handleManualScan} disabled={scanning || manualLeft <= 0}
              className="px-6 py-3 rounded-xl font-dm-mono text-sm font-bold transition-all hover:-translate-y-0.5 disabled:opacity-40"
              style={{ background: "#00e676", color: "#080a10" }}>
              {scanning ? "Scanning…" : "Run first scan"}
            </button>
          </div>
        ) : withSetups.length === 0 && noSetups.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-bebas text-2xl tracking-[0.04em] text-white mb-2">NO A+ SETUPS DETECTED</p>
            <p className="text-[#6b7280] text-sm mb-1">Markets may be ranging or consolidating</p>
            <p className="font-dm-mono text-[11px] text-[#4b5563]">Next scan in {countdown}</p>
          </div>
        ) : (
          <>
            {withSetups.length > 0 && (
              <div className="mb-8">
                <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#00e676] font-semibold mb-4">
                  Active Setups ({withSetups.length})
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {withSetups.map((r) => (
                    <SetupCard key={r.id} r={r} onView={setModalResult} />
                  ))}
                </div>
              </div>
            )}

            {noSetups.length > 0 && (
              <div>
                <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#4b5563] font-semibold mb-4">
                  No Setup ({noSetups.length})
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {noSetups.map((r) => (
                    <NoSetupCard key={r.id} r={r} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* SQL reminder */}
        <div className="mt-16 rounded-2xl p-5 font-dm-mono text-[11px] leading-relaxed text-[#4b5563]"
          style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-[#6b7280] font-bold mb-2">Setup required — run once in Supabase SQL Editor:</p>
          <pre className="whitespace-pre-wrap text-[10px] text-[#374151]">{`CREATE TABLE scanner_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  asset text, category text, timeframe text,
  signal text, confidence integer, grade text,
  entry text, stop_loss text, take_profit text,
  risk_reward text, summary text, setup_type text,
  has_setup boolean DEFAULT false,
  is_active boolean DEFAULT true
);
ALTER TABLE scanner_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON scanner_results FOR ALL USING (true) WITH CHECK (true);`}</pre>
        </div>
      </main>

      {/* Modal */}
      <AnimatePresence>
        {modalResult && (
          <AnalysisModal r={modalResult} onClose={() => setModalResult(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
