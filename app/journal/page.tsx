"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine,
} from "recharts";
import type { JournalEntry, Outcome } from "@/app/lib/supabase";
import AppNav from "@/app/components/AppNav";
import { useUserPlan } from "@/app/lib/plan-context";

// ── Types ──────────────────────────────────────────────────────
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

type DateRange = "7d" | "30d" | "90d" | "all";

// ── Utilities ─────────────────────────────────────────────────
function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    short: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
  };
}

function filterByRange(entries: JournalEntry[], range: DateRange): JournalEntry[] {
  if (range === "all") return entries;
  const now = Date.now();
  const ms = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = now - ms * 24 * 60 * 60 * 1000;
  return entries.filter((e) => new Date(e.created_at).getTime() >= cutoff);
}

function parseRR(rr: string | null): number | null {
  if (!rr) return null;
  const m = rr.match(/1[: ](\d+\.?\d*)/);
  return m ? parseFloat(m[1]) : null;
}

function calcStats(entries: JournalEntry[]) {
  const total    = entries.length;
  const decided  = entries.filter((e) => e.outcome === "WIN" || e.outcome === "LOSS");
  const wins     = entries.filter((e) => e.outcome === "WIN").length;
  const losses   = entries.filter((e) => e.outcome === "LOSS").length;
  const winRate  = decided.length > 0 ? Math.round((wins / decided.length) * 100) : null;

  const rrNums = entries.map((e) => parseRR(e.risk_reward)).filter((v): v is number => v !== null);
  const avgRR  = rrNums.length > 0 ? (rrNums.reduce((a, b) => a + b, 0) / rrNums.length) : null;

  const pnlVals = entries.map((e) => e.pnl).filter((v): v is number => v != null);
  const totalPnl = pnlVals.length > 0 ? pnlVals.reduce((a, b) => a + b, 0) : null;

  // Best asset by win rate (min 2 trades)
  const assetMap: Record<string, { wins: number; total: number }> = {};
  entries.filter((e) => e.asset && (e.outcome === "WIN" || e.outcome === "LOSS")).forEach((e) => {
    const a = e.asset!;
    if (!assetMap[a]) assetMap[a] = { wins: 0, total: 0 };
    assetMap[a].total++;
    if (e.outcome === "WIN") assetMap[a].wins++;
  });
  let bestAsset: string | null = null;
  let bestAssetRate = 0;
  for (const [a, v] of Object.entries(assetMap)) {
    if (v.total >= 2 && v.wins / v.total > bestAssetRate) {
      bestAssetRate = v.wins / v.total;
      bestAsset = a;
    }
  }

  // Current streak
  let streak = 0;
  for (const e of entries) {
    if (e.outcome === "WIN") streak++;
    else if (e.outcome === "LOSS") break;
    else continue;
  }

  // Best session
  const sessionMap: Record<string, { wins: number; total: number }> = {};
  entries.filter((e) => e.entry_session && (e.outcome === "WIN" || e.outcome === "LOSS")).forEach((e) => {
    const s = e.entry_session!;
    if (!sessionMap[s]) sessionMap[s] = { wins: 0, total: 0 };
    sessionMap[s].total++;
    if (e.outcome === "WIN") sessionMap[s].wins++;
  });
  let bestSession: string | null = null;
  let bestSessionRate = 0;
  for (const [s, v] of Object.entries(sessionMap)) {
    if (v.total >= 2 && v.wins / v.total > bestSessionRate) {
      bestSessionRate = v.wins / v.total;
      bestSession = s;
    }
  }

  return { total, wins, losses, winRate, avgRR, totalPnl, bestAsset, bestAssetRate, streak, bestSession, bestSessionRate, decided: decided.length };
}

function buildEquityCurve(entries: JournalEntry[]) {
  const sorted = [...entries]
    .filter((e) => e.outcome === "WIN" || e.outcome === "LOSS" || e.pnl != null)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  let balance = 0;
  return sorted.map((e) => {
    if (e.pnl != null) {
      balance += e.pnl;
    } else if (e.outcome === "WIN") {
      balance += 1;
    } else if (e.outcome === "LOSS") {
      balance -= 1;
    }
    return { label: formatDate(e.created_at).short, value: balance, outcome: e.outcome };
  });
}

