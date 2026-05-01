"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useGamification } from "../lib/gamification-context";
import { getLevelInfo } from "../lib/gamification";
import AppNav from "../components/AppNav";

type Tab = "xp" | "winrate" | "analyses" | "streak";

interface LeaderRow {
  rank:     number;
  name:     string;
  flag:     string;
  level:    number;
  title:    string;
  streak:   number;
  xp:       number;
  winRate:  number;
  analyses: number;
  isYou?:   boolean;
}

// Deterministic pseudo-leaderboard seeded on week number
function weekNumber() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
}

function buildLeaderboard(tab: Tab, myState: ReturnType<typeof useGamification>["state"]): LeaderRow[] {
  const names  = ["James K","Sarah M","Alex T","Emma D","Luca F","Ryan P","Mia C","Noah B","Chloe R","Ethan W","Isabelle G","Marcus L","Sofia A","Jake H","Priya N","Oliver S","Zoe T","Sam U","Ava J","Ben Q"];
  const flags  = ["🇬🇧","🇺🇸","🇦🇺","🇨🇦","🇩🇪","🇫🇷","🇸🇬","🇦🇪","🇧🇷","🇳🇿","🇮🇳","🇿🇦","🇸🇪","🇳🇱","🇯🇵","🇪🇸","🇦🇷","🇳🇬","🇮🇪","🇰🇷"];
  const wk = weekNumber();

  const rows: LeaderRow[] = names.map((name, i) => {
    let seed = (i + 1) * 997 + wk * 31;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
    const xp       = Math.floor(1200 + rnd() * 8000 - i * 200);
    const analyses = Math.floor(15 + rnd() * 80 - i * 2);
    const winRate  = Math.floor(45 + rnd() * 45);
    const streak   = Math.floor(1 + rnd() * 28 - i * 0.5);
    const info     = getLevelInfo(xp);
    return {
      rank: i + 1,
      name, flag: flags[i % flags.length],
      level: info.level, title: info.title,
      streak: Math.max(0, streak),
      xp: Math.max(100, xp),
      winRate, analyses: Math.max(1, analyses),
    };
  });

  // Sort by current tab
  rows.sort((a, b) => {
    if (tab === "xp")       return b.xp - a.xp;
    if (tab === "winrate")  return b.winRate - a.winRate;
    if (tab === "analyses") return b.analyses - a.analyses;
    return b.streak - a.streak;
  });

  // Re-rank
  rows.forEach((r, i) => r.rank = i + 1);

  // Find where user fits
  const myInfo = getLevelInfo(myState.xp);
  const myScore = tab === "xp" ? myState.xp : tab === "winrate" ? myState.winRate : tab === "analyses" ? myState.totalAnalyses : myState.streak;
  const myRank = rows.filter(r => {
    const s = tab === "xp" ? r.xp : tab === "winrate" ? r.winRate : tab === "analyses" ? r.analyses : r.streak;
    return s > myScore;
  }).length + 1;

  const meRow: LeaderRow = {
    rank: myRank, name: "You", flag: "🏠",
    level: myInfo.level, title: myInfo.title,
    streak: myState.streak, xp: myState.xp,
    winRate: myState.winRate, analyses: myState.totalAnalyses,
    isYou: true,
  };

  // Splice me into the right position
  rows.splice(myRank - 1, 0, meRow);
  rows.forEach((r, i) => r.rank = i + 1);

  return rows.slice(0, 21);
}

const RANK_STYLES: Record<number, { bg: string; border: string; glow: string }> = {
  1: { bg: "rgba(255,215,64,0.07)",  border: "rgba(255,215,64,0.3)",  glow: "0 0 20px rgba(255,215,64,0.12)"  },
  2: { bg: "rgba(192,192,192,0.06)", border: "rgba(192,192,192,0.25)", glow: "0 0 16px rgba(192,192,192,0.08)" },
  3: { bg: "rgba(205,127,50,0.07)",  border: "rgba(205,127,50,0.25)",  glow: "0 0 16px rgba(205,127,50,0.08)"  },
};

