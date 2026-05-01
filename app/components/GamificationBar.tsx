"use client";

import { motion } from "framer-motion";
import { useGamification } from "../lib/gamification-context";
import { getLevelInfo, getStreakMultiplier, todayUTC } from "../lib/gamification";

export default function GamificationBar() {
  const { state } = useGamification();
  const today    = todayUTC();
  const analysedToday = state.analysisDate === today && state.todayAnalyses > 0;
  const info     = getLevelInfo(state.xp);
  const mult     = getStreakMultiplier(state.streak);

  const xpInLevel    = state.xp - info.minXP;
  const xpNeeded     = (info.nextXP ?? state.xp + 1) - info.minXP;
  const progressPct  = Math.min(100, (xpInLevel / xpNeeded) * 100);

  return (
    <div className="rounded-2xl p-4 mb-5"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex flex-wrap items-center gap-4">

        {/* Streak */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <span className="text-2xl" style={{ filter: state.streak > 0 ? "drop-shadow(0 0 8px rgba(255,120,0,0.7))" : "none" }}>
              🔥
            </span>
            {state.streak > 0 && (
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ background: "radial-gradient(circle, rgba(255,120,0,0.3) 0%, transparent 70%)" }}
              />
            )}
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-bebas text-[28px] leading-none text-white">{state.streak}</span>
              <span className="font-dm-mono text-[10px] text-[#6b7280]">day streak</span>
            </div>
            <p className="font-dm-mono text-[9px] text-[#4b5563]">
              Best: {state.longestStreak}d
            </p>
          </div>
        </div>

        <div className="w-px h-8 bg-white/[0.07] hidden sm:block" />

        {/* XP + level progress */}
        <div className="flex-1 min-w-[180px]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-dm-mono text-[10px] font-bold px-2 py-0.5 rounded"
                style={{ background: "rgba(0,230,118,0.12)", color: "#00e676", border: "1px solid rgba(0,230,118,0.25)" }}>
                LVL {info.level}
              </span>
              <span className="font-dm-mono text-[10px] text-[#9ca3af]">{info.title}</span>
              {mult > 1 && (
                <span className="font-dm-mono text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(255,215,64,0.12)", color: "#ffd740", border: "1px solid rgba(255,215,64,0.2)" }}>
                  {mult}× XP
                </span>
              )}
            </div>
            <span className="font-dm-mono text-[10px] text-[#6b7280]">
              {state.xp.toLocaleString()} / {(info.nextXP ?? state.xp).toLocaleString()} XP
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ background: "linear-gradient(90deg, #00c853, #00e676)" }}
            />
          </div>
          {info.nextTitle && (
            <p className="font-dm-mono text-[9px] text-[#4b5563] mt-0.5">
              {(info.nextXP! - state.xp).toLocaleString()} XP to {info.nextTitle}
            </p>
          )}
        </div>

        <div className="w-px h-8 bg-white/[0.07] hidden sm:block" />

        {/* Today status */}
        <div className="flex-shrink-0">
          {analysedToday ? (
            <div className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="6" stroke="#00e676" strokeWidth="1"/>
                <path d="M4 6.5l2 2 3-3" stroke="#00e676" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="font-dm-mono text-[10px] text-[#00e676] font-bold">Streak protected ✓</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-sm">⚡</span>
              <div>
                <p className="font-dm-mono text-[10px] text-[#ffd740] font-bold">Analyse to keep streak</p>
                <p className="font-dm-mono text-[9px] text-[#4b5563]">+{mult > 1 ? `${mult}×` : ""} XP today</p>
              </div>
            </div>
          )}
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-2 ml-auto">
          <a href="/achievements"
            className="font-dm-mono text-[10px] px-2.5 py-1.5 rounded-lg transition-all hover:-translate-y-0.5"
            style={{ background: "rgba(255,255,255,0.04)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.07)" }}>
            Achievements
          </a>
          <a href="/leaderboard"
            className="font-dm-mono text-[10px] px-2.5 py-1.5 rounded-lg transition-all hover:-translate-y-0.5"
            style={{ background: "rgba(255,215,64,0.08)", color: "#ffd740", border: "1px solid rgba(255,215,64,0.2)" }}>
            🏆 Leaderboard
          </a>
        </div>
      </div>
    </div>
  );
}
