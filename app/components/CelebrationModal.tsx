"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGamification } from "../lib/gamification-context";
import { RARITY_COLORS } from "../lib/gamification";

function Confetti() {
  const COLORS = ["#00e676","#ffd740","#ef5350","#42a5f5","#ab47bc","#ffffff","#ff7043"];
  const pieces = Array.from({ length: 70 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: COLORS[i % COLORS.length],
    size: 5 + Math.random() * 8,
    delay: Math.random() * 0.8,
    dur: 1.6 + Math.random() * 1.4,
    rotate: Math.random() * 360,
    isCircle: Math.random() > 0.5,
  }));

  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[299]">
        {pieces.map(p => (
          <div key={p.id} style={{
            position: "absolute", top: 0, left: `${p.x}%`,
            width: p.size, height: p.size,
            background: p.color,
            borderRadius: p.isCircle ? "50%" : "2px",
            animationName: "confetti-fall",
            animationTimingFunction: "linear",
            animationFillMode: "forwards",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            transform: `rotate(${p.rotate}deg)`,
          }} />
        ))}
      </div>
    </>
  );
}

export default function CelebrationModal() {
  const { celebration, dismissCelebration } = useGamification();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (celebration) {
      timerRef.current = setTimeout(dismissCelebration, 6000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [celebration, dismissCelebration]);

  if (!celebration) return null;

  const shareText = celebration.type === "level_up"
    ? `I just reached Level ${celebration.level} — ${celebration.title} on ChartIQ AI! 📊`
    : celebration.type === "streak_milestone"
    ? `I just hit a ${celebration.streak} day streak on ChartIQ AI! 🔥`
    : `I just earned the "${celebration.name}" achievement on ChartIQ AI! ${celebration.icon}`;

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText + " trade-edge-ai.vercel.app")}`;

  return (
    <>
      <Confetti />
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-[300] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismissCelebration}
        >
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 40 }}
            animate={{ scale: 1,   opacity: 1, y: 0  }}
            exit={{    scale: 0.85, opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            onClick={e => e.stopPropagation()}
            className="relative z-10 rounded-3xl p-8 text-center max-w-sm w-full"
            style={{ background: "#0d1117", border: "1px solid rgba(0,230,118,0.3)", boxShadow: "0 0 60px rgba(0,230,118,0.15)" }}
          >
            {celebration.type === "level_up" && (
              <>
                <div className="text-6xl mb-4">🏅</div>
                <p className="font-dm-mono text-[11px] uppercase tracking-[0.2em] text-[#00e676] mb-2">Level Up!</p>
                <h2 className="font-bebas text-[52px] leading-none text-white mb-2">
                  LEVEL {celebration.level}
                </h2>
                <p className="text-[#00e676] font-bold text-lg mb-2">{celebration.title}</p>
                <p className="text-[#6b7280] text-sm mb-6">You&apos;re levelling up fast. Keep analysing.</p>
              </>
            )}
            {celebration.type === "streak_milestone" && (
              <>
                <div className="text-6xl mb-4">{celebration.emoji}</div>
                <p className="font-dm-mono text-[11px] uppercase tracking-[0.2em] text-[#00e676] mb-2">Streak Milestone!</p>
                <h2 className="font-bebas text-[48px] leading-none text-white mb-2">
                  {celebration.streak} DAY STREAK
                </h2>
                <p className="text-[#00e676] font-bold text-lg mb-2">{celebration.label}</p>
                <p className="text-[#6b7280] text-sm mb-6">Consistency is the edge. Don&apos;t stop now.</p>
              </>
            )}
            {celebration.type === "achievement" && (() => {
              const rc = RARITY_COLORS[celebration.rarity as keyof typeof RARITY_COLORS] ?? RARITY_COLORS.common;
              return (
                <>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl"
                    style={{ background: rc.bg, border: `2px solid ${rc.border}` }}>
                    {celebration.icon}
                  </div>
                  <p className="font-dm-mono text-[11px] uppercase tracking-[0.2em] mb-2" style={{ color: rc.color }}>
                    Achievement Unlocked!
                  </p>
                  <h2 className="font-bebas text-[40px] leading-none text-white mb-4">{celebration.name}</h2>
                </>
              );
            })()}

            <div className="flex gap-2">
              <a href={twitterUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                style={{ background: "rgba(29,155,240,0.12)", color: "#1d9bf0", border: "1px solid rgba(29,155,240,0.25)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.734-8.835L1.254 2.25H8.08l4.257 5.625 5.907-5.625zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Share
              </a>
              <button onClick={dismissCelebration}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                style={{ background: "rgba(255,255,255,0.05)", color: "#9ca3af" }}>
                Continue
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
