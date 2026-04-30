"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  asset?: string;
  timeframe?: string;
  signal?: string;
  entry?: string;
  stopLoss?: string;
  takeProfit1?: string;
  takeProfit2?: string;
  confidence?: number;
  isPro: boolean;
}

// Strip commas and whitespace before any numeric operation.
// "27,618.25" → "27618.25" → 27618.25
function cleanPrice(raw: string | undefined | null): string {
  return String(raw ?? "0").replace(/,/g, "").trim();
}

function toNum(raw: string | undefined | null): number {
  return parseFloat(cleanPrice(raw)) || 0;
}

function generatePineScript(p: Props): string {
  const asset = p.asset ?? "ASSET";
  const tf    = p.timeframe ? ` · ${p.timeframe}` : "";
  const dir   = (p.signal ?? "").toUpperCase() === "SHORT" ? "SELL" : "BUY";
  const conf  = p.confidence ?? 0;
  const isBuy = dir === "BUY";

  // Clean every price — the root fix for Problem 1 + 2
  const entryN  = toNum(p.entry);
  const slN     = toNum(p.stopLoss);
  const tp1N    = toNum(p.takeProfit1);

  // If a real TP2 was supplied, use it; otherwise project by the same distance as TP1
  const tp2Raw  = toNum(p.takeProfit2);
  const tp2N    = tp2Raw && tp2Raw !== tp1N
    ? tp2Raw
    : isBuy
      ? tp1N + (tp1N - entryN)   // project above TP1
      : tp1N - (entryN - tp1N);  // project below TP1

  // Format for Pine Script — plain decimals, no commas
  const E  = entryN.toFixed(2);
  const SL = slN.toFixed(2);
  const T1 = tp1N.toFixed(2);
  const T2 = tp2N.toFixed(2);

  return `//@version=5
indicator("ChartIQ Signal", overlay=true, max_lines_count=10, max_labels_count=10)
// ChartIQ AI — ${asset}${tf}
// Signal: ${dir} | Confidence: ${conf}%
// trade-edge-ai.vercel.app

// Price levels — no commas in numbers
var float entry_price = ${E}
var float sl_price    = ${SL}
var float tp1_price   = ${T1}
var float tp2_price   = ${T2}

// Draw horizontal lines
var line entryLine = line.new(bar_index, entry_price, bar_index + 1, entry_price, extend=extend.both, color=color.white, style=line.style_solid, width=2)
var line slLine    = line.new(bar_index, sl_price,    bar_index + 1, sl_price,    extend=extend.both, color=color.red,   style=line.style_dashed, width=2)
var line tp1Line   = line.new(bar_index, tp1_price,   bar_index + 1, tp1_price,   extend=extend.both, color=color.lime,  style=line.style_dashed, width=2)
var line tp2Line   = line.new(bar_index, tp2_price,   bar_index + 1, tp2_price,   extend=extend.both, color=color.green, style=line.style_dotted, width=1)

// Labels
var label entryLabel = label.new(bar_index + 10, entry_price, "Entry: " + str.tostring(entry_price), color=color.white,  textcolor=color.black, style=label.style_label_left)
var label slLabel    = label.new(bar_index + 10, sl_price,    "SL: "    + str.tostring(sl_price),    color=color.red,    textcolor=color.white, style=label.style_label_left)
var label tp1Label   = label.new(bar_index + 10, tp1_price,   "TP1: "   + str.tostring(tp1_price),   color=color.lime,   textcolor=color.black, style=label.style_label_left)
var label tp2Label   = label.new(bar_index + 10, tp2_price,   "TP2: "   + str.tostring(tp2_price),   color=color.green,  textcolor=color.white, style=label.style_label_left)
`;
}

// ── Test output (verifies no commas survive) ─────────────
// generatePineScript({ entry:"27,618.25", stopLoss:"27560.00", takeProfit1:"27750.00", takeProfit2:"27850.00", isPro:true })
// → entry_price = 27618.25 ✓  sl_price = 27560.00 ✓  tp1_price = 27750.00 ✓  tp2_price = 27850.00 ✓

export default function PineScriptExport(props: Props) {
  const [open,   setOpen]   = useState(false);
  const [copied, setCopied] = useState(false);

  const script = generatePineScript(props);

  async function handleCopy() {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (!props.isPro) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.7, duration: 0.4 }}
        className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 3.5h10M2 7h6M2 10.5h8" stroke="#4b5563" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span className="text-xs font-semibold text-[#4b5563]">Export to TradingView</span>
          </div>
          <span className="font-dm-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }}>
            PRO
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.7, duration: 0.4 }}
      className="rounded-2xl border overflow-hidden"
      style={{
        borderColor: open ? "rgba(0,230,118,0.22)" : "rgba(255,255,255,0.07)",
        background: "#090d12",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M2 3.5h11M2 7.5h7M2 11.5h9" stroke="#00e676" strokeWidth="1.35" strokeLinecap="round"/>
          </svg>
          <span className="text-sm font-semibold text-white">Export to TradingView</span>
          <span className="font-dm-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.18)" }}>
            PINE SCRIPT
          </span>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <path d="M2 4l4 4 4-4" stroke="#6b7280" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/[0.05]">
              <div className="relative rounded-xl overflow-hidden mt-3"
                style={{ background: "#06080f", border: "1px solid rgba(255,255,255,0.06)" }}>
                <pre className="text-[10.5px] font-dm-mono text-[#7c93b0] p-4 overflow-x-auto leading-[1.65]"
                  style={{ maxHeight: "260px" }}>
                  {script}
                </pre>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                  style={copied
                    ? { background: "rgba(0,230,118,0.12)", color: "#00e676", border: "1px solid rgba(0,230,118,0.3)" }
                    : { background: "#00e676", color: "#080a10" }}
                >
                  {copied ? (
                    <><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2 2.5L9 2.5" stroke="#00e676" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>Copied!</>
                  ) : (
                    <><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.1"/><path d="M3.5 7.5H2.5A1.2 1.2 0 011.3 6.3V3a1.2 1.2 0 011.2-1.2H5.7A1.2 1.2 0 016.9 3v1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>Copy Script</>
                  )}
                </button>
                <a href="https://tradingview.com" target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                  style={{ background: "rgba(33,150,243,0.1)", color: "#42a5f5", border: "1px solid rgba(33,150,243,0.22)" }}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M9 2L2 9M9 2H5M9 2V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Open TradingView
                </a>
              </div>

              <div className="rounded-xl px-3 py-2 font-dm-mono text-[10px] text-[#6b7280]"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                Pine Script Editor → New → Paste → Add to chart
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
