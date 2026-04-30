"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface Props {
  asset?: string;
  signal?: string;
  entry?: string;
  stopLoss?: string;
  takeProfit?: string;
  isPro: boolean;
}

function mtSymbol(asset?: string) {
  return (asset ?? "").replace(/[/\\]/g, "").toUpperCase();
}

function orderType(signal?: string) {
  const s = (signal ?? "").toUpperCase();
  return s === "LONG" || s === "BUY" ? "Buy Limit" : "Sell Limit";
}

function calcLot(entry?: string, sl?: string, asset?: string): string {
  const e = parseFloat(entry ?? "");
  const s = parseFloat(sl ?? "");
  if (!e || !s) return "0.10";
  const dist = Math.abs(e - s);
  if (!dist) return "0.10";
  const sym = (asset ?? "").toUpperCase();
  let pipVal = 10;
  if (sym.includes("JPY"))                         pipVal = 9.1;
  if (sym.includes("XAU") || sym.includes("GOLD")) pipVal = 100;
  if (sym.includes("XAG") || sym.includes("SILVER"))pipVal = 50;
  const lot = 100 / (dist * pipVal);
  return Math.max(0.01, Math.min(10, Math.round(lot * 100) / 100)).toFixed(2);
}

export default function MTTradeSetup({ isPro, asset, signal, entry, stopLoss, takeProfit }: Props) {
  const [copied, setCopied] = useState(false);

  const sym  = mtSymbol(asset);
  const type = orderType(signal);
  const lot  = calcLot(entry, stopLoss, asset);
  const isBuy = type.startsWith("Buy");

  const rows = [
    { label: "Symbol",      value: sym,              color: "white"    },
    { label: "Type",        value: type,             color: isBuy ? "#4ade80" : "#f87171" },
    { label: "Price",       value: entry ?? "",      color: "white"    },
    { label: "Stop Loss",   value: stopLoss ?? "",   color: "#f87171"  },
    { label: "Take Profit", value: takeProfit ?? "", color: "#4ade80"  },
    { label: "Lot Size",    value: lot,              color: "#c084fc"  },
  ];

  async function handleCopy() {
    const txt = rows.map((r) => `${r.label}: ${r.value}`).join("\n");
    await navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (!isPro) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8, duration: 0.4 }}
        className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-between"
      >
        <span className="text-xs font-semibold text-[#4b5563]">MT4 / MT5 Trade Setup</span>
        <span className="font-dm-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full"
          style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }}>
          PRO
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.8, duration: 0.4 }}
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid rgba(255,130,0,0.22)", background: "#0a0d12" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center text-[10px]"
            style={{ background: "rgba(255,130,0,0.14)" }}>📊</div>
          <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "#ff8200" }}>
            MT4 / MT5 Trade Setup
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:-translate-y-0.5"
          style={copied
            ? { background: "rgba(0,230,118,0.12)", color: "#00e676", border: "1px solid rgba(0,230,118,0.3)" }
            : { background: "rgba(255,255,255,0.05)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.08)" }}>
          {copied ? "Copied!" : "Copy All"}
        </button>
      </div>

      {/* Rows */}
      <div className="px-4 py-1">
        {rows.map((row) => (
          <div key={row.label}
            className="flex justify-between items-center py-2.5 border-b border-white/[0.04] last:border-0">
            <span className="text-[#6b7280] text-sm">{row.label}</span>
            <span className="font-dm-mono text-sm font-semibold" style={{ color: row.color }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Hint box */}
      <div className="mx-4 mb-4 rounded-xl px-3 py-2.5 space-y-0.5"
        style={{ background: "rgba(255,130,0,0.05)", border: "1px solid rgba(255,130,0,0.1)" }}>
        <p className="font-dm-mono text-[10px] text-[#9ca3af]">MT4: Right click chart → New Order (F9)</p>
        <p className="font-dm-mono text-[10px] text-[#9ca3af]">MT5: Press F9 → Fill in the values above</p>
        <p className="font-dm-mono text-[10px] text-[#6b7280] mt-1">
          Lot size est. based on $10k / 1% risk. Adjust to your account.
        </p>
      </div>
    </motion.div>
  );
}
