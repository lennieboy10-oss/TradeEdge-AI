"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGamification } from "../lib/gamification-context";
import AppNav from "../components/AppNav";
import {
  ACHIEVEMENTS, RARITY_COLORS, getLevelInfo,
  getStreakMultiplier, todayUTC, type GamStats,
} from "../lib/gamification";

function buildStats(state: ReturnType<typeof useGamification>["state"], isPro: boolean): GamStats {
  return {
    totalAnalyses:    state.totalAnalyses,
    aPlusCount:       state.aPlusCount,
    highConfidence90: state.highConfidence90,
    winsLogged:       state.winsLogged,
    totalLogged:      state.totalLogged,
    streak:           state.streak,
    longestStreak:    state.longestStreak,
    tradesLogged:     state.tradesLogged,
    backtestsRun:     state.backtestsRun,
    savedStrategies:  state.savedStrategies,
    isPro,
    isElite:          false,
    referrals:        state.referrals,
    joinedEarly:      state.joinedEarly,
    brokerConnected:  state.brokerConnected,
    webhookSetup:     state.webhookSetup,
    autoEnabled:      state.autoEnabled,
    winRate:          state.winRate,
    profitPositive:   state.profitPositive,
  };
}

const CATEGORIES = ["All", "Analysis", "Accuracy", "Streak", "Journal", "Strategy", "Platform", "Social", "Special"];

