"use client";

import { motion } from "framer-motion";
import { useGamification } from "../lib/gamification-context";

const STEPS = [
  { id: "analysis",  label: "Run your first analysis",       xp: 20, href: "/#analyze" },
  { id: "journal",   label: "Log an outcome in journal",     xp: 30, href: "/journal"  },
  { id: "watchlist", label: "Set up your watchlist",         xp: 20, href: "/watchlist" },
  { id: "backtest",  label: "Run a strategy backtest",       xp: 50, href: "/strategy-tester" },
  { id: "streak3",   label: "Hit a 3 day analysis streak",   xp: 80, href: "/#analyze" },
];

export default function WelcomeQuest() {
  const { state } = useGamification();
  const done      = state.welcomeSteps;

  // Auto-derive some steps from stats
  const derived = new Set([
    ...done,
    ...(state.totalAnalyses > 0  ? ["analysis"]  : []),
    ...(state.tradesLogged > 0   ? ["journal"]   : []),
    ...(state.backtestsRun > 0   ? ["backtest"]  : []),
    ...(state.streak >= 3        ? ["streak3"]   : []),
  ]);

  const allDone = STEPS.every(s => derived.has(s.id));
  if (allDone) return null;

  const completedCount = STEPS.filter(s => derived.has(s.id)).length;
  const pct = (completedCount / STEPS.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 mb-5"
      style={{ background: "rgba(255,215,64,0.04)", border: "1px solid rgba(255,215,64,0.2)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🗺️</span>
          <div>
            <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: "#ffd740" }}>
              Welcome Quest
            </p>
            <p className="font-dm-mono text-[9px] text-[#4b5563]">Complete all steps — earn 200 XP</p>
          </div>
        </div>
        <span className="font-dm-mono text-[10px] text-[#6b7280]">{completedCount}/{STEPS.length}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div className="h-full rounded-full"
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ background: "linear-gradient(90deg, #f59e0b, #ffd740)" }}
        />
      </div>

      <div className="space-y-1.5">
        {STEPS.map(step => {
          const isDone = derived.has(step.id);
          return (
            <a key={step.id} href={step.href}
              className="flex items-center gap-2.5 py-1 px-2 rounded-lg transition-colors hover:bg-white/[0.02]">
              <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                style={isDone
                  ? { background: "rgba(0,230,118,0.15)", border: "1px solid rgba(0,230,118,0.4)" }
                  : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {isDone
                  ? <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2L7 1.5" stroke="#00e676" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : <div className="w-1.5 h-1.5 rounded-full bg-white/20" />}
              </div>
              <span className={`font-dm-mono text-[10px] flex-1 ${isDone ? "line-through text-[#4b5563]" : "text-white"}`}>
                {step.label}
              </span>
              <span className="font-dm-mono text-[9px]" style={{ color: "#ffd740" }}>+{step.xp} XP</span>
            </a>
          );
        })}
      </div>
    </motion.div>
  );
}
