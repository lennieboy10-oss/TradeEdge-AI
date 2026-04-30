"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { JournalEntry, Outcome } from "@/app/lib/supabase";
import { AuthNavButtons } from "@/app/providers";
import { useUserPlan } from "@/app/lib/plan-context";
import { ProLockedPage } from "@/app/components/ProLockedPage";

// ── Shared pieces ─────────────────────────────────────────────
function LogoMark() {
  return (
    <div className="w-8 h-8 rounded-full bg-[#00e676] flex items-center justify-center flex-shrink-0">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="#080a10" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00e676]/30 bg-[#00e676]/10 text-[#00e676] text-xs font-semibold tracking-[0.13em] uppercase mb-5">
      {children}
    </div>
  );
}

// ── Stats ─────────────────────────────────────────────────────
function calcStats(entries: JournalEntry[]) {
  const total   = entries.length;
  const decided = entries.filter((e) => e.outcome === "WIN" || e.outcome === "LOSS");
  const wins    = entries.filter((e) => e.outcome === "WIN").length;
  const winRate = decided.length > 0 ? Math.round((wins / decided.length) * 100) : null;

  const rrNums = entries
    .map((e) => {
      if (!e.risk_reward) return null;
      const m = e.risk_reward.match(/1[: ](\d+\.?\d*)/);
      return m ? parseFloat(m[1]) : null;
    })
    .filter((v): v is number => v !== null);
  const avgRR = rrNums.length > 0
    ? (rrNums.reduce((a, b) => a + b, 0) / rrNums.length).toFixed(1)
    : null;

  const assetWins: Record<string, number> = {};
  entries
    .filter((e) => e.outcome === "WIN" && e.asset)
    .forEach((e) => { assetWins[e.asset!] = (assetWins[e.asset!] || 0) + 1; });
  const bestAsset = Object.keys(assetWins).length > 0
    ? Object.entries(assetWins).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  // Best session by win rate (requires ≥2 decided trades in that session)
  const sessionWins: Record<string, number>  = {};
  const sessionTotal: Record<string, number> = {};
  entries
    .filter((e) => (e.outcome === "WIN" || e.outcome === "LOSS") && e.entry_session)
    .forEach((e) => {
      const s = e.entry_session!;
      sessionTotal[s] = (sessionTotal[s] || 0) + 1;
      if (e.outcome === "WIN") sessionWins[s] = (sessionWins[s] || 0) + 1;
    });
  let bestSession: string | null = null;
  let bestSessionRate = 0;
  for (const [s, tot] of Object.entries(sessionTotal)) {
    if (tot >= 2) {
      const rate = (sessionWins[s] || 0) / tot;
      if (rate > bestSessionRate) { bestSessionRate = rate; bestSession = s; }
    }
  }

  return { total, winRate, avgRR, bestAsset, bestSession, bestSessionRate };
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

// ── Badges ────────────────────────────────────────────────────
function SignalBadge({ signal }: { signal: string | null }) {
  if (!signal) return <span className="text-[#4b5563] text-xs font-dm-mono">—</span>;
  const map: Record<string, { color: string; bg: string; border: string }> = {
    LONG:    { color: "#4ade80", bg: "rgba(74,222,128,0.1)",   border: "rgba(74,222,128,0.2)"   },
    SHORT:   { color: "#f87171", bg: "rgba(248,113,113,0.1)",  border: "rgba(248,113,113,0.2)"  },
    NEUTRAL: { color: "#9ca3af", bg: "rgba(156,163,175,0.08)", border: "rgba(156,163,175,0.15)" },
  };
  const s = map[signal.toUpperCase()] ?? map.NEUTRAL;
  return (
    <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wider font-dm-mono"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
      {signal.toUpperCase()}
    </span>
  );
}

function ConfBadge({ confidence }: { confidence: number | null }) {
  if (confidence == null) return <span className="text-[#4b5563] text-xs font-dm-mono">—</span>;
  const color =
    confidence >= 75 ? "#4ade80" :
    confidence >= 50 ? "#9ca3af" : "#f87171";
  return (
    <span className="font-dm-mono text-xs font-bold tabular-nums" style={{ color }}>{confidence}%</span>
  );
}

function outcomeColor(outcome: Outcome | null | undefined) {
  if (outcome === "WIN")       return "#4ade80";
  if (outcome === "LOSS")      return "#f87171";
  if (outcome === "BREAKEVEN") return "#9ca3af";
  return "#4b5563";
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-6 py-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] flex flex-col gap-1">
      <p className="text-[#6b7280] text-[11px] font-semibold uppercase tracking-[0.13em]">{label}</p>
      <p className="text-[32px] font-extrabold text-[#00e676] leading-none">{value}</p>
      {sub && <p className="text-[#4b5563] text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Coaching score gauge ──────────────────────────────────────
function CoachingScoreGauge({ score }: { score: number }) {
  const radius = 52;
  const stroke = 7;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  // Arc covers 270 degrees (from 135deg to 405deg)
  const arcLength = circumference * 0.75;
  const fillLength = arcLength * Math.min(1, Math.max(0, score / 100));
  const gapLength  = arcLength - fillLength;

  const scoreColor = score >= 75 ? "#00e676" : score >= 50 ? "#9ca3af" : "#f87171";

  return (
    <div className="relative flex items-center justify-center" style={{ width: radius * 2, height: radius * 2 }}>
      <svg width={radius * 2} height={radius * 2} style={{ transform: "rotate(135deg)" }}>
        {/* Track */}
        <circle
          cx={radius} cy={radius} r={normalizedRadius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeLinecap="round"
        />
        {/* Fill */}
        <circle
          cx={radius} cy={radius} r={normalizedRadius}
          fill="none"
          stroke={scoreColor}
          strokeWidth={stroke}
          strokeDasharray={`${fillLength} ${gapLength + (circumference - arcLength)}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${scoreColor}88)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bebas text-[38px] leading-none" style={{ color: scoreColor }}>{score}</span>
        <span className="font-dm-mono text-[9px] text-[#6b7280] uppercase tracking-widest mt-0.5">Score</span>
      </div>
    </div>
  );
}

// ── Coaching report ───────────────────────────────────────────
interface CoachingData {
  strongestAsset: string | null;
  weakestAsset:   string | null;
  bestTimeframe:  string | null;
  worstTimeframe: string | null;
  bestSession:    string | null;
  worstSession:   string | null;
  winnerAvgR:     string | null;
  loserAvgR:      string | null;
  keyPatterns:    string[];
  improvements:   string[];
  overallAssessment: string;
  coachingScore:  number;
}

function CoachingReport({ data, onClose }: { data: CoachingData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(8,10,16,0.92)", backdropFilter: "blur(12px)" }}>
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/[0.1]"
        style={{ background: "linear-gradient(135deg, #0d1117 0%, #080a10 100%)" }}>

        {/* Close */}
        <button onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-xl flex items-center justify-center text-[#4b5563] hover:text-white hover:bg-white/[0.08] transition-all z-10">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#00e676]/30 bg-[#00e676]/10 text-[#00e676] text-[10px] font-semibold tracking-[0.14em] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00e676] animate-pulse" />
              AI Trade Coach
            </div>
          </div>
          <h2 className="text-[28px] font-extrabold text-white mb-1 leading-tight">Your Coaching Report</h2>
          <p className="text-[#4b5563] text-sm mb-8">Based on your full trade history</p>

          {/* Score + overall */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8 p-6 rounded-2xl border border-white/[0.07]"
            style={{ background: "rgba(255,255,255,0.02)" }}>
            <CoachingScoreGauge score={data.coachingScore} />
            <div className="flex-1">
              <p className="font-dm-mono text-[10px] text-[#6b7280] uppercase tracking-[0.14em] mb-2">Coach's Assessment</p>
              <p className="text-[#d1d5db] text-sm leading-relaxed">{data.overallAssessment}</p>
            </div>
          </div>

          {/* Strengths / Weaknesses grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { label: "Strongest Asset", value: data.strongestAsset, good: true },
              { label: "Weakest Asset",   value: data.weakestAsset,   good: false },
              { label: "Best Timeframe",  value: data.bestTimeframe,  good: true },
              { label: "Worst Timeframe", value: data.worstTimeframe, good: false },
              { label: "Best Session",    value: data.bestSession,    good: true },
              { label: "Worst Session",   value: data.worstSession,   good: false },
              { label: "Avg Winner R",    value: data.winnerAvgR ? `1:${data.winnerAvgR}` : null, good: true },
              { label: "Avg Loser R",     value: data.loserAvgR  ? `1:${data.loserAvgR}`  : null, good: false },
            ].map(({ label, value, good }) => (
              <div key={label} className="px-4 py-3 rounded-xl border"
                style={{
                  background: good ? "rgba(74,222,128,0.04)" : "rgba(248,113,113,0.04)",
                  borderColor: good ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
                }}>
                <p className="font-dm-mono text-[9px] uppercase tracking-[0.14em] mb-1"
                  style={{ color: good ? "#4ade80" : "#f87171" }}>{label}</p>
                <p className="text-white font-semibold text-sm">{value ?? "—"}</p>
              </div>
            ))}
          </div>

          {/* Key patterns */}
          {data.keyPatterns?.length > 0 && (
            <div className="mb-6">
              <p className="font-dm-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280] mb-3">Key Patterns Identified</p>
              <div className="space-y-2">
                {data.keyPatterns.map((p, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl border border-white/[0.06]"
                    style={{ background: "rgba(255,255,255,0.02)" }}>
                    <span className="font-bebas text-[#00e676] text-lg leading-none mt-0.5">{i + 1}</span>
                    <p className="text-[#d1d5db] text-sm leading-relaxed">{p}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Improvements */}
          {data.improvements?.length > 0 && (
            <div>
              <p className="font-dm-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280] mb-3">Action Plan</p>
              <div className="space-y-2">
                {data.improvements.map((imp, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl border border-[#00e676]/[0.1]"
                    style={{ background: "rgba(0,230,118,0.03)" }}>
                    <div className="w-5 h-5 rounded-full border border-[#00e676]/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3l2 2 4-4" stroke="#00e676" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="text-[#d1d5db] text-sm leading-relaxed">{imp}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Journal row ───────────────────────────────────────────────
function JournalRow({ entry, onUpdate, onDelete }: {
  entry: JournalEntry;
  onUpdate: (id: string, patch: Partial<JournalEntry>) => void;
  onDelete: (id: string) => void;
}) {
  const [open,     setOpen]     = useState(false);
  const [notes,    setNotes]    = useState(entry.notes ?? "");
  const [deleting, setDeleting] = useState(false);

  async function patchOutcome(outcome: Outcome | null) {
    onUpdate(entry.id, { outcome });
    await fetch(`/api/journal/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
  }

  async function saveNotes() {
    const current = entry.notes ?? "";
    if (notes === current) return;
    await fetch(`/api/journal/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    onUpdate(entry.id, { notes });
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("Delete this journal entry? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/journal/${entry.id}`, { method: "DELETE" });
    onDelete(entry.id);
  }

  const { date, time } = formatDateTime(entry.created_at);

  return (
    <div className="card-dark overflow-hidden" style={{ opacity: deleting ? 0.4 : 1, transition: "opacity 0.2s" }}>
      {/* Main row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 py-4 grid gap-3 items-center"
        style={{ gridTemplateColumns: "1fr 80px 52px 80px 80px 80px 108px 52px" }}>

        {/* Asset + timeframe + date */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-bebas text-[18px] leading-none text-white truncate">
              {entry.asset ?? <span className="text-[#4b5563] font-sans text-sm">Unknown</span>}
            </p>
            {entry.timeframe && (
              <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-dm-mono font-bold text-[#6b7280]"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {entry.timeframe}
              </span>
            )}
          </div>
          <p className="font-dm-mono text-[10px] text-[#4b5563] mt-0.5">{date} · {time}</p>
        </div>

        <SignalBadge signal={entry.signal} />
        <ConfBadge  confidence={entry.confidence} />

        <span className="font-dm-mono text-sm text-white">{entry.entry ?? "—"}</span>
        <span className="font-dm-mono text-sm text-[#f87171]">{entry.stop_loss ?? "—"}</span>
        <span className="font-dm-mono text-sm text-[#4ade80]">{entry.take_profit ?? "—"}</span>

        {/* Outcome */}
        <select
          value={entry.outcome ?? ""}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => patchOutcome((e.target.value as Outcome) || null)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none focus:border-[#00e676]/50 transition-colors cursor-pointer"
          style={{ color: outcomeColor(entry.outcome) }}>
          <option value="">— Pending</option>
          <option value="WIN">WIN</option>
          <option value="LOSS">LOSS</option>
          <option value="BREAKEVEN">BREAKEVEN</option>
        </select>

        {/* Delete + chevron */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleDelete}
            title="Delete entry"
            className="w-6 h-6 rounded-md flex items-center justify-center text-[#4b5563] hover:text-[#f87171] hover:bg-[#f87171]/[0.08] transition-all flex-shrink-0">
            <svg width="11" height="12" viewBox="0 0 11 12" fill="none">
              <path d="M1 2.5h9M3.5 2.5V1.5h4v1M2 2.5l.75 8h6.5L10 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="text-[#4b5563] flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
              style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}>
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="px-5 pb-5 pt-4 border-t border-white/[0.05] space-y-4">
          <div className="flex flex-wrap gap-3">
            {entry.risk_reward && (
              <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-[#6b7280]">
                R:R <span className="text-[#c084fc] font-dm-mono ml-1">{entry.risk_reward}</span>
              </span>
            )}
            {entry.confidence != null && (
              <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-[#6b7280]">
                Confidence <span className="font-dm-mono ml-1" style={{ color: entry.confidence >= 75 ? "#4ade80" : entry.confidence >= 50 ? "#9ca3af" : "#f87171" }}>{entry.confidence}%</span>
              </span>
            )}
          </div>

          {entry.summary && (
            <div className="rounded-xl bg-white/[0.025] border border-white/[0.05] p-4">
              <p className="text-[#6b7280] text-[10px] font-semibold uppercase tracking-[0.12em] mb-2">AI Summary</p>
              <p className="text-[#d1d5db] text-sm leading-relaxed">{entry.summary}</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[#6b7280] text-[10px] font-semibold uppercase tracking-[0.12em]">Notes
              <span className="normal-case tracking-normal ml-2 text-[#374151]">— auto-saves on blur</span>
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={3}
              placeholder="Add your trade notes…"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-[#374151] focus:outline-none focus:border-[#00e676]/50 resize-none transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Lock icon ─────────────────────────────────────────────────
function JournalLockIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect x="5" y="14" width="22" height="16" rx="3.5" stroke="#00e676" strokeWidth="1.6"/>
      <path d="M10 14V10a6 6 0 0112 0v4" stroke="#00e676" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="16" cy="22" r="2" fill="#00e676"/>
      <path d="M16 24v2" stroke="#00e676" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function JournalPage() {
  const { isPro } = useUserPlan();
  const [entries,         setEntries]         = useState<JournalEntry[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [setupErr,        setSetupErr]        = useState(false);
  const [clientId,        setClientId]        = useState<string | null>(null);
  const [coachingData,    setCoachingData]    = useState<CoachingData | null>(null);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [coachingError,   setCoachingError]   = useState<string | null>(null);
  const [showCoaching,    setShowCoaching]    = useState(false);

  useEffect(() => {
    const id = localStorage.getItem("ciq_client_id");
    setClientId(id);
    if (!isPro) return;
    const url = `/api/journal${id ? `?client_id=${encodeURIComponent(id)}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setEntries(d.entries ?? []);
        } else {
          setSetupErr(true);
        }
      })
      .catch(() => setSetupErr(true))
      .finally(() => setLoading(false));
  }, [isPro]);

  function handleUpdate(id: string, patch: Partial<JournalEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleGetCoaching() {
    if (!clientId) return;
    setCoachingLoading(true);
    setCoachingError(null);
    try {
      const res  = await fetch("/api/coaching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCoachingError(data.error ?? "Failed to generate coaching report");
      } else {
        setCoachingData(data.coaching as CoachingData);
        setShowCoaching(true);
      }
    } catch {
      setCoachingError("Network error — please try again");
    } finally {
      setCoachingLoading(false);
    }
  }

  const stats = calcStats(entries);
  const canCoach = entries.length >= 10;

  return (
    <div className="min-h-screen bg-[#080a10] text-white overflow-x-hidden flex flex-col">

      {/* ── Coaching modal ── */}
      {showCoaching && coachingData && (
        <CoachingReport data={coachingData} onClose={() => setShowCoaching(false)} />
      )}

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 nav-glass">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-bold text-[17px] text-white">
              ChartIQ <span className="text-[#00e676]">AI</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-7">
            <Link href="/watchlist"   className="text-sm text-[#6b7280] hover:text-white transition-colors">Watchlist</Link>
            <Link href="/calculator"  className="text-sm text-[#6b7280] hover:text-white transition-colors">Calculator</Link>
            <Link href="/calendar"    className="text-sm text-[#6b7280] hover:text-white transition-colors">Calendar</Link>
            <Link href="/journal"     className="text-sm font-semibold text-[#00e676]">Journal</Link>
          </div>
          <Link href="/#analyze" className="btn-yellow px-5 py-2 text-sm hidden md:inline-flex">
            ⚡ Analyze Chart
          </Link>
          <AuthNavButtons className="hidden md:flex" />
        </div>
      </nav>

      {/* ── Locked for free users ── */}
      {!isPro ? (
        <ProLockedPage
          icon={<JournalLockIcon />}
          heading="TRACK YOUR EDGE"
          subtext="Your complete trade history, win rate, and performance insights — Pro only"
          features={[
            "Auto-save every analysis",
            "Win rate tracking",
            "Best performing assets",
            "Notes and outcome tracking",
          ]}
          ctaLabel="Unlock journal — £19/mo"
          clientId={clientId}
        />
      ) : (
      <div className="max-w-6xl mx-auto px-6 pt-32 pb-20">

        {/* ── Header ── */}
        <div className="mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <SectionBadge>
              <span className="w-2 h-2 rounded-full bg-[#00e676] animate-pulse-dot" />
              Trade Journal
            </SectionBadge>
            <h1 className="text-[clamp(38px,6vw,60px)] font-extrabold leading-[1.08] tracking-tight mb-3">
              Your Trading <span className="text-[#00e676]">History</span>
            </h1>
            <p className="text-[#6b7280] text-lg max-w-lg leading-relaxed">
              Every chart analysis is automatically logged. Track outcomes, review setups, and sharpen your edge.
            </p>
          </div>

          {/* ── Get Coaching button ── */}
          {!loading && (
            <div className="flex-shrink-0">
              {canCoach ? (
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={handleGetCoaching}
                    disabled={coachingLoading}
                    className="flex items-center gap-2.5 px-5 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: coachingLoading ? "rgba(0,230,118,0.15)" : "#00e676",
                      color: coachingLoading ? "#00e676" : "#080a10",
                      boxShadow: "0 0 22px rgba(0,230,118,0.3)",
                    }}>
                    {coachingLoading ? (
                      <>
                        <svg className="animate-spin" width="15" height="15" viewBox="0 0 15 15" fill="none">
                          <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
                        </svg>
                        Analysing your trades…
                      </>
                    ) : (
                      <>
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                          <path d="M7.5 1.5c-3.314 0-6 2.686-6 6s2.686 6 6 6 6-2.686 6-6-2.686-6-6-6z" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M5 7.5l1.8 1.8 3.2-3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Get AI Coaching
                      </>
                    )}
                  </button>
                  {coachingData && (
                    <button onClick={() => setShowCoaching(true)}
                      className="font-dm-mono text-[10px] text-[#00e676] hover:underline">
                      View last report
                    </button>
                  )}
                  {coachingError && (
                    <p className="font-dm-mono text-[10px] text-[#f87171]">{coachingError}</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-end gap-1 px-4 py-3 rounded-xl border border-white/[0.06]"
                  style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center gap-2">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <rect x="1.5" y="5.5" width="10" height="7" rx="1.5" stroke="#4b5563" strokeWidth="1.2"/>
                      <path d="M4 5.5V4a2.5 2.5 0 015 0v1.5" stroke="#4b5563" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    <span className="font-dm-mono text-[10px] text-[#4b5563]">AI Coaching unlocks at 10 trades</span>
                  </div>
                  <div className="w-full h-[3px] rounded-full overflow-hidden mt-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div style={{ width: `${Math.min(100, (entries.length / 10) * 100)}%`, background: "#00e676", height: "100%", borderRadius: "9999px" }} />
                  </div>
                  <span className="font-dm-mono text-[9px] text-[#374151]">{entries.length}/10 trades logged</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Supabase error ── */}
        {setupErr && (
          <div className="mb-8 rounded-2xl border border-[#9ca3af]/20 bg-[#9ca3af]/[0.04] p-5 flex items-start gap-4">
            <div className="w-8 h-8 rounded-xl bg-[#9ca3af]/10 flex items-center justify-center flex-shrink-0 text-base">⚠</div>
            <div>
              <p className="text-[#9ca3af] font-semibold text-sm mb-1">Supabase not configured</p>
              <p className="text-[#9ca3af]/60 text-sm leading-relaxed">
                Add{" "}
                <code className="font-dm-mono bg-[#9ca3af]/10 px-1.5 py-0.5 rounded text-[#9ca3af]">SUPABASE_URL</code>{" "}
                and{" "}
                <code className="font-dm-mono bg-[#9ca3af]/10 px-1.5 py-0.5 rounded text-[#9ca3af]">SUPABASE_SERVICE_KEY</code>{" "}
                to <code className="font-dm-mono bg-[#9ca3af]/10 px-1.5 py-0.5 rounded text-[#9ca3af]">.env.local</code> and restart.
              </p>
            </div>
          </div>
        )}

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
          <StatCard label="Total Analyses" value={String(stats.total)} sub="all time" />
          <StatCard
            label="Win Rate"
            value={stats.winRate != null ? `${stats.winRate}%` : "—"}
            sub={stats.winRate != null ? "of decided trades" : "no closed trades yet"} />
          <StatCard
            label="Avg Risk/Reward"
            value={stats.avgRR != null ? `1:${stats.avgRR}` : "—"}
            sub="average across all setups" />
          <StatCard
            label="Best Asset"
            value={stats.bestAsset ?? "—"}
            sub={stats.bestAsset ? "most winning trades" : "mark trades as WIN to track"} />
          <StatCard
            label="Best Session"
            value={stats.bestSession ?? "—"}
            sub={stats.bestSession ? `${Math.round(stats.bestSessionRate * 100)}% win rate` : "needs session data"} />
        </div>

        {/* ── Column headers ── */}
        {!loading && entries.length > 0 && (
          <div
            className="hidden md:grid px-5 mb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#374151]"
            style={{ gridTemplateColumns: "1fr 80px 52px 80px 80px 80px 108px 52px" }}>
            <span>Asset / Time</span>
            <span>Signal</span>
            <span>Conf</span>
            <span>Entry</span>
            <span>Stop</span>
            <span>Target</span>
            <span>Outcome</span>
            <span />
          </div>
        )}

        {/* ── Loading skeletons ── */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-[68px] rounded-2xl" />
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !setupErr && entries.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/[0.08] flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#00e676]/[0.08] border border-[#00e676]/15 flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="2" width="20" height="24" rx="3" stroke="#00e676" strokeWidth="1.4" />
                <path d="M9 9h10M9 13h10M9 17h6" stroke="#00e676" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-white font-semibold mb-1">No analyses yet</p>
            <p className="text-[#4b5563] text-sm mb-6 max-w-xs">
              Upload your first chart to get started — every analysis is saved here automatically.
            </p>
            <Link href="/#analyze" className="btn-yellow px-6 py-2.5 text-sm inline-flex items-center gap-2">
              ⚡ Analyze Your First Chart
            </Link>
          </div>
        )}

        {/* ── Journal rows ── */}
        {!loading && entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((e) => (
              <JournalRow key={e.id} entry={e} onUpdate={handleUpdate} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
