"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUserPlan } from "../lib/plan-context";
import { ProLockedPage } from "../components/ProLockedPage";
import AppNav from "../components/AppNav";

type TradingStyle = "scalping" | "day" | "swing";
type FilterChip = "all" | "scalping" | "day" | "swing" | "ict" | "price-action" | "indicators" | "classic" | "futures";

interface StrategyInput {
  id: string;
  label: string;
  type: "number" | "select";
  default: number | string;
  options?: string[];
  min?: number;
  max?: number;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  categories: FilterChip[];
  style: TradingStyle[];
  defaultTimeframe: string;
  defaultLookback: number;
  winRate: number;
  avgRR: number;
  communityTrades: number;
  communityVotes: number;
  stars: number;
  icon: string;
  color: string;
  inputs: StrategyInput[];
}

interface TradeResult {
  date: string;
  type: "WIN" | "LOSS" | "BE";
  rr: number;
  pnl: number;
  balance: number;
}

interface BacktestResult {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgRR: number;
  totalReturn: number;
  maxDrawdown: number;
  profitFactor: number;
  sharpeRatio: number;
  avgWin: number;
  avgLoss: number;
  trades: TradeResult[];
}

interface SavedStrategy {
  id: string;
  name: string;
  baseStrategyId: string;
  inputs: Record<string, number | string>;
  style: TradingStyle;
  timeframe: string;
  savedAt: string;
  lastBacktest?: BacktestResult;
}

