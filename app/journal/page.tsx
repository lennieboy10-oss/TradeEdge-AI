"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { JournalEntry, Outcome } from "@/app/lib/supabase";

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

  return { total, winRate, avgRR, bestAsset };
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
    confidence >= 50 ? "#fbbf24" : "#f87171";
  return (
    <span className="font-dm-mono text-xs font-bold tabular-nums" style={{ color }}>{confidence}%</span>
  );
}

function outcomeColor(outcome: Outcome | null | undefined) {
  if (outcome === "WIN")       return "#4ade80";
  if (outcome === "LOSS")      return "#f87171";
  if (outcome === "BREAKEVEN") return "#fbbf24";
  return "#4b5563";
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-6 py-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] flex flex-col gap-1">
      <p className="text-[#6b7280] text-[11px] font-semibold uppercase tracking-[0.13em]">{label}</p>
      <p className="text-[32px] font-extrabold text-[#f5c518] leading-none">{value}</p>
      {sub && <p className="text-[#4b5563] text-xs mt-0.5">{sub}</p>}
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
                Confidence <span className="font-dm-mono ml-1" style={{ color: entry.confidence >= 75 ? "#4ade80" : entry.confidence >= 50 ? "#fbbf24" : "#f87171" }}>{entry.confidence}%</span>
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

// ── Page ──────────────────────────────────────────────────────
export default function JournalPage() {
  const [entries,  setEntries]  = useState<JournalEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [setupErr, setSetupErr] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [isPro,    setIsPro]    = useState(false);

  useEffect(() => {
    const id = localStorage.getItem("ciq_client_id");
    setClientId(id);
    const url = `/api/journal${id ? `?client_id=${encodeURIComponent(id)}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setEntries(d.entries ?? []);
          setIsPro(d.isPro ?? false);
        } else {
          setSetupErr(true);
        }
      })
      .catch(() => setSetupErr(true))
      .finally(() => setLoading(false));
  }, []);

  function handleUpdate(id: string, patch: Partial<JournalEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function handleUpgrade() {
    if (!clientId) return;
    fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.url) window.location.href = d.url; });
  }

  const stats = calcStats(entries);

  return (
    <div className="min-h-screen bg-[#080a10] text-white overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 nav-glass">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-bold text-[17px] text-white">
              ChartIQ <span className="text-[#f5c518]">AI</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-7">
            <Link href="/watchlist"   className="text-sm text-[#6b7280] hover:text-white transition-colors">Watchlist</Link>
            <Link href="/calculator"  className="text-sm text-[#6b7280] hover:text-white transition-colors">Calculator</Link>
            <Link href="/calendar"    className="text-sm text-[#6b7280] hover:text-white transition-colors">Calendar</Link>
            <Link href="/journal"     className="text-sm font-semibold text-[#f5c518]">Journal</Link>
          </div>
          <Link href="/#analyze" className="btn-yellow px-5 py-2 text-sm hidden md:inline-flex">
            ⚡ Analyze Chart
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-32 pb-20">

        {/* ── Header ── */}
        <div className="mb-12">
          <SectionBadge>
            <span className="w-2 h-2 rounded-full bg-[#00e676] animate-pulse-dot" />
            Trade Journal
          </SectionBadge>
          <h1 className="text-[clamp(38px,6vw,60px)] font-extrabold leading-[1.08] tracking-tight mb-3">
            Your Trading <span className="text-[#f5c518]">History</span>
          </h1>
          <p className="text-[#6b7280] text-lg max-w-lg leading-relaxed">
            Every chart analysis is automatically logged. Track outcomes, review setups, and sharpen your edge.
          </p>
        </div>

        {/* ── Supabase error ── */}
        {setupErr && (
          <div className="mb-8 rounded-2xl border border-[#fbbf24]/20 bg-[#fbbf24]/[0.04] p-5 flex items-start gap-4">
            <div className="w-8 h-8 rounded-xl bg-[#fbbf24]/10 flex items-center justify-center flex-shrink-0 text-base">⚠</div>
            <div>
              <p className="text-[#fbbf24] font-semibold text-sm mb-1">Supabase not configured</p>
              <p className="text-[#fbbf24]/60 text-sm leading-relaxed">
                Add{" "}
                <code className="font-dm-mono bg-[#fbbf24]/10 px-1.5 py-0.5 rounded text-[#fbbf24]">SUPABASE_URL</code>{" "}
                and{" "}
                <code className="font-dm-mono bg-[#fbbf24]/10 px-1.5 py-0.5 rounded text-[#fbbf24]">SUPABASE_SERVICE_KEY</code>{" "}
                to <code className="font-dm-mono bg-[#fbbf24]/10 px-1.5 py-0.5 rounded text-[#fbbf24]">.env.local</code> and restart.
              </p>
            </div>
          </div>
        )}

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
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
        </div>

        {/* ── Free tier notice ── */}
        {!isPro && !loading && entries.length >= 10 && (
          <div className="mb-6 rounded-xl border border-[#00e676]/20 bg-[#00e676]/[0.04] px-5 py-4 flex items-center justify-between gap-4">
            <p className="text-[#6b7280] text-sm">
              Showing your last 10 entries.{" "}
              <span className="text-white">Upgrade to Pro for full unlimited history.</span>
            </p>
            <button
              onClick={handleUpgrade}
              className="flex-shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-all hover:-translate-y-0.5"
              style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 14px rgba(0,230,118,0.25)" }}>
              Upgrade to Pro
            </button>
          </div>
        )}

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
    </div>
  );
}
