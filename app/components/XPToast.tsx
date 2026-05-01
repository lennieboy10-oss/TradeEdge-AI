"use client";

import { useGamification } from "../lib/gamification-context";
import { motion, AnimatePresence } from "framer-motion";

export default function XPToast() {
  const { toasts } = useGamification();

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col-reverse gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.85 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: -24, scale: 0.9  }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-dm-mono text-xs font-bold shadow-lg"
            style={{
              background: "rgba(0,230,118,0.14)",
              border:     "1px solid rgba(0,230,118,0.35)",
              color:      "#00e676",
              backdropFilter: "blur(8px)",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1l.8 2.5H8L6 5.2l.8 2.5L5 6.2l-1.8 1.5L4 5.2 2 3.5h2.2z"
                fill="#00e676"/>
            </svg>
            +{t.amount} XP
            {t.multiplier > 1 && (
              <span className="opacity-70">({t.multiplier}× streak)</span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