export default function AchievementsPage() {
  const { state } = useGamification();
  const [catFilter, setCatFilter]   = useState("All");
  const [selected,  setSelected]    = useState<string | null>(null);

  // Derive isPro from localStorage
  const isPro = typeof window !== "undefined"
    ? (localStorage.getItem("ciq_plan") === "pro" || localStorage.getItem("ciq_plan") === "elite")
    : false;

  const stats   = buildStats(state, isPro);
  const info    = getLevelInfo(state.xp);
  const today   = todayUTC();
  const analysedToday = state.analysisDate === today && state.todayAnalyses > 0;
  const mult    = getStreakMultiplier(state.streak);

  const earned  = new Set(state.achievements);
  const filtered = CATEGORIES[0] === catFilter || catFilter === "All"
    ? ACHIEVEMENTS
    : ACHIEVEMENTS.filter(a => a.category === catFilter);

  const earnedCount = ACHIEVEMENTS.filter(a => earned.has(a.id)).length;

  // Recent activity (derived from state changes — show last N earned)
  const recentActivity = [
    ...state.achievements.slice(-5).reverse().map(id => {
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      return ach ? `${ach.icon} Earned "${ach.name}" — ${ach.description}` : null;
    }).filter(Boolean) as string[],
    state.totalAnalyses > 0 ? `📊 Ran ${state.totalAnalyses} total analyses` : null,
    state.streak > 0 ? `🔥 Current streak: ${state.streak} days` : null,
  ].filter(Boolean).slice(0, 5) as string[];

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <AppNav />

      <main className="pt-24 pb-20 px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <p className="font-dm-mono text-[10px] uppercase tracking-[0.2em] text-[#00e676] mb-2">Progress</p>
            <h1 className="font-bebas text-[52px] leading-none tracking-[0.04em] text-white mb-2">
              YOUR ACHIEVEMENTS
            </h1>
            <p className="text-[#6b7280] text-sm">Track your progress and unlock badges as you improve</p>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              {
                label: "Level",
                value: `LVL ${info.level}`,
                sub: info.title,
                color: "#00e676",
              },
              {
                label: "Streak",
                value: `${state.streak} 🔥`,
                sub: analysedToday ? "Protected ✓" : "Analyse today!",
                color: state.streak > 0 ? "#ff7043" : "#6b7280",
              },
              {
                label: "Total XP",
                value: state.xp.toLocaleString(),
                sub: mult > 1 ? `${mult}× multiplier active` : "Keep going!",
                color: "#ffd740",
              },
              {
                label: "Badges",
                value: `${earnedCount}/${ACHIEVEMENTS.length}`,
                sub: `${ACHIEVEMENTS.length - earnedCount} remaining`,
                color: "#ab47bc",
              },
            ].map(stat => (
              <div key={stat.label} className="rounded-2xl p-4 text-center"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="font-dm-mono text-[10px] uppercase tracking-wider text-[#4b5563] mb-1">{stat.label}</p>
                <p className="font-bebas text-[28px] leading-none" style={{ color: stat.color }}>{stat.value}</p>
                <p className="font-dm-mono text-[9px] text-[#4b5563] mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Badge grid */}
            <div className="lg:col-span-2">
              {/* Category filter */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setCatFilter(cat)}
                    className="font-dm-mono text-[10px] px-2.5 py-1 rounded-full border transition-all"
                    style={catFilter === cat
                      ? { background: "rgba(0,230,118,0.12)", color: "#00e676", borderColor: "rgba(0,230,118,0.3)" }
                      : { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)", color: "#6b7280" }}>
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {filtered.map(ach => {
                  const isEarned = earned.has(ach.id);
                  const rc = RARITY_COLORS[ach.rarity];
                  const [cur, tgt] = ach.progress(stats);
                  const pct = Math.min(100, (cur / tgt) * 100);

                  return (
                    <motion.button key={ach.id}
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                      onClick={() => setSelected(selected === ach.id ? null : ach.id)}
                      className="rounded-xl p-2.5 flex flex-col items-center gap-1.5 transition-all relative"
                      style={{
                        background: isEarned ? rc.bg : "rgba(255,255,255,0.02)",
                        border: isEarned ? `1px solid ${rc.border}` : "1px solid rgba(255,255,255,0.06)",
                        opacity: isEarned ? 1 : 0.55,
                      }}
                    >
                      <div className="text-2xl" style={{ filter: isEarned ? `drop-shadow(0 0 6px ${rc.color})` : "grayscale(1)" }}>
                        {ach.icon}
                      </div>
                      <p className="font-dm-mono text-[8px] text-center leading-snug"
                        style={{ color: isEarned ? rc.color : "#4b5563" }}>
                        {ach.name}
                      </p>
                      {!isEarned && pct > 0 && (
                        <div className="w-full h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: rc.color }} />
                        </div>
                      )}
                      {!isEarned && (
                        <div className="absolute top-1 right-1">
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <rect x="1" y="3.5" width="6" height="4" rx="0.8" stroke="#374151" strokeWidth="0.8"/>
                            <path d="M2.5 3.5V2.5a1.5 1.5 0 013 0v1" stroke="#374151" strokeWidth="0.8" strokeLinecap="round"/>
                          </svg>
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Badge detail popover */}
              <AnimatePresence>
                {selected && (() => {
                  const ach = ACHIEVEMENTS.find(a => a.id === selected);
                  if (!ach) return null;
                  const isEarned = earned.has(ach.id);
                  const rc = RARITY_COLORS[ach.rarity];
                  const [cur, tgt] = ach.progress(stats);
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="mt-4 rounded-2xl p-4 flex items-center gap-4"
                      style={{ background: rc.bg, border: `1px solid ${rc.border}` }}
                    >
                      <div className="text-4xl flex-shrink-0">{ach.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="font-bold text-sm text-white">{ach.name}</p>
                          <span className="font-dm-mono text-[9px] px-1.5 py-0.5 rounded uppercase font-bold"
                            style={{ background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>
                            {ach.rarity}
                          </span>
                          {isEarned && (
                            <span className="font-dm-mono text-[9px] text-[#00e676]">✓ Earned</span>
                          )}
                        </div>
                        <p className="font-dm-mono text-[10px] text-[#6b7280] mb-2">{ach.description}</p>
                        {!isEarned && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100,(cur/tgt)*100)}%`, background: rc.color }}/>
                            </div>
                            <span className="font-dm-mono text-[10px]" style={{ color: rc.color }}>{cur}/{tgt}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-dm-mono text-[10px] text-[#4b5563]">Reward</p>
                        <p className="font-dm-mono text-sm font-bold" style={{ color: "#ffd740" }}>+{ach.xpReward} XP</p>
                      </div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </div>

            {/* Right: recent activity + XP breakdown */}
            <div className="space-y-4">
              <div className="rounded-2xl p-4"
                style={{ background: "#090d12", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#4b5563] font-semibold mb-3">
                  Recent Activity
                </p>
                {recentActivity.length === 0 ? (
                  <p className="font-dm-mono text-[10px] text-[#374151]">Start analysing to see activity here.</p>
                ) : (
                  <div className="space-y-2">
                    {recentActivity.map((item, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-[#00e676] mt-1.5 flex-shrink-0" />
                        <p className="font-dm-mono text-[10px] text-[#9ca3af] leading-relaxed">{item}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* XP breakdown */}
              <div className="rounded-2xl p-4"
                style={{ background: "#090d12", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#4b5563] font-semibold mb-3">
                  Your Progress
                </p>
                <div className="space-y-2.5">
                  {[
                    { label: "Analyses",   value: state.totalAnalyses,    icon: "📊" },
                    { label: "A+ signals", value: state.aPlusCount,       icon: "⭐" },
                    { label: "Trades logged", value: state.tradesLogged,  icon: "📓" },
                    { label: "Backtests",  value: state.backtestsRun,     icon: "🧪" },
                    { label: "Longest streak", value: `${state.longestStreak}d`, icon: "🔥" },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{row.icon}</span>
                        <span className="font-dm-mono text-[10px] text-[#6b7280]">{row.label}</span>
                      </div>
                      <span className="font-dm-mono text-[11px] font-bold text-white">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <a href="/leaderboard"
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-dm-mono text-xs font-bold transition-all hover:-translate-y-0.5"
                style={{ background: "rgba(255,215,64,0.08)", color: "#ffd740", border: "1px solid rgba(255,215,64,0.2)" }}>
                🏆 View Leaderboard
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