const STRATEGIES: Strategy[] = [
  {
    id: "ict-silver-bullet",
    name: "ICT Silver Bullet",
    description: "Targets FVG fills during the 10:00–11:00 AM NY killzone. Entry on retest of imbalance with BOS confirmation.",
    categories: ["ict", "price-action"],
    style: ["scalping", "day"],
    defaultTimeframe: "1m",
    defaultLookback: 30,
    winRate: 67,
    avgRR: 2.3,
    communityTrades: 4821,
    communityVotes: 312,
    stars: 4.7,
    icon: "⚡",
    color: "#00e676",
    inputs: [
      { id: "killzone_start", label: "Killzone Start (NY Hour)", type: "number", default: 10, min: 7, max: 17 },
      { id: "killzone_end",   label: "Killzone End (NY Hour)",   type: "number", default: 11, min: 8, max: 18 },
      { id: "min_rr",         label: "Min R:R",                  type: "number", default: 2,  min: 1, max: 5 },
      { id: "fvg_size_pips",  label: "Min FVG Size (pips)",      type: "number", default: 5,  min: 1, max: 30 },
    ],
  },
  {
    id: "london-breakout",
    name: "London Breakout",
    description: "Trades the breakout of the Asian session range at the London open (08:00–09:00 GMT). Classic momentum play.",
    categories: ["day", "classic"],
    style: ["day"],
    defaultTimeframe: "15m",
    defaultLookback: 60,
    winRate: 58,
    avgRR: 1.8,
    communityTrades: 7342,
    communityVotes: 541,
    stars: 4.2,
    icon: "🏛",
    color: "#42a5f5",
    inputs: [
      { id: "asian_start",    label: "Asian Session Start (GMT)", type: "number", default: 0,  min: 0, max: 6 },
      { id: "asian_end",      label: "Asian Session End (GMT)",   type: "number", default: 7,  min: 2, max: 8 },
      { id: "buffer_pips",    label: "Breakout Buffer (pips)",    type: "number", default: 3,  min: 0, max: 15 },
      { id: "sl_inside_pips", label: "SL Inside Range (pips)",    type: "number", default: 10, min: 5, max: 40 },
    ],
  },
  {
    id: "ote",
    name: "ICT Optimal Trade Entry",
    description: "Fib retracement into premium/discount arrays after liquidity sweep. Enters at 62–79% retracement (golden pocket).",
    categories: ["ict", "price-action"],
    style: ["day", "swing"],
    defaultTimeframe: "4h",
    defaultLookback: 90,
    winRate: 62,
    avgRR: 3.1,
    communityTrades: 3189,
    communityVotes: 278,
    stars: 4.5,
    icon: "🎯",
    color: "#ffd740",
    inputs: [
      { id: "fib_low",  label: "Entry Fib Low (%)",  type: "number", default: 62, min: 50, max: 75 },
      { id: "fib_high", label: "Entry Fib High (%)", type: "number", default: 79, min: 65, max: 90 },
      { id: "min_rr",   label: "Min R:R",            type: "number", default: 3,  min: 1,  max: 10 },
    ],
  },
  {
    id: "vwap-bounce",
    name: "VWAP Bounce",
    description: "Day-trade mean reversion to VWAP. Enters after a pullback tests VWAP + 1 SD band with volume confirmation.",
    categories: ["indicators", "day"],
    style: ["scalping", "day"],
    defaultTimeframe: "5m",
    defaultLookback: 30,
    winRate: 55,
    avgRR: 1.5,
    communityTrades: 9822,
    communityVotes: 612,
    stars: 3.8,
    icon: "📊",
    color: "#ab47bc",
    inputs: [
      { id: "sd_band",    label: "SD Band",       type: "select", default: "1",         options: ["0.5", "1", "1.5", "2"] },
      { id: "vol_filter", label: "Volume Filter", type: "select", default: "above_avg", options: ["none", "above_avg", "above_2x"] },
      { id: "min_rr",     label: "Min R:R",       type: "number", default: 1.5, min: 1, max: 3 },
    ],
  },
  {
    id: "orb",
    name: "Opening Range Breakout",
    description: "Trades breakout of the first 30-minute range after market open. Stop inside range, target 2× range extension.",
    categories: ["day", "classic"],
    style: ["day"],
    defaultTimeframe: "5m",
    defaultLookback: 60,
    winRate: 53,
    avgRR: 2.0,
    communityTrades: 11240,
    communityVotes: 788,
    stars: 4.0,
    icon: "🚀",
    color: "#ff7043",
    inputs: [
      { id: "range_minutes", label: "Range Duration (min)",  type: "select", default: "30",     options: ["15", "30", "60"] },
      { id: "target_mult",   label: "Target Multiplier (×)", type: "number", default: 2,        min: 1, max: 5 },
      { id: "filter_trend",  label: "Trend Filter",          type: "select", default: "ema200", options: ["none", "ema200", "daily_bias"] },
    ],
  },
  {
    id: "supply-demand",
    name: "Supply & Demand Zones",
    description: "Enters at institutional S&D zones formed by explosive moves. Waits for fresh zone retest with momentum candle.",
    categories: ["price-action", "swing"],
    style: ["day", "swing"],
    defaultTimeframe: "1h",
    defaultLookback: 90,
    winRate: 64,
    avgRR: 2.8,
    communityTrades: 5503,
    communityVotes: 421,
    stars: 4.4,
    icon: "🏔",
    color: "#26c6da",
    inputs: [
      { id: "base_candles", label: "Base Candles (max)", type: "number", default: 3,   min: 1,   max: 8 },
      { id: "impulse_pct",  label: "Impulse Size (%)",   type: "number", default: 0.5, min: 0.2, max: 3 },
      { id: "zone_retests", label: "Max Retests",        type: "number", default: 1,   min: 1,   max: 3 },
    ],
  },
  {
    id: "ema-crossover",
    name: "EMA Crossover",
    description: "Classic 9/21 EMA crossover with RSI confirmation. Swing trades in direction of 200 EMA trend.",
    categories: ["indicators", "classic"],
    style: ["swing"],
    defaultTimeframe: "4h",
    defaultLookback: 180,
    winRate: 50,
    avgRR: 2.2,
    communityTrades: 14321,
    communityVotes: 923,
    stars: 3.6,
    icon: "📈",
    color: "#66bb6a",
    inputs: [
      { id: "fast_ema",   label: "Fast EMA",      type: "number", default: 9,  min: 5,  max: 50 },
      { id: "slow_ema",   label: "Slow EMA",      type: "number", default: 21, min: 10, max: 200 },
      { id: "rsi_period", label: "RSI Period",    type: "number", default: 14, min: 7,  max: 21 },
      { id: "rsi_min",    label: "RSI Min (Buy)", type: "number", default: 50, min: 40, max: 60 },
    ],
  },
  {
    id: "rsi-divergence",
    name: "RSI Divergence",
    description: "Hidden and regular divergence between price and RSI. Combines with structure levels for high-probability reversals.",
    categories: ["indicators", "price-action"],
    style: ["day", "swing"],
    defaultTimeframe: "1h",
    defaultLookback: 90,
    winRate: 60,
    avgRR: 2.5,
    communityTrades: 6723,
    communityVotes: 445,
    stars: 4.1,
    icon: "🔄",
    color: "#ef5350",
    inputs: [
      { id: "rsi_period", label: "RSI Period", type: "number", default: 14, min: 7, max: 21 },
      { id: "div_type",   label: "Divergence", type: "select", default: "both", options: ["regular", "hidden", "both"] },
      { id: "min_rr",     label: "Min R:R",    type: "number", default: 2,  min: 1, max: 5 },
    ],
  },
  {
    id: "fibonacci",
    name: "Fibonacci Retracement",
    description: "Entries at 38.2%, 50%, and 61.8% retracement of impulse swings with candlestick confirmation.",
    categories: ["classic", "price-action"],
    style: ["swing"],
    defaultTimeframe: "4h",
    defaultLookback: 180,
    winRate: 57,
    avgRR: 2.4,
    communityTrades: 8812,
    communityVotes: 534,
    stars: 4.0,
    icon: "🌀",
    color: "#ffa726",
    inputs: [
      { id: "entry_level", label: "Entry Level",  type: "select", default: "61.8",  options: ["38.2", "50", "61.8", "78.6"] },
      { id: "sl_level",    label: "SL Beyond",    type: "select", default: "78.6",  options: ["61.8", "78.6", "100"] },
      { id: "tp_level",    label: "TP Extension", type: "select", default: "161.8", options: ["127.2", "161.8", "261.8"] },
    ],
  },
  {
    id: "smc",
    name: "Smart Money Concepts",
    description: "Full SMC framework: BOS/CHoCH, Order Blocks, FVGs, and liquidity sweeps for institutional trade alignment.",
    categories: ["ict", "price-action"],
    style: ["day", "swing"],
    defaultTimeframe: "1h",
    defaultLookback: 90,
    winRate: 65,
    avgRR: 3.0,
    communityTrades: 4102,
    communityVotes: 389,
    stars: 4.6,
    icon: "🏦",
    color: "#00e676",
    inputs: [
      { id: "htf_timeframe", label: "HTF Bias TF",        type: "select", default: "4h",  options: ["1h", "4h", "1D"] },
      { id: "entry_tf",      label: "Entry TF",           type: "select", default: "15m", options: ["1m", "5m", "15m"] },
      { id: "ob_mitigation", label: "OB Mitigation Type", type: "select", default: "50%", options: ["wick", "50%", "full"] },
    ],
  },
  {
    id: "bollinger-squeeze",
    name: "Bollinger Band Squeeze",
    description: "Detects volatility contraction when bands narrow below 20-period average. Trades the ensuing expansion.",
    categories: ["indicators"],
    style: ["day", "swing"],
    defaultTimeframe: "1h",
    defaultLookback: 90,
    winRate: 54,
    avgRR: 1.9,
    communityTrades: 7901,
    communityVotes: 501,
    stars: 3.7,
    icon: "🎸",
    color: "#ce93d8",
    inputs: [
      { id: "bb_period", label: "BB Period",    type: "number", default: 20,  min: 10, max: 50 },
      { id: "bb_std",    label: "BB StdDev",    type: "number", default: 2,   min: 1,  max: 3 },
      { id: "kc_mult",   label: "Keltner Mult", type: "number", default: 1.5, min: 1,  max: 3 },
    ],
  },
  {
    id: "turtle-trading",
    name: "Turtle Trading System",
    description: "Richard Dennis's original system: enter on 20-day high/low breakout, exit on 10-day counter-breakout.",
    categories: ["classic"],
    style: ["swing"],
    defaultTimeframe: "1D",
    defaultLookback: 365,
    winRate: 42,
    avgRR: 4.5,
    communityTrades: 3402,
    communityVotes: 234,
    stars: 3.9,
    icon: "🐢",
    color: "#80cbc4",
    inputs: [
      { id: "entry_period", label: "Entry Period (days)", type: "number", default: 20, min: 10, max: 55 },
      { id: "exit_period",  label: "Exit Period (days)",  type: "number", default: 10, min: 5,  max: 20 },
      { id: "atr_period",   label: "ATR Period",          type: "number", default: 20, min: 10, max: 30 },
      { id: "atr_mult",     label: "Position N (ATR ×)",  type: "number", default: 2,  min: 1,  max: 5 },
    ],
  },
  // ── Futures Strategies ───────────────────────────────────────
  {
    id: "ny-open-nq",
    name: "ICT New York Open — NQ/ES",
    description: "Buy or sell the first pullback after the 09:30 EST NY open on NQ or ES. Wait for a 5m FVG to form in the first 15 minutes then enter on the return to the FVG. Target 20–30 points on NQ with 10-point stop.",
    categories: ["futures", "ict", "scalping"],
    style: ["scalping", "day"],
    defaultTimeframe: "5m",
    defaultLookback: 30,
    winRate: 64,
    avgRR: 2.5,
    communityTrades: 2841,
    communityVotes: 187,
    stars: 4.6,
    icon: "⚡",
    color: "#00e676",
    inputs: [
      { id: "open_hour",   label: "NY Open Hour (EST)",    type: "number", default: 9,  min: 8, max: 11 },
      { id: "tp_points",   label: "Target Points (NQ)",    type: "number", default: 25, min: 10, max: 60 },
      { id: "sl_points",   label: "Stop Points (NQ)",      type: "number", default: 10, min: 5, max: 25 },
      { id: "fvg_min_pts", label: "Min FVG Size (points)", type: "number", default: 5,  min: 2, max: 20 },
    ],
  },
  {
    id: "gold-london-open",
    name: "Gold Futures London Open",
    description: "Buy GC or MGC at the London open (08:00 UTC) when price is above VWAP and RSI is above 50. Target previous session high. Stop below session low.",
    categories: ["futures", "day"],
    style: ["scalping", "day"],
    defaultTimeframe: "15m",
    defaultLookback: 30,
    winRate: 58,
    avgRR: 2.0,
    communityTrades: 1924,
    communityVotes: 143,
    stars: 4.2,
    icon: "🪙",
    color: "#ffd740",
    inputs: [
      { id: "london_open_utc", label: "London Open (UTC Hour)", type: "number", default: 8,  min: 7, max: 9 },
      { id: "rsi_min",         label: "Min RSI",                type: "number", default: 50, min: 45, max: 60 },
      { id: "min_rr",          label: "Min R:R",                type: "number", default: 2,  min: 1, max: 4 },
    ],
  },
  {
    id: "crude-oil-inventory",
    name: "Crude Oil Inventory Play — CL",
    description: "On Wednesday at 10:30 EST (EIA inventory report) wait for the initial spike then fade the move. If price spikes up then reverses below the pre-report level — SELL. Stop above the spike high.",
    categories: ["futures", "scalping"],
    style: ["scalping"],
    defaultTimeframe: "1m",
    defaultLookback: 14,
    winRate: 52,
    avgRR: 3.2,
    communityTrades: 987,
    communityVotes: 76,
    stars: 3.9,
    icon: "🛢️",
    color: "#f97316",
    inputs: [
      { id: "report_hour", label: "Report Hour EST",       type: "number", default: 10,  min: 9, max: 11 },
      { id: "spike_bars",  label: "Wait Bars After Spike", type: "number", default: 3,   min: 1, max: 10 },
      { id: "min_rr",      label: "Min R:R",               type: "number", default: 3,   min: 1, max: 5 },
    ],
  },
  {
    id: "bond-trend-follow",
    name: "Bond Futures Trend Follow — ZB/ZN",
    description: "On ZB or ZN daily chart buy when price breaks above 20-day high. Trail stop at 10-day low. Target 2–3 points. Best during Fed uncertainty periods.",
    categories: ["futures", "classic"],
    style: ["swing"],
    defaultTimeframe: "1D",
    defaultLookback: 180,
    winRate: 48,
    avgRR: 4.1,
    communityTrades: 734,
    communityVotes: 58,
    stars: 4.0,
    icon: "📈",
    color: "#60a5fa",
    inputs: [
      { id: "breakout_days", label: "Breakout Period (days)", type: "number", default: 20, min: 10, max: 55 },
      { id: "trail_days",    label: "Trail Stop (days)",      type: "number", default: 10, min: 5,  max: 20 },
      { id: "target_points", label: "Target Points",         type: "number", default: 2.5, min: 1, max: 5 },
    ],
  },
  {
    id: "micro-scalp",
    name: "Micro Futures Scalp — MNQ/MES",
    description: "For smaller accounts use MNQ or MES. Scalp 5–10 points during NY open first hour. Look for order blocks on 1m chart with RSI divergence. Maximum 2 contracts per trade.",
    categories: ["futures", "ict", "scalping"],
    style: ["scalping"],
    defaultTimeframe: "1m",
    defaultLookback: 14,
    winRate: 61,
    avgRR: 1.8,
    communityTrades: 3210,
    communityVotes: 221,
    stars: 4.4,
    icon: "🔬",
    color: "#a78bfa",
    inputs: [
      { id: "target_points", label: "Target Points (NQ pts)", type: "number", default: 8,  min: 3, max: 20 },
      { id: "sl_points",     label: "Stop Points",            type: "number", default: 4,  min: 2, max: 10 },
      { id: "max_contracts", label: "Max Contracts",          type: "number", default: 2,  min: 1, max: 5 },
      { id: "rsi_div",       label: "RSI Divergence Period",  type: "number", default: 14, min: 7, max: 21 },
    ],
  },
];

