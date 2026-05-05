"use client";

import { useGamification } from "../lib/gamification-context";
import { motion, AnimatePresence } from "framer-motion";
import { XP_ACTION_LABELS } from "../lib/gamification";

export default function XPToast() {
  const { toasts } = useGamification();

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col-reverse gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const isLarge = t.amount >= 30 || t.multiplier > 1;
          const label = XP_ACTION_LABELS[t.label] ?? t.label;

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 28, scale: 0.75 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit={{    opacity: 0, y: -20, scale: 0.88 }}
              transition={{ type: "spring", stiffness: 340, damping: 20 }}
              className="flex items-center gap-3 rounded-2xl"
              style={{
                padding:       isLarge ? "12px 18px" : "8px 14px",
                background:    "rgba(0, 230, 118, 0.12)",
                border:        "1px solid rgba(0, 230, 118, 0.35)",
                backdropFilter: "blur(12px)",
                boxShadow:     isLarge
                  ? "0 0 24px rgba(0,230,118,0.25), 0 4px 20px rgba(0,0,0,0.4)"
                  : "0 4px 16px rgba(0,0,0,0.3)",
              }}
            >
              {/* Icon */}
              <motion.div
                initial={{ rotate: -20, scale: 0.6 }}
                animate={{ rotate: 0,   scale: 1   }}
                transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.05 }}
                className="flex-shrink-0"
              >
                {isLarge ? (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M9 1.5l1.5 4.5H15l-3.75 2.7 1.5 4.5L9 10.5l-3.75 2.7 1.5-4.5L3 6h4.5z" fill="#00e676"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1l1.2 3.6H12l-3 2.16 1.2 3.6L7 8.4l-3.2 1.96 1.2-3.6L2 4.6h3.8z" fill="#00e676"/>
                  </svg>
                )}
              </motion.div>

              <div>
                {/* Action label */}
                <p className="font-dm-mono text-[10px] text-[#4ade80] leading-none mb-0.5">{label}</p>

                {/* XP amount */}
                <motion.p
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1   }}
                  transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.08 }}
                  className="font-dm-mono font-bold leading-none"
                  style={{ fontSize: isLarge ? "20px" : "15px", color: "#00e676" }}
                >
                  +{t.amount} XP
                </motion.p>

                {/* Streak multiplier */}
                {t.multiplier > 1 && (
                  <p className="font-dm-mono text-[10px] font-semibold mt-0.5"
                    style={{ color: "#ffd740" }}>
                    {t.multiplier}× streak bonus
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