export default function LeaderboardPage() {
  const { state }      = useGamification();
  const [tab, setTab]  = useState<Tab>("xp");
  const rows           = buildLeaderboard(tab, state);
  const meRow          = rows.find(r => r.isYou);
  const myInfo         = getLevelInfo(state.xp);

  const tabs: { id: Tab; label: string }[] = [
    { id: "xp",       label: "XP this week" },
    { id: "winrate",  label: "Win rate"      },
    { id: "analyses", label: "Analyses"      },
    { id: "streak",   label: "Streak"        },
  ];

  function score(r: LeaderRow) {
    if (tab === "xp")       return r.xp.toLocaleString() + " XP";
    if (tab === "winrate")  return r.winRate + "%";
    if (tab === "analyses") return r.analyses.toString();
    return r.streak + "d";
  }

  const rankEmoji: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <AppNav />

      <main className="pt-24 pb-20 px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <p className="font-dm-mono text-[10px] uppercase tracking-[0.2em] text-[#ffd740] mb-2">Competition</p>
            <h1 className="font-bebas text-[52px] leading-none tracking-[0.04em] text-white mb-2">
              WEEKLY LEADERBOARD
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[#6b7280] text-sm">Resets every Monday midnight UTC</p>
              <span className="font-dm-mono text-[10px] px-2.5 py-1 rounded-full"
                style={{ background: "rgba(255,215,64,0.08)", color: "#ffd740", border: "1px solid rgba(255,215,64,0.2)" }}>
                🏆 Top 3 get 1 month Pro free
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex-1 py-2 rounded-lg font-dm-mono text-[11px] font-bold transition-all"
                style={tab === t.id
                  ? { background: "#00e676", color: "#080a10" }
                  : { color: "#6b7280" }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Your rank banner */}
          {meRow && (
            <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3"
              style={{ background: "rgba(0,230,118,0.06)", border: "1px solid rgba(0,230,118,0.2)" }}>
              <span className="font-dm-mono text-[11px] text-[#00e676] font-bold">Your rank:</span>
              <span className="font-bebas text-2xl text-white">#{meRow.rank}</span>
              <span className="font-dm-mono text-[10px] text-[#6b7280] ml-auto">
                {meRow.rank <= 3
                  ? "🏆 You're in the prizes!"
                  : meRow.rank <= 10
                  ? "🔥 You're in the top 10!"
                  : `${meRow.rank - 1} spots to top ${meRow.rank <= 20 ? "20" : "50"}`}
              </span>
            </div>
          )}

          {/* Rows */}
          <div className="space-y-1.5">
            {rows.map((row, i) => {
              const rs = RANK_STYLES[row.rank];
              return (
                <motion.div key={`${row.rank}-${row.name}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.025, duration: 0.25 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                  style={{
                    background: row.isYou ? "rgba(0,230,118,0.07)" : rs?.bg ?? "rgba(255,255,255,0.02)",
                    border: row.isYou ? "1px solid rgba(0,230,118,0.3)" : rs ? `1px solid ${rs.border}` : "1px solid rgba(255,255,255,0.06)",
                    boxShadow: row.isYou ? "0 0 18px rgba(0,230,118,0.1)" : rs?.glow ?? "none",
                  }}>

                  {/* Rank */}
                  <div className="w-8 text-center flex-shrink-0">
                    {rankEmoji[row.rank]
                      ? <span className="text-lg">{rankEmoji[row.rank]}</span>
                      : <span className="font-dm-mono text-[12px] font-bold text-[#6b7280]">#{row.rank}</span>}
                  </div>

                  {/* Flag + name */}
                  <span className="text-base flex-shrink-0">{row.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${row.isYou ? "text-[#00e676]" : "text-white"}`}>
                        {row.name}
                        {row.isYou && " (You)"}
                      </span>
                      <span className="font-dm-mono text-[9px] px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(0,230,118,0.08)", color: "#00e676" }}>
                        LVL {row.level}
                      </span>
                    </div>
                    <p className="font-dm-mono text-[9px] text-[#4b5563]">{row.title}</p>
                  </div>

                  {/* Streak */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs">🔥</span>
                    <span className="font-dm-mono text-[10px] text-[#6b7280]">{row.streak}d</span>
                  </div>

                  {/* Score */}
                  <div className="text-right flex-shrink-0 min-w-[70px]">
                    <p className="font-dm-mono text-[13px] font-bold"
                      style={{ color: row.rank === 1 ? "#ffd740" : row.rank === 2 ? "#c0c0c0" : row.rank === 3 ? "#cd7f32" : row.isYou ? "#00e676" : "white" }}>
                      {score(row)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Prize callout */}
          <div className="mt-6 rounded-2xl p-4 text-center"
            style={{ background: "rgba(255,215,64,0.04)", border: "1px solid rgba(255,215,64,0.15)" }}>
            <p className="font-bebas text-2xl text-[#ffd740] mb-1">THIS WEEK&apos;S PRIZES</p>
            <p className="font-dm-mono text-[11px] text-[#6b7280]">
              🥇 1st place: 1 month Pro free &nbsp;·&nbsp; 🥈 2nd place: 1 month Pro free &nbsp;·&nbsp; 🥉 3rd place: 1 month Pro free
            </p>
            <p className="font-dm-mono text-[10px] text-[#4b5563] mt-1">
              Leaderboard resets Monday 00:00 UTC · Results verified by admin
            </p>
          </div>

          {/* Your stats summary */}
          <div className="mt-4 rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="font-dm-mono text-[10px] uppercase tracking-wider text-[#4b5563] mb-3">Your Stats This Week</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Level",     value: `LVL ${myInfo.level}` },
                { label: "XP",        value: state.xp.toLocaleString() },
                { label: "Analyses",  value: state.totalAnalyses.toString() },
                { label: "Streak",    value: `${state.streak}d 🔥` },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="font-dm-mono text-[9px] text-[#4b5563] uppercase tracking-wider mb-0.5">{s.label}</p>
                  <p className="font-dm-mono text-sm font-bold text-white">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