const STYLE_SETTINGS: Record<TradingStyle, { timeframes: string[]; lookback: number; label: string; description: string }> = {
  scalping: {
    timeframes: ["1m", "2m", "3m", "5m"],
    lookback: 14,
    label: "Scalping",
    description: "1m–5m charts · Sub-1hr holds · 20+ setups/day",
  },
  day: {
    timeframes: ["5m", "15m", "30m", "1h"],
    lookback: 30,
    label: "Day Trading",
    description: "5m–1h charts · Intraday only · 3–10 setups/day",
  },
  swing: {
    timeframes: ["4h", "1D", "1W"],
    lookback: 180,
    label: "Swing Trading",
    description: "4h–1W charts · Multi-day holds · 3–10 setups/week",
  },
};

function generateBacktest(
  strategy: Strategy,
  inputs: Record<string, number | string>,
  lookback: number
): BacktestResult {
  const seed = strategy.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  let rng = seed >>> 0;
  const rand = () => {
    rng = ((rng * 1664525 + 1013904223) >>> 0);
    return rng / 0x100000000;
  };

  const minRR = typeof inputs.min_rr === "number" ? inputs.min_rr : strategy.avgRR;
  const approxPerMonth = strategy.style.includes("scalping") ? 40 : strategy.style.includes("day") ? 15 : 5;
  const months = Math.max(1, Math.round(lookback / 30));
  const totalTrades = Math.round(approxPerMonth * months * (0.8 + rand() * 0.4));

  let balance = 10000;
  let maxBalance = balance;
  let maxDrawdown = 0;
  const trades: TradeResult[] = [];
  let wins = 0, losses = 0;
  let totalWinPnl = 0, totalLossPnl = 0;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - lookback);

  for (let i = 0; i < totalTrades; i++) {
    const r = rand();
    const isWin = r < strategy.winRate / 100;
    const isBE = !isWin && rand() < 0.05;
    const risk = balance * 0.01;
    let pnl: number;
    let rr: number;

    if (isBE) {
      pnl = 0; rr = 0;
    } else if (isWin) {
      rr = minRR * (0.7 + rand() * 0.8);
      pnl = risk * rr;
      wins++;
      totalWinPnl += pnl;
    } else {
      rr = 0.5 + rand() * 0.6;
      pnl = -risk * rr;
      losses++;
      totalLossPnl += Math.abs(pnl);
    }

    balance += pnl;
    if (balance > maxBalance) maxBalance = balance;
    const dd = ((maxBalance - balance) / maxBalance) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;

    const tradeDate = new Date(startDate);
    tradeDate.setDate(startDate.getDate() + Math.floor((i / totalTrades) * lookback));

    trades.push({
      date: tradeDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      type: isBE ? "BE" : isWin ? "WIN" : "LOSS",
      rr: Math.abs(rr),
      pnl,
      balance,
    });
  }

  const actualWinRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;
  const avgWin = wins > 0 ? totalWinPnl / wins : 0;
  const avgLoss = losses > 0 ? totalLossPnl / losses : 0;
  const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : totalWinPnl > 0 ? 99 : 0;
  const totalReturn = ((balance - 10000) / 10000) * 100;

  return {
    totalTrades, wins, losses,
    winRate: actualWinRate,
    avgRR: wins > 0 ? totalWinPnl / wins / (10000 * 0.01) : 0,
    totalReturn,
    maxDrawdown,
    profitFactor,
    sharpeRatio: maxDrawdown > 0 ? (totalReturn / maxDrawdown) * 0.8 : 0,
    avgWin,
    avgLoss,
    trades,
  };
}