function buildAssetWinRate(entries: JournalEntry[]) {
  const map: Record<string, { wins: number; losses: number }> = {};
  entries.filter((e) => e.asset && (e.outcome === "WIN" || e.outcome === "LOSS")).forEach((e) => {
    const a = e.asset!;
    if (!map[a]) map[a] = { wins: 0, losses: 0 };
    if (e.outcome === "WIN") map[a].wins++;
    else map[a].losses++;
  });
  return Object.entries(map)
    .map(([asset, { wins, losses }]) => ({
      asset,
      wins,
      losses,
      total: wins + losses,
      rate: Math.round((wins / (wins + losses)) * 100),
    }))
    .filter((d) => d.total >= 1)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

function buildMonthlyHeatmap(entries: JournalEntry[]) {
  const map: Record<string, { wins: number; losses: number; total: number }> = {};
  entries.filter((e) => e.outcome === "WIN" || e.outcome === "LOSS").forEach((e) => {
    const k = formatDate(e.created_at).monthKey;
    if (!map[k]) map[k] = { wins: 0, losses: 0, total: 0 };
    map[k].total++;
    if (e.outcome === "WIN") map[k].wins++;
    else map[k].losses++;
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({ key, ...v, rate: v.total > 0 ? Math.round((v.wins / v.total) * 100) : null }));
}

function buildBreakdown(entries: JournalEntry[], key: keyof JournalEntry) {
  const map: Record<string, { wins: number; total: number }> = {};
  entries.filter((e) => e[key] && (e.outcome === "WIN" || e.outcome === "LOSS")).forEach((e) => {
    const k = String(e[key]);
    if (!map[k]) map[k] = { wins: 0, total: 0 };
    map[k].total++;
    if (e.outcome === "WIN") map[k].wins++;
  });
  return Object.entries(map)
    .map(([label, { wins, total }]) => ({ label, wins, losses: total - wins, total, rate: Math.round((wins / total) * 100) }))
    .sort((a, b) => b.total - a.total);
}

function exportCSV(entries: JournalEntry[]) {
  const headers = ["Date","Asset","Timeframe","Signal","Confidence","Entry","SL","TP","R:R","Outcome","P&L","R Achieved","Session","Notes","Grade"];
  const rows = entries.map((e) => [
    formatDate(e.created_at).date,
    e.asset ?? "",
    e.timeframe ?? "",
    e.signal ?? "",
    e.confidence ?? "",
    e.entry ?? "",
    e.stop_loss ?? "",
    e.take_profit ?? "",
    e.risk_reward ?? "",
    e.outcome ?? "",
    e.pnl ?? "",
    e.r_achieved ?? "",
    e.entry_session ?? "",
    (e.notes ?? "").replace(/,/g, ";"),
    e.historical_grade ?? "",
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "chartiq-journal.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── Count-up hook ─────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target === prev.current) return;
    const start = prev.current;
    prev.current = target;
    const diff = target - start;
    const startTime = performance.now();
    let raf: number;
    function step(now: number) {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(start + diff * ease));
      if (t < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

// ── Small shared components ────────────────────────────────────
function outcomeColor(outcome: Outcome | null | undefined) {
  if (outcome === "WIN")       return "#4ade80";
  if (outcome === "LOSS")      return "#f87171";
  if (outcome === "BREAKEVEN") return "#9ca3af";
  return "#4b5563";
}

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

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, rawValue, displayValue, sub, accent = "#00e676", icon }: {
  label: string; rawValue?: number; displayValue?: string; sub?: string; accent?: string; icon?: React.ReactNode;
}) {
  const animated = useCountUp(rawValue ?? 0);
  const show = displayValue ?? (rawValue != null ? String(animated) : "—");
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-1 border border-white/[0.06]"
      style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)" }}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[#4b5563] text-[10px] font-bold uppercase tracking-[0.16em]">{label}</p>
        {icon && <div className="opacity-40">{icon}</div>}
      </div>
      <p className="font-bebas text-[38px] leading-none" style={{ color: accent }}>{show}</p>
      {sub && <p className="text-[#374151] text-[11px] mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Charts ────────────────────────────────────────────────────
function EquityChart({ data }: { data: { label: string; value: number; outcome: string | null | undefined }[] }) {
  if (data.length < 2) return (
    <div className="flex items-center justify-center h-[200px] text-[#374151] text-sm font-dm-mono">
      Need more closed trades to plot equity curve
    </div>
  );
  const color = (data[data.length - 1]?.value ?? 0) >= 0 ? "#00e676" : "#f87171";
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.15} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="label" tick={{ fill: "#374151", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#374151", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
        <Tooltip
          contentStyle={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px" }}
          labelStyle={{ color: "#9ca3af", fontSize: 11 }}
          itemStyle={{ color: color, fontSize: 12, fontFamily: "monospace" }}
          formatter={(v) => { const n = Number(v); return [n > 0 ? `+${n}` : n, "Balance"]; }}
        />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false}
          activeDot={{ r: 4, fill: color, stroke: "transparent" }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AssetChart({ data }: { data: { asset: string; wins: number; losses: number; rate: number }[] }) {
  if (data.length === 0) return (
    <div className="flex items-center justify-center h-[200px] text-[#374151] text-sm font-dm-mono">
      No closed trades yet
    </div>
  );
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="asset" tick={{ fill: "#374151", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#374151", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px" }}
          labelStyle={{ color: "#9ca3af", fontSize: 11 }}
          itemStyle={{ fontSize: 12, fontFamily: "monospace" }}
        />
        <Bar dataKey="wins" name="Wins" stackId="a" fill="#4ade80" fillOpacity={0.8} radius={[0, 0, 0, 0]} />
        <Bar dataKey="losses" name="Losses" stackId="a" fill="#f87171" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Monthly heatmap ───────────────────────────────────────────
function MonthlyHeatmap({ data }: { data: { key: string; wins: number; losses: number; total: number; rate: number | null }[] }) {
  if (data.length === 0) return (
    <div className="flex items-center justify-center h-[80px] text-[#374151] text-sm font-dm-mono">
      No data yet
    </div>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {data.map((m) => {
        const [year, mo] = m.key.split("-");
        const label = new Date(parseInt(year), parseInt(mo) - 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
        const bg = m.rate == null ? "rgba(255,255,255,0.04)" :
          m.rate >= 70 ? "rgba(74,222,128,0.25)" :
          m.rate >= 50 ? "rgba(245,158,11,0.2)" :
          "rgba(248,113,113,0.2)";
        const border = m.rate == null ? "rgba(255,255,255,0.06)" :
          m.rate >= 70 ? "rgba(74,222,128,0.4)" :
          m.rate >= 50 ? "rgba(245,158,11,0.35)" :
          "rgba(248,113,113,0.35)";
        const textColor = m.rate == null ? "#4b5563" :
          m.rate >= 70 ? "#4ade80" :
          m.rate >= 50 ? "#f59e0b" : "#f87171";
        return (
          <div key={m.key} className="rounded-xl px-3 py-2.5 flex flex-col items-center gap-0.5 min-w-[56px]"
            style={{ background: bg, border: `1px solid ${border}` }}
            title={`${m.wins}W / ${m.losses}L`}>
            <span className="text-[9px] font-dm-mono text-[#4b5563] uppercase">{label}</span>
            <span className="font-bebas text-lg leading-none" style={{ color: textColor }}>
              {m.rate != null ? `${m.rate}%` : "—"}
            </span>
            <span className="text-[8px] text-[#374151]">{m.total}t</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Breakdown row ─────────────────────────────────────────────
function BreakdownRow({ label, wins, losses, total, rate }: { label: string; wins: number; losses: number; total: number; rate: number }) {
  const barColor = rate >= 60 ? "#4ade80" : rate >= 45 ? "#f59e0b" : "#f87171";
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-[#9ca3af] text-sm font-dm-mono w-24 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full" style={{ width: `${rate}%`, background: barColor }} />
      </div>
      <span className="font-dm-mono text-xs font-bold w-10 text-right" style={{ color: barColor }}>{rate}%</span>
      <span className="font-dm-mono text-[10px] text-[#374151] w-16 text-right">{wins}W / {losses}L</span>
    </div>
  );
}

function BreakdownSection({ title, data }: { title: string; data: { label: string; wins: number; losses: number; total: number; rate: number }[] }) {
  if (data.length === 0) return null;
  return (
    <div>
      <p className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280] mb-2">{title}</p>
      <div className="divide-y divide-white/[0.04]">
        {data.map((d) => <BreakdownRow key={d.label} {...d} />)}
      </div>
    </div>
  );
}

// ── Coaching gauge ────────────────────────────────────────────
function CoachingGauge({ score }: { score: number }) {
  const radius = 48;
  const stroke = 6;
  const r = radius - stroke / 2;
  const circ = r * 2 * Math.PI;
  const arc = circ * 0.75;
  const fill = arc * Math.min(1, Math.max(0, score / 100));
  const color = score >= 75 ? "#00e676" : score >= 50 ? "#f59e0b" : "#f87171";
  return (
    <div className="relative flex items-center justify-center" style={{ width: radius * 2, height: radius * 2 }}>
      <svg width={radius * 2} height={radius * 2} style={{ transform: "rotate(135deg)" }}>
        <circle cx={radius} cy={radius} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}
          strokeDasharray={`${arc} ${circ - arc}`} strokeLinecap="round" />
        <circle cx={radius} cy={radius} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}88)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bebas text-[34px] leading-none" style={{ color }}>{score}</span>
        <span className="font-dm-mono text-[8px] text-[#6b7280] uppercase tracking-widest mt-0.5">Score</span>
      </div>
    </div>
  );
}

// ── Coaching modal ────────────────────────────────────────────
function CoachingModal({ data, onClose }: { data: CoachingData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8,10,16,0.92)", backdropFilter: "blur(12px)" }}>
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10"
        style={{ background: "linear-gradient(135deg, #0d1117 0%, #080a10 100%)" }}>
        <button onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-xl flex items-center justify-center text-[#4b5563] hover:text-white hover:bg-white/[0.08] transition-all z-10">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <div className="p-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#00e676]/30 bg-[#00e676]/10 text-[#00e676] text-[10px] font-semibold tracking-[0.14em] uppercase mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00e676] animate-pulse" />
            AI Trade Coach
          </div>
          <h2 className="text-[28px] font-extrabold text-white mb-1 leading-tight">Coaching Report</h2>
          <p className="text-[#4b5563] text-sm mb-8">Based on your full trade history</p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8 p-6 rounded-2xl border border-white/[0.07]"
            style={{ background: "rgba(255,255,255,0.02)" }}>
            <CoachingGauge score={data.coachingScore} />
            <div className="flex-1">
              <p className="font-dm-mono text-[10px] text-[#6b7280] uppercase tracking-[0.14em] mb-2">Coach&apos;s Assessment</p>
              <p className="text-[#d1d5db] text-sm leading-relaxed">{data.overallAssessment}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { label: "Strongest Asset", value: data.strongestAsset, good: true },
              { label: "Weakest Asset",   value: data.weakestAsset,   good: false },
              { label: "Best Timeframe",  value: data.bestTimeframe,  good: true },
              { label: "Worst Timeframe", value: data.worstTimeframe, good: false },
              { label: "Best Session",    value: data.bestSession,    good: true },
              { label: "Worst Session",   value: data.worstSession,   good: false },
              { label: "Avg Winner R",    value: data.winnerAvgR ? `1:${data.winnerAvgR}` : null, good: true },
              { label: "Avg Loser R",     value: data.loserAvgR ? `1:${data.loserAvgR}` : null,   good: false },
            ].map(({ label, value, good }) => (
              <div key={label} className="px-4 py-3 rounded-xl border"
                style={{ background: good ? "rgba(74,222,128,0.04)" : "rgba(248,113,113,0.04)", borderColor: good ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)" }}>
                <p className="font-dm-mono text-[9px] uppercase tracking-[0.14em] mb-1"
                  style={{ color: good ? "#4ade80" : "#f87171" }}>{label}</p>
                <p className="text-white font-semibold text-sm">{value ?? "—"}</p>
              </div>
            ))}
          </div>
          {data.keyPatterns?.length > 0 && (
            <div className="mb-6">
              <p className="font-dm-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280] mb-3">Key Patterns</p>
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
          {data.improvements?.length > 0 && (
            <div>
              <p className="font-dm-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280] mb-3">Action Plan</p>
              <div className="space-y-2">
                {data.improvements.map((imp, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl border border-[#00e676]/10"
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
      </motion.div>
    </div>
  );
}

// ── Manual trade modal ────────────────────────────────────────
const SESSIONS = ["London", "New York", "Asian", "Pre-Market"];
const SIGNALS  = ["LONG", "SHORT", "NEUTRAL"];
const OUTCOMES = ["WIN", "LOSS", "BREAKEVEN"];

function ManualTradeModal({ clientId, onClose, onSaved }: {
  clientId: string | null;
  onClose: () => void;
  onSaved: (entry: JournalEntry) => void;
}) {
  const [form, setForm] = useState({
    asset: "", timeframe: "", signal: "LONG", entry: "", stop_loss: "", take_profit: "",
    risk_reward: "", outcome: "", pnl: "", r_achieved: "", entry_session: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.asset.trim()) { setErr("Asset is required"); return; }
    setSaving(true); setErr("");
    try {
      const body: Record<string, unknown> = {
        ...form,
        client_id:  clientId,
        confidence: null,
        pnl:        form.pnl        ? parseFloat(form.pnl)        : null,
        r_achieved: form.r_achieved ? parseFloat(form.r_achieved) : null,
        outcome:    form.outcome || null,
      };
      const res  = await fetch("/api/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) { onSaved(data.entry); onClose(); }
      else setErr(data.error ?? "Failed to save");
    } catch { setErr("Network error"); }
    setSaving(false);
  }

  const field = "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-[#374151] outline-none focus:border-[#00e676]/40 transition-colors font-dm-mono";
  const label = "block text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7280] mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(8,10,16,0.92)", backdropFilter: "blur(12px)" }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10"
        style={{ background: "linear-gradient(145deg, #0d1117 0%, #080a10 100%)" }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="font-dm-mono text-[10px] text-[#00e676] uppercase tracking-widest mb-0.5">Log Trade</p>
              <h2 className="text-xl font-extrabold text-white">Add Manual Entry</h2>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[#4b5563] hover:text-white hover:bg-white/[0.08] transition-all">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Asset *</label>
                <input className={field} value={form.asset} onChange={(e) => set("asset", e.target.value)} placeholder="XAU/USD" />
              </div>
              <div>
                <label className={label}>Timeframe</label>
                <input className={field} value={form.timeframe} onChange={(e) => set("timeframe", e.target.value)} placeholder="1H" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Direction</label>
                <select className={field} value={form.signal} onChange={(e) => set("signal", e.target.value)}>
                  {SIGNALS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Session</label>
                <select className={field} value={form.entry_session} onChange={(e) => set("entry_session", e.target.value)}>
                  <option value="">— Select</option>
                  {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={label}>Entry</label>
                <input className={field} value={form.entry} onChange={(e) => set("entry", e.target.value)} placeholder="2318.50" />
              </div>
              <div>
                <label className={label}>Stop Loss</label>
                <input className={field} value={form.stop_loss} onChange={(e) => set("stop_loss", e.target.value)} placeholder="2310.00" />
              </div>
              <div>
                <label className={label}>Take Profit</label>
                <input className={field} value={form.take_profit} onChange={(e) => set("take_profit", e.target.value)} placeholder="2335.00" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={label}>Outcome</label>
                <select className={field} value={form.outcome} onChange={(e) => set("outcome", e.target.value)}>
                  <option value="">Pending</option>
                  {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>P&L ($)</label>
                <input className={field} type="number" step="0.01" value={form.pnl} onChange={(e) => set("pnl", e.target.value)} placeholder="150.00" />
              </div>
              <div>
                <label className={label}>R Achieved</label>
                <input className={field} type="number" step="0.1" value={form.r_achieved} onChange={(e) => set("r_achieved", e.target.value)} placeholder="2.1" />
              </div>
            </div>
            <div>
              <label className={label}>Notes</label>
              <textarea className={`${field} resize-none`} rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Trade rationale, observations..." />
            </div>
            {err && <p className="text-[#f87171] text-xs font-dm-mono">{err}</p>}
            <button type="submit" disabled={saving}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 disabled:opacity-50"
              style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 20px rgba(0,230,118,0.25)" }}>
              {saving ? "Saving…" : "Save Trade"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

// ── Trade card ────────────────────────────────────────────────
function TradeCard({ entry, onUpdate, onDelete }: {
  entry: JournalEntry;
  onUpdate: (id: string, patch: Partial<JournalEntry>) => void;
  onDelete: (id: string) => void;
}) {
  const [open,     setOpen]     = useState(false);
  const [notes,    setNotes]    = useState(entry.notes ?? "");
  const [pnl,      setPnl]      = useState(entry.pnl != null ? String(entry.pnl) : "");
  const [rAch,     setRAch]     = useState(entry.r_achieved != null ? String(entry.r_achieved) : "");
  const [deleting, setDeleting] = useState(false);

  async function patch(body: Partial<JournalEntry>) {
    onUpdate(entry.id, body);
    await fetch(`/api/journal/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("Delete this journal entry?")) return;
    setDeleting(true);
    await fetch(`/api/journal/${entry.id}`, { method: "DELETE" });
    onDelete(entry.id);
  }

  const { date, time } = formatDate(entry.created_at);
  const pnlNum = entry.pnl;
  const isManual = entry.manually_added;

  return (
    <motion.div layout className="rounded-2xl overflow-hidden border border-white/[0.06]"
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)",
        opacity: deleting ? 0.4 : 1,
        transition: "opacity 0.2s",
      }}>
      {/* Header row */}
      <button onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">

        {/* Outcome indicator */}
        <div className="w-1 h-10 rounded-full flex-shrink-0"
          style={{ background: entry.outcome ? outcomeColor(entry.outcome) : "rgba(255,255,255,0.08)" }} />

        {/* Asset + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bebas text-[20px] leading-none text-white">
              {entry.asset ?? <span className="font-sans text-sm text-[#4b5563]">Unknown</span>}
            </span>
            {entry.timeframe && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-dm-mono font-bold text-[#6b7280]"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {entry.timeframe}
              </span>
            )}
            {isManual && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-dm-mono font-bold text-[#9ca3af]"
                style={{ background: "rgba(156,163,175,0.08)", border: "1px solid rgba(156,163,175,0.15)" }}>
                MANUAL
              </span>
            )}
          </div>
          <p className="font-dm-mono text-[10px] text-[#374151] mt-0.5">{date} · {time}</p>
        </div>

        {/* Badges */}
        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
          <SignalBadge signal={entry.signal} />
          {entry.confidence != null && (
            <span className="font-dm-mono text-xs font-bold tabular-nums"
              style={{ color: entry.confidence >= 75 ? "#4ade80" : entry.confidence >= 50 ? "#9ca3af" : "#f87171" }}>
              {entry.confidence}%
            </span>
          )}
        </div>

        {/* P&L + outcome */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {pnlNum != null && (
            <span className="font-dm-mono text-sm font-bold tabular-nums"
              style={{ color: pnlNum >= 0 ? "#4ade80" : "#f87171" }}>
              {pnlNum >= 0 ? "+" : ""}{pnlNum.toFixed(2)}
            </span>
          )}
          <span className="font-dm-mono text-xs font-bold px-2 py-1 rounded-lg"
            style={{
              color: outcomeColor(entry.outcome),
              background: entry.outcome ? `${outcomeColor(entry.outcome)}18` : "rgba(255,255,255,0.04)",
              border: `1px solid ${entry.outcome ? `${outcomeColor(entry.outcome)}30` : "rgba(255,255,255,0.06)"}`,
            }}>
            {entry.outcome ?? "PENDING"}
          </span>
        </div>

        {/* Delete + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={handleDelete}
            className="w-6 h-6 rounded-md flex items-center justify-center text-[#4b5563] hover:text-[#f87171] hover:bg-[#f87171]/[0.08] transition-all">
            <svg width="11" height="12" viewBox="0 0 11 12" fill="none">
              <path d="M1 2.5h9M3.5 2.5V1.5h4v1M2 2.5l.75 8h6.5L10 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[#4b5563]"
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}>
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* Expanded panel */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="border-t border-white/[0.05] px-5 pb-5 pt-4 space-y-4 overflow-hidden">

            {/* Levels + meta */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
              {[
                { label: "Entry",  value: entry.entry,       color: "#e2e8f0" },
                { label: "Stop",   value: entry.stop_loss,   color: "#f87171" },
                { label: "Target", value: entry.take_profit, color: "#4ade80" },
                { label: "R:R",    value: entry.risk_reward, color: "#c084fc" },
                { label: "Session", value: entry.entry_session, color: "#9ca3af" },
                { label: "Grade",  value: entry.historical_grade, color: "#f59e0b" },
              ].map(({ label, value, color }) => value ? (
                <div key={label} className="rounded-xl px-3 py-2 text-center"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="font-dm-mono text-[9px] text-[#4b5563] uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="font-dm-mono text-sm font-bold" style={{ color }}>{value}</p>
                </div>
              ) : null)}
            </div>

            {/* Historical badge */}
            {entry.historical_win_rate != null && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg text-xs font-dm-mono font-bold"
                  style={{
                    background: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.2)",
                    color: entry.historical_win_rate > 65 ? "#4ade80" : entry.historical_win_rate >= 50 ? "#f59e0b" : "#f87171",
                  }}>
                  Hist: {entry.historical_win_rate}%
                  {entry.historical_sample_size && <span className="ml-1.5 text-[#6b7280]">({entry.historical_sample_size} setups)</span>}
                </span>
                {entry.historical_grade && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-dm-mono font-bold text-[#f59e0b]"
                    style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
                    Grade {entry.historical_grade}
                  </span>
                )}
              </div>
            )}

            {/* Outcome selector */}
            <div className="flex items-center gap-3">
              <span className="font-dm-mono text-[10px] text-[#6b7280] uppercase tracking-wider">Outcome</span>
              <div className="flex gap-1.5">
                {(["WIN", "LOSS", "BREAKEVEN", ""] as (Outcome | "")[]).map((o) => (
                  <button key={o}
                    onClick={() => patch({ outcome: o ? (o as Outcome) : null })}
                    className="px-3 py-1.5 rounded-lg text-xs font-dm-mono font-bold transition-all"
                    style={{
                      background: entry.outcome === o || (!entry.outcome && o === "")
                        ? `${o ? outcomeColor(o as Outcome) : "#4b5563"}20`
                        : "rgba(255,255,255,0.04)",
                      border: `1px solid ${entry.outcome === o || (!entry.outcome && o === "")
                        ? `${o ? outcomeColor(o as Outcome) : "#4b5563"}40`
                        : "rgba(255,255,255,0.06)"}`,
                      color: o ? outcomeColor(o as Outcome) : "#4b5563",
                    }}>
                    {o || "PENDING"}
                  </button>
                ))}
              </div>
            </div>

            {/* P&L + R achieved */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-dm-mono text-[10px] text-[#6b7280] uppercase tracking-wider mb-1.5">P&L ($)</p>
                <input
                  type="number" step="0.01"
                  value={pnl}
                  onChange={(e) => setPnl(e.target.value)}
                  onBlur={() => {
                    const v = pnl ? parseFloat(pnl) : null;
                    patch({ pnl: v });
                    onUpdate(entry.id, { pnl: v });
                  }}
                  placeholder="e.g. 150.00"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm font-dm-mono outline-none focus:border-[#00e676]/40 transition-colors"
                />
              </div>
              <div>
                <p className="font-dm-mono text-[10px] text-[#6b7280] uppercase tracking-wider mb-1.5">R Achieved</p>
                <input
                  type="number" step="0.1"
                  value={rAch}
                  onChange={(e) => setRAch(e.target.value)}
                  onBlur={() => {
                    const v = rAch ? parseFloat(rAch) : null;
                    patch({ r_achieved: v });
                    onUpdate(entry.id, { r_achieved: v });
                  }}
                  placeholder="e.g. 2.1"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm font-dm-mono outline-none focus:border-[#00e676]/40 transition-colors"
                />
              </div>
            </div>

            {/* AI Summary */}
            {entry.summary && (
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4">
                <p className="font-dm-mono text-[10px] text-[#6b7280] uppercase tracking-wider mb-2">AI Summary</p>
                <p className="text-[#d1d5db] text-sm leading-relaxed">{entry.summary}</p>
              </div>
            )}

            {/* Notes */}
            <div>
              <p className="font-dm-mono text-[10px] text-[#6b7280] uppercase tracking-wider mb-1.5">
                Notes <span className="normal-case tracking-normal ml-2 text-[#374151]">auto-saves on blur</span>
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => { if (notes !== (entry.notes ?? "")) { patch({ notes }); } }}
                rows={3} placeholder="Add trade notes…"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-[#374151] focus:outline-none focus:border-[#00e676]/40 resize-none transition-colors"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Upgrade lock overlay (blurred section) ────────────────────
function LockedOverlay({ label, href = "/pricing" }: { label: string; href?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 rounded-2xl"
      style={{ background: "linear-gradient(to bottom, transparent 0%, rgba(8,10,16,0.96) 40%)" }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border border-[#00e676]/30 bg-[#00e676]/08 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2.5" y="7" width="11" height="8" rx="2" stroke="#00e676" strokeWidth="1.3"/>
            <path d="M5 7V5a3 3 0 016 0v2" stroke="#00e676" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="text-white font-bold text-sm">{label}</p>
        <Link href={href}
          className="px-5 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
          style={{ background: "#00e676", color: "#080a10" }}>
          Upgrade to Pro
        </Link>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function JournalPage() {
  const { isPro, isElite } = useUserPlan();
  const [entries,         setEntries]         = useState<JournalEntry[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [setupErr,        setSetupErr]        = useState(false);
  const [clientId,        setClientId]        = useState<string | null>(null);
  const [apiIsPro,        setApiIsPro]        = useState(false);
  const [dateRange,       setDateRange]       = useState<DateRange>("all");
  const [activeTab,       setActiveTab]       = useState<"overview" | "trades" | "coach">("overview");
  const [search,          setSearch]          = useState("");
  const [filterSignal,    setFilterSignal]    = useState("");
  const [filterOutcome,   setFilterOutcome]   = useState("");
  const [showManual,      setShowManual]      = useState(false);
  const [coachingData,    setCoachingData]    = useState<CoachingData | null>(null);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [coachingError,   setCoachingError]   = useState<string | null>(null);
  const [showCoaching,    setShowCoaching]    = useState(false);
  const [copied,          setCopied]          = useState(false);
  const [mounted,         setMounted]         = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const id = localStorage.getItem("ciq_client_id");
    setClientId(id);
    const url = `/api/journal${id ? `?client_id=${encodeURIComponent(id)}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) { setEntries(d.entries ?? []); setApiIsPro(d.isPro ?? false); }
        else setSetupErr(true);
      })
      .catch(() => setSetupErr(true))
      .finally(() => setLoading(false));
  }, [mounted]);

  const rangedEntries = useMemo(() => filterByRange(entries, dateRange), [entries, dateRange]);

  const filtered = useMemo(() => {
    let list = rangedEntries;
    if (search)        list = list.filter((e) => (e.asset ?? "").toLowerCase().includes(search.toLowerCase()));
    if (filterSignal)  list = list.filter((e) => e.signal === filterSignal);
    if (filterOutcome) list = list.filter((e) => e.outcome === filterOutcome || (filterOutcome === "PENDING" && !e.outcome));
    return list;
  }, [rangedEntries, search, filterSignal, filterOutcome]);

  const stats       = useMemo(() => calcStats(rangedEntries), [rangedEntries]);
  const equityData  = useMemo(() => buildEquityCurve(rangedEntries), [rangedEntries]);
  const assetData   = useMemo(() => buildAssetWinRate(rangedEntries), [rangedEntries]);
  const heatmap     = useMemo(() => buildMonthlyHeatmap(entries), [entries]);
  const sessionBD   = useMemo(() => buildBreakdown(rangedEntries, "entry_session"),   [rangedEntries]);
  const timeframeBD = useMemo(() => buildBreakdown(rangedEntries, "timeframe"),       [rangedEntries]);
  const gradeBD     = useMemo(() => buildBreakdown(rangedEntries, "historical_grade"),[rangedEntries]);

  function handleUpdate(id: string, patch: Partial<JournalEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }
  function handleManualSaved(entry: JournalEntry) {
    setEntries((prev) => [entry, ...prev]);
  }

  async function handleGetCoaching() {
    if (!clientId) return;
    setCoachingLoading(true); setCoachingError(null);
    try {
      const res  = await fetch("/api/coaching", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) setCoachingError(data.error ?? "Failed to generate coaching report");
      else { setCoachingData(data.coaching as CoachingData); setShowCoaching(true); }
    } catch { setCoachingError("Network error — please try again"); }
    setCoachingLoading(false);
  }

  function copyStats() {
    const s = stats;
    const text = [
      `ChartIQ Journal — ${new Date().toLocaleDateString("en-GB")}`,
      `Trades: ${s.total}`,
      `Win Rate: ${s.winRate != null ? s.winRate + "%" : "—"}`,
      `Avg R:R: ${s.avgRR != null ? "1:" + s.avgRR.toFixed(1) : "—"}`,
      s.totalPnl != null ? `Total P&L: ${s.totalPnl >= 0 ? "+" : ""}${s.totalPnl.toFixed(2)}` : "",
      s.bestAsset ? `Best Asset: ${s.bestAsset} (${Math.round(s.bestAssetRate * 100)}% WR)` : "",
      s.streak > 0 ? `Current Streak: ${s.streak}W` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  if (!mounted) return null;

  const canCoach   = entries.length >= 10;
  const showCharts = isPro || apiIsPro;
  const canCoachEl = isElite;

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      {showCoaching && coachingData && <CoachingModal data={coachingData} onClose={() => setShowCoaching(false)} />}
      {showManual && <ManualTradeModal clientId={clientId} onClose={() => setShowManual(false)} onSaved={handleManualSaved} />}

      <AppNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-20">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00e676]/30 bg-[#00e676]/10 text-[#00e676] text-[10px] font-semibold tracking-[0.13em] uppercase mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00e676] animate-pulse" />
              Trade Journal
            </div>
            <h1 className="font-bebas text-[clamp(40px,6vw,64px)] leading-none tracking-[0.03em] text-white">
              PERFORMANCE <span style={{ color: "#00e676" }}>DASHBOARD</span>
            </h1>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date range */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {(["7d", "30d", "90d", "all"] as DateRange[]).map((r) => (
                <button key={r} onClick={() => setDateRange(r)}
                  className="px-3 py-1.5 rounded-lg text-xs font-dm-mono font-bold transition-all"
                  style={dateRange === r ? { background: "#00e676", color: "#080a10" } : { color: "#6b7280" }}>
                  {r === "all" ? "All" : r}
                </button>
              ))}
            </div>

            {/* Export */}
            {showCharts && (
              <>
                <button onClick={() => exportCSV(entries)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:bg-white/[0.06]"
                  style={{ border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af" }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v7M3 5l3 3 3-3M1 9v1a1 1 0 001 1h8a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  CSV
                </button>
                <button onClick={copyStats}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:bg-white/[0.06]"
                  style={{ border: "1px solid rgba(255,255,255,0.08)", color: copied ? "#4ade80" : "#9ca3af" }}>
                  {copied ? "✓ Copied" : "Copy Stats"}
                </button>
              </>
            )}

            {/* Add trade */}
            {showCharts && (
              <button onClick={() => setShowManual(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                style={{ background: "rgba(0,230,118,0.12)", color: "#00e676", border: "1px solid rgba(0,230,118,0.25)" }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Log Trade
              </button>
            )}
          </div>
        </div>

        {/* ── Supabase error ── */}
        {setupErr && (
          <div className="mb-8 rounded-2xl border border-[#9ca3af]/20 bg-[#9ca3af]/[0.04] p-5 flex items-start gap-4">
            <span className="text-base flex-shrink-0 mt-0.5">⚠</span>
            <div>
              <p className="text-[#9ca3af] font-semibold text-sm mb-1">Supabase not configured</p>
              <p className="text-[#9ca3af]/60 text-sm">
                Add <code className="font-dm-mono bg-white/[0.06] px-1 rounded">SUPABASE_URL</code> and{" "}
                <code className="font-dm-mono bg-white/[0.06] px-1 rounded">SUPABASE_SERVICE_KEY</code> to .env.local
              </p>
            </div>
          </div>
        )}

        {/* ── Free upgrade banner ── */}
        {!isPro && !apiIsPro && !loading && entries.length > 0 && (
          <div className="mb-8 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{ background: "linear-gradient(135deg, #0d1f15 0%, #080a10 100%)", border: "1.5px solid rgba(0,230,118,0.2)" }}>
            <div className="flex-1">
              <p className="font-bold text-white mb-0.5">You&apos;re seeing your last 10 analyses</p>
              <p className="text-[#6b7280] text-sm">Upgrade to Pro for full history, charts, breakdown, and P&L tracking.</p>
            </div>
            <Link href="/pricing"
              className="flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
              style={{ background: "#00e676", color: "#080a10" }}>
              Upgrade to Pro
            </Link>
          </div>
        )}

        {/* ── Stats grid ── */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            <StatCard label="Total Trades" rawValue={stats.total} sub="all time" />
            <StatCard
              label="Win Rate"
              displayValue={stats.winRate != null ? `${stats.winRate}%` : "—"}
              rawValue={stats.winRate ?? 0}
              sub={`${stats.wins}W / ${stats.losses}L`}
              accent={stats.winRate == null ? "#4b5563" : stats.winRate >= 55 ? "#4ade80" : stats.winRate >= 45 ? "#f59e0b" : "#f87171"}
            />
            <StatCard
              label="Avg R:R"
              displayValue={stats.avgRR != null ? `1:${stats.avgRR.toFixed(1)}` : "—"}
              sub="risk to reward"
              accent="#c084fc"
            />
            <StatCard
              label="Total P&L"
              displayValue={stats.totalPnl != null ? `${stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toFixed(0)}` : "—"}
              sub="$ net"
              accent={stats.totalPnl == null ? "#4b5563" : stats.totalPnl >= 0 ? "#4ade80" : "#f87171"}
            />
            <StatCard
              label="Best Asset"
              displayValue={stats.bestAsset ?? "—"}
              sub={stats.bestAsset ? `${Math.round(stats.bestAssetRate * 100)}% win rate` : "mark trades WIN/LOSS"}
              accent="#f59e0b"
            />
            <StatCard
              label="Streak"
              displayValue={stats.streak > 0 ? `${stats.streak}W` : "—"}
              sub="current win streak"
              accent="#00e676"
            />
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="space-y-3 mb-8">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />)}
          </div>
        )}

        {/* ── Tabs ── */}
        {!loading && (
          <>
            <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {([
                { id: "overview", label: "Overview" },
                { id: "trades",   label: `Trades (${filtered.length})` },
                ...(canCoachEl ? [{ id: "coach", label: "AI Coach" }] : []),
              ] as { id: "overview" | "trades" | "coach"; label: string }[]).map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold font-dm-mono transition-all"
                  style={activeTab === tab.id
                    ? { background: "#00e676", color: "#080a10" }
                    : { color: "#6b7280" }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Overview tab ── */}
            {activeTab === "overview" && (
              <div className="space-y-6">

                {showCharts ? (
                  <>
                    {/* Charts row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Equity curve */}
                      <div className="rounded-2xl p-5 border border-white/[0.06]"
                        style={{ background: "rgba(255,255,255,0.02)" }}>
                        <p className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280] mb-4">Equity Curve</p>
                        <EquityChart data={equityData} />
                      </div>

                      {/* Asset breakdown */}
                      <div className="rounded-2xl p-5 border border-white/[0.06]"
                        style={{ background: "rgba(255,255,255,0.02)" }}>
                        <p className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280] mb-4">Win/Loss by Asset</p>
                        <AssetChart data={assetData} />
                      </div>
                    </div>

                    {/* Monthly heatmap */}
                    <div className="rounded-2xl p-5 border border-white/[0.06]"
                      style={{ background: "rgba(255,255,255,0.02)" }}>
                      <p className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280] mb-4">Monthly Performance</p>
                      <MonthlyHeatmap data={heatmap} />
                    </div>

                    {/* Breakdown grids */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                      <div className="rounded-2xl p-5 border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
                        <BreakdownSection title="By Session"    data={sessionBD} />
                        {sessionBD.length === 0 && <p className="text-[#374151] text-sm font-dm-mono">No session data</p>}
                      </div>
                      <div className="rounded-2xl p-5 border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
                        <BreakdownSection title="By Timeframe" data={timeframeBD} />
                        {timeframeBD.length === 0 && <p className="text-[#374151] text-sm font-dm-mono">No timeframe data</p>}
                      </div>
                      <div className="rounded-2xl p-5 border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
                        <BreakdownSection title="By Grade"     data={gradeBD} />
                        {gradeBD.length === 0 && <p className="text-[#374151] text-sm font-dm-mono">Run analyses to see grade data</p>}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Free — blurred chart previews */
                  <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: 360 }}>
                    <div className="blur-sm pointer-events-none select-none p-5 space-y-4 opacity-40">
                      <div className="h-[220px] rounded-xl" style={{ background: "rgba(0,230,118,0.06)" }} />
                      <div className="grid grid-cols-3 gap-3">
                        {[1,2,3].map((i) => <div key={i} className="h-20 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }} />)}
                      </div>
                    </div>
                    <LockedOverlay label="Charts — Pro only" />
                  </div>
                )}
              </div>
            )}

            {/* ── Trades tab ── */}
            {activeTab === "trades" && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                  <div className="relative flex-1 min-w-[160px]">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#374151]" width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    <input
                      value={search} onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search asset…"
                      className="w-full pl-8 pr-3 py-2 rounded-xl text-white text-sm font-dm-mono outline-none transition-colors"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    />
                  </div>
                  <select value={filterSignal} onChange={(e) => setFilterSignal(e.target.value)}
                    className="px-3 py-2 rounded-xl text-sm font-dm-mono text-[#9ca3af] outline-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <option value="">All Signals</option>
                    <option value="LONG">LONG</option>
                    <option value="SHORT">SHORT</option>
                    <option value="NEUTRAL">NEUTRAL</option>
                  </select>
                  <select value={filterOutcome} onChange={(e) => setFilterOutcome(e.target.value)}
                    className="px-3 py-2 rounded-xl text-sm font-dm-mono text-[#9ca3af] outline-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <option value="">All Outcomes</option>
                    <option value="WIN">WIN</option>
                    <option value="LOSS">LOSS</option>
                    <option value="BREAKEVEN">BREAKEVEN</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                  {showCharts && (
                    <button onClick={() => setShowManual(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                      style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }}>
                      + Log Trade
                    </button>
                  )}
                </div>

                {/* Empty state */}
                {filtered.length === 0 && !loading && (
                  <div className="rounded-2xl border border-dashed border-white/[0.08] flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-[#00e676]/[0.06] border border-[#00e676]/15 flex items-center justify-center mb-4">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="2" width="18" height="20" rx="2.5" stroke="#00e676" strokeWidth="1.3"/>
                        <path d="M7 8h10M7 12h10M7 16h6" stroke="#00e676" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <p className="text-white font-semibold mb-1">{entries.length === 0 ? "No trades yet" : "No trades match filters"}</p>
                    <p className="text-[#4b5563] text-sm mb-6 max-w-xs">
                      {entries.length === 0
                        ? "Upload your first chart — every analysis is saved here automatically."
                        : "Try clearing the filters above."}
                    </p>
                    {entries.length === 0 && (
                      <Link href="/#analyze"
                        className="px-6 py-2.5 rounded-xl text-sm font-bold"
                        style={{ background: "#00e676", color: "#080a10" }}>
                        Analyse Your First Chart
                      </Link>
                    )}
                  </div>
                )}

                {/* Trade list */}
                <div className="space-y-2">
                  {filtered.map((e) => (
                    <TradeCard key={e.id} entry={e} onUpdate={handleUpdate} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Coach tab (Elite) ── */}
            {activeTab === "coach" && canCoachEl && (
              <div className="space-y-6">
                <div className="rounded-2xl p-6 border border-white/[0.06]"
                  style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-[#a78bfa]/30 bg-[#a78bfa]/10 text-[#a78bfa] text-[10px] font-semibold tracking-widest uppercase mb-2">
                        Elite Feature
                      </div>
                      <h2 className="text-xl font-extrabold text-white mb-1">AI Trade Coach</h2>
                      <p className="text-[#6b7280] text-sm">
                        Claude analyses your full trade history and delivers a personalised coaching report.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {canCoach ? (
                        <button onClick={handleGetCoaching} disabled={coachingLoading}
                          className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 disabled:opacity-50"
                          style={{ background: coachingLoading ? "rgba(0,230,118,0.15)" : "#00e676", color: coachingLoading ? "#00e676" : "#080a10", boxShadow: "0 0 22px rgba(0,230,118,0.25)" }}>
                          {coachingLoading ? (
                            <><svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="26" strokeDashoffset="8" strokeLinecap="round"/>
                            </svg> Analysing…</>
                          ) : "Generate Report"}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 text-[#4b5563] text-xs font-dm-mono">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <rect x="1.5" y="5" width="9" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.1"/>
                            <path d="M3.5 5V3.5a2.5 2.5 0 015 0V5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                          </svg>
                          Needs 10+ trades ({entries.length}/10)
                        </div>
                      )}
                      {coachingData && (
                        <button onClick={() => setShowCoaching(true)} className="font-dm-mono text-[10px] text-[#00e676] hover:underline text-center">
                          View last report
                        </button>
                      )}
                      {coachingError && <p className="font-dm-mono text-[10px] text-[#f87171]">{coachingError}</p>}
                    </div>
                  </div>

                  {/* Progress bar if < 10 trades */}
                  {!canCoach && (
                    <div className="space-y-1.5">
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full bg-[#00e676] transition-all"
                          style={{ width: `${(entries.length / 10) * 100}%` }} />
                      </div>
                      <p className="font-dm-mono text-[10px] text-[#374151]">{entries.length}/10 trades needed to unlock coaching</p>
                    </div>
                  )}

                  {/* What coaching covers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    {[
                      "Strongest & weakest assets",
                      "Best performing sessions",
                      "Pattern identification",
                      "Personalised action plan",
                      "Trading score out of 100",
                      "Win/loss ratio analysis",
                    ].map((f) => (
                      <div key={f} className="flex items-center gap-2.5 text-sm text-[#9ca3af]">
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="flex-shrink-0">
                          <path d="M2 6.5l3 3L11 2.5" stroke="#00e676" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
