"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useGamification } from "../lib/gamification-context";
import { getDailyChallenges, todayUTC } from "../lib/gamification";

function Countdown() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    function calc() {
      const now = new Date();
      const midnight = new Date();
      midnight.setUTCHours(24, 0, 0, 0);
      setSecs(Math.floor((midnight.getTime() - now.getTime()) / 1000));
    }
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return (
    <span className="font-dm-mono text-[10px] text-[#4b5563]">
      Resets in {String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
    </span>
  );
}

export default function DailyChallenges() {
  const { state } = useGamification();
  const today      = todayUTC();
  const challenges = getDailyChallenges(today);

  const isToday     = state.challengeDate === today;
  const progress    = isToday ? state.challengeProgress : {};
  const done        = isToday ? state.challengesDone    : [];
  const bonusClaimed = isToday ? state.bonusClaimed     : false;
  const allDone     = challenges.every(c => done.includes(c.id));

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">⚡</span>
          <span className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#6b7280] font-semibold">
            Daily Challenges
          </span>
          {allDone && (
            <span className="font-dm-mono text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(0,230,118,0.12)", color: "#00e676", border: "1px solid rgba(0,230,118,0.25)" }}>
              ALL COMPLETE {bonusClaimed ? "✓" : ""}
            </span>
          )}
        </div>
        <Countdown />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {challenges.map((ch, i) => {
          const cur  = progress[ch.id] ?? 0;
          const pct  = Math.min(100, (cur / ch.target) * 100);
          const isDone = done.includes(ch.id);

          return (
            <motion.div key={ch.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className="rounded-xl p-3 relative overflow-hidden"
              style={{
                background: isDone ? "rgba(0,230,118,0.06)" : "rgba(255,255,255,0.02)",
                border: isDone ? "1px solid rgba(0,230,118,0.25)" : "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-dm-mono text-[10px] text-white leading-snug flex-1">{ch.description}</p>
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 mt-0.5">
                    <circle cx="7" cy="7" r="6.5" fill="rgba(0,230,118,0.15)" stroke="#00e676" strokeWidth="1"/>
                    <path d="M4.5 7l2 2 3.5-3.5" stroke="#00e676" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span className="font-dm-mono text-[10px] font-bold flex-shrink-0 mt-0.5" style={{ color: "#00e676" }}>
                    +{ch.xpReward} XP
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  style={{ background: isDone ? "#00e676" : "rgba(0,230,118,0.5)" }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="font-dm-mono text-[9px] text-[#4b5563]">
                  {cur}/{ch.target}
                </span>
                {isDone && (
                  <span className="font-dm-mono text-[9px] text-[#00e676]">Done!</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {allDone && !bonusClaimed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-2 rounded-xl py-2 px-4 text-center font-dm-mono text-xs font-bold"
          style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.25)" }}
        >
          🎉 ALL COMPLETE — +50 bonus XP awarded!
        </motion.div>
      )}
    </div>
  );
}