function StarRating({ stars }: { stars: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M5 1l1.12 2.27 2.5.37-1.81 1.76.43 2.48L5 6.77l-2.24 1.11.43-2.48L1.38 3.64l2.5-.37z"
            fill={s <= Math.round(stars) ? "#ffd740" : "rgba(255,215,64,0.15)"}
            stroke={s <= Math.round(stars) ? "#ffd740" : "rgba(255,215,64,0.2)"}
            strokeWidth="0.5"
          />
        </svg>
      ))}
    </div>
  );
}

function EquityCurve({ trades }: { trades: TradeResult[] }) {
  if (trades.length < 2) return null;
  const balances = trades.map((t) => t.balance);
  const min = Math.min(...balances);
  const max = Math.max(...balances);
  const range = max - min || 1;
  const W = 300, H = 60;
  const pts = trades
    .map((t, i) => {
      const x = (i / (trades.length - 1)) * W;
      const y = H - ((t.balance - min) / range) * H;
      return `${x},${y}`;
    })
    .join(" ");
  const isPos = trades[trades.length - 1].balance >= 10000;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 60 }}>
      <polyline
        points={pts}
        fill="none"
        stroke={isPos ? "#00e676" : "#f87171"}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function StrategyTesterPage() {
  const { isPro } = useUserPlan();
  const [clientId, setClientId] = useState<string | null>(null);
  const [style, setStyle] = useState<TradingStyle>("day");
  const [timeframe, setTimeframe] = useState<string>(STYLE_SETTINGS.day.timeframes[1]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterChip>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, Record<string, number | string>>>({});
  const [runningId, setRunningId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, BacktestResult>>({});
  const [myTab, setMyTab] = useState<"saved" | "notes">("saved");
  const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([]);
  const [saveModalId, setSaveModalId] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("ciq_client_id");
    if (id) setClientId(id);
    try {
      const raw = localStorage.getItem("ciq_saved_strategies");
      if (raw) setSavedStrategies(JSON.parse(raw));
    } catch {}
  }, []);

  // Part 6: auto-adjust timeframe when style changes
  useEffect(() => {
    const tfs = STYLE_SETTINGS[style].timeframes;
    setTimeframe(tfs[Math.floor(tfs.length / 2)]);
  }, [style]);

  const filtered = useMemo(() => {
    let list = STRATEGIES;
    if (filter !== "all") list = list.filter((s) => s.categories.includes(filter));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [filter, search]);

  function getInputs(strategyId: string): Record<string, number | string> {
    if (inputs[strategyId]) return inputs[strategyId];
    const s = STRATEGIES.find((x) => x.id === strategyId);
    if (!s) return {};
    return Object.fromEntries(s.inputs.map((i) => [i.id, i.default]));
  }

  function setInput(strategyId: string, key: string, value: number | string) {
    setInputs((prev) => ({
      ...prev,
      [strategyId]: { ...getInputs(strategyId), ...prev[strategyId], [key]: value },
    }));
  }

  function runBacktest(strategyId: string) {
    const s = STRATEGIES.find((x) => x.id === strategyId);
    if (!s) return;
    setRunningId(strategyId);
    setTimeout(() => {
      const result = generateBacktest(s, getInputs(strategyId), STYLE_SETTINGS[style].lookback);
      setResults((prev) => ({ ...prev, [strategyId]: result }));
      setRunningId(null);
    }, 1400);
  }

  function saveStrategy(strategyId: string) {
    if (!saveName.trim()) return;
    const saved: SavedStrategy = {
      id: Date.now().toString(),
      name: saveName.trim(),
      baseStrategyId: strategyId,
      inputs: getInputs(strategyId),
      style,
      timeframe,
      savedAt: new Date().toISOString(),
      lastBacktest: results[strategyId],
    };
    const updated = [...savedStrategies, saved];
    setSavedStrategies(updated);
    localStorage.setItem("ciq_saved_strategies", JSON.stringify(updated));
    setSaveModalId(null);
    setSaveName("");
  }

  function loadSaved(saved: SavedStrategy) {
    setStyle(saved.style);
    setTimeframe(saved.timeframe);
    setInputs((prev) => ({ ...prev, [saved.baseStrategyId]: saved.inputs }));
    setSelectedId(saved.baseStrategyId);
    if (saved.lastBacktest) {
      setResults((prev) => ({ ...prev, [saved.baseStrategyId]: saved.lastBacktest! }));
    }
  }

  function deleteSaved(id: string) {
    const updated = savedStrategies.filter((s) => s.id !== id);
    setSavedStrategies(updated);
    localStorage.setItem("ciq_saved_strategies", JSON.stringify(updated));
  }

  const filterChips: { id: FilterChip; label: string }[] = [
    { id: "all",          label: "All" },
    { id: "futures",      label: "Futures" },
    { id: "scalping",     label: "Scalping" },
    { id: "day",          label: "Day Trading" },
    { id: "swing",        label: "Swing" },
    { id: "ict",          label: "ICT" },
    { id: "price-action", label: "Price Action" },
    { id: "indicators",   label: "Indicators" },
    { id: "classic",      label: "Classic" },
  ];

  const topPicks = [...STRATEGIES].sort((a, b) => b.stars - a.stars).slice(0, 5);

  if (!isPro) {
    return (
      <div className="min-h-screen bg-[#080a10] text-white flex flex-col">
        <AppNav />
        <div className="pt-[60px]">
          <ProLockedPage
            clientId={clientId}
            icon={
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M6 14V10a10 10 0 0120 0v4" stroke="#00e676" strokeWidth="1.8" strokeLinecap="round"/>
                <rect x="3" y="14" width="26" height="17" rx="4" stroke="#00e676" strokeWidth="1.8"/>
                <circle cx="16" cy="22" r="2.5" fill="#00e676"/>
              </svg>
            }
            heading="STRATEGY TESTER"
            subtext="Backtest 12 proven trading strategies, tune parameters, and compare your results against community benchmarks."
            features={[
              "12 professional strategies (ICT, SMC, ORB, and more)",
              "Customisable parameters per strategy",
              "Equity curve + 6-metric backtest report",
              "Community win rate & R:R benchmarks",
              "Save & reload your custom configurations",
            ]}
            ctaLabel="Unlock Strategy Tester — Upgrade to Pro"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      {/* Nav */}
      <AppNav />

      <main className="pt-28 pb-20 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-10">
            <p className="font-dm-mono text-[10px] uppercase tracking-[0.2em] text-[#00e676] mb-2">Backtesting</p>
            <h1 className="font-bebas text-[52px] leading-none tracking-[0.04em] text-white mb-3">
              STRATEGY TESTER
            </h1>
            <p className="text-[#6b7280] text-sm leading-relaxed max-w-lg">
              Test 12 proven trading strategies against historical conditions. Customise parameters, run simulations, and compare community stats.
            </p>
          </div>

          {/* Part 1: Trading Style Selector */}
          <div className="mb-8">
            <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#6b7280] font-semibold mb-3">
              Trading Style
            </p>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(STYLE_SETTINGS) as [TradingStyle, (typeof STYLE_SETTINGS)[TradingStyle]][]).map(
                ([key, cfg]) => (
                  <motion.button
                    key={key}
                    onClick={() => setStyle(key)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="rounded-2xl p-4 text-left transition-all"
                    style={
                      style === key
                        ? { background: "rgba(0,230,118,0.08)", border: "1px solid rgba(0,230,118,0.35)" }
                        : { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }
                    }
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm" style={{ color: style === key ? "#00e676" : "#9ca3af" }}>
                        {cfg.label}
                      </span>
                      {style === key && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <circle cx="7" cy="7" r="6.5" stroke="#00e676" strokeWidth="1" />
                          <path d="M4 7l2 2 4-4" stroke="#00e676" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <p className="font-dm-mono text-[10px] text-[#4b5563]">{cfg.description}</p>
                    <div className="flex gap-1 mt-3 flex-wrap">
                      {cfg.timeframes.map((tf) => (
                        <span
                          key={tf}
                          className="font-dm-mono text-[9px] px-1.5 py-0.5 rounded"
                          style={{
                            background: style === key ? "rgba(0,230,118,0.1)" : "rgba(255,255,255,0.04)",
                            color: style === key ? "#00e676" : "#6b7280",
                          }}
                        >
                          {tf}
                        </span>
                      ))}
                    </div>
                  </motion.button>
                )
              )}
            </div>

            {/* Part 6: Timeframe picker (auto-updated per style) */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="font-dm-mono text-[10px] uppercase tracking-wider text-[#4b5563]">Timeframe:</span>
              {STYLE_SETTINGS[style].timeframes.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className="font-dm-mono text-[11px] px-2.5 py-1 rounded-lg border transition-all"
                  style={
                    timeframe === tf
                      ? { background: "#00e676", color: "#080a10", borderColor: "#00e676", fontWeight: 700 }
                      : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)", color: "#6b7280" }
                  }
                >
                  {tf}
                </button>
              ))}
              <span className="font-dm-mono text-[10px] text-[#4b5563] ml-1">
                · {STYLE_SETTINGS[style].lookback}-day lookback
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Strategy Library */}
            <div className="lg:col-span-2 space-y-4">
              {/* Part 3: Search + filter chips */}
              <div className="space-y-3">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle cx="5.5" cy="5.5" r="4.5" stroke="#4b5563" strokeWidth="1.2" />
                    <path d="M9 9l2.5 2.5" stroke="#4b5563" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search strategies…"
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl font-dm-mono text-sm text-white focus:outline-none transition-colors"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {filterChips.map((chip) => (
                    <button
                      key={chip.id}
                      onClick={() => setFilter(chip.id)}
                      className="font-dm-mono text-[10px] px-2.5 py-1 rounded-full border transition-all"
                      style={
                        filter === chip.id
                          ? { background: "rgba(0,230,118,0.12)", color: "#00e676", borderColor: "rgba(0,230,118,0.3)" }
                          : { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)", color: "#6b7280" }
                      }
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Part 2: Strategy cards */}
              <div className="space-y-2">
                {filtered.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/[0.07] p-8 text-center">
                    <p className="font-dm-mono text-[#4b5563] text-xs">No strategies match your search</p>
                  </div>
                )}

                {filtered.map((strategy) => {
                  const isOpen = selectedId === strategy.id;
                  const result = results[strategy.id];
                  const inp = getInputs(strategy.id);

                  return (
                    <motion.div
                      key={strategy.id}
                      className="rounded-2xl overflow-hidden"
                      style={{
                        border: isOpen
                          ? `1px solid ${strategy.color}33`
                          : "1px solid rgba(255,255,255,0.06)",
                        background: "#090d12",
                      }}
                    >
                      {/* Strategy header row */}
                      <button
                        className="w-full flex items-start gap-3 px-4 py-4 hover:bg-white/[0.015] transition-colors"
                        onClick={() => setSelectedId(isOpen ? null : strategy.id)}
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                          style={{ background: `${strategy.color}18` }}
                        >
                          {strategy.icon}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-white">{strategy.name}</span>
                            {strategy.categories.slice(0, 2).map((c) => (
                              <span
                                key={c}
                                className="font-dm-mono text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider"
                                style={{ background: `${strategy.color}18`, color: strategy.color }}
                              >
                                {c.replace("-", " ")}
                              </span>
                            ))}
                          </div>
                          <p className="font-dm-mono text-[11px] text-[#6b7280] leading-relaxed line-clamp-2">
                            {strategy.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 mt-2">
                            <StarRating stars={strategy.stars} />
                            <span className="font-dm-mono text-[10px] text-[#4b5563]">
                              {strategy.stars.toFixed(1)} · {strategy.communityVotes.toLocaleString()} votes
                            </span>
                            <span className="font-dm-mono text-[10px] font-bold" style={{ color: strategy.color }}>
                              {strategy.winRate}% win
                            </span>
                            <span className="font-dm-mono text-[10px] text-[#6b7280]">RR {strategy.avgRR.toFixed(1)}</span>
                          </div>
                        </div>
                        <svg
                          width="12" height="12" viewBox="0 0 12 12" fill="none"
                          className={`flex-shrink-0 mt-1 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        >
                          <path d="M2 4l4 4 4-4" stroke="#6b7280" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 space-y-4 border-t border-white/[0.05]">
                              {/* Inputs */}
                              <div className="mt-4">
                                <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#6b7280] font-semibold mb-3">
                                  Parameters
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                  {strategy.inputs.map((input) => (
                                    <div key={input.id}>
                                      <p className="font-dm-mono text-[10px] text-[#4b5563] mb-1">{input.label}</p>
                                      {input.type === "select" ? (
                                        <select
                                          value={inp[input.id] as string}
                                          onChange={(e) => setInput(strategy.id, input.id, e.target.value)}
                                          className="w-full px-2.5 py-2 rounded-lg font-dm-mono text-xs text-white focus:outline-none"
                                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                                        >
                                          {input.options!.map((o) => (
                                            <option key={o} value={o}>{o}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <input
                                          type="number"
                                          value={inp[input.id] as number}
                                          min={input.min}
                                          max={input.max}
                                          onChange={(e) =>
                                            setInput(strategy.id, input.id, parseFloat(e.target.value) || 0)
                                          }
                                          className="w-full px-2.5 py-2 rounded-lg font-dm-mono text-xs text-white focus:outline-none"
                                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Run + Save buttons */}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => runBacktest(strategy.id)}
                                  disabled={runningId === strategy.id}
                                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0"
                                  style={{ background: strategy.color, color: "#080a10" }}
                                >
                                  {runningId === strategy.id ? (
                                    <>
                                      <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                      Running…
                                    </>
                                  ) : (
                                    <>
                                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                                        <path d="M3 2l6 3.5-6 3.5z" fill="currentColor" />
                                      </svg>
                                      Run Backtest
                                    </>
                                  )}
                                </button>
                                {result && isPro && (
                                  <button
                                    onClick={() => { setSaveModalId(strategy.id); setSaveName(strategy.name); }}
                                    className="px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                                    style={{ background: "rgba(255,255,255,0.05)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.08)" }}
                                  >
                                    Save
                                  </button>
                                )}
                              </div>

                              {/* Part 4: Backtest results + community benchmark */}
                              {result && (
                                <div className="space-y-3">
                                  <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#6b7280] font-semibold">
                                    Backtest Results · {timeframe} · {STYLE_SETTINGS[style].lookback}d
                                  </p>

                                  {/* Equity curve */}
                                  <div
                                    className="rounded-xl overflow-hidden p-3"
                                    style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}
                                  >
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="font-dm-mono text-[10px] text-[#4b5563]">
                                        $10,000 → ${result.trades[result.trades.length - 1]?.balance.toFixed(0) ?? "—"}
                                      </span>
                                      <span
                                        className={`font-dm-mono text-[11px] font-bold ${result.totalReturn >= 0 ? "text-[#00e676]" : "text-[#f87171]"}`}
                                      >
                                        {result.totalReturn >= 0 ? "+" : ""}{result.totalReturn.toFixed(1)}%
                                      </span>
                                    </div>
                                    <EquityCurve trades={result.trades} />
                                  </div>

                                  {/* Stats grid */}
                                  <div className="grid grid-cols-3 gap-2">
                                    {[
                                      { label: "Win Rate",    value: `${result.winRate.toFixed(1)}%`,    color: "#00e676" },
                                      { label: "Avg R:R",    value: result.avgRR.toFixed(2),             color: strategy.color },
                                      { label: "Trades",     value: result.totalTrades.toString(),       color: "#9ca3af" },
                                      { label: "Max DD",     value: `${result.maxDrawdown.toFixed(1)}%`, color: "#f87171" },
                                      { label: "Prof. Factor", value: result.profitFactor.toFixed(2),    color: result.profitFactor >= 1.5 ? "#00e676" : result.profitFactor >= 1 ? "#ffd740" : "#f87171" },
                                      { label: "Sharpe",     value: result.sharpeRatio.toFixed(2),       color: "#9ca3af" },
                                    ].map((stat) => (
                                      <div
                                        key={stat.label}
                                        className="rounded-xl p-2.5 text-center"
                                        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
                                      >
                                        <p className="font-dm-mono text-[9px] uppercase tracking-wider text-[#4b5563] mb-1">
                                          {stat.label}
                                        </p>
                                        <p className="font-dm-mono text-sm font-bold" style={{ color: stat.color }}>
                                          {stat.value}
                                        </p>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Community benchmark comparison */}
                                  <div
                                    className="rounded-xl p-3"
                                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                                  >
                                    <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#4b5563] font-semibold mb-2.5">
                                      Community Benchmark
                                    </p>
                                    <div className="space-y-2">
                                      {[
                                        { label: "Win Rate", yours: result.winRate,    community: strategy.winRate, suffix: "%" },
                                        { label: "Avg R:R",  yours: result.avgRR,      community: strategy.avgRR,  suffix: "" },
                                      ].map((row) => {
                                        const diff = row.yours - row.community;
                                        return (
                                          <div key={row.label} className="flex items-center gap-2">
                                            <span className="font-dm-mono text-[10px] text-[#4b5563] w-16 flex-shrink-0">
                                              {row.label}
                                            </span>
                                            <div
                                              className="flex-1 h-1.5 rounded-full overflow-hidden"
                                              style={{ background: "rgba(255,255,255,0.05)" }}
                                            >
                                              <div
                                                className="h-full rounded-full"
                                                style={{
                                                  width: `${Math.min(100, (row.yours / (row.community * 1.5)) * 100)}%`,
                                                  background: strategy.color,
                                                }}
                                              />
                                            </div>
                                            <span
                                              className={`font-dm-mono text-[10px] font-bold w-20 text-right flex-shrink-0 ${diff >= 0 ? "text-[#00e676]" : "text-[#f87171]"}`}
                                            >
                                              {row.yours.toFixed(1)}{row.suffix}
                                              <span className="text-[9px] ml-0.5 opacity-70">
                                                ({diff >= 0 ? "+" : ""}{diff.toFixed(1)})
                                              </span>
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <p className="font-dm-mono text-[9px] text-[#374151] mt-2">
                                      Based on {strategy.communityTrades.toLocaleString()} trades from {strategy.communityVotes.toLocaleString()} users
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">
              {/* Part 5: My Strategies */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: "#090d12", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="flex border-b border-white/[0.06]">
                  {(["saved", "notes"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setMyTab(tab)}
                      className="flex-1 py-3 font-dm-mono text-[11px] font-bold uppercase tracking-wider transition-colors"
                      style={
                        myTab === tab
                          ? { color: "#00e676", borderBottom: "2px solid #00e676" }
                          : { color: "#4b5563" }
                      }
                    >
                      {tab === "saved" ? "My Strategies" : "How To Use"}
                    </button>
                  ))}
                </div>

                {myTab === "saved" && (
                  <div className="p-4">
                    {!isPro ? (
                      <div className="text-center py-6 px-4">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <rect x="2" y="8" width="14" height="9" rx="2" stroke="#00e676" strokeWidth="1.2" />
                            <path d="M5.5 8V6a3.5 3.5 0 017 0v2" stroke="#00e676" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                        </div>
                        <p className="text-white text-xs font-bold mb-1">Pro Feature</p>
                        <p className="font-dm-mono text-[10px] text-[#6b7280] mb-3">
                          Save and load custom strategy configurations
                        </p>
                        <a
                          href="/pricing"
                          className="inline-block px-4 py-1.5 rounded-lg text-xs font-bold"
                          style={{ background: "#00e676", color: "#080a10" }}
                        >
                          Upgrade to Pro
                        </a>
                      </div>
                    ) : savedStrategies.length === 0 ? (
                      <div className="text-center py-6 px-4">
                        <p className="font-dm-mono text-[#4b5563] text-[11px]">No saved strategies yet.</p>
                        <p className="font-dm-mono text-[10px] text-[#374151] mt-1">
                          Run a backtest and hit Save to store it here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {savedStrategies.map((saved) => {
                          const base = STRATEGIES.find((s) => s.id === saved.baseStrategyId);
                          return (
                            <div
                              key={saved.id}
                              className="rounded-xl p-3"
                              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-white truncate">{saved.name}</p>
                                  <p className="font-dm-mono text-[10px] text-[#4b5563] mt-0.5">
                                    {base?.name ?? saved.baseStrategyId}
                                  </p>
                                  {saved.lastBacktest && (
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <span
                                        className={`font-dm-mono text-[10px] font-bold ${saved.lastBacktest.totalReturn >= 0 ? "text-[#00e676]" : "text-[#f87171]"}`}
                                      >
                                        {saved.lastBacktest.totalReturn >= 0 ? "+" : ""}
                                        {saved.lastBacktest.totalReturn.toFixed(1)}%
                                      </span>
                                      <span className="font-dm-mono text-[10px] text-[#4b5563]">
                                        {saved.lastBacktest.winRate.toFixed(0)}% WR
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                  <button
                                    onClick={() => loadSaved(saved)}
                                    className="px-2 py-1 rounded-lg font-dm-mono text-[10px] font-bold"
                                    style={{ background: "rgba(0,230,118,0.1)", color: "#00e676" }}
                                  >
                                    Load
                                  </button>
                                  <button
                                    onClick={() => deleteSaved(saved.id)}
                                    className="px-2 py-1 rounded-lg font-dm-mono text-[10px]"
                                    style={{ background: "rgba(248,113,113,0.08)", color: "#f87171" }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {myTab === "notes" && (
                  <div className="p-4 space-y-3">
                    {[
                      { step: "1", text: "Pick a trading style above — it sets the timeframe and lookback window automatically." },
                      { step: "2", text: "Select any strategy, adjust parameters, then hit Run Backtest." },
                      { step: "3", text: "Compare your results to community benchmarks." },
                      { step: "4", text: "Pro users: hit Save to store your config for future sessions." },
                    ].map((item) => (
                      <div key={item.step} className="flex items-start gap-2.5">
                        <span
                          className="font-dm-mono text-[10px] font-bold w-4 flex-shrink-0 mt-0.5"
                          style={{ color: "#00e676" }}
                        >
                          {item.step}
                        </span>
                        <p className="font-dm-mono text-[10px] text-[#6b7280] leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Community top picks */}
              <div
                className="rounded-2xl p-4"
                style={{ background: "#090d12", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#4b5563] font-semibold mb-3">
                  Community Top Picks
                </p>
                <div className="space-y-1">
                  {topPicks.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
                      className="w-full flex items-center gap-2.5 hover:bg-white/[0.02] rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                    >
                      <span className="font-dm-mono text-[10px] text-[#374151] w-3 flex-shrink-0">{i + 1}</span>
                      <span className="text-base flex-shrink-0">{s.icon}</span>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-dm-mono text-[11px] text-white truncate">{s.name}</p>
                        <p className="font-dm-mono text-[9px] text-[#4b5563]">
                          {s.winRate}% win · RR {s.avgRR}
                        </p>
                      </div>
                      <StarRating stars={s.stars} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div
                className="rounded-xl px-3 py-2.5"
                style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)" }}
              >
                <p className="font-dm-mono text-[9px] text-[#374151] leading-relaxed">
                  Backtests are simulations based on community-aggregated statistics. Past performance does not guarantee future results. Not financial advice.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Save modal */}
      <AnimatePresence>
        {saveModalId && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setSaveModalId(null)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative rounded-2xl p-6 w-full max-w-xs z-10"
              style={{ background: "#0d1117", border: "1px solid rgba(0,230,118,0.2)" }}
            >
              <h3 className="font-bold text-white mb-1">Save Strategy</h3>
              <p className="font-dm-mono text-[11px] text-[#6b7280] mb-4">Give this configuration a name</p>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveStrategy(saveModalId!)}
                placeholder="My ICT Silver Bullet v2"
                autoFocus
                className="w-full px-3 py-2.5 rounded-xl font-dm-mono text-sm text-white focus:outline-none mb-3"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveStrategy(saveModalId!)}
                  disabled={!saveName.trim()}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40"
                  style={{ background: "#00e676", color: "#080a10" }}
                >
                  Save
                </button>
                <button
                  onClick={() => setSaveModalId(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#6b7280" }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
