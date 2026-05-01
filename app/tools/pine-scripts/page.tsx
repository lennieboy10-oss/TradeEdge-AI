"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useUserPlan } from "@/app/lib/plan-context";
import AppNav from "@/app/components/AppNav";

function LogoMark() {
  return (
    <div className="w-8 h-8 rounded-full bg-[#00e676] flex items-center justify-center flex-shrink-0">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="#080a10" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const SCRIPTS = [
  {
    id:      "signal-overlay",
    name:    "ChartIQ Signal Overlay",
    tier:    "free",
    preview: "Plots entry (white), SL (red), TP1 and TP2 (green) as horizontal lines with a signal label. Entry zone highlighted.",
    code: `//@version=5
// ChartIQ AI Signal Overlay — trade-edge-ai.vercel.app
// Replace the price values below with your analysis output.
indicator("ChartIQ Signal Overlay", overlay=true)

// ── Replace with values from ChartIQ analysis ──────────
float entry_price = input.float(3293.00, "Entry Price")
float sl_price    = input.float(3302.00, "Stop Loss")
float tp1_price   = input.float(3260.00, "Take Profit 1")
float tp2_price   = input.float(3230.00, "Take Profit 2")
string direction  = input.string("SELL", "Direction", options=["BUY","SELL"])
int   confidence  = input.int(87, "Confidence %", minval=0, maxval=100)
// ───────────────────────────────────────────────────────

hline(entry_price, "Entry",  color=color.white,      linestyle=hline.style_solid,  linewidth=2)
hline(sl_price,    "SL",     color=color.red,         linestyle=hline.style_dashed, linewidth=1)
hline(tp1_price,   "TP1",    color=color.lime,        linestyle=hline.style_dashed, linewidth=1)
hline(tp2_price,   "TP2",    color=color.green,       linestyle=hline.style_dashed, linewidth=1)

float zone_hi = math.max(entry_price, sl_price)
float zone_lo = math.min(entry_price, sl_price)
bgcolor(close >= zone_lo and close <= zone_hi ? color.new(color.white, 90) : na, title="Entry Zone")

isBuy = direction == "BUY"
if barstate.islast
    label.new(bar_index + 2, entry_price,
        text=(isBuy ? "🟢 BUY " : "🔴 SELL ") + str.tostring(confidence) + "%\\n📍 Entry: " + str.tostring(entry_price) + "\\n🛑 SL: " + str.tostring(sl_price) + "\\n🎯 TP1: " + str.tostring(tp1_price),
        color=color.new(isBuy ? color.lime : color.red, 10),
        textcolor=color.white, style=label.style_label_left, size=size.normal)
`,
  },
  {
    id:      "smc-zones",
    name:    "ChartIQ SMC Zones",
    tier:    "pro",
    preview: "Draws FVG zones (green/red fills), order block boxes, and equal high/low dashed lines. Matches ChartIQ SMC analysis output.",
    code: `//@version=5
// ChartIQ SMC Zones — trade-edge-ai.vercel.app
// Draws FVG, Order Block, and Equal Level zones from ChartIQ analysis.
indicator("ChartIQ SMC Zones", overlay=true)

// ── FVG Zones — replace with priceRange from your analysis ──
bool  fvg1_active = input.bool(true, "FVG 1 Active")
float fvg1_hi     = input.float(3291.0, "FVG 1 High")
float fvg1_lo     = input.float(3285.0, "FVG 1 Low")
bool  fvg1_bull   = input.bool(false, "FVG 1 Bullish?")

bool  fvg2_active = input.bool(false, "FVG 2 Active")
float fvg2_hi     = input.float(3270.0, "FVG 2 High")
float fvg2_lo     = input.float(3264.0, "FVG 2 Low")
bool  fvg2_bull   = input.bool(true, "FVG 2 Bullish?")

// ── Order Block ─────────────────────────────────────────────
bool  ob1_active  = input.bool(true, "OB 1 Active")
float ob1_hi      = input.float(3306.0, "OB 1 High")
float ob1_lo      = input.float(3300.0, "OB 1 Low")
bool  ob1_bull    = input.bool(false, "OB 1 Bullish?")

// ── Equal Levels ─────────────────────────────────────────────
bool  eqh_active  = input.bool(true, "Equal High Active")
float eqh_price   = input.float(3312.0, "Equal High Price")
bool  eql_active  = input.bool(false, "Equal Low Active")
float eql_price   = input.float(3250.0, "Equal Low Price")

lookback = input.int(50, "Lookback bars", minval=10)

// Draw FVGs
if fvg1_active
    box.new(bar_index - lookback, fvg1_hi, bar_index + 10, fvg1_lo,
        bgcolor=color.new(fvg1_bull ? color.lime : color.red, 88),
        border_color=color.new(fvg1_bull ? color.lime : color.red, 50),
        border_width=1)

if fvg2_active
    box.new(bar_index - lookback, fvg2_hi, bar_index + 10, fvg2_lo,
        bgcolor=color.new(fvg2_bull ? color.lime : color.red, 88),
        border_color=color.new(fvg2_bull ? color.lime : color.red, 50),
        border_width=1)

// Draw Order Block
if ob1_active
    box.new(bar_index - lookback, ob1_hi, bar_index + 10, ob1_lo,
        bgcolor=color.new(ob1_bull ? color.aqua : color.orange, 84),
        border_color=color.new(ob1_bull ? color.aqua : color.orange, 40),
        border_width=1)

// Draw Equal Levels
if eqh_active
    line.new(bar_index - lookback, eqh_price, bar_index + 10, eqh_price,
        color=color.yellow, style=line.style_dashed, width=1)
    label.new(bar_index + 10, eqh_price, "EQH", color=color.new(color.yellow, 80),
        textcolor=color.yellow, style=label.style_label_left, size=size.tiny)

if eql_active
    line.new(bar_index - lookback, eql_price, bar_index + 10, eql_price,
        color=color.yellow, style=line.style_dashed, width=1)
    label.new(bar_index + 10, eql_price, "EQL", color=color.new(color.yellow, 80),
        textcolor=color.yellow, style=label.style_label_left, size=size.tiny)
`,
  },
  {
    id:      "alert-sender",
    name:    "ChartIQ Alert Sender",
    tier:    "pro",
    preview: "Fires a webhook to ChartIQ when price crosses a level. Auto-saves to your journal. Paste your API key in settings.",
    code: `//@version=5
// ChartIQ Alert Sender — trade-edge-ai.vercel.app
// Fires webhook to ChartIQ when price hits your level.
// 1. Set your price level and direction below.
// 2. Create a TradingView alert on this indicator.
// 3. In Alert Actions, enable Webhook URL: https://trade-edge-ai.vercel.app/api/tradingview/webhook
// 4. Set Message to the JSON format below.
indicator("ChartIQ Alert Sender", overlay=true)

float alert_price = input.float(3293.0, "Alert Price")
string direction  = input.string("SELL", "Direction", options=["BUY","SELL"])
string apiKey     = input.string("YOUR_CHARTIQ_API_KEY", "ChartIQ API Key")
int   confidence  = input.int(85, "Confidence Estimate %", minval=0, maxval=100)

crossed = direction == "BUY" ? ta.crossover(close, alert_price) : ta.crossunder(close, alert_price)

hline(alert_price, "Alert Level", color=direction == "BUY" ? color.lime : color.red,
      linestyle=hline.style_dotted, linewidth=2)

alertcondition(crossed,
    title="ChartIQ Price Alert",
    message='{"apiKey":"' + apiKey + '","asset":"{{ticker}}","signal":"' + direction + '","entry":"{{close}}","timeframe":"{{interval}}","confidence":"' + str.tostring(confidence) + '","message":"Alert triggered at {{close}}"}')
`,
  },
  {
    id:      "journal-markers",
    name:    "ChartIQ Journal Markers",
    tier:    "pro",
    preview: "Mark your journal trades directly on the chart. Enter trade prices below — arrows show entry direction with SL/TP labels.",
    code: `//@version=5
// ChartIQ Journal Markers — trade-edge-ai.vercel.app
// Marks your ChartIQ journal trades on the chart.
// Add your trades in the inputs below.
indicator("ChartIQ Journal Markers", overlay=true)

// Trade 1
bool  t1_active = input.bool(true,     "Trade 1 Active")
float t1_entry  = input.float(3293.0,  "T1 Entry")
float t1_sl     = input.float(3302.0,  "T1 SL")
float t1_tp     = input.float(3260.0,  "T1 TP")
bool  t1_long   = input.bool(false,    "T1 Long?")
int   t1_bar    = input.int(-20,       "T1 Bar Offset", minval=-500, maxval=0)
string t1_out   = input.string("PENDING", "T1 Outcome", options=["PENDING","WIN","LOSS","BREAKEVEN"])

// Trade 2
bool  t2_active = input.bool(false,    "Trade 2 Active")
float t2_entry  = input.float(3250.0,  "T2 Entry")
float t2_sl     = input.float(3260.0,  "T2 SL")
float t2_tp     = input.float(3215.0,  "T2 TP")
bool  t2_long   = input.bool(true,     "T2 Long?")
int   t2_bar    = input.int(-40,       "T2 Bar Offset", minval=-500, maxval=0)
string t2_out   = input.string("WIN",  "T2 Outcome", options=["PENDING","WIN","LOSS","BREAKEVEN"])

outcomeColor(o) =>
    o == "WIN" ? color.lime : o == "LOSS" ? color.red : o == "BREAKEVEN" ? color.yellow : color.gray

if barstate.islast
    if t1_active
        label.new(bar_index + t1_bar, t1_entry,
            text=(t1_long ? "▲ LONG" : "▼ SHORT") + "\\nE: " + str.tostring(t1_entry) + "\\nSL: " + str.tostring(t1_sl) + "\\nTP: " + str.tostring(t1_tp) + "\\n" + t1_out,
            color=color.new(outcomeColor(t1_out), 15), textcolor=color.white,
            style=t1_long ? label.style_label_up : label.style_label_down, size=size.small)
    if t2_active
        label.new(bar_index + t2_bar, t2_entry,
            text=(t2_long ? "▲ LONG" : "▼ SHORT") + "\\nE: " + str.tostring(t2_entry) + "\\nSL: " + str.tostring(t2_sl) + "\\nTP: " + str.tostring(t2_tp) + "\\n" + t2_out,
            color=color.new(outcomeColor(t2_out), 15), textcolor=color.white,
            style=t2_long ? label.style_label_up : label.style_label_down, size=size.small)
`,
  },
];

export default function PineScriptsPage() {
  const { isPro } = useUserPlan();
  const [copied, setCopied] = useState<string | null>(null);

  async function handleCopy(id: string, code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2500);
  }

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <AppNav />

      <main className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto">

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00e676]/30 bg-[#00e676]/10 text-[#00e676] text-xs font-semibold tracking-[0.13em] uppercase mb-4">
              Tools
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-3">Pine Script Library</h1>
            <p className="text-[#6b7280] text-base max-w-xl">
              Ready-to-use TradingView scripts powered by ChartIQ AI analysis. Copy, paste, add to chart.
            </p>
          </motion.div>

          <div className="space-y-5">
            {SCRIPTS.map((script, i) => {
              const isLocked = script.tier === "pro" && !isPro;
              return (
                <motion.div key={script.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * i }}
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    borderColor: isLocked ? "rgba(255,255,255,0.06)" : "rgba(0,230,118,0.18)",
                    background: "#090d12",
                    opacity: isLocked ? 0.65 : 1,
                  }}>
                  {/* Header */}
                  <div className="flex items-start justify-between p-5 border-b border-white/[0.05]">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white text-sm">{script.name}</span>
                        <span className={`font-dm-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full ${
                          script.tier === "free"
                            ? "bg-white/[0.06] text-[#6b7280] border border-white/[0.1]"
                            : "border"
                        }`}
                          style={script.tier === "pro" ? { background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" } : {}}>
                          {script.tier === "free" ? "FREE" : "PRO"}
                        </span>
                      </div>
                      <p className="text-[#6b7280] text-xs leading-relaxed max-w-lg">{script.preview}</p>
                    </div>
                  </div>

                  {/* Code */}
                  <div className="relative">
                    {isLocked && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-3"
                        style={{ background: "rgba(8,10,16,0.82)" }}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <rect x="3" y="9" width="14" height="10" rx="2" stroke="#00e676" strokeWidth="1.5"/>
                          <path d="M6 9V6a4 4 0 018 0v3" stroke="#00e676" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <p className="text-[#00e676] text-xs font-bold">Pro feature</p>
                        <Link href="/pricing"
                          className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                          style={{ background: "#00e676", color: "#080a10" }}>
                          Upgrade to Pro
                        </Link>
                      </div>
                    )}
                    <pre className="text-[10.5px] font-dm-mono text-[#7c93b0] p-5 overflow-x-auto leading-[1.65]"
                      style={{ maxHeight: "200px", filter: isLocked ? "blur(3px)" : "none" }}>
                      {script.code}
                    </pre>
                  </div>

                  {/* Footer */}
                  {!isLocked && (
                    <div className="flex items-center gap-3 px-5 py-3 border-t border-white/[0.05]">
                      <button onClick={() => handleCopy(script.id, script.code)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                        style={copied === script.id
                          ? { background: "rgba(0,230,118,0.12)", color: "#00e676", border: "1px solid rgba(0,230,118,0.3)" }
                          : { background: "#00e676", color: "#080a10" }}>
                        {copied === script.id ? (
                          <><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2 2.5L9 2" stroke="#00e676" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>Copied!</>
                        ) : "Copy Script"}
                      </button>
                      <a href="https://tradingview.com" target="_blank" rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:-translate-y-0.5"
                        style={{ background: "rgba(33,150,243,0.1)", color: "#42a5f5", border: "1px solid rgba(33,150,243,0.2)" }}>
                        Open TradingView
                      </a>
                      <span className="font-dm-mono text-[10px] text-[#4b5563] ml-auto">
                        Pine Script Editor → New → Paste → Add to chart
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* CTA */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="mt-10 rounded-2xl p-6 text-center"
            style={{ background: "rgba(0,230,118,0.04)", border: "1px solid rgba(0,230,118,0.14)" }}>
            <p className="font-bold text-white mb-1">Pine Script auto-generated from every analysis</p>
            <p className="text-[#6b7280] text-sm mb-4">Pro users get a Pine Script with real prices after every chart analysis — no manual entry needed.</p>
            <Link href="/"
              className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
              style={{ background: "#00e676", color: "#080a10" }}>
              Analyze a Chart →
            </Link>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
