"use client";

import { useState, useRef, useEffect } from "react";
import { useUserPlan } from "@/app/lib/plan-context";
import { useAuth } from "@/app/lib/auth-context";
import { motion } from "framer-motion";
import AppNav from "@/app/components/AppNav";
import ShareModal from "@/app/components/ShareModal";
import type { ShareCardParams } from "@/app/lib/shareCard";
import AnnotatedChart from "@/app/components/AnnotatedChart";
import type { SMCData } from "@/app/components/AnnotatedChart";
import PineScriptExport from "@/app/components/PineScriptExport";
import MTTradeSetup from "@/app/components/MTTradeSetup";
import GamificationBar from "@/app/components/GamificationBar";
import DailyChallenges from "@/app/components/DailyChallenges";
import WelcomeQuest from "@/app/components/WelcomeQuest";
import { useGamification } from "@/app/lib/gamification-context";
import { detectFutures, type FuturesSpec } from "@/app/lib/futures-specs";

// ── Types ──────────────────────────────────────────────────────
type AnalysisResult = {
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;
  timeframe: string;
  summary: string;
  tradeSetup: { entry: string; entryType: string; stopLoss: string; takeProfit1: string; riskReward: string };
  keyLevels:  { resistance: string[]; support: string[] };
  indicators: { rsi: string; macd: string; maCross: string };
  confluences: string[];
  confluenceChecks?: { label: string; passed: boolean }[];
  warnings: string[];
  // Pro-only fields
  tradeScore?: string;
  fibonacci?: { keyLevels: string[]; context: string };
  volumeAnalysis?: string;
  marketStructure?: string;
  momentum?: string;
  priceLevels?: string[];
  invalidationLevel?: string;
  bestSession?: string;
  historicalSetups?: { pattern: string; asset: string; period: string; result: string }[];
  // Smart Entry Timer fields
  entrySession?: string | null;
  entryTimeUTC?: string | null;
  entryRationale?: string | null;
  waitForConfirmation?: string | null;
  // SMC fields
  fvg?:             { type: string; priceRange: string; filled?: boolean; description?: string }[];
  liquiditySweeps?: { direction?: string; price: string; description?: string }[];
  orderBlocks?:     { type: string; priceRange: string; description?: string }[];
  structureBreaks?: { type: string; price: string; description?: string }[];
  equalLevels?:     { type: string; price: string; description?: string }[];
  marketZone?:      string;
  patterns?:        { name: string; direction?: string; target?: string; description?: string }[];
  smcFibonacci?:    { level: string; price: string; description?: string }[];
  smc_summary?:     string | null;
};

type MultiResult = {
  analyses:  { current: AnalysisResult; higher: AnalysisResult; highest: AnalysisResult };
  tfLabels:  { current: string; higher: string; highest: string };
  confluence: { score: number; total: number; label: string; color: string; detail: string };
};

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

// ── Economic calendar types + helpers ─────────────────────────
type CalEvent = {
  title: string;
  country: string;
  date: string;
  time: string;
  impact: "High" | "Medium" | "Low";
  forecast: string;
  previous: string;
};

// Times from faireconomy.media are in UTC
function parseCalDate(dateStr: string, timeStr: string): Date | null {
  if (!timeStr || /all.?day|tentative/i.test(timeStr.trim())) return null;
  const mdy = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  const ymd = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let y: number, mo: number, d: number;
  if (mdy) { mo = +mdy[1]; d = +mdy[2]; y = +mdy[3]; }
  else if (ymd) { y = +ymd[1]; mo = +ymd[2]; d = +ymd[3]; }
  else return null;
  const [h, m = 0] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, m, 0));
}

function calMinutesFromNow(e: CalEvent): number | null {
  const dt = parseCalDate(e.date, e.time);
  if (!dt) return null;
  return Math.round((dt.getTime() - Date.now()) / 60_000);
}

function fmtCalCountdown(min: number): string {
  if (min <= 0) return "NOW";
  if (min < 60) return `in ${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
}

// ── Session utilities ──────────────────────────────────────────
const SESSION_RANGES: Record<string, [number, number]> = {
  "asian":           [0,   540],
  "asian session":   [0,   540],
  "london":          [480, 1020],
  "london open":     [480, 1020],
  "london session":  [480, 1020],
  "ny":              [780, 1320],
  "ny open":         [780, 1320],
  "ny session":      [780, 1320],
  "new york":        [780, 1320],
  "london/ny overlap": [780, 1020],
  "overlap":         [780, 1020],
};

function utcNowMins(): number {
  const d = new Date();
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function isSessionActive(sessionName: string): boolean {
  const nowMins = utcNowMins();
  const key = (sessionName ?? "").toLowerCase().trim();
  for (const [k, [s, e]] of Object.entries(SESSION_RANGES)) {
    if (key === k || key.includes(k) || k.includes(key)) {
      return nowMins >= s && nowMins < e;
    }
  }
  return false;
}

function getCountdownToUTC(entryTimeUTC: string): { secs: number; isNow: boolean; tomorrow: boolean } {
  const parts = entryTimeUTC.split(":");
  const h = parseInt(parts[0] ?? "0", 10) || 0;
  const m = parseInt(parts[1] ?? "0", 10) || 0;
  const now = new Date();
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0));
  const diffMs = target.getTime() - now.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs > -1800 && diffSecs <= 0) return { secs: 0, isNow: true, tomorrow: false };
  if (diffSecs < -1800) {
    const tom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, h, m, 0));
    return { secs: Math.floor((tom.getTime() - now.getTime()) / 1000), isNow: false, tomorrow: true };
  }
  return { secs: diffSecs, isNow: false, tomorrow: false };
}

function fmtCountdown(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

const CAL_FLAGS: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵",
  AUD: "🇦🇺", CAD: "🇨🇦", NZD: "🇳🇿", CHF: "🇨🇭",
  CNY: "🇨🇳", XAU: "🥇", BTC: "₿",
};

function extractPairCurrencies(asset: string | null): string[] {
  if (!asset) return [];
  const up = asset.toUpperCase().replace(/\s/g, "");
  if (up.includes("/")) return up.split("/").map((s) => s.replace(/[^A-Z]/g, "").slice(0, 3)).filter(Boolean);
  if (/^[A-Z]{6}$/.test(up)) return [up.slice(0, 3), up.slice(3, 6)];
  if (up.includes("XAU") || up.includes("GOLD")) return ["USD"];
  if (up.includes("OIL") || up.includes("WTI") || up.includes("BRENT")) return ["USD", "CAD"];
  if (/^[A-Z]{2,5}$/.test(up)) return ["USD"]; // stocks
  return ["USD"];
}

// ── Calendar strip (shown above upload zone) ───────────────────
function CalendarStrip({ events }: { events: CalEvent[] }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const chips = events
    .filter((e) => e.impact === "High")
    .map((e) => ({ ...e, min: calMinutesFromNow(e) }))
    .filter((e) => e.min !== null && e.min > -60 && e.min <= 24 * 60)
    .sort((a, b) => (a.min ?? 9999) - (b.min ?? 9999))
    .slice(0, 5);

  if (chips.length === 0) return null;

  const expandedChip = expandedIdx !== null ? chips[expandedIdx] : null;

  return (
    <div className="mb-6 card-dark p-4">
      <div className="flex items-center gap-2 mb-3">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <rect x="1" y="1.5" width="9" height="8.5" rx="1.5" stroke="#6b7280" strokeWidth="1.1"/>
          <path d="M3.5 1V2.5M7.5 1V2.5M1 4h9" stroke="#6b7280" strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
        <p className="font-dm-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-[#6b7280]">
          Upcoming High Impact News
        </p>
        <a href="/calendar" className="ml-auto font-dm-mono text-[10px] text-[#4b5563] hover:text-[#9ca3af] transition-colors">
          Full calendar →
        </a>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {chips.map((e, i) => {
          const urgent  = e.min! < 60;
          const caution = e.min! < 240;
          const color  = urgent ? "#f87171" : caution ? "#9ca3af" : "#00e676";
          const bg     = urgent ? "rgba(248,113,113,0.1)" : caution ? "rgba(156,163,175,0.1)" : "rgba(0,230,118,0.1)";
          const border = urgent ? "rgba(248,113,113,0.3)" : caution ? "rgba(156,163,175,0.3)" : "rgba(0,230,118,0.3)";
          const isOpen = expandedIdx === i;
          return (
            <button key={i}
              onClick={() => setExpandedIdx(isOpen ? null : i)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap font-dm-mono text-xs font-medium transition-all duration-150 hover:-translate-y-0.5 flex-shrink-0"
              style={{ background: isOpen ? bg.replace("0.1", "0.2") : bg, border: `1px solid ${border}`, color }}>
              <span>{CAL_FLAGS[e.country] ?? e.country}</span>
              <span style={{ color: "rgba(255,255,255,0.85)", maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</span>
              <span>·</span>
              <span>{fmtCalCountdown(e.min!)}</span>
            </button>
          );
        })}
      </div>

      {expandedChip && (
        <motion.div
          key={expandedIdx}
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="mt-2 px-4 py-3 rounded-xl font-dm-mono text-xs"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p className="text-white font-semibold mb-1">
            {expandedChip.title}{" "}
            <span className="text-[#6b7280]">· {expandedChip.country}</span>
          </p>
          <div className="flex flex-wrap gap-5 text-[#6b7280]">
            {expandedChip.forecast && <span>Forecast <span className="text-white">{expandedChip.forecast}</span></span>}
            {expandedChip.previous && <span>Previous <span className="text-white">{expandedChip.previous}</span></span>}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ── News warning banner (shown in results when event imminent) ─
function NewsWarningBanner({ events, asset }: { events: CalEvent[]; asset: string }) {
  const pairCurrencies = extractPairCurrencies(asset);
  const warnings = events
    .filter((e) => {
      if (e.impact !== "High") return false;
      if (!pairCurrencies.includes(e.country)) return false;
      const min = calMinutesFromNow(e);
      return min !== null && min > -60 && min <= 120;
    })
    .map((e) => ({ ...e, min: calMinutesFromNow(e)! }))
    .sort((a, b) => a.min - b.min);

  if (warnings.length === 0) return null;

  const first = warnings[0];
  const minStr = first.min <= 0 ? "NOW" : first.min < 60 ? `${first.min} MINUTES` : `${Math.ceil(first.min / 60)} HOURS`;

  return (
    <div className="rounded-xl border border-[#9ca3af]/30 bg-[#9ca3af]/[0.07] p-3.5 mb-4 flex items-start gap-3">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
        <path d="M8 2L1.5 13.5h13L8 2z" stroke="#9ca3af" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 6.5v3.5M8 11.5v.5" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-[#9ca3af] text-xs font-bold uppercase tracking-[0.1em] mb-0.5 font-dm-mono">
          HIGH IMPACT NEWS IN {minStr}
        </p>
        <p className="text-[#fca5a5] text-xs leading-relaxed">
          {warnings.map((w) => `${w.title} (${w.country})`).join(" · ")} · Consider waiting for the news candle to close before entering this trade.
        </p>
      </div>
    </div>
  );
}

// ── Position calculator ────────────────────────────────────────
type CalcAssetType = "forex" | "crypto" | "stocks" | "gold" | "futures";
type CalcCurrency  = "GBP" | "USD" | "EUR";
const CURRENCY_SYMBOLS: Record<CalcCurrency, string> = { GBP: "£", USD: "$", EUR: "€" };

function detectCalcAsset(asset: string): CalcAssetType {
  const up = (asset ?? "").toUpperCase().replace(/\s/g, "");
  if (detectFutures(asset)) return "futures";
  if (up.includes("XAU") || up.includes("GOLD") || up.includes("OIL") || up.includes("WTI")) return "gold";
  const cryptoKeys = ["BTC","ETH","SOL","DOGE","ADA","XRP","AVAX","LTC","LINK","DOT","BNB","MATIC"];
  if (cryptoKeys.some((c) => up.includes(c))) return "crypto";
  if (up.includes("/") || /^[A-Z]{6}$/.test(up)) return "forex";
  return "stocks";
}

function parseNum(s: string): number {
  const n = parseFloat(String(s ?? "").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

type CalcResult = {
  sizeLabel: string; profit1: number; rr1: number; marginRequired: number; slPips?: number;
  contracts?: number; rawContracts?: number; dollarRiskPerContract?: number;
  pointsAtRisk?: number; ticksAtRisk?: number; spec?: FuturesSpec;
  microContracts?: number; microDollarRisk?: number;
};

function doCalc(
  type: CalcAssetType, riskAmt: number, entry: number, sl: number, tp: number, asset: string
): CalcResult | null {
  const slDist = Math.abs(entry - sl);
  const tpDist = Math.abs(tp - entry);
  if (slDist === 0 || entry === 0) return null;
  const rr1 = tpDist / slDist;
  if (type === "futures") {
    const spec = detectFutures(asset);
    if (!spec) return null;
    const pointsAtRisk = slDist;
    const ticksAtRisk  = pointsAtRisk / spec.tickSize;
    const dollarRiskPerContract = ticksAtRisk * spec.tickValue;
    if (dollarRiskPerContract <= 0) return null;
    const rawContracts = riskAmt / dollarRiskPerContract;
    const contracts    = Math.max(1, Math.floor(rawContracts));
    const profit1      = (tpDist / spec.tickSize) * spec.tickValue * contracts;
    const marginRequired = contracts * spec.margin;
    let microContracts: number | undefined;
    let microDollarRisk: number | undefined;
    if (spec.microSymbol) {
      const microSpec = detectFutures(spec.microSymbol);
      if (microSpec) {
        const microTicks = pointsAtRisk / microSpec.tickSize;
        const microDrpc  = microTicks * microSpec.tickValue;
        microContracts   = Math.max(1, Math.floor(riskAmt / microDrpc));
        microDollarRisk  = microContracts * microDrpc;
      }
    }
    return { sizeLabel: `${contracts} contract${contracts !== 1 ? "s" : ""}`, profit1, rr1, marginRequired, contracts, rawContracts, dollarRiskPerContract, pointsAtRisk, ticksAtRisk, spec, microContracts, microDollarRisk };
  }
  if (type === "forex") {
    const isJpy     = asset.toUpperCase().includes("JPY");
    const pipSize   = isJpy ? 0.01 : 0.0001;
    const pipPerLot = isJpy ? 1000 : 10;
    const slPips    = slDist / pipSize;
    const lots      = riskAmt / (slPips * pipPerLot);
    return { sizeLabel: `${lots.toFixed(2)} lots`, profit1: (tpDist / pipSize) * pipPerLot * lots, rr1, marginRequired: lots * 100_000 * entry * 0.01, slPips };
  }
  if (type === "crypto") {
    const up   = asset.toUpperCase().replace(/\s/g, "");
    const coin = up.split("/")[0] || up.slice(0, 3);
    const units = riskAmt / slDist;
    return { sizeLabel: `${units.toFixed(4)} ${coin}`, profit1: tpDist * units, rr1, marginRequired: units * entry * 0.1 };
  }
  if (type === "stocks") {
    const shares = Math.max(1, Math.floor(riskAmt / slDist));
    return { sizeLabel: `${shares.toLocaleString()} shares`, profit1: tpDist * shares, rr1, marginRequired: shares * entry * 0.25 };
  }
  const oz = riskAmt / slDist;
  return { sizeLabel: `${oz.toFixed(2)} oz`, profit1: tpDist * oz, rr1, marginRequired: oz * entry * 0.005 };
}

const QUICK_CHIPS = [
  "What's the best entry for this setup?",
  "Where should I set my stop loss?",
  "Is this a high-probability trade?",
  "What invalidates this setup?",
  "What's the risk/reward here?",
];

const TF_OPTIONS = ["1m", "5m", "15m", "30m", "1H", "4H", "Daily", "Weekly"] as const;

// ── Tiny shared pieces ─────────────────────────────────────────

function Check({ color = "#22c55e" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 mt-0.5">
      <path d="M2.5 7l3 3L11.5 3.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 mt-0.5">
      <path d="M3.5 10.5l7-7M10.5 10.5l-7-7" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00e676]/30 bg-[#00e676]/10 text-[#00e676] text-xs font-semibold tracking-[0.13em] uppercase mb-5">
      {children}
    </div>
  );
}

function TimeframeSelector({ value, onChange }: { value: string; onChange: (tf: string) => void }) {
  return (
    <div className="mb-4">
      <p className="text-[#6b7280] text-[10px] font-semibold uppercase tracking-[0.12em] mb-2">Chart Timeframe</p>
      <div className="flex flex-wrap gap-1.5">
        {TF_OPTIONS.map((tf) => (
          <button
            key={tf}
            onClick={() => onChange(tf)}
            className="font-dm-mono text-xs px-3 py-1.5 rounded-lg border transition-all duration-150"
            style={value === tf ? {
              background: "#00e676",
              borderColor: "#00e676",
              color: "#080a10",
              fontWeight: 700,
              boxShadow: "0 0 12px rgba(0,230,118,0.35)",
            } : {
              background: "rgba(255,255,255,0.03)",
              borderColor: "rgba(255,255,255,0.09)",
              color: "#6b7280",
            }}
          >
            {tf}
          </button>
        ))}
      </div>
    </div>
  );
}

function LogoMark() {
  return (
    <div className="w-8 h-8 rounded-full bg-[#00e676] flex items-center justify-center flex-shrink-0">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="#080a10" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ── Session clock (nav widget) ─────────────────────────────────
function SessionClock() {
  const [nowMins, setNowMins] = useState(utcNowMins);
  useEffect(() => {
    const t = setInterval(() => setNowMins(utcNowMins()), 60_000);
    return () => clearInterval(t);
  }, []);
  const sessions = [
    { name: "Asia",   range: [0, 540]    as [number, number] },
    { name: "London", range: [480, 1020] as [number, number] },
    { name: "NY",     range: [780, 1320] as [number, number] },
  ];
  return (
    <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03]" title="Live market sessions (UTC)">
      {sessions.map(({ name, range }) => {
        const active = nowMins >= range[0] && nowMins < range[1];
        return (
          <div key={name} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-500"
              style={{ background: active ? "#00e676" : "#374151", boxShadow: active ? "0 0 4px rgba(0,230,118,0.6)" : "none" }} />
            <span className="font-dm-mono text-[9px] font-semibold transition-colors duration-500"
              style={{ color: active ? "#00e676" : "#374151" }}>
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Confidence gauge ───────────────────────────────────────────
function ConfidenceGauge({ score }: { score: number }) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    setDisplayScore(0);
    const t = setTimeout(() => setDisplayScore(score), 350);
    return () => clearTimeout(t);
  }, [score]);

  const r = 36;
  const cx = 50, cy = 50;
  const circumference = 2 * Math.PI * r;
  const arcLen  = circumference * (240 / 360);
  const filled  = arcLen * Math.min(Math.max(displayScore, 0), 100) / 100;

  const color =
    score >= 75 ? "#00e676" :
    score >= 50 ? "#9ca3af" :
    "#ff4444";

  const label =
    score >= 75 ? "Strong setup — high confidence" :
    score >= 50 ? "Moderate setup — trade carefully" :
    "Weak signal — avoid or reduce size";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 100 100" width="148" height="148">
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="rgba(255,255,255,0.07)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${arcLen} ${circumference - arcLen}`}
          transform={`rotate(150 ${cx} ${cy})`}
        />
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          transform={`rotate(150 ${cx} ${cy})`}
          style={{
            transition: "stroke-dasharray 1.1s cubic-bezier(0.34,1.56,0.64,1), stroke 0.3s ease",
            filter: `drop-shadow(0 0 7px ${color}80)`,
          }}
        />
        <text x={cx} y={cy + 5} textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize="30"
          style={{ fontFamily: "var(--font-bebas), Impact, sans-serif" }}>
          {score}
        </text>
        <text x={cx} y={cy + 19} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize="8"
          style={{ fontFamily: "var(--font-dm-mono), monospace" }}>
          %
        </text>
      </svg>
      <div className="text-center -mt-1">
        <p className="text-[#6b7280] text-[10px] font-semibold uppercase tracking-[0.12em]">
          Signal Confidence
        </p>
        <p className="text-sm font-semibold mt-1" style={{ color }}>{label}</p>
      </div>
    </div>
  );
}

// ── Scanning loader (replaces skeleton while loading) ──────────
function ScanningLoader() {
  const [progress, setProgress] = useState(0);
  const [dotCount, setDotCount] = useState(0);
  const [cursorOn, setCursorOn] = useState(true);

  useEffect(() => {
    const startTime = Date.now();
    const DURATION = 3000;
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.min((elapsed / DURATION) * 97, 97));
      if (elapsed < DURATION * 1.5) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const dotTimer  = setInterval(() => setDotCount(d => (d + 1) % 4), 500);
    const cursorTimer = setInterval(() => setCursorOn(v => !v), 530);
    return () => { cancelAnimationFrame(raf); clearInterval(dotTimer); clearInterval(cursorTimer); };
  }, []);

  const stages = ["Uploading image...", "Detecting patterns...", "Calculating levels...", "Generating insights..."];
  const stage   = stages[Math.min(Math.floor(progress / 24.25), 3)];

  return (
    <div className="py-8 flex flex-col items-center gap-5">
      <div className="relative">
        <div className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ border: "1px solid rgba(0,230,118,0.25)", background: "rgba(0,230,118,0.06)" }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M4 20L9 13L13.5 16.5L20 7L24 12" stroke="#00e676" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="absolute inset-0 rounded-full"
          style={{ border: "1px solid rgba(0,230,118,0.15)", animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite" }} />
      </div>

      <div className="font-dm-mono text-center">
        <p className="text-[#00e676] text-[15px] font-medium tracking-[0.2em]">
          SCANNING CHART{".".repeat(dotCount)}
          <span style={{ opacity: cursorOn ? 1 : 0 }}>_</span>
        </p>
        <p className="text-[#4b5563] text-[11px] tracking-wider mt-1">{stage}</p>
      </div>

      <div className="w-full h-[2px] rounded-full overflow-hidden bg-white/[0.05]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #009e4f, #00e676)",
            boxShadow: "0 0 10px rgba(0,230,118,0.4)",
            transition: "width 0.08s linear",
          }}
        />
      </div>

      <div className="w-full space-y-2.5">
        {[0.9, 0.7, 0.85, 0.6].map((w, i) => (
          <div key={i} className="flex justify-between items-center">
            <div className="skeleton h-2.5 rounded" style={{ width: `${w * 100}px`, animationDelay: `${i * 0.15}s` }} />
            <div className="skeleton h-2.5 w-20 rounded"   style={{ animationDelay: `${i * 0.15 + 0.07}s` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Particle burst (fires when bias badge mounts) ──────────────
function ParticleBurst({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i * 360) / 8;
        const rad   = angle * (Math.PI / 180);
        const dist  = 44;
        return (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 rounded-full"
            style={{ width: 6, height: 6, background: color, marginLeft: -3, marginTop: -3 }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(rad) * dist, y: Math.sin(rad) * dist, opacity: 0, scale: 0 }}
            transition={{ duration: 0.65, ease: "easeOut", delay: 0.04 + i * 0.04 }}
          />
        );
      })}
    </div>
  );
}

// ── Word-by-word summary reveal ────────────────────────────────
function WordFade({ text, startDelay = 0 }: { text: string; startDelay?: number }) {
  const words = text.split(" ");
  return (
    <p className="text-[#d1d5db] text-sm leading-relaxed">
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: startDelay + i * 0.038, duration: 0.22 }}
        >
          {word}{" "}
        </motion.span>
      ))}
    </p>
  );
}

// ── Midnight countdown timer ───────────────────────────────────
function MidnightCountdown() {
  const [time, setTime] = useState("--:--:--");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setTime(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-dm-mono text-[#00e676] text-2xl font-semibold tracking-widest">{time}</span>;
}

// ── Analysis expiry countdown (10 min from mount) ─────────────
function AnalysisExpiry() {
  const [secs, setSecs] = useState(600);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const expired = secs === 0;
  return (
    <span className="font-dm-mono font-bold" style={{ color: secs < 120 ? "#f87171" : "#9ca3af" }}>
      {expired ? "EXPIRED" : `${m}:${String(s).padStart(2, "0")}`}
    </span>
  );
}

// ── Daily limit modal ──────────────────────────────────────────
function LimitModal({ onClose, clientId }: { onClose: () => void; clientId: string | null }) {
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showDemo, setShowDemo]               = useState(false);
  const [annual, setAnnual]                   = useState(false);

  async function handleUpgrade() {
    setCheckoutLoading(true);
    try {
      const res  = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, annual }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { /* silent */ }
    setCheckoutLoading(false);
  }

  if (showDemo) {
    return <DemoProAnalysis onBack={() => setShowDemo(false)} onUpgrade={handleUpgrade} checkoutLoading={checkoutLoading} />;
  }

  const dailyCost = annual ? "41p" : "64p";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(4, 6, 10, 0.94)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.22, duration: 0.5 }}
        className="w-full max-w-sm rounded-2xl p-7 text-center my-4"
        style={{
          background: "#080c0a",
          border: "1px solid rgba(0,230,118,0.28)",
          boxShadow: "0 0 60px rgba(0,230,118,0.07), 0 24px 64px rgba(0,0,0,0.55)",
        }}
      >
        {/* Header */}
        <h2 className="font-bebas text-[42px] leading-none tracking-[0.05em] text-white mb-1">
          YOU HIT YOUR LIMIT
        </h2>
        <p className="text-[#6b7280] text-sm mb-5">You have used all 5 of your free analyses. Upgrade to Pro for unlimited chart analysis.</p>

        {/* What they're missing */}
        <div className="rounded-xl overflow-hidden mb-4"
          style={{ border: "1px solid rgba(0,230,118,0.15)", background: "rgba(0,230,118,0.04)" }}>
          <div className="px-4 py-2.5 border-b border-white/[0.06]">
            <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#9ca3af] font-semibold text-left">
              Your last chart had hidden Pro insights — unlock them:
            </p>
          </div>
          <div className="p-3 text-left space-y-1.5">
            {[
              "Fibonacci retracement levels",
              "Smart money concept analysis",
              "Historical pattern match",
              "Exact invalidation with reasoning",
              "Best trading session for this setup",
              "Personal coaching tip based on your journal",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-xs text-[#9ca3af]">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="flex-shrink-0">
                  <path d="M1.5 5l2.5 2.5L8.5 2" stroke="#00e676" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Monthly / Annual toggle */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setAnnual(false)}
            className="flex-1 py-2 rounded-lg font-dm-mono text-xs font-bold transition-all"
            style={!annual ? { background: "#00e676", color: "#080a10" } : { background: "rgba(255,255,255,0.05)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.09)" }}>
            Monthly
          </button>
          <button onClick={() => setAnnual(true)}
            className="flex-1 py-2 rounded-lg font-dm-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            style={annual ? { background: "#00e676", color: "#080a10" } : { background: "rgba(255,255,255,0.05)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.09)" }}>
            Annual
            <span className="text-[9px] px-1.5 py-0.5 rounded-full"
              style={{ background: annual ? "rgba(8,10,16,0.25)" : "rgba(0,230,118,0.15)", color: annual ? "#080a10" : "#00e676" }}>
              SAVE 35%
            </span>
          </button>
        </div>

        {/* Daily cost pricing */}
        <div className="mb-1">
          <p className="font-bebas text-[52px] leading-none tracking-[0.03em] text-[#00e676]">{dailyCost} per day</p>
          <p className="text-[#4b5563] text-xs mt-0.5">
            {annual ? "£149/yr billed annually" : "£19 billed monthly"} — cancel any time
          </p>
        </div>

        {/* Social proof */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 my-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1">
              {[0,1,2,3,4].map((i) => (
                <svg key={i} width="11" height="11" viewBox="0 0 14 14" fill="#00e676">
                  <path d="M7 1l1.8 3.6L13 5.4l-3 2.9.7 4.1L7 10.4l-3.7 2 .7-4.1-3-2.9 4.2-.8z"/>
                </svg>
              ))}
              <span className="font-dm-mono text-[10px] text-[#6b7280] ml-1">4.9/5 · 312 reviews</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-dm-mono text-[10px] text-[#6b7280]">847 traders upgraded this week</span>
            <span className="font-dm-mono text-[10px] text-[#6b7280]">73% of users are on Pro</span>
          </div>
        </div>

        {/* Urgency */}
        <div className="rounded-xl border border-[#9ca3af]/20 bg-[#9ca3af]/[0.06] px-4 py-2 mb-4">
          <p className="font-dm-mono text-[10px] text-[#9ca3af]">
            Launch price — increases to £29/mo on 1st June 2026
          </p>
        </div>

        {/* Primary CTA */}
        <button
          onClick={handleUpgrade}
          disabled={checkoutLoading}
          className="w-full py-4 rounded-xl text-base font-bold mb-3 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60"
          style={{ background: "#00e676", color: "#080c0a", boxShadow: "0 0 28px rgba(0,230,118,0.32)" }}>
          {checkoutLoading ? "Redirecting…" : `Start Pro now — ${dailyCost}/day`}
        </button>

        {/* Secondary CTA — demo */}
        <button onClick={() => setShowDemo(true)}
          className="w-full py-3 rounded-xl text-sm font-semibold border border-white/[0.12] text-white hover:bg-white/[0.06] transition-all duration-150 mb-4">
          See a Pro analysis example →
        </button>

        {/* Trust badges */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {["✅ 7 day money back", "✅ Cancel any time", "✅ Instant access"].map((b) => (
            <p key={b} className="font-dm-mono text-[9px] text-[#4b5563] text-center leading-snug">{b}</p>
          ))}
        </div>

        <button onClick={onClose} className="text-[#4b5563] text-xs hover:text-[#9ca3af] transition-colors">
          No thanks, wait until tomorrow
        </button>
      </motion.div>
    </div>
  );
}

// ── Pro glow wrapper ───────────────────────────────────────────
function ProGlowCard({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div className="relative">
      <div className="absolute -inset-px rounded-2xl pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${color}40 0%, transparent 50%, ${color}20 100%)`, filter: "blur(1px)" }} />
      <div className="absolute -inset-0.5 rounded-2xl pointer-events-none opacity-60"
        style={{ boxShadow: `0 0 30px ${color}30, 0 0 60px ${color}15, inset 0 0 30px ${color}08` }} />
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -inset-px rounded-2xl pointer-events-none"
        style={{ border: `1px solid ${color}50` }}
      />
      {children}
    </div>
  );
}

// ── Background particles (Pro only) ───────────────────────────
function ProParticles({ color }: { color: string }) {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    duration: Math.random() * 4 + 3,
    delay: Math.random() * 3,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
      {particles.map((p) => (
        <motion.div key={p.id}
          className="absolute rounded-full"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, background: color, opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0], y: [-10, -30], scale: [0.5, 1, 0.3] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

// ── Trade Score badge ──────────────────────────────────────────
function TradeScore({ grade }: { grade: string }) {
  const cfg: Record<string, { color: string; bg: string; border: string; label: string }> = {
    "A+": { color: "#00e676", bg: "rgba(0,230,118,0.1)",   border: "rgba(0,230,118,0.35)",  label: "Perfect setup" },
    "A":  { color: "#4ade80", bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.35)", label: "Strong setup" },
    "B":  { color: "#9ca3af", bg: "rgba(156,163,175,0.1)",  border: "rgba(156,163,175,0.35)", label: "Decent setup" },
    "C":  { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)", label: "Trade with caution" },
    "D":  { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)",   label: "Avoid this trade" },
  };
  const c = cfg[grade] ?? cfg["B"];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, type: "spring", bounce: 0.4 }}
      className="rounded-2xl p-4 flex items-center justify-between"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div>
        <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#6b7280] mb-0.5">Trade Score</p>
        <p className="text-sm font-semibold" style={{ color: c.color }}>{c.label}</p>
      </div>
      <motion.div
        animate={{ boxShadow: [`0 0 12px ${c.color}40`, `0 0 28px ${c.color}80`, `0 0 12px ${c.color}40`] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="font-bebas text-[52px] leading-none"
        style={{ color: c.color }}>
        {grade}
      </motion.div>
    </motion.div>
  );
}

// ── Historical setups ──────────────────────────────────────────
function HistoricalSetups({ setups }: { setups: { pattern: string; asset: string; period: string; result: string }[] }) {
  return (
    <motion.div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.6, duration: 0.4 }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(192,132,252,0.15)" }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 8V3l4-2 4 2v5" stroke="#c084fc" strokeWidth="1.1" strokeLinecap="round"/>
            <rect x="3" y="5" width="4" height="4" rx="0.5" stroke="#c084fc" strokeWidth="1.1"/>
          </svg>
        </div>
        <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#c084fc] font-semibold">Similar Historical Setups</p>
      </div>
      <div className="space-y-3">
        {setups.map((s, i) => (
          <div key={i} className="rounded-xl p-3" style={{ background: "rgba(192,132,252,0.04)", border: "1px solid rgba(192,132,252,0.12)" }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-dm-mono text-[10px] font-bold text-[#c084fc] uppercase">{s.pattern}</span>
              <span className="text-[#4b5563] text-[10px]">·</span>
              <span className="font-dm-mono text-[10px] text-[#6b7280]">{s.asset}</span>
              <span className="ml-auto font-dm-mono text-[9px] text-[#4b5563]">{s.period}</span>
            </div>
            <p className="text-[#9ca3af] text-xs leading-relaxed">{s.result}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Pro deep analysis panel ────────────────────────────────────
function ProDeepAnalysis({ a }: { a: AnalysisResult }) {
  return (
    <motion.div className="space-y-3"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>

      {/* Fibonacci */}
      {a.fibonacci && (
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
          <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#9ca3af] font-semibold mb-3">Fibonacci Levels</p>
          <div className="space-y-1.5 mb-2">
            {a.fibonacci.keyLevels.map((l, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-[#9ca3af] flex-shrink-0" />
                <span className="font-dm-mono text-[#d1d5db]">{l}</span>
              </div>
            ))}
          </div>
          <p className="text-[#6b7280] text-xs italic">{a.fibonacci.context}</p>
        </div>
      )}

      {/* Volume + Structure + Momentum row */}
      {(a.volumeAnalysis || a.marketStructure || a.momentum) && (
        <div className="grid grid-cols-1 gap-2">
          {[
            { label: "Volume",   value: a.volumeAnalysis,   color: "#38bdf8" },
            { label: "Structure", value: a.marketStructure, color: "#a78bfa" },
            { label: "Momentum", value: a.momentum,         color: "#f472b6" },
          ].filter(r => r.value).map((row) => (
            <div key={row.label} className="rounded-xl p-3 flex gap-3 items-start"
              style={{ background: `${row.color}08`, border: `1px solid ${row.color}18` }}>
              <span className="font-dm-mono text-[9px] uppercase tracking-widest font-bold flex-shrink-0 mt-0.5"
                style={{ color: row.color }}>{row.label}</span>
              <p className="text-[#9ca3af] text-xs leading-relaxed">{row.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Price levels to watch */}
      {a.priceLevels && a.priceLevels.length > 0 && (
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
          <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#38bdf8] font-semibold mb-3">Price Levels to Watch</p>
          <div className="space-y-2">
            {a.priceLevels.map((l, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="font-dm-mono text-[#38bdf8] text-[11px] font-bold flex-shrink-0">{i + 1}.</span>
                <span className="text-[#d1d5db] text-xs">{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invalidation + Session row */}
      <div className="grid grid-cols-2 gap-3">
        {a.invalidationLevel && (
          <div className="rounded-xl p-3" style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.18)" }}>
            <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#f87171] font-semibold mb-1.5">Invalidation</p>
            <p className="text-[#d1d5db] text-xs leading-relaxed">{a.invalidationLevel}</p>
          </div>
        )}
        {a.bestSession && (
          <div className="rounded-xl p-3" style={{ background: "rgba(0,230,118,0.06)", border: "1px solid rgba(0,230,118,0.15)" }}>
            <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#00e676] font-semibold mb-1.5">Best Session</p>
            <p className="font-bebas text-2xl text-white leading-none">{a.bestSession}</p>
          </div>
        )}
      </div>

      {/* Historical setups */}
      {a.historicalSetups && a.historicalSetups.length > 0 && (
        <HistoricalSetups setups={a.historicalSetups} />
      )}
    </motion.div>
  );
}

// ── Smart Entry Timer widget ───────────────────────────────────
function EntryTimerWidget({
  entrySession, entryTimeUTC, entryRationale, waitForConfirmation,
  isPro, clientId,
}: {
  entrySession: string;
  entryTimeUTC: string;
  entryRationale?: string | null;
  waitForConfirmation?: string | null;
  isPro: boolean;
  clientId: string | null;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  void tick; // triggers re-render every second

  const { secs, isNow, tomorrow } = getCountdownToUTC(entryTimeUTC);
  const sessionActive = isSessionActive(entrySession);

  // Local time label
  const parts = entryTimeUTC.split(":");
  const h = parseInt(parts[0] ?? "0", 10) || 0;
  const m = parseInt(parts[1] ?? "0", 10) || 0;
  const localTime = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), h, m, 0))
    .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" });

  function handleUpgrade() {
    if (!clientId) return;
    fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) })
      .then(r => r.json()).then(d => { if (d.url) window.location.href = d.url; });
  }

  if (!isPro) {
    return (
      <div className="relative rounded-2xl overflow-hidden">
        <div style={{ filter: "blur(4px)", pointerEvents: "none", userSelect: "none" }}>
          <div className="rounded-2xl p-4" style={{ background: "rgba(0,230,118,0.06)", border: "1px solid rgba(0,230,118,0.2)" }}>
            <p className="font-dm-mono text-[10px] uppercase tracking-[0.16em] text-[#00e676] font-semibold mb-2">Optimal Entry Window</p>
            <p className="font-bebas text-[30px] text-white leading-none mb-1">NY OPEN</p>
            <p className="font-dm-mono text-[18px] font-bold text-[#00e676]">Opens in 2h 15m 30s</p>
            <p className="font-dm-mono text-[10px] text-[#6b7280] mt-2">13:30 UTC · 14:30 BST · Wait for close above...</p>
          </div>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-5 gap-2.5 rounded-2xl"
          style={{ backdropFilter: "blur(2px)", background: "rgba(8,10,16,0.78)" }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="2.5" y="9.5" width="17" height="11" rx="2.5" stroke="#00e676" strokeWidth="1.3"/>
            <path d="M7 9.5V7a4 4 0 018 0v2.5" stroke="#00e676" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <p className="text-white font-bold text-sm">Smart Entry Timer — Pro Only</p>
          <p className="text-[#6b7280] text-[11px] leading-snug max-w-[200px]">
            Optimal entry time with live countdown and session awareness
          </p>
          <button onClick={handleUpgrade}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 mt-1"
            style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 16px rgba(0,230,118,0.3)" }}>
            Upgrade to Pro — £19/mo
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.4 }}
      className="rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: isNow ? "rgba(0,230,118,0.09)" : "rgba(0,230,118,0.04)",
        border: isNow ? "1px solid rgba(0,230,118,0.4)" : "1px solid rgba(0,230,118,0.18)",
        boxShadow: isNow ? "0 0 28px rgba(0,230,118,0.14)" : undefined,
      }}>
      {/* Pulse overlay when active */}
      {isNow && (
        <motion.div className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ background: "rgba(0,230,118,0.05)" }} />
      )}

      <div className="flex items-start justify-between mb-2.5">
        <p className="font-dm-mono text-[10px] uppercase tracking-[0.16em] text-[#00e676] font-semibold">
          Optimal Entry Window
        </p>
        {sessionActive && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00e676] animate-pulse" />
            <span className="font-dm-mono text-[9px] text-[#00e676] font-bold uppercase tracking-wider">Active</span>
          </div>
        )}
      </div>

      <div className="mb-3">
        <p className="font-bebas text-[30px] text-white leading-none mb-1">{entrySession.toUpperCase()}</p>
        {isNow ? (
          <motion.p
            className="font-dm-mono text-base font-bold"
            style={{ color: "#00e676" }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>
            ⚡ ENTRY WINDOW NOW OPEN
          </motion.p>
        ) : (
          <p className="font-dm-mono font-bold text-[#d1d5db]" style={{ fontSize: "15px" }}>
            {tomorrow ? "Next window: Tomorrow" : "Opens in"}{" "}
            <span style={{ color: "#00e676" }}>{fmtCountdown(secs)}</span>
          </p>
        )}
      </div>

      <p className="font-dm-mono text-[10px] text-[#6b7280] mb-3">
        <span className="text-[#9ca3af]">{entryTimeUTC} UTC</span>
        {" · "}
        {localTime}
        {tomorrow && (
          <span className="ml-2 px-1.5 py-0.5 rounded text-[9px]"
            style={{ background: "rgba(156,163,175,0.12)", border: "1px solid rgba(156,163,175,0.2)", color: "#9ca3af" }}>
            tomorrow
          </span>
        )}
      </p>

      {entryRationale && (
        <p className="text-[#6b7280] text-xs leading-relaxed mb-2.5">{entryRationale}</p>
      )}

      {waitForConfirmation && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: "rgba(0,230,118,0.05)", border: "1px solid rgba(0,230,118,0.14)" }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="flex-shrink-0 mt-0.5">
            <circle cx="5.5" cy="5.5" r="4.5" stroke="#00e676" strokeWidth="1.1"/>
            <path d="M3.5 5.5l1.5 1.5L8 3.5" stroke="#00e676" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-[#d1d5db] text-xs leading-relaxed">{waitForConfirmation}</p>
        </div>
      )}
    </motion.div>
  );
}

// ── Entry window toast notification ───────────────────────────
function EntryWindowToast({ asset, signal, onClose }: { asset: string | null; signal: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 10_000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
      transition={{ type: "spring", bounce: 0.18 }}
      className="fixed top-20 right-6 z-[300] max-w-[270px] rounded-xl px-4 py-3"
      style={{
        background: "#0c1410",
        border: "1px solid rgba(0,230,118,0.45)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.55), 0 0 20px rgba(0,230,118,0.12)",
      }}>
      <div className="flex items-start gap-2.5">
        <span className="w-2 h-2 rounded-full bg-[#00e676] animate-pulse mt-1 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#00e676] font-bold mb-0.5">
            ⚡ Entry Window Open
          </p>
          <p className="text-[#d1d5db] text-xs leading-snug">
            Entry window now open for your {asset ?? "chart"} {signal} setup
          </p>
        </div>
        <button onClick={onClose} className="flex-shrink-0 text-[#4b5563] hover:text-white transition-colors mt-0.5">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

// ── Pro insights banner (shown after analysis for free users) ──
function FreeWatermark({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.8, duration: 0.4 }}
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid rgba(0,230,118,0.2)", background: "rgba(0,230,118,0.03)" }}>
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <p className="font-dm-mono text-[11px] uppercase tracking-[0.12em] text-[#00e676] font-semibold">
          You are missing 6 Pro insights on this chart
        </p>
      </div>
      {/* Blurred preview of Pro insights */}
      <div className="p-4 space-y-2 select-none" style={{ filter: "blur(3.5px)", pointerEvents: "none" }}>
        {[
          { label: "Fibonacci levels",          value: "0.618 retracement at key supply zone" },
          { label: "Smart Money Concepts",       value: "Bearish order block — institutional supply" },
          { label: "Historical pattern match",   value: "Similar setup +14% — March 2024" },
          { label: "Best session to trade",      value: "NY open 14:30 UTC — peak liquidity" },
          { label: "Detailed 8-line summary",    value: "Full institutional-grade breakdown..." },
          { label: "Personal coaching tip",      value: "Based on your recent journal entries..." },
        ].map((row) => (
          <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-white/[0.04] last:border-0">
            <span className="text-[#6b7280] text-xs">{row.label}</span>
            <span className="font-dm-mono text-xs text-[#00e676]">{row.value}</span>
          </div>
        ))}
      </div>
      <div className="px-4 pb-4">
        <button onClick={onUpgrade}
          className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
          style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 20px rgba(0,230,118,0.3)" }}>
          Unlock all insights — £19/mo
        </button>
      </div>
    </motion.div>
  );
}

// ── Avoid trade banner ─────────────────────────────────────────
function AvoidBanner({ confidence, riskReward, warnings }: { confidence: number; riskReward: string; warnings: string[] }) {
  const rr = parseFloat((riskReward ?? "").match(/1\s*:\s*([\d.]+)/)?.[1] ?? "0");
  const lowRR      = rr > 0 && rr < 1.5;
  const lowConf    = confidence < 45;
  if (!lowRR && !lowConf) return null;

  const reason = lowRR && lowConf
    ? `Confidence is only ${confidence}% and R:R of 1:${rr.toFixed(1)} is below the 1:1.5 minimum.`
    : lowConf
    ? `Confidence is only ${confidence}% — fewer than 2 confluence factors align on this setup.`
    : `Risk/Reward of 1:${rr.toFixed(1)} is below the 1:1.5 minimum required for a trade recommendation.`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.15, duration: 0.35 }}
      className="rounded-2xl p-5 text-center"
      style={{ background: "rgba(239,68,68,0.07)", border: "2px solid rgba(239,68,68,0.35)", boxShadow: "0 0 30px rgba(239,68,68,0.08)" }}>
      <div className="flex items-center justify-center gap-2 mb-2">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8.5" stroke="#ef4444" strokeWidth="1.5"/>
          <path d="M7 7l6 6M13 7l-6 6" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        <p className="font-bebas text-[22px] tracking-[0.08em] text-[#f87171]">AVOID THIS TRADE</p>
      </div>
      <p className="text-[#fca5a5] text-sm leading-relaxed mb-3">{reason}</p>
      {warnings.length > 0 && (
        <div className="space-y-1 text-left">
          {warnings.map((w, i) => (
            <p key={i} className="font-dm-mono text-[11px] text-[#f87171] flex items-start gap-1.5">
              <span className="mt-0.5 flex-shrink-0">⚠</span>{w}
            </p>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Confluence checklist ───────────────────────────────────────
function ConfluerenceChecklist({ checks }: { checks: { label: string; passed: boolean }[] }) {
  if (!checks || checks.length === 0) return null;
  const passed = checks.filter((c) => c.passed).length;
  return (
    <motion.div
      className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.0, duration: 0.4 }}>
      <div className="flex items-center justify-between mb-3">
        <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#6b7280] font-semibold">
          Confluence Checklist
        </p>
        <span className="font-dm-mono text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{
            background: passed >= 4 ? "rgba(0,230,118,0.12)" : passed >= 3 ? "rgba(156,163,175,0.1)" : "rgba(239,68,68,0.1)",
            color:      passed >= 4 ? "#00e676"               : passed >= 3 ? "#9ca3af"               : "#f87171",
            border:     `1px solid ${passed >= 4 ? "rgba(0,230,118,0.3)" : passed >= 3 ? "rgba(156,163,175,0.25)" : "rgba(239,68,68,0.25)"}`,
          }}>
          {passed}/{checks.length} aligned
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {checks.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="flex-shrink-0 text-[13px]">{c.passed ? "✅" : "❌"}</span>
            <span className="font-dm-mono text-[11px]" style={{ color: c.passed ? "#d1d5db" : "#4b5563" }}>
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── 5-point structured summary ─────────────────────────────────
function StructuredSummary({ text, isPro, startDelay = 0 }: { text: string; isPro: boolean; startDelay?: number }) {
  const points = text.split("|").map((s) => s.trim()).filter(Boolean);
  if (points.length < 2) {
    return <WordFade text={text} startDelay={startDelay} />;
  }
  const labels = ["What", "Entry", "Invalidation", "Confirmation", "Risk"];
  const colors = ["#d1d5db", "#4ade80", "#f87171", "#38bdf8", "#9ca3af"];
  return (
    <div className="space-y-2">
      {points.map((pt, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: startDelay + i * 0.12, duration: 0.3 }}
          className="flex items-start gap-2.5">
          <span className="font-dm-mono text-[9px] uppercase tracking-widest font-bold flex-shrink-0 mt-0.5 w-16 text-right"
            style={{ color: colors[i] ?? "#6b7280" }}>
            {labels[i] ?? `${i + 1}`}
          </span>
          <p className="text-[#d1d5db] text-sm leading-relaxed flex-1">{pt}</p>
        </motion.div>
      ))}
    </div>
  );
}

// ── Scan line sweep ────────────────────────────────────────────
function ScanLine({ color }: { color: string }) {
  return (
    <motion.div
      className="absolute left-0 right-0 h-[1px] pointer-events-none"
      style={{
        background: `linear-gradient(90deg, transparent 0%, ${color}60 20%, ${color} 50%, ${color}60 80%, transparent 100%)`,
        boxShadow: `0 0 12px ${color}50`,
        zIndex: 10,
      }}
      initial={{ top: 0, opacity: 0 }}
      animate={{ top: "100%", opacity: [0, 1, 1, 0] }}
      transition={{ delay: 1.8, duration: 1.1, ease: "linear", times: [0, 0.08, 0.92, 1] }}
    />
  );
}

// ── What-if scenarios ──────────────────────────────────────────
function WhatIfScenarios({
  balance, sym, asset, assetType, entryVal, slVal, tp1Val,
}: {
  balance: number; sym: string; asset: string; assetType: CalcAssetType;
  entryVal: number; slVal: number; tp1Val: number;
}) {
  return (
    <div>
      <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#6b7280] font-semibold mb-3">
        What If Scenarios
      </p>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Conservative", riskPct: 0.5, color: "#4ade80" },
          { label: "Standard",     riskPct: 1,   color: "#00e676" },
          { label: "Aggressive",   riskPct: 2,   color: "#9ca3af" },
        ].map((sc) => {
          const riskAmt = balance * sc.riskPct / 100;
          const calc    = doCalc(assetType, riskAmt, entryVal, slVal, tp1Val, asset);
          return (
            <div key={sc.label} className="rounded-xl p-3 text-center"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="font-dm-mono text-[9px] uppercase tracking-wider text-[#6b7280] mb-1.5">{sc.label}</p>
              <p className="font-dm-mono text-[10px] font-bold mb-1.5" style={{ color: sc.color }}>{sc.riskPct}% risk</p>
              <p className="font-dm-mono text-xs font-bold text-white truncate">{calc?.sizeLabel ?? "—"}</p>
              <p className="font-dm-mono text-xs mt-1 text-[#00e676]">+{sym}{(calc?.profit1 ?? 0).toFixed(0)}</p>
              <p className="font-dm-mono text-xs text-[#f87171]">-{sym}{riskAmt.toFixed(0)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Position calculator panel ──────────────────────────────────
function PositionCalculator({
  defaultEntry, defaultSL, defaultTP1, asset, isPro, clientId,
}: {
  defaultEntry: string; defaultSL: string; defaultTP1: string;
  asset: string; isPro: boolean; clientId: string | null;
}) {
  const [balance, setBalance]     = useState("10000");
  const [currency, setCurrency]   = useState<CalcCurrency>("GBP");
  const [riskPct, setRiskPct]     = useState(1);
  const [entryStr, setEntryStr]   = useState(defaultEntry);
  const [slStr, setSlStr]         = useState(defaultSL);
  const [tp1Str, setTp1Str]       = useState(defaultTP1);
  const [assetType, setAssetType] = useState<CalcAssetType>(detectCalcAsset(asset));

  useEffect(() => {
    const b = localStorage.getItem("ciq_calc_balance");
    const c = localStorage.getItem("ciq_calc_currency");
    if (b) setBalance(b);
    if (c) setCurrency(c as CalcCurrency);
  }, []);
  useEffect(() => { localStorage.setItem("ciq_calc_balance", balance); }, [balance]);
  useEffect(() => { localStorage.setItem("ciq_calc_currency", currency); }, [currency]);
  useEffect(() => { setEntryStr(defaultEntry); }, [defaultEntry]);
  useEffect(() => { setSlStr(defaultSL); }, [defaultSL]);
  useEffect(() => { setTp1Str(defaultTP1); }, [defaultTP1]);
  useEffect(() => { setAssetType(detectCalcAsset(asset)); }, [asset]);

  const sym        = CURRENCY_SYMBOLS[currency];
  const balVal     = parseNum(balance);
  const riskAmount = balVal * riskPct / 100;
  const entryVal   = parseNum(entryStr);
  const slVal      = parseNum(slStr);
  const tp1Val     = parseNum(tp1Str);
  const calc       = (balVal > 0 && entryVal > 0 && slVal > 0 && tp1Val > 0)
    ? doCalc(assetType, riskAmount, entryVal, slVal, tp1Val, asset)
    : null;

  const slDist   = Math.abs(entryVal - slVal);
  const tp1Dist  = Math.abs(tp1Val - entryVal);
  const totalD   = slDist + tp1Dist;
  const slBarPct = totalD > 0 ? (slDist / totalD) * 100 : 50;
  const tpBarPct = 100 - slBarPct;

  const inputBase = "w-full px-3 py-2.5 rounded-xl font-dm-mono text-sm text-white focus:outline-none transition-colors";

  function upgradeFn() {
    if (!clientId) return;
    fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) })
      .then((r) => r.json()).then((d) => { if (d.url) window.location.href = d.url; });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="mt-4 p-6 rounded-2xl"
      style={{ background: "#0d1310", border: "1px solid rgba(0,230,118,0.14)" }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h3 className="font-bebas text-[22px] tracking-[0.08em] text-white">POSITION CALCULATOR</h3>
        <div className="flex gap-1.5 flex-wrap">
          {(["forex", "crypto", "stocks", "gold", "futures"] as const).map((t) => (
            <button key={t} onClick={() => setAssetType(t)}
              className="font-dm-mono text-[10px] uppercase px-2.5 py-1.5 rounded-lg border transition-all"
              style={assetType === t
                ? { background: "#00e676", color: "#080a10", borderColor: "#00e676", fontWeight: 700 }
                : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)", color: "#6b7280" }}>
              {t === "gold" ? "XAU" : t}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="col-span-2">
          <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#6b7280] font-semibold mb-1.5">Account Balance</p>
          <div className="flex gap-2">
            <select value={currency} onChange={(e) => setCurrency(e.target.value as CalcCurrency)}
              className="px-2.5 py-2.5 rounded-xl font-dm-mono text-xs font-bold text-[#00e676] focus:outline-none cursor-pointer"
              style={{ background: "rgba(0,230,118,0.08)", border: "1px solid rgba(0,230,118,0.2)" }}>
              {(["GBP", "USD", "EUR"] as const).map((c) => (
                <option key={c} value={c}>{CURRENCY_SYMBOLS[c]} {c}</option>
              ))}
            </select>
            <input type="number" value={balance} onChange={(e) => setBalance(e.target.value)}
              placeholder="10000"
              className={`${inputBase} flex-1 focus:border-[#00e676]/60`}
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
          </div>
        </div>

        <div className="col-span-2">
          <div className="flex justify-between items-center mb-1.5">
            <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#6b7280] font-semibold">Risk %</p>
            <span className="font-dm-mono text-[11px] font-bold text-[#00e676]">{riskPct}% = {sym}{riskAmount.toFixed(0)} at risk</span>
          </div>
          <input type="range" min="0.5" max="5" step="0.5" value={riskPct}
            onChange={(e) => setRiskPct(parseFloat(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: "#00e676" }} />
          <div className="flex justify-between font-dm-mono text-[9px] text-[#4b5563] mt-1">
            {["0.5%","1%","2%","3%","4%","5%"].map((v) => <span key={v}>{v}</span>)}
          </div>
        </div>

        <div>
          <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#6b7280] font-semibold mb-1.5">Entry</p>
          <input type="text" value={entryStr} onChange={(e) => setEntryStr(e.target.value)}
            className={`${inputBase} focus:border-[#00e676]/60`}
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
        </div>

        <div>
          <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#f87171] font-semibold mb-1.5">Stop Loss</p>
          <input type="text" value={slStr} onChange={(e) => setSlStr(e.target.value)}
            className={`${inputBase} focus:border-[#f87171]/60`}
            style={{ background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.14)" }} />
        </div>

        <div className="col-span-2">
          <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#4ade80] font-semibold mb-1.5">Take Profit</p>
          <input type="text" value={tp1Str} onChange={(e) => setTp1Str(e.target.value)}
            className={`${inputBase} focus:border-[#4ade80]/60`}
            style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.14)" }} />
        </div>
      </div>

      {/* Results */}
      {calc ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4 text-center"
              style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)" }}>
              <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#f87171] font-semibold mb-1">Max Loss</p>
              <p className="font-dm-mono text-[26px] font-bold text-[#f87171] leading-none">{sym}{riskAmount.toFixed(2)}</p>
              <p className="font-dm-mono text-[10px] text-[#4b5563] mt-1">{riskPct}% of balance</p>
            </div>
            <div className="rounded-2xl p-4 text-center"
              style={{ background: "rgba(0,230,118,0.06)", border: "1px solid rgba(0,230,118,0.15)" }}>
              <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#00e676] font-semibold mb-1">Potential Profit</p>
              <p className="font-dm-mono text-[26px] font-bold text-[#00e676] leading-none">{sym}{calc.profit1.toFixed(2)}</p>
              <p className="font-dm-mono text-[10px] text-[#4b5563] mt-1">RR 1:{calc.rr1.toFixed(2)}</p>
            </div>
          </div>

          {assetType === "futures" && calc.spec ? (
            <div className="space-y-3">
              {/* Contract spec badge */}
              <div className="rounded-xl p-3 flex items-center justify-between"
                style={{ background: "rgba(0,230,118,0.06)", border: "1px solid rgba(0,230,118,0.15)" }}>
                <div>
                  <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#00e676] mb-0.5">Contract</p>
                  <p className="font-dm-mono text-sm font-bold text-white">{calc.spec.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] mb-0.5">{calc.spec.exchange}</p>
                  <p className="font-dm-mono text-xs text-[#9ca3af]">Tick ${calc.spec.tickValue} / {calc.spec.tickSize}pt</p>
                </div>
              </div>
              {/* Breakdown grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Points at Risk",   val: calc.pointsAtRisk?.toFixed(2) ?? "—" },
                  { label: "Ticks at Risk",    val: calc.ticksAtRisk?.toFixed(0) ?? "—" },
                  { label: "$/Contract Risk",  val: `$${calc.dollarRiskPerContract?.toFixed(2) ?? "—"}` },
                  { label: "Contracts",        val: String(calc.contracts ?? "—") },
                  { label: "Margin Required",  val: `${sym}${calc.marginRequired.toFixed(0)}` },
                  { label: "$ Profit at TP",   val: `$${calc.profit1.toFixed(0)}` },
                ].map(({ label, val }) => (
                  <div key={label} className="rounded-xl p-3"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] mb-1">{label}</p>
                    <p className="font-dm-mono text-sm font-bold text-white">{val}</p>
                  </div>
                ))}
              </div>
              {/* Micro alternative */}
              {calc.microContracts !== undefined && calc.spec.microSymbol && (
                <div className="rounded-xl p-3"
                  style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)" }}>
                  <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#60a5fa] mb-1">Micro Alternative ({calc.spec.microSymbol})</p>
                  <p className="font-dm-mono text-sm font-bold text-white">{calc.microContracts} micro contract{calc.microContracts !== 1 ? "s" : ""}</p>
                  <p className="font-dm-mono text-[10px] text-[#9ca3af] mt-0.5">~${calc.microDollarRisk?.toFixed(0)} risk</p>
                </div>
              )}
              {/* Margin warning */}
              {calc.marginRequired / balVal > 0.5 && (
                <div className="rounded-xl p-3"
                  style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
                  <p className="font-dm-mono text-[10px] text-[#fbbf24]">⚠ Margin is {((calc.marginRequired / balVal) * 100).toFixed(0)}% of account — consider reducing size</p>
                </div>
              )}
            </div>
          ) : (
            <div className={`grid gap-3 ${assetType === "forex" ? "grid-cols-3" : "grid-cols-2"}`}>
              <div className="rounded-xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] mb-1">Position Size</p>
                <p className="font-dm-mono text-sm font-bold text-white">{calc.sizeLabel}</p>
              </div>
              {assetType === "forex" && calc.slPips !== undefined && (
                <div className="rounded-xl p-3 text-center"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] mb-1">SL Pips</p>
                  <p className="font-dm-mono text-sm font-bold text-white">{calc.slPips.toFixed(0)}</p>
                </div>
              )}
              <div className="rounded-xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] mb-1">Margin Est.</p>
                <p className="font-dm-mono text-sm font-bold text-white">{sym}{calc.marginRequired.toFixed(0)}</p>
              </div>
            </div>
          )}

          <div>
            <div className="flex justify-between font-dm-mono text-[10px] mb-1.5">
              <span className="text-[#f87171]">Risk {slBarPct.toFixed(0)}%</span>
              <span className="text-[#6b7280]">Risk vs Reward</span>
              <span className="text-[#00e676]">Reward {tpBarPct.toFixed(0)}%</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden flex">
              <div className="h-full" style={{ width: `${slBarPct}%`, background: "linear-gradient(90deg, #dc2626, #f87171)" }} />
              <div className="h-full" style={{ width: `${tpBarPct}%`, background: "linear-gradient(90deg, #4ade80, #00e676)" }} />
            </div>
          </div>

          {isPro ? (
            <WhatIfScenarios balance={balVal} sym={sym} asset={asset} assetType={assetType}
              entryVal={entryVal} slVal={slVal} tp1Val={tp1Val} />
          ) : (
            <div className="relative rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-4"
                style={{ backdropFilter: "blur(6px)", background: "rgba(8,10,16,0.75)" }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="mb-2">
                  <rect x="2.5" y="9.5" width="17" height="11" rx="2.5" stroke="#00e676" strokeWidth="1.3"/>
                  <path d="M7 9.5V7a4 4 0 018 0v2.5" stroke="#00e676" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                <p className="text-white text-xs font-bold mb-1">Pro Feature</p>
                <p className="text-[#6b7280] text-[11px] mb-3">Upgrade to unlock What If scenarios</p>
                <button onClick={upgradeFn}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:-translate-y-0.5"
                  style={{ background: "#00e676", color: "#080a10" }}>
                  Upgrade to Pro
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 p-4 pointer-events-none select-none" style={{ filter: "blur(4px)" }}>
                {["Conservative","Standard","Aggressive"].map((s) => (
                  <div key={s} className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.025)" }}>
                    <p className="font-dm-mono text-[9px] text-[#6b7280] mb-1">{s}</p>
                    <p className="font-dm-mono text-sm font-bold text-white">0.12 lots</p>
                    <p className="font-dm-mono text-xs text-[#00e676]">+{sym}480</p>
                    <p className="font-dm-mono text-xs text-[#f87171]">-{sym}100</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/[0.07] p-6 text-center">
          <p className="font-dm-mono text-[#4b5563] text-xs">Enter entry, stop loss and take profit to see your position size</p>
        </div>
      )}
    </motion.div>
  );
}

// ── Follow-up chat ─────────────────────────────────────────────
function ChatBox({ journalId, analysisJson, chartBase64, chartMime, clientId, isPro }: {
  journalId: string | null;
  analysisJson: unknown;
  chartBase64: string | null;
  chartMime: string;
  clientId: string | null;
  isPro: boolean;
}) {
  const [messages, setMessages]       = useState<ChatMsg[]>([]);
  const [input, setInput]             = useState("");
  const [streaming, setStreaming]     = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [limitReached, setLimitReached]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    setInput("");

    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setStreaming(true);
    setStreamingText("");

    const isFirst = messages.length === 0;
    const chatHistory = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          analysisJson,
          imageBase64: isFirst ? chartBase64 : null,
          imageMime:   isFirst ? chartMime   : null,
          chatHistory,
          clientId,
          journalId,
        }),
      });

      if (res.status === 429) {
        setLimitReached(true);
        setStreaming(false);
        return;
      }

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          if (raw === "[DONE]") break;
          try {
            const { text: t } = JSON.parse(raw);
            if (t) { full += t; setStreamingText(full); }
          } catch { /* skip */ }
        }
      }

      if (full) {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: full }]);
      }
    } catch (err) {
      console.error("[chat]", err);
    } finally {
      setStreaming(false);
      setStreamingText("");
    }
  }

  const assistantCount = messages.filter((m) => m.role === "assistant").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="mt-6 card-dark p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-white">Ask a Follow-up Question</h3>
          <p className="text-[#6b7280] text-xs mt-0.5">Chat with AI about this specific chart</p>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="#00e676" strokeWidth="1.2"/>
            <path d="M4 6l1.5 1.5L8 4" stroke="#00e676" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="font-dm-mono text-[10px] font-semibold" style={{ color: "#00e676" }}>Powered by Claude AI</span>
        </div>
      </div>

      {/* Messages */}
      {messages.length > 0 && (
        <div className="mb-4 space-y-3 max-h-72 overflow-y-auto pr-1">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                style={m.role === "user"
                  ? { background: "#00e676", color: "#080a10", fontWeight: 600 }
                  : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#d1d5db" }}
              >
                {m.content}
              </div>
            </div>
          ))}
          {streaming && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#d1d5db" }}>
                {streamingText
                  ? <>{streamingText}<span className="inline-block w-[3px] h-[14px] bg-[#00e676] ml-0.5 rounded-sm" style={{ animation: "pulse 1s ease infinite" }} /></>
                  : <span className="flex gap-1.5 items-center py-0.5">{[0,1,2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#4b5563] animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</span>
                }
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Quick chips — shown only before first message */}
      {messages.length === 0 && !limitReached && (
        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_CHIPS.map((chip) => (
            <button key={chip} onClick={() => send(chip)}
              className="text-xs px-3 py-1.5 rounded-full border border-white/[0.10] bg-white/[0.03] text-[#9ca3af] hover:border-[#00e676]/40 hover:text-white transition-all duration-150">
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Limit gate */}
      {limitReached && (
        <div className="mb-4 rounded-xl border border-[#00e676]/20 bg-[#00e676]/[0.06] p-4 text-center">
          <p className="text-white text-sm font-bold mb-1">Upgrade to Pro for unlimited chat</p>
          <p className="text-[#6b7280] text-xs mb-3">Free users get 1 AI response per analysis.</p>
          <button
            onClick={() => clientId && fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) }).then((r) => r.json()).then((d) => { if (d.url) window.location.href = d.url; })}
            className="px-5 py-2 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
            style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 18px rgba(0,230,118,0.28)" }}>
            Upgrade to Pro — £19/mo
          </button>
        </div>
      )}

      {/* Input row */}
      {!limitReached && (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask about this chart…"
            disabled={streaming}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-[#4b5563] focus:outline-none focus:border-[#00e676]/60 transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || streaming}
            className="px-4 py-2.5 rounded-xl font-bold transition-all duration-150 disabled:opacity-40 flex items-center justify-center"
            style={{ background: "#00e676", color: "#080a10", minWidth: "44px" }}>
            {streaming
              ? <span className="w-4 h-4 rounded-full border-2 border-[#080a10]/25 border-t-[#080a10] animate-spin-btn" />
              : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8h12M10 4l4 4-4 4" stroke="#080a10" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
          </button>
        </div>
      )}

      {/* Free tier note */}
      {!isPro && !limitReached && assistantCount === 0 && (
        <p className="text-[#4b5563] text-[11px] mt-2 text-center">
          Free: 1 AI response per analysis ·{" "}
          <button
            onClick={() => clientId && fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) }).then((r) => r.json()).then((d) => { if (d.url) window.location.href = d.url; })}
            className="text-[#00e676] hover:underline">
            Upgrade for unlimited
          </button>
        </p>
      )}
    </motion.div>
  );
}

// ── Welcome modal (shows once per device to non-logged-in users) ──
function WelcomeModal({ onClose }: { onClose: () => void }) {
  function pick(plan: "free" | "trial") {
    localStorage.setItem("ciq_presignup_plan", plan);
    onClose();
    window.location.href = "/signup";
  }

  const freeFeatures  = ["5 analyses to get started", "Basic signal + entry/SL/TP", "Confidence score", "Risk calculator"];
  const trialFeatures = ["Unlimited analyses for 7 days", "All Pro features unlocked", "SMC analysis & confluences", "Journal, watchlist, calendar"];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-2xl rounded-2xl p-7 overflow-hidden"
        style={{ background: "#0a0d14", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>

        {/* Close */}
        <button onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-[#4b5563] hover:text-white hover:bg-white/[0.06] transition-all">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-7">
          <h2 className="font-bebas text-[clamp(36px,5vw,52px)] leading-none tracking-[0.04em] text-white mb-2">
            CHOOSE HOW TO START
          </h2>
          <p className="text-[#6b7280] text-sm">No credit card required · Upgrade or change anytime</p>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 gap-4">

          {/* Free card */}
          <div className="rounded-xl p-5 flex flex-col"
            style={{ background: "#0c0f18", border: "1px solid rgba(255,255,255,0.07)" }}>
            <span className="font-dm-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full self-start mb-3"
              style={{ background: "rgba(255,255,255,0.06)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.09)" }}>
              FREE
            </span>
            <div className="text-2xl mb-2">🎯</div>
            <h3 className="font-bold text-white text-base mb-1">Start Free</h3>
            <p className="text-[#6b7280] text-xs mb-4">No time limit, get started now</p>
            <ul className="space-y-1.5 mb-5 flex-1">
              {freeFeatures.map(f => (
                <li key={f} className="flex items-center gap-2 text-xs text-[#9ca3af]">
                  <span className="text-[#00e676] flex-shrink-0">✓</span>{f}
                </li>
              ))}
            </ul>
            <button onClick={() => pick("free")}
              className="w-full py-3 rounded-xl text-sm font-bold border transition-all hover:bg-white/[0.06] hover:text-white"
              style={{ borderColor: "rgba(255,255,255,0.13)", color: "#9ca3af" }}>
              Start free
            </button>
          </div>

          {/* Pro Trial card */}
          <div className="rounded-xl p-5 flex flex-col relative overflow-hidden"
            style={{ background: "linear-gradient(135deg,#0c1810,#0a1a12)", border: "1px solid rgba(0,230,118,0.35)", boxShadow: "0 0 30px rgba(0,230,118,0.08)" }}>
            <div className="absolute top-0 right-0 w-28 h-28 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle,rgba(0,230,118,0.09) 0%,transparent 70%)" }} />
            <span className="font-dm-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full self-start mb-3"
              style={{ background: "rgba(0,230,118,0.15)", color: "#00e676", border: "1px solid rgba(0,230,118,0.3)" }}>
              RECOMMENDED
            </span>
            <div className="text-2xl mb-2">⚡</div>
            <h3 className="font-bold text-white text-base mb-1">Try Pro Free</h3>
            <p className="text-[#9ca3af] text-xs mb-4">Full Pro access, no card needed</p>
            <ul className="space-y-1.5 mb-5 flex-1">
              {trialFeatures.map(f => (
                <li key={f} className="flex items-center gap-2 text-xs text-[#d1d5db]">
                  <span className="text-[#00e676] flex-shrink-0">✓</span>{f}
                </li>
              ))}
            </ul>
            <button onClick={() => pick("trial")}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
              style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 18px rgba(0,230,118,0.35)" }}>
              Start 7-day trial →
            </button>
            <p className="text-center font-dm-mono text-[9px] text-[#4b5563] mt-1.5">No credit card required</p>
          </div>
        </div>

        <p className="text-center text-[#374151] text-[10px] mt-5">
          Join 2,400+ traders · 7-day trial then £19/mo · Cancel anytime
        </p>
      </motion.div>
    </div>
  );
}

// ── Sticky top trial banner (non-logged-in only) ──────────────
function TrialTopBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="relative z-40 flex items-center justify-center gap-3 py-2.5 px-6"
      style={{ background: "#00e676" }}>
      <a href="/signup" className="flex items-center gap-2 flex-1 justify-center">
        <span className="text-sm font-bold text-[#080a10]">
          🚀 Start your 7 day free Pro trial — no card needed
        </span>
        <span className="hidden sm:inline font-bold text-[#080a10] text-xs px-3 py-1 rounded-lg"
          style={{ background: "rgba(0,0,0,0.12)" }}>
          Start free →
        </span>
      </a>
      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(); }}
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors"
        aria-label="Dismiss">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 2l8 8M10 2L2 10" stroke="#080a10" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

// ── Mobile floating bottom bar (non-logged-in only) ───────────
function MobileTrialBar() {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 p-3 pb-[max(12px,env(safe-area-inset-bottom))]"
      style={{ background: "linear-gradient(to top, #080a10 60%, transparent)" }}>
      <a href="/signup"
        className="block w-full py-4 rounded-xl text-sm font-bold text-center transition-all active:scale-[0.98]"
        style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 24px rgba(0,230,118,0.5)" }}>
        Start free 7 day trial →
      </a>
    </div>
  );
}

// ── Live activity feed (bottom-left) ──────────────────────────
const LIVE_NOTIFICATIONS = [
  { text: "James from London just upgraded to Pro ↑", upgrade: true },
  { text: "Sarah just analysed EUR/USD — LONG 87% confidence", upgrade: false },
  { text: "Mike from Dubai just upgraded to Pro ↑", upgrade: true },
  { text: "Alex just analysed BTC/USD — SHORT 91% confidence", upgrade: false },
  { text: "Emma from Sydney just upgraded to Pro ↑", upgrade: true },
  { text: "Trading group of 12 just joined on Team plan", upgrade: true },
];

function LiveActivityFeed() {
  const [idx, setIdx]             = useState(0);
  const [visible, setVisible]     = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible || dismissed) return;
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % LIVE_NOTIFICATIONS.length);
        setVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(t);
  }, [visible, dismissed]);

  if (dismissed || !visible) return null;

  const item = LIVE_NOTIFICATIONS[idx];
  return (
    <motion.div
      key={idx}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.35 }}
      className="fixed bottom-6 left-6 z-40 max-w-[265px]"
    >
      <div className="relative rounded-xl px-4 py-3 pr-8"
        style={{
          background: "#0c0f18",
          border: `1px solid ${item.upgrade ? "rgba(0,230,118,0.25)" : "rgba(255,255,255,0.09)"}`,
          boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
        }}>
        <div className="flex items-start gap-2">
          <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
            style={{ background: item.upgrade ? "#00e676" : "#6b7280" }} />
          <p className="font-dm-mono text-[10px] leading-snug"
            style={{ color: item.upgrade ? "#00e676" : "#9ca3af" }}>
            {item.text}
          </p>
        </div>
        <button onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 text-[#374151] hover:text-[#9ca3af] transition-colors">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

// ── Exit intent popup ──────────────────────────────────────────
function ExitIntentPopup({ onClose }: { onClose: () => void }) {
  const [email, setEmail]       = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    try {
      await fetch("/api/exit-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch { /* silent */ }
    setSubmitted(true);
    setTimeout(onClose, 2500);
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(4,6,10,0.9)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.22, duration: 0.45 }}
        className="w-full max-w-sm rounded-2xl p-8 text-center"
        style={{ background: "#080c0a", border: "1px solid rgba(0,230,118,0.25)", boxShadow: "0 0 60px rgba(0,230,118,0.07)" }}>
        <div className="text-[40px] mb-3">⚡</div>
        <h2 className="font-bebas text-[30px] leading-none tracking-[0.04em] text-white mb-2">
          WAIT — GET 3 MORE FREE ANALYSES
        </h2>
        <p className="text-[#6b7280] text-sm mb-6 leading-relaxed">
          Enter your email and we&apos;ll send you a full Pro trial — no card needed.
        </p>
        {submitted ? (
          <p className="text-[#00e676] font-semibold text-sm py-4">Sent! Check your inbox.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com" required
              className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white text-sm placeholder-[#4b5563] focus:outline-none focus:border-[#00e676]/60 transition-colors" />
            <button type="submit"
              className="w-full py-3.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
              style={{ background: "#00e676", color: "#080c0a" }}>
              Send me 5 free analyses →
            </button>
          </form>
        )}
        <button onClick={onClose} className="mt-4 text-[#4b5563] text-xs hover:text-[#9ca3af] transition-colors">
          No thanks, I&apos;ll pass
        </button>
      </motion.div>
    </div>
  );
}

// ── Demo Pro analysis modal ────────────────────────────────────
function DemoProAnalysis({
  onBack, onUpgrade, checkoutLoading,
}: {
  onBack: () => void;
  onUpgrade: () => void;
  checkoutLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(4,6,10,0.96)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
        className="w-full max-w-sm rounded-2xl my-4"
        style={{ background: "#080c0a", border: "1px solid rgba(0,230,118,0.25)", boxShadow: "0 0 60px rgba(0,230,118,0.08)", position: "relative", overflow: "hidden" }}>
        {/* DEMO watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 0 }}>
          <p className="font-bebas text-[90px] tracking-[0.2em] select-none" style={{ color: "rgba(255,255,255,0.025)" }}>DEMO</p>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]" style={{ position: "relative", zIndex: 1 }}>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-dm-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: "rgba(0,230,118,0.15)", color: "#00e676", border: "1px solid rgba(0,230,118,0.3)" }}>
                PRO DEMO
              </span>
              <span className="font-dm-mono text-[9px] text-[#4b5563]">example only</span>
            </div>
            <p className="font-bebas text-xl text-white tracking-[0.04em]">XAU/USD · 4H</p>
          </div>
          <button onClick={onBack} className="text-[#4b5563] hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto" style={{ position: "relative", zIndex: 1 }}>
          {/* Signal */}
          <div className="rounded-2xl border p-4 flex items-center justify-between"
            style={{ borderColor: "rgba(248,113,113,0.35)", background: "rgba(248,113,113,0.07)" }}>
            <div>
              <p className="text-[#6b7280] text-[10px] uppercase tracking-[0.12em] mb-1">Bias · Grade A+</p>
              <p className="text-2xl font-extrabold text-[#f87171]">BEARISH</p>
            </div>
            <div className="text-right">
              <p className="text-[#6b7280] text-[10px] uppercase tracking-[0.12em] mb-1">Confidence</p>
              <p className="font-bebas text-[44px] text-[#f87171] leading-none">89%</p>
            </div>
          </div>

          {/* Trade setup */}
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
            <p className="text-[#6b7280] text-[10px] font-semibold uppercase tracking-[0.12em] mb-3">Trade Setup · Confirmed Short</p>
            {[
              { label: "Entry",         value: "3,298",  color: "white" },
              { label: "Stop Loss",     value: "3,315",  color: "#f87171" },
              { label: "Take Profit",   value: "3,256",  color: "#4ade80" },
              { label: "Risk / Reward", value: "1:2.47", color: "#c084fc" },
            ].map((row) => (
              <div key={row.label} className="flex justify-between items-center py-2.5 border-b border-white/[0.04] last:border-0">
                <span className="text-[#6b7280] text-sm">{row.label}</span>
                <span className="font-dm-mono text-sm font-semibold" style={{ color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Pro insights */}
          <div className="rounded-2xl border border-[#00e676]/20 bg-[#00e676]/[0.03] p-4">
            <p className="font-dm-mono text-[10px] uppercase tracking-[0.15em] text-[#00e676] font-semibold mb-3">
              6 Pro Insights — hidden on free plan
            </p>
            <div className="space-y-2.5">
              {[
                { icon: "📐", label: "Fibonacci",    value: "Key retracement at 61.8% — 3,285 level. Price rejected precisely at this zone." },
                { icon: "💡", label: "Smart Money",  value: "Bearish order block at 3,302 — strong institutional supply zone with 3 clean touches." },
                { icon: "📊", label: "Pattern",      value: "Head and shoulders confirmed — measured move to 3,256 with high probability." },
                { icon: "🕐", label: "Best Session", value: "NY open 14:30 UTC — highest liquidity window for XAU/USD short entries." },
                { icon: "📋", label: "Pro Summary",  value: "Gold showing exhaustion at multi-week resistance. H&S neckline break below 3,290 confirms bearish momentum. RSI divergence aligns. Target: 3,256." },
                { icon: "🎯", label: "Coaching Tip", value: "You tend to enter too early — wait for the 5m close below 3,290 before entering. Your last 3 SHORT entries were premature." },
              ].map((item) => (
                <div key={item.label} className="rounded-xl p-3"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="font-dm-mono text-[9px] font-bold text-[#00e676] uppercase tracking-wider mb-1">
                    {item.icon} {item.label}
                  </p>
                  <p className="text-[#9ca3af] text-xs leading-relaxed">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button onClick={onUpgrade} disabled={checkoutLoading}
            className="w-full py-4 rounded-xl text-base font-bold transition-all hover:-translate-y-0.5 disabled:opacity-60"
            style={{ background: "#00e676", color: "#080c0a", boxShadow: "0 0 28px rgba(0,230,118,0.3)" }}>
            {checkoutLoading ? "Redirecting…" : "Get Pro — 64p/day"}
          </button>
          <button onClick={onBack} className="w-full text-center text-[#4b5563] text-xs hover:text-[#9ca3af] transition-colors py-1">
            ← Back
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── SMC tooltip definitions ────────────────────────────────────
const SMC_TIPS: Record<string, string> = {
  fvg:    "Fair Value Gap — a price imbalance where the market moved too fast, leaving a gap. Price frequently returns to fill these zones.",
  ob:     "Order Block — the last candle before a strong institutional move. Banks and funds leave unfilled orders here; price often reacts when it returns.",
  sweep:  "Liquidity Sweep — price briefly breaks a key level to trigger retail stop-losses, then immediately reverses. A classic sign smart money is entering.",
  bos:    "Break of Structure — a confirmed break of the previous swing high (bullish) or low (bearish), signalling the trend has shifted.",
  choch:  "Change of Character — the first sign a trend may be reversing, before it is fully confirmed. Higher risk, earlier entry signal.",
  eqh:    "Equal Highs — two or more highs at the same price. A liquidity pool of stop-losses above, likely to be swept before a reversal.",
  eql:    "Equal Lows — two or more lows at the same price. A liquidity pool below waiting to be swept before a potential bounce.",
  zone:   "Premium zone = top 25% of the range (institutions prefer selling here). Discount zone = bottom 25% (institutions prefer buying here).",
  pattern:"A classical chart pattern with a measured-move price target based on the pattern height.",
  fib:    "Fibonacci retracement — key levels (38.2%, 50%, 61.8%, 78.6%) where price often pauses or reverses after a swing move.",
};

function SMCTooltip({ tipKey }: { tipKey: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex flex-shrink-0"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <button
        className="w-3.5 h-3.5 rounded-full flex items-center justify-center font-dm-mono text-[8px] font-bold"
        style={{ background: "rgba(156,163,175,0.15)", border: "1px solid rgba(156,163,175,0.2)", color: "#6b7280" }}>
        ?
      </button>
      {show && (
        <div className="absolute z-50 bottom-full mb-2 w-52 rounded-xl px-3 py-2.5 text-xs leading-relaxed pointer-events-none"
          style={{
            left: "50%", transform: "translateX(-50%)",
            background: "#0c0f18", border: "1px solid rgba(0,230,118,0.3)",
            color: "#d1d5db", boxShadow: "0 4px 24px rgba(0,0,0,0.65)",
          }}>
          {SMC_TIPS[tipKey] ?? ""}
          <div className="absolute top-full" style={{ left: "50%", marginLeft: "-5px", borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid rgba(0,230,118,0.3)" }} />
        </div>
      )}
    </div>
  );
}

function SMCCard({
  badge, badgeColor, badgeBg, badgeBorder,
  priceRange, status, description, tipKey,
}: {
  badge: string; badgeColor: string; badgeBg: string; badgeBorder: string;
  priceRange?: string; status?: string; description?: string; tipKey?: string;
}) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-dm-mono text-[9px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: badgeBg, border: `1px solid ${badgeBorder}`, color: badgeColor }}>
            {badge}
          </span>
          {priceRange && (
            <span className="font-dm-mono text-[10px] font-semibold text-[#d1d5db]">{priceRange}</span>
          )}
        </div>
        {tipKey && <SMCTooltip tipKey={tipKey} />}
      </div>
      {status      && <p className="font-dm-mono text-[10px] text-[#9ca3af] mb-1">{status}</p>}
      {description && <p className="text-[#6b7280] text-[11px] leading-relaxed">{description}</p>}
    </div>
  );
}

function SMCSection({
  a, isPro, clientId,
}: {
  a: AnalysisResult; isPro: boolean; clientId: string | null;
}) {
  function upgrade() {
    if (!clientId) return;
    fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) })
      .then(r => r.json()).then(d => { if (d.url) window.location.href = d.url; });
  }

  const fvg     = a.fvg             ?? [];
  const sweeps  = a.liquiditySweeps ?? [];
  const obs     = a.orderBlocks     ?? [];
  const sb      = a.structureBreaks ?? [];
  const eq      = a.equalLevels     ?? [];
  const pats    = a.patterns        ?? [];
  const fibs    = a.smcFibonacci    ?? [];

  const totalSMC = fvg.length + sweeps.length + obs.length + sb.length + eq.length;
  const hasAny   = totalSMC > 0 || pats.length > 0 || fibs.length > 0 || !!a.smc_summary;
  if (!hasAny) return null;

  const strength      = totalSMC >= 4 ? "STRONG SMC SETUP" : totalSMC >= 2 ? "MODERATE SMC" : "WEAK SMC";
  const strengthColor = totalSMC >= 4 ? "#00e676" : totalSMC >= 2 ? "#f59e0b" : "#f87171";
  const strengthBg    = totalSMC >= 4 ? "rgba(0,230,118,0.1)" : totalSMC >= 2 ? "rgba(245,158,11,0.1)" : "rgba(248,113,113,0.1)";
  const strengthBdr   = totalSMC >= 4 ? "rgba(0,230,118,0.3)" : totalSMC >= 2 ? "rgba(245,158,11,0.3)" : "rgba(248,113,113,0.3)";

  // Free: first FVG as teaser, rest locked
  const visibleFVG = isPro ? fvg : fvg.slice(0, 1);
  const hasLocked  = !isPro && (fvg.length > 1 || sweeps.length > 0 || obs.length > 0 || sb.length > 0 || eq.length > 0 || pats.length > 0 || fibs.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.55, duration: 0.4 }}
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid rgba(0,230,118,0.2)", background: "rgba(0,230,118,0.02)" }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.05]">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <p className="font-dm-mono text-[11px] font-bold uppercase tracking-[0.15em] text-[#00e676]">
              Smart Money Confluences
            </p>
            {!isPro && (
              <span className="font-dm-mono text-[9px] px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(0,230,118,0.1)", border: "1px solid rgba(0,230,118,0.25)", color: "#00e676" }}>
                PRO
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-dm-mono text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: strengthBg, border: `1px solid ${strengthBdr}`, color: strengthColor }}>
              {strength}
            </span>
            {totalSMC > 0 && (
              <span className="font-dm-mono text-[9px] text-[#4b5563]">{totalSMC} confluence{totalSMC !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>

        {/* SMC bias summary */}
        {a.smc_summary && (
          <div className="rounded-xl px-3 py-2.5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] font-bold mb-1">SMC Bias</p>
            <p className="text-[#d1d5db] text-xs leading-relaxed">{a.smc_summary}</p>
          </div>
        )}

        {/* Market zone pill */}
        {isPro && a.marketZone && a.marketZone !== "neutral" && (
          <div className="flex items-center gap-2 mt-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
              style={{
                background: a.marketZone === "premium" ? "rgba(248,113,113,0.08)" : "rgba(0,230,118,0.08)",
                border: `1px solid ${a.marketZone === "premium" ? "rgba(248,113,113,0.25)" : "rgba(0,230,118,0.25)"}`,
              }}>
              <span className="font-dm-mono text-[9px] font-bold uppercase tracking-wider"
                style={{ color: a.marketZone === "premium" ? "#f87171" : "#00e676" }}>
                {a.marketZone === "premium" ? "PREMIUM ZONE" : "DISCOUNT ZONE"}
              </span>
              <span className="font-dm-mono text-[9px] text-[#6b7280]">
                — {a.marketZone === "premium" ? "shorts preferred" : "longs preferred"}
              </span>
            </div>
            <SMCTooltip tipKey="zone" />
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="p-4 space-y-2">

        {/* FVGs — free users see first one */}
        {visibleFVG.map((f, i) => {
          const bull = f.type?.toLowerCase().includes("bull");
          return (
            <SMCCard key={i}
              badge={bull ? "BULLISH FVG" : "BEARISH FVG"}
              badgeColor={bull ? "#00e676" : "#f87171"}
              badgeBg={bull ? "rgba(0,230,118,0.1)" : "rgba(248,113,113,0.1)"}
              badgeBorder={bull ? "rgba(0,230,118,0.3)" : "rgba(248,113,113,0.3)"}
              priceRange={f.priceRange}
              status={f.filled ? "Filled" : "Unfilled — potential price magnet"}
              description={f.description}
              tipKey="fvg"
            />
          );
        })}

        {/* Locked overlay for free users */}
        {hasLocked && (
          <div className="relative rounded-xl overflow-hidden">
            <div style={{ filter: "blur(4px)", pointerEvents: "none", userSelect: "none" }} className="space-y-2">
              {obs.slice(0, 1).map((o, i) => {
                const bull = o.type?.toLowerCase().includes("bull");
                return (
                  <SMCCard key={i}
                    badge={bull ? "BULLISH ORDER BLOCK" : "BEARISH ORDER BLOCK"}
                    badgeColor={bull ? "#00e676" : "#f87171"}
                    badgeBg={bull ? "rgba(0,230,118,0.1)" : "rgba(248,113,113,0.1)"}
                    badgeBorder={bull ? "rgba(0,230,118,0.3)" : "rgba(248,113,113,0.3)"}
                    priceRange={o.priceRange} description={o.description}
                  />
                );
              })}
              {sweeps.slice(0, 1).map((s, i) => (
                <SMCCard key={i}
                  badge="LIQUIDITY SWEEP" badgeColor="#fbbf24"
                  badgeBg="rgba(251,191,36,0.1)" badgeBorder="rgba(251,191,36,0.3)"
                  priceRange={s.price} description={s.description}
                />
              ))}
              {sb.slice(0, 1).map((s, i) => (
                <SMCCard key={i}
                  badge="BOS / CHoCH" badgeColor="#9ca3af"
                  badgeBg="rgba(156,163,175,0.1)" badgeBorder="rgba(156,163,175,0.3)"
                  priceRange={s.price} description={s.description}
                />
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-5 rounded-xl"
              style={{ background: "rgba(8,10,16,0.82)" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2.5" y="8" width="13" height="9" rx="2" stroke="#00e676" strokeWidth="1.2"/>
                <path d="M5.5 8V6a3.5 3.5 0 017 0v2" stroke="#00e676" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <p className="text-white text-xs font-bold">Pro — Full SMC Analysis</p>
              <p className="text-[#6b7280] text-[10px] leading-snug max-w-[190px]">
                Order blocks, liquidity sweeps, BOS/CHoCH, equal highs/lows, patterns and Fibonacci
              </p>
              <button onClick={upgrade}
                className="mt-1 px-4 py-1.5 rounded-xl text-[11px] font-bold transition-all hover:-translate-y-0.5"
                style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 14px rgba(0,230,118,0.28)" }}>
                Upgrade to Pro
              </button>
            </div>
          </div>
        )}

        {/* Pro-only cards */}
        {isPro && (
          <>
            {obs.map((o, i) => {
              const bull = o.type?.toLowerCase().includes("bull");
              return (
                <SMCCard key={i}
                  badge={bull ? "BULLISH ORDER BLOCK" : "BEARISH ORDER BLOCK"}
                  badgeColor={bull ? "#00e676" : "#f87171"}
                  badgeBg={bull ? "rgba(0,230,118,0.1)" : "rgba(248,113,113,0.1)"}
                  badgeBorder={bull ? "rgba(0,230,118,0.3)" : "rgba(248,113,113,0.3)"}
                  priceRange={o.priceRange} description={o.description} tipKey="ob"
                />
              );
            })}
            {sweeps.map((s, i) => (
              <SMCCard key={i}
                badge="LIQUIDITY SWEEP" badgeColor="#fbbf24"
                badgeBg="rgba(251,191,36,0.1)" badgeBorder="rgba(251,191,36,0.3)"
                priceRange={s.price} description={s.description} tipKey="sweep"
              />
            ))}
            {sb.map((s, i) => {
              const isBOS  = s.type?.toUpperCase().includes("BOS");
              const isBull = s.type?.toLowerCase().includes("bull") || s.type?.toLowerCase().includes("high");
              const color  = isBull ? "#00e676" : isBOS ? "#f87171" : "#f59e0b";
              const label  = s.type?.toUpperCase().includes("CHOCH") ? "CHOCH DETECTED" : isBull ? "BOS BULLISH" : "BOS BEARISH";
              return (
                <SMCCard key={i} badge={label} badgeColor={color}
                  badgeBg={`${color}18`} badgeBorder={`${color}40`}
                  priceRange={s.price} description={s.description}
                  tipKey={isBOS ? "bos" : "choch"}
                />
              );
            })}
            {eq.map((e, i) => {
              const isHigh = e.type?.toLowerCase().includes("high");
              return (
                <SMCCard key={i}
                  badge={isHigh ? "EQUAL HIGHS" : "EQUAL LOWS"}
                  badgeColor={isHigh ? "#f87171" : "#00e676"}
                  badgeBg={isHigh ? "rgba(248,113,113,0.1)" : "rgba(0,230,118,0.1)"}
                  badgeBorder={isHigh ? "rgba(248,113,113,0.3)" : "rgba(0,230,118,0.3)"}
                  priceRange={e.price} description={e.description}
                  tipKey={isHigh ? "eqh" : "eql"}
                />
              );
            })}
            {pats.map((p, i) => (
              <SMCCard key={i}
                badge={p.name?.toUpperCase() ?? "PATTERN"}
                badgeColor="#38bdf8" badgeBg="rgba(56,189,248,0.1)" badgeBorder="rgba(56,189,248,0.3)"
                priceRange={p.target ? `Target: ${p.target}` : undefined}
                description={p.description} tipKey="pattern"
              />
            ))}
            {fibs.length > 0 && (
              <div className="rounded-xl p-3" style={{ background: "rgba(192,132,252,0.05)", border: "1px solid rgba(192,132,252,0.18)" }}>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className="font-dm-mono text-[9px] uppercase tracking-widest font-bold text-[#c084fc]">
                    Fibonacci Levels
                  </span>
                  <SMCTooltip tipKey="fib" />
                </div>
                <div className="space-y-1.5">
                  {fibs.map((f, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="font-dm-mono text-[10px] font-bold text-[#c084fc] w-10 flex-shrink-0">{f.level}</span>
                      <span className="font-dm-mono text-[10px] text-[#d1d5db] flex-shrink-0">{f.price}</span>
                      <span className="font-dm-mono text-[9px] text-[#6b7280] truncate">{f.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Most shared setups this week ──────────────────────────────
function MostSharedSetups() {
  const [setups, setSetups] = useState<{ asset: string; signal: string; count: number }[]>([]);

  useEffect(() => {
    fetch("/api/shares")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.setups)) setSetups(d.setups); })
      .catch(() => {});
  }, []);

  if (setups.length === 0) return null;

  return (
    <section className="py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8" data-animate>
          <SectionBadge>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="7.5" cy="2" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
              <circle cx="2" cy="5" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
              <circle cx="7.5" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
              <path d="M3.4 4.4l2.8-1.8M3.4 5.6l2.8 1.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            Most Shared This Week
          </SectionBadge>
          <h2 className="font-bebas text-[clamp(32px,4vw,52px)] leading-none tracking-[0.03em] text-white mt-2">
            TOP SETUPS TRADERS ARE SHARING
          </h2>
          <p className="text-[#6b7280] text-base mt-3 max-w-lg mx-auto">
            The chart setups your fellow traders found most compelling this week
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {setups.map((s, i) => {
            const sigColor = s.signal === "LONG" ? "#00e676" : s.signal === "SHORT" ? "#f87171" : "#9ca3af";
            const sigBg    = s.signal === "LONG" ? "rgba(0,230,118,0.1)" : s.signal === "SHORT" ? "rgba(248,113,113,0.1)" : "rgba(156,163,175,0.1)";
            const rank     = ["🥇", "🥈", "🥉"][i] ?? "";
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.35 }}
                className="rounded-2xl px-5 py-4 flex items-center gap-4"
                style={{ background: "#0c0f18", border: "1px solid rgba(255,255,255,0.07)", minWidth: "220px" }}
              >
                <span className="text-2xl">{rank}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bebas text-xl text-white leading-none tracking-wide">{s.asset}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-dm-mono text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: sigBg, color: sigColor, border: `1px solid ${sigColor}40` }}>
                      {s.signal}
                    </span>
                    <span className="font-dm-mono text-[10px] text-[#4b5563]">{s.count} share{s.count !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Main app ───────────────────────────────────────────────────
export default function App() {
  const [file, setFile]             = useState<File | null>(null);
  const [preview, setPreview]       = useState<string | null>(null);
  const [asset, setAsset]           = useState("");
  const [selectedTF, setSelectedTF] = useState("1H");
  const [htfBias, setHtfBias]       = useState<"BULLISH" | "BEARISH" | "UNKNOWN">("UNKNOWN");
  const [activeTab, setActiveTab]   = useState<"current" | "higher" | "highest">("current");
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<MultiResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [revealKey, setRevealKey]           = useState(0);
  const [showLimitModal, setShowLimitModal]   = useState(false);
  const [freeUsed, setFreeUsed]               = useState(0);
  const FREE_LIMIT = 5;
  const [clientId, setClientId]               = useState<string | null>(null);
  const [showExitIntent, setShowExitIntent]       = useState(false);
  const [exitIntentFired, setExitIntentFired]     = useState(false);
  const [showAnnualPricing, setShowAnnualPricing] = useState(false);
  const [showWelcome, setShowWelcome]             = useState(false);
  const [showTopBanner, setShowTopBanner]         = useState(false);
  const [welcomePlan, setWelcomePlan]             = useState<"free" | "trial" | null>(null);
  const { plan, isPro: isPlanPro, isElite } = useUserPlan();
  const { user, loading: authLoading } = useAuth();
  const isPro = isPlanPro;
  const { awardXP, recordActivity, completeChallenge } = useGamification();
  const fileRef       = useRef<HTMLInputElement>(null);
  const resultsRef    = useRef<HTMLDivElement>(null);
  const [chartBase64, setChartBase64]   = useState<string | null>(null);
  const [chartMime, setChartMime]       = useState("image/png");
  const [journalId, setJournalId]       = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalEvent[]>([]);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showEntryToast, setShowEntryToast] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCount, setShareCount]         = useState<number | null>(null);
  const [tvUrl, setTvUrl]                   = useState("");
  const [tvImporting, setTvImporting]       = useState(false);
  const [tvUrlError, setTvUrlError]         = useState<string | null>(null);

  // ── Multi-chart state ──────────────────────────────────────
  const mRef0 = useRef<HTMLInputElement>(null);
  const mRef1 = useRef<HTMLInputElement>(null);
  const mRef2 = useRef<HTMLInputElement>(null);
  const mRef3 = useRef<HTMLInputElement>(null);
  const mRef4 = useRef<HTMLInputElement>(null);
  const mRef5 = useRef<HTMLInputElement>(null);
  const [multiFiles, setMultiFiles]           = useState<(File | null)[]>([null, null, null, null, null, null]);
  const [multiLabels, setMultiLabels]         = useState(["XAU/USD", "BTC/USD", "EUR/USD", "NAS100", "AAPL", "Chart 6"]);
  const [multiLoading, setMultiLoading]       = useState(false);
  const [multiResult, setMultiResult]         = useState<null | { individual: Record<string, unknown>[]; combined: Record<string, unknown> }>(null);

  // Init client identity + usage from localStorage
  useEffect(() => {
    // Ensure client ID exists
    let id = localStorage.getItem("ciq_client_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("ciq_client_id", id);
    }
    setClientId(id);

    // Lifetime usage counter (cached locally, server is source of truth)
    const storedUsed = localStorage.getItem("ciq_free_used");
    if (storedUsed !== null) setFreeUsed(parseInt(storedUsed, 10));

    // Pre-fill asset from URL param (?asset=BTC/USD)
    const params = new URLSearchParams(window.location.search);
    const preAsset = params.get("asset");
    if (preAsset) setAsset(decodeURIComponent(preAsset));

    const welcome = params.get("welcome");
    if (welcome === "free" || welcome === "trial") {
      setWelcomePlan(welcome);
      localStorage.removeItem("ciq_signup_plan");
      // Strip the param from the URL without a reload
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Fetch economic calendar (background, non-blocking)
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.events)) setCalendarEvents(d.events); })
      .catch(() => {});

  }, []);

  // Scroll-reveal
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); } }),
      { threshold: 0.1, rootMargin: "0px 0px -48px 0px" }
    );
    document.querySelectorAll("[data-animate]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Welcome modal — fires once per device for non-logged-in visitors
  useEffect(() => {
    if (authLoading) return; // wait for auth to settle
    if (user) return;        // already logged in
    if (localStorage.getItem("ciq_welcome_shown")) return;
    // Delay slightly so the page has rendered first
    const t = setTimeout(() => {
      setShowWelcome(true);
      setShowTopBanner(true);
      localStorage.setItem("ciq_welcome_shown", "true");
    }, 1200);
    return () => clearTimeout(t);
  }, [authLoading, user]);

  // Top banner — show for non-logged-in users (persists until dismissed)
  useEffect(() => {
    if (authLoading) return;
    if (user) return;
    if (!localStorage.getItem("ciq_banner_dismissed")) {
      setShowTopBanner(true);
    }
  }, [authLoading, user]);

  // Exit intent — fires once for free users when mouse leaves top of viewport
  useEffect(() => {
    if (isPro || exitIntentFired) return;
    const handler = (e: MouseEvent) => {
      if (e.clientY <= 0 && !exitIntentFired) {
        setExitIntentFired(true);
        setShowExitIntent(true);
      }
    };
    document.addEventListener("mouseleave", handler);
    return () => document.removeEventListener("mouseleave", handler);
  }, [isPro, exitIntentFired]);

  function pickFile(f: File) {
    setFile(f);
    setResult(null);
    setError(null);
    setJournalId(null);
    setChartBase64(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setChartBase64(dataUrl.split(",")[1]);
      setChartMime(f.type || "image/png");
    };
    reader.readAsDataURL(f);
  }

  function clearFile() {
    setFile(null);
    setResult(null);
    setError(null);
    setJournalId(null);
    setChartBase64(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("image/")) pickFile(f);
  }

  async function handleTVImport() {
    const url = tvUrl.trim();
    if (!url) return;
    setTvImporting(true);
    setTvUrlError(null);
    try {
      const res = await fetch(`/api/tradingview/snapshot?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error("Could not fetch image from URL");
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) throw new Error("URL does not point to an image");
      const fakeName = "tradingview-chart.png";
      const f = new File([blob], fakeName, { type: blob.type });
      pickFile(f);
      setTvUrl("");
    } catch (err) {
      setTvUrlError(err instanceof Error ? err.message : "Import failed");
    }
    setTvImporting(false);
  }

  async function handleAnalyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setJournalId(null);
    setActiveTab("current");
    setShowCalculator(false);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    fd.append("timeframe", selectedTF);
    fd.append("htf_bias", htfBias);
    if (asset.trim())  fd.append("asset", asset.trim());
    if (clientId)      fd.append("client_id", clientId);

    // Client-side 90 s abort so the spinner never runs forever
    const controller = new AbortController();
    const clientTimeout = setTimeout(() => controller.abort(), 90_000);

    try {
      const res  = await fetch("/api/analyze", { method: "POST", body: fd, signal: controller.signal });
      clearTimeout(clientTimeout);
      const data = await res.json();

      if (res.status === 429) {
        const used = data.used ?? FREE_LIMIT;
        setFreeUsed(used);
        localStorage.setItem("ciq_free_used", String(used));
        setShowLimitModal(true);
        return;
      }

      if (data.success && data.analyses) {
        setResult({ analyses: data.analyses, tfLabels: data.tfLabels, confluence: data.confluence });
        setJournalId(data.journalId ?? null);
        setRevealKey(k => k + 1);
        // ── Gamification ──────────────────────────────────────
        recordActivity();
        const curAnalysis = data.analyses.current;
        const grade      = curAnalysis.tradeScore ?? "";
        const confidence = curAnalysis.confidence ?? 0;
        const isMultiTf  = !!(data.analyses.higher && data.analyses.highest);
        awardXP("ANALYSIS_RUN", { grade, confidence, asset: asset.trim() || undefined, isMultiTf });
        if (grade === "A+")        awardXP("A_PLUS_GRADE");
        if (confidence >= 85)      awardXP("HIGH_CONFIDENCE");
        completeChallenge("analyses");
        if (confidence >= 80)      completeChallenge("confidence");
        if (asset.trim())          completeChallenge("assets");
        // ─────────────────────────────────────────────────────
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
        // Toast when entry window is open right now
        if (isPro && data.analyses.current.entryTimeUTC) {
          const { isNow } = getCountdownToUTC(data.analyses.current.entryTimeUTC);
          if (isNow) setShowEntryToast(true);
        }
        if (!data.usage?.isPro && data.usage?.used != null) {
          setFreeUsed(data.usage.used);
          localStorage.setItem("ciq_free_used", String(data.usage.used));
        }
        // Fetch share count for this setup (non-blocking)
        const a = asset.trim();
        const sig = data.analyses.current.bias === "BULLISH" ? "LONG" : data.analyses.current.bias === "BEARISH" ? "SHORT" : "NEUTRAL";
        if (a && sig) {
          fetch(`/api/shares?asset=${encodeURIComponent(a)}&signal=${sig}`)
            .then(r => r.json())
            .then(d => { if (d.count != null) setShareCount(d.count); })
            .catch(() => {});
        }
      } else {
        setError(data.error || "Analysis failed — please try again.");
      }
    } catch (err: unknown) {
      clearTimeout(clientTimeout);
      const isAbort = err instanceof Error && err.name === "AbortError";
      setError(isAbort
        ? "Analysis timed out — the AI is busy. Please try again in a moment."
        : "Network error — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const cur       = result?.analyses.current;
  const biasColor =
    cur?.bias === "BULLISH" ? "#00e676" :
    cur?.bias === "BEARISH" ? "#f87171" :
    "#9ca3af";

  return (
    <div className="min-h-screen bg-[#080a10] text-white overflow-x-hidden">

      {/* ── SIGNUP WELCOME BANNER ───────────────────────────── */}
      {welcomePlan && (
        <div className="fixed top-[88px] left-0 right-0 z-[45] flex justify-center px-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
            className="pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl"
            style={{
              background: welcomePlan === "trial" ? "rgba(0,230,118,0.1)" : "rgba(255,255,255,0.06)",
              border: welcomePlan === "trial" ? "1px solid rgba(0,230,118,0.3)" : "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
            }}
          >
            <span className="text-lg">{welcomePlan === "trial" ? "⚡" : "🎯"}</span>
            <p className="font-dm-mono text-[12px] font-semibold" style={{ color: welcomePlan === "trial" ? "#00e676" : "#e5e7eb" }}>
              {welcomePlan === "trial"
                ? "Pro trial activated! 7 days of unlimited access starts now."
                : "Welcome! You have 5 free analyses to get started."}
            </p>
            <button onClick={() => setWelcomePlan(null)} className="text-[#4b5563] hover:text-white transition-colors ml-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </motion.div>
        </div>
      )}

      {/* ── WELCOME MODAL ───────────────────────────────────── */}
      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}

      {/* ── TRIAL TOP BANNER ────────────────────────────────── */}
      {!user && !isPro && showTopBanner && (
        <TrialTopBanner onDismiss={() => { setShowTopBanner(false); localStorage.setItem("ciq_banner_dismissed", "true"); }} />
      )}

      {/* ── DAILY LIMIT MODAL ───────────────────────────────── */}
      {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} clientId={clientId} />}

      {/* ── EXIT INTENT POPUP ───────────────────────────────── */}
      {showExitIntent && <ExitIntentPopup onClose={() => setShowExitIntent(false)} />}

      {/* ── ENTRY WINDOW TOAST ──────────────────────────────── */}
      {showEntryToast && (
        <EntryWindowToast
          asset={asset || null}
          signal={cur?.bias === "BULLISH" ? "LONG" : cur?.bias === "BEARISH" ? "SHORT" : "NEUTRAL"}
          onClose={() => setShowEntryToast(false)}
        />
      )}

      {/* ── SHARE MODAL ─────────────────────────────────────── */}
      {showShareModal && cur && (
        <ShareModal
          params={{
            asset: asset || null,
            timeframe: result?.tfLabels.current ?? "",
            signal: cur.bias === "BULLISH" ? "LONG" : cur.bias === "BEARISH" ? "SHORT" : "NEUTRAL",
            grade: cur.tradeScore ?? "B",
            entry: cur.tradeSetup?.entry ?? "N/A",
            stopLoss: cur.tradeSetup?.stopLoss ?? "N/A",
            takeProfit: cur.tradeSetup?.takeProfit1 ?? "N/A",
            riskReward: cur.tradeSetup?.riskReward ?? "N/A",
            confidence: cur.confidence,
            summary: cur.summary ?? "",
            chartBase64: chartBase64,
            chartMime: chartMime,
            isPro,
          } satisfies ShareCardParams}
          onClose={() => setShowShareModal(false)}
          onShare={(platform) => {
            // Record share in Supabase (fire-and-forget)
            const sig = cur.bias === "BULLISH" ? "LONG" : cur.bias === "BEARISH" ? "SHORT" : "NEUTRAL";
            fetch("/api/shares", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ asset: asset || null, signal: sig, platform }),
            }).then(r => r.json()).then(d => {
              if (d.success) setShareCount(c => (c ?? 0) + 1);
            }).catch(() => {});
          }}
        />
      )}

      {/* ── LIVE ACTIVITY FEED ──────────────────────────────── */}
      <LiveActivityFeed />

      {/* ── MOBILE TRIAL BAR (non-logged-in) ────────────────── */}
      {!user && !isPro && <MobileTrialBar />}

      {/* ── NAV ─────────────────────────────────────────────── */}
      <AppNav />

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="relative pt-36 pb-24 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 hero-glow pointer-events-none"
          style={{ width: "1000px", height: "560px", background: "radial-gradient(ellipse at center top, rgba(0,230,118,0.1) 0%, rgba(124,58,237,0.1) 40%, transparent 70%)" }} />

        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left — copy */}
            <div>
              <div className="animate-fade-up">
                <SectionBadge>
                  <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse-dot" />
                  AI-Powered Chart Analysis
                </SectionBadge>
              </div>
              <h1 className="animate-fade-up delay-100 font-bebas text-[clamp(52px,7vw,84px)] leading-[0.93] tracking-[0.02em] text-white mb-6">
                THE SMARTEST WAY<br />TO READ ANY<br /><span className="text-[#00e676]">CHART</span>
              </h1>
              <p className="animate-fade-up delay-200 text-[#9ca3af] text-lg mb-8 max-w-lg leading-relaxed">
                Drop a screenshot. Get your entry, stop loss, take profit, confidence score, and full AI trade breakdown in seconds. For stocks, crypto, forex, and futures.
              </p>
              <div className="animate-fade-up delay-300 flex flex-wrap gap-3 mb-10">
                <a href="#analyze" className="btn-yellow px-7 py-3.5 text-sm flex items-center gap-2">⚡ Start free — no card needed</a>
                <a href="#how-it-works" className="btn-outline px-7 py-3.5 text-sm flex items-center gap-2">See it in action →</a>
              </div>
              <div className="animate-fade-up delay-400 flex flex-wrap gap-8">
                {[{ value: "2,400+", label: "Active traders" }, { value: "<5s", label: "Analysis speed" }, { value: "5", label: "Free analyses" }].map((s) => (
                  <div key={s.label}>
                    <div className="font-bebas text-[32px] text-[#00e676] leading-none">{s.value}</div>
                    <div className="text-[#6b7280] text-xs tracking-wide mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — floating trade card */}
            <div className="animate-fade-up delay-200 relative flex justify-center lg:justify-end">
              <div className="relative w-full max-w-sm">
                <div className="absolute inset-0 rounded-3xl pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(0,230,118,0.18) 0%, transparent 70%)" }} />
                <div className="relative rounded-2xl border border-[#00e676]/20 p-6"
                  style={{ background: "#0c1410", boxShadow: "0 0 60px rgba(0,230,118,0.08), 0 24px 64px rgba(0,0,0,0.5)" }}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className="font-dm-mono text-[10px] uppercase tracking-widest text-[#6b7280] mb-0.5">AI Analysis</p>
                      <p className="font-bebas text-xl tracking-wide text-white">BTC/USD · 4H</p>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl font-dm-mono text-xs font-bold"
                      style={{ background: "rgba(0,230,118,0.12)", color: "#00e676", border: "1px solid rgba(0,230,118,0.25)" }}>
                      LONG
                    </div>
                  </div>
                  <div className="rounded-xl overflow-hidden mb-5" style={{ background: "rgba(0,230,118,0.04)", border: "1px solid rgba(0,230,118,0.1)", height: "72px" }}>
                    <svg viewBox="0 0 280 72" width="100%" height="72" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00e676" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#00e676" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M0 60 L40 52 L80 48 L100 54 L130 38 L160 30 L200 22 L240 14 L280 8 L280 72 L0 72"
                        fill="url(#chartGrad)" opacity="0.3" />
                      <path d="M0 60 L40 52 L80 48 L100 54 L130 38 L160 30 L200 22 L240 14 L280 8"
                        fill="none" stroke="#00e676" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="space-y-2.5 mb-5">
                    {[
                      { label: "Entry",         value: "$67,420", color: "white" },
                      { label: "Stop Loss",      value: "$65,800", color: "#f87171" },
                      { label: "Take Profit",    value: "$71,200", color: "#4ade80" },
                      { label: "Risk / Reward",  value: "1:2.3",   color: "#c084fc" },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between items-center">
                        <span className="text-[#6b7280] text-xs">{row.label}</span>
                        <span className="font-dm-mono text-xs font-semibold" style={{ color: row.color }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl p-3 flex items-center justify-between"
                    style={{ background: "rgba(0,230,118,0.06)", border: "1px solid rgba(0,230,118,0.15)" }}>
                    <span className="font-dm-mono text-[10px] uppercase tracking-widest text-[#6b7280]">Confidence</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded-full overflow-hidden bg-white/10">
                        <div className="h-full rounded-full bg-[#00e676]" style={{ width: "84%" }} />
                      </div>
                      <span className="font-dm-mono text-sm font-bold text-[#00e676]">84%</span>
                    </div>
                  </div>
                </div>
                <div className="absolute -top-3 -right-3 px-3 py-1.5 rounded-xl font-dm-mono text-[10px] font-bold"
                  style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 20px rgba(0,230,118,0.5)" }}>
                  STRONG SETUP
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ────────────────────────────────── */}
      <div className="border-y border-white/[0.05] bg-white/[0.01] py-5 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-dm-mono text-[11px] uppercase tracking-[0.15em] text-[#6b7280] text-center md:text-left whitespace-nowrap">
            Join 2,400+ traders already using ChartIQ
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {["TradingView", "Binance", "MT4", "MT5", "FXReplay", "Interactive Brokers"].map((p, i) => (
              <span key={p} className="font-dm-mono text-[11px] font-semibold tracking-wider text-[#4b5563] hover:text-[#9ca3af] transition-colors cursor-default flex items-center gap-2">
                {i > 0 && <span className="text-white/10">·</span>}
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── ANALYZE ─────────────────────────────────────────── */}
      <section id="analyze" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14" data-animate>
            <SectionBadge>⚡ AI-Powered Analysis</SectionBadge>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Analyze Your Chart <span className="text-[#00e676]">Instantly</span>
            </h2>
            <p className="text-[#6b7280] mt-4 text-lg max-w-lg mx-auto leading-relaxed">
              Upload any trading chart and get institutional-grade insights in under 10 seconds.
            </p>
          </div>

          {/* ── Economic calendar strip ── */}
          <CalendarStrip events={calendarEvents} />

          {/* ── Gamification bar (logged-in users) ── */}
          {(user || isPro) && (
            <>
              <GamificationBar />
              <WelcomeQuest />
              <DailyChallenges />
            </>
          )}

          <div className="grid md:grid-cols-2 gap-6">

            {/* ── Upload card ── */}
            <div className="card-dark p-7" data-animate data-delay="1">
              <div className="mb-5">
                <h3 className="text-lg font-bold text-white">Upload Your Chart</h3>
                <p className="text-[#6b7280] text-sm mt-0.5">Drag & drop or click to select</p>
              </div>

              <TimeframeSelector value={selectedTF} onChange={setSelectedTF} />

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => !file && fileRef.current?.click()}
                className={[
                  "rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200",
                  file ? "cursor-default" : "cursor-pointer",
                  isDragging ? "border-[#00e676] bg-[#00e676]/[0.07] scale-[1.01]"
                             : "border-white/[0.09] hover:border-white/20 hover:bg-white/[0.02]",
                ].join(" ")}
              >
                {preview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={preview} alt="Chart preview" className="max-h-52 mx-auto rounded-xl object-contain" />
                ) : (
                  <>
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-[#00e676]/10 border border-[#00e676]/20 flex items-center justify-center mb-3">
                      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                        <rect x="2" y="4" width="22" height="18" rx="3" stroke="#00e676" strokeWidth="1.4" />
                        <path d="M2 9.5h22" stroke="#00e676" strokeWidth="1.4" />
                        <circle cx="6" cy="7" r="1.1" fill="#00e676" />
                        <circle cx="9.5" cy="7" r="1.1" fill="#00e676" />
                        <path d="M6 18l4-5 3.5 3 4.5-6 3 4" stroke="#00e676" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="text-white font-semibold mb-1">Drop your chart image here</p>
                    <p className="text-[#4b5563] text-sm">PNG, JPG — TradingView, MT4/5, NinjaTrader, Tradovate, Sierra Chart</p>
                  </>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
              </div>

              {file && (
                <div className="mt-3 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                  <div className="w-7 h-7 rounded-lg bg-[#00e676]/15 flex items-center justify-center flex-shrink-0">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <rect x="1" y="1" width="11" height="11" rx="2" stroke="#00e676" strokeWidth="1.2" />
                      <path d="M3 5h7M3 7.5h5" stroke="#00e676" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{file.name}</p>
                    <p className="text-[#6b7280] text-[11px]">{formatBytes(file.size)}</p>
                  </div>
                  <button onClick={clearFile}
                    className="w-6 h-6 rounded-md bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition-colors flex-shrink-0"
                    title="Remove file">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 2l6 6M8 2L2 8" stroke="#9ca3af" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              )}

              {!file && (
                <button onClick={() => fileRef.current?.click()}
                  className="btn-purple w-full py-3 mt-3 text-sm flex items-center justify-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <path d="M7.5 2v9M4.5 5l3-3 3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2.5 13h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                  </svg>
                  Browse Files
                </button>
              )}

              {/* TradingView snapshot import */}
              <div className="mt-3 rounded-xl border border-white/[0.07] p-3"
                style={{ background: "rgba(33,150,243,0.04)" }}>
                <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em] text-[#42a5f5] mb-2">
                  Or import TradingView chart
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={tvUrl}
                    onChange={(e) => setTvUrl(e.target.value)}
                    placeholder="Paste TradingView snapshot URL (.png)"
                    className="flex-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-white text-[11px] font-dm-mono placeholder-[#4b5563] focus:outline-none focus:border-[#42a5f5]/40 transition-colors"
                  />
                  <button
                    onClick={handleTVImport}
                    disabled={!tvUrl.trim() || tvImporting}
                    className="px-3 py-2 rounded-xl text-[11px] font-bold flex-shrink-0 transition-all hover:-translate-y-0.5 disabled:opacity-40"
                    style={{ background: "rgba(33,150,243,0.15)", color: "#42a5f5", border: "1px solid rgba(33,150,243,0.25)" }}>
                    {tvImporting ? "…" : "Import"}
                  </button>
                </div>
                {tvUrlError && <p className="text-[#f87171] text-[10px] mt-1.5 font-dm-mono">{tvUrlError}</p>}
                <p className="text-[#4b5563] text-[10px] mt-1.5 font-dm-mono leading-relaxed">
                  In TradingView: camera icon → Copy link → paste here
                </p>
              </div>

              <input
                type="text"
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                placeholder="Asset (e.g. BTC/USD, EUR/USD, AAPL) — optional"
                className="w-full mt-3 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-[#4b5563] focus:outline-none focus:border-[#00e676]/60 transition-colors"
              />

              {/* ── HTF Bias ──────────────────────────────────── */}
              <div className="mt-4 rounded-xl border border-white/[0.07] p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
                <p className="font-dm-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280] mb-3">What is the higher timeframe trend?</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["BULLISH", "BEARISH", "UNKNOWN"] as const).map((b) => {
                    const active = htfBias === b;
                    const activeStyle = b === "BULLISH"
                      ? { background: "rgba(0,230,118,0.14)", color: "#00e676", border: "1px solid rgba(0,230,118,0.35)" }
                      : b === "BEARISH"
                      ? { background: "rgba(248,113,113,0.14)", color: "#f87171", border: "1px solid rgba(248,113,113,0.35)" }
                      : { background: "rgba(156,163,175,0.1)", color: "#9ca3af", border: "1px solid rgba(156,163,175,0.3)" };
                    const idleStyle = { background: "transparent", color: "#4b5563", border: "1px solid rgba(255,255,255,0.07)" };
                    return (
                      <button key={b} type="button" onClick={() => setHtfBias(b)}
                        className="py-2.5 rounded-xl font-dm-mono text-xs font-bold transition-all duration-150 hover:opacity-90"
                        style={active ? activeStyle : idleStyle}>
                        {b === "BULLISH" ? "↑ Bullish" : b === "BEARISH" ? "↓ Bearish" : "? Unknown"}
                      </button>
                    );
                  })}
                </div>
                {htfBias !== "UNKNOWN" && (
                  <p className="font-dm-mono text-[10px] mt-2.5 text-center" style={{ color: htfBias === "BULLISH" ? "rgba(0,230,118,0.6)" : "rgba(248,113,113,0.6)" }}>
                    {htfBias === "BULLISH" ? "Only LONG setups will be prioritised" : "Only SHORT setups will be prioritised"}
                  </p>
                )}
              </div>

              {/* Free usage progress bar */}
              {!isPro && (
                <div className="mt-3 rounded-xl border border-white/[0.06] px-4 py-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-dm-mono text-[10px] text-[#6b7280]">
                      {freeUsed >= FREE_LIMIT
                        ? "Free analyses used up — upgrade to continue"
                        : freeUsed >= FREE_LIMIT - 1
                        ? "1 free analysis remaining"
                        : freeUsed >= FREE_LIMIT - 2
                        ? "Using up fast — upgrade for unlimited"
                        : `${freeUsed} of ${FREE_LIMIT} free analyses used`}
                    </span>
                    <span className="font-dm-mono text-[10px]" style={{ color: freeUsed >= FREE_LIMIT ? "#ef4444" : freeUsed >= FREE_LIMIT - 2 ? "#f87171" : "#6b7280" }}>
                      {freeUsed}/{FREE_LIMIT}
                    </span>
                  </div>
                  <div className="w-full h-[5px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (freeUsed / FREE_LIMIT) * 100)}%`,
                        background: freeUsed >= FREE_LIMIT ? "#ef4444" : freeUsed >= FREE_LIMIT - 2 ? "#f87171" : "#00e676",
                        boxShadow: freeUsed >= FREE_LIMIT ? "0 0 6px rgba(239,68,68,0.5)" : freeUsed >= FREE_LIMIT - 2 ? "0 0 5px rgba(248,113,113,0.4)" : "0 0 6px rgba(0,230,118,0.4)",
                      }} />
                  </div>
                </div>
              )}

              <button onClick={handleAnalyze} disabled={!file || loading}
                className="btn-yellow w-full py-3.5 mt-3 text-sm flex items-center justify-center gap-2">
                {loading ? (
                  <><span className="w-4 h-4 rounded-full border-2 border-[#080a10]/25 border-t-[#080a10] animate-spin-btn" />Analysing chart…</>
                ) : "⚡ Analyze My Chart"}
              </button>

              {error && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <circle cx="6.5" cy="6.5" r="5.5" stroke="#f87171" strokeWidth="1.2" />
                      <path d="M6.5 4v3M6.5 9v.5" stroke="#f87171" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-red-400 text-sm font-medium">Analysis failed</p>
                    <p className="text-red-400/70 text-xs mt-0.5">{error}</p>
                  </div>
                  <button onClick={handleAnalyze}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-semibold transition-colors">
                    Retry
                  </button>
                </div>
              )}

              <ul className="mt-5 space-y-2.5">
                {["Pattern recognition & identification", "Support & resistance level detection",
                  "Trend direction & momentum analysis", "Trade setup recommendations"].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#6b7280]">
                    <Check />{f}
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Results card ── */}
            <div ref={resultsRef} className={`card-dark p-7 relative overflow-hidden transition-all duration-500 ${isPro && result ? "ring-1 ring-[#00e676]/30" : ""}`}
              style={isPro && result ? { boxShadow: "0 0 40px rgba(0,230,118,0.08), 0 0 80px rgba(0,230,118,0.04)" } : {}}>
              {isPro && result && <ProParticles color={biasColor} />}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-white">Analysis Results</h3>
                  <p className="text-[#6b7280] text-sm mt-0.5">
                    {result ? `${cur?.bias} · ${result.tfLabels.current} · ${cur?.confidence}% confidence` : "Your AI-powered insights will appear here"}
                  </p>
                  {result && shareCount != null && shareCount > 0 && (
                    <p className="font-dm-mono text-[10px] text-[#4b5563] mt-0.5">
                      <span className="text-[#00e676]">{shareCount}</span> trader{shareCount !== 1 ? "s" : ""} shared this setup this week
                    </p>
                  )}
                </div>
                {result && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setShowShareModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 hover:-translate-y-0.5"
                      style={{ background: "rgba(0,230,118,0.1)", border: "1px solid rgba(0,230,118,0.3)", color: "#00e676" }}>
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <circle cx="8.5" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                        <circle cx="2.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                        <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                        <path d="M4 4.8l3-1.8M4 6.2l3 1.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                      </svg>
                      Share
                    </button>
                    <button onClick={clearFile}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[#9ca3af] hover:text-white text-xs font-medium transition-all duration-150 flex-shrink-0">
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M10 5.5A4.5 4.5 0 111 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        <path d="M10 2.5V5.5H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      New
                    </button>
                  </div>
                )}
              </div>

              {/* Empty state */}
              {!result && !loading && (
                <div className="rounded-2xl border border-dashed border-white/[0.08] flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-3">
                    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                      <rect x="5" y="2" width="16" height="22" rx="3" stroke="#374151" strokeWidth="1.4" />
                      <path d="M9 8h8M9 12h8M9 16h5" stroke="#374151" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-[#4b5563] text-sm font-medium mb-1">Upload a chart to see your analysis</p>
                  <p className="text-[#374151] text-xs">Entry · Stop Loss · Take Profit · Risk/Reward</p>
                </div>
              )}

              {/* Scanning loader */}
              {loading && <ScanningLoader />}

              {/* ── Multi-timeframe results ── */}
              {result && (
                <motion.div key={revealKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>

                  {/* News warning: high-impact event within 2h for this pair */}
                  {asset && <NewsWarningBanner events={calendarEvents} asset={asset} />}

                  {/* Confluence badge */}
                  <motion.div
                    className="rounded-xl border p-3 mb-4 flex items-center justify-between"
                    style={{ borderColor: `${result.confluence.color}30`, background: `${result.confluence.color}0d` }}
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                  >
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-0.5" style={{ color: result.confluence.color }}>
                        Timeframe Confluence
                      </p>
                      <p className="text-white text-sm font-semibold">{result.confluence.label}</p>
                    </div>
                    <span className="font-dm-mono text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: `${result.confluence.color}18`, color: result.confluence.color, border: `1px solid ${result.confluence.color}30` }}>
                      {result.confluence.detail}
                    </span>
                  </motion.div>

                  {/* Tabs */}
                  <div className="flex gap-1 mb-4 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    {(["current", "higher", "highest"] as const).map((tab) => {
                      const tf    = result.tfLabels[tab];
                      const bias  = result.analyses[tab]?.bias;
                      const bc    = bias === "BULLISH" ? "#00e676" : bias === "BEARISH" ? "#f87171" : "#9ca3af";
                      const label = tab === "current" ? tf : tab === "higher" ? `${tf} ctx` : `${tf} bias`;
                      const isActive = activeTab === tab;
                      const isLocked = !isPro && tab !== "current";
                      return (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold font-dm-mono transition-all duration-150"
                          style={isActive ? { background: "#00e676", color: "#080a10" }
                                          : { background: "transparent", color: "#6b7280" }}>
                          {isLocked && (
                            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                              <rect x="1.5" y="4" width="6" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.1"/>
                              <path d="M3 4V2.8a1.5 1.5 0 013 0V4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                            </svg>
                          )}
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: isActive ? "#080a10" : bc }} />
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Current tab — full breakdown */}
                  {activeTab === "current" && (() => {
                    const a = result.analyses.current;
                    return (
                      <div className="space-y-3 relative">
                        <ScanLine color={biasColor} />

                        {/* Avoid banner — shown first if low quality setup */}
                        <AvoidBanner
                          confidence={a.confidence}
                          riskReward={a.tradeSetup?.riskReward ?? ""}
                          warnings={a.warnings ?? []}
                        />

                        <motion.div className="rounded-2xl border p-4 flex items-center justify-between gap-4 relative overflow-hidden"
                          style={{ borderColor: `${biasColor}35`, background: `${biasColor}0d`,
                            boxShadow: isPro ? `0 0 20px ${biasColor}20` : undefined }}
                          initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0, duration: 0.45, type: "spring", bounce: 0.28 }}>
                          <ParticleBurst color={biasColor} />
                          <div style={{ position: "relative", zIndex: 1 }}>
                            <p className="text-[#6b7280] text-[10px] uppercase tracking-[0.12em] mb-1">Bias</p>
                            <motion.p className="text-2xl font-extrabold"
                              style={{ color: biasColor }}
                              animate={isPro ? { textShadow: [`0 0 20px ${biasColor}60`, `0 0 40px ${biasColor}90`, `0 0 20px ${biasColor}60`] } : {}}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                              {a.bias}
                            </motion.p>
                          </div>
                          <div className="flex items-center gap-3" style={{ position: "relative", zIndex: 1 }}>
                            {isPro && (
                              <motion.span className="font-dm-mono text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: "rgba(0,230,118,0.15)", color: "#00e676", border: "1px solid rgba(0,230,118,0.3)" }}
                                animate={{ boxShadow: ["0 0 4px rgba(0,230,118,0.3)", "0 0 12px rgba(0,230,118,0.7)", "0 0 4px rgba(0,230,118,0.3)"] }}
                                transition={{ duration: 1.8, repeat: Infinity }}>
                                PRO
                              </motion.span>
                            )}
                            <div className="text-right">
                              <p className="text-[#6b7280] text-[10px] uppercase tracking-[0.12em] mb-1">Timeframe</p>
                              <p className="font-dm-mono text-xl font-bold text-white">{a.timeframe}</p>
                            </div>
                          </div>
                        </motion.div>

                        {/* Trade Score — Pro only */}
                        {a.tradeScore && (
                          isPro ? <TradeScore grade={a.tradeScore} /> : (
                            <div className="relative rounded-2xl overflow-hidden">
                              <div style={{ filter: "blur(6px)", pointerEvents: "none", userSelect: "none" }}>
                                <TradeScore grade={a.tradeScore} />
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-2xl"
                                style={{ background: "rgba(8,10,16,0.75)" }}>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="6" width="10" height="7" rx="1.5" stroke="#00e676" strokeWidth="1.2"/><path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="#00e676" strokeWidth="1.2" strokeLinecap="round"/></svg>
                                <span className="text-[#00e676] text-xs font-bold">Pro — Trade Grade</span>
                              </div>
                            </div>
                          )
                        )}

                        <motion.div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] py-6 flex justify-center"
                          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.28, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                          <ConfidenceGauge score={a.confidence} />
                        </motion.div>
                        <motion.div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4"
                          initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.55, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
                          <p className="text-[#6b7280] text-[10px] font-semibold uppercase tracking-[0.12em] mb-3">Trade Setup · {a.tradeSetup?.entryType}</p>
                          {[
                            { label: "Entry",         value: a.tradeSetup?.entry,       color: "white",   i: 0 },
                            { label: "Stop Loss",     value: a.tradeSetup?.stopLoss,    color: "#f87171", i: 1 },
                            { label: "Take Profit",   value: a.tradeSetup?.takeProfit1, color: "#4ade80", i: 2 },
                            { label: "Risk / Reward", value: a.tradeSetup?.riskReward,  color: "#c084fc", i: 3 },
                          ].map((row) => (
                            <motion.div key={row.label}
                              className="flex justify-between items-center py-2.5 border-b border-white/[0.04] last:border-0"
                              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.65 + row.i * 0.09, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}>
                              <span className="text-[#6b7280] text-sm">{row.label}</span>
                              <span className="font-dm-mono text-sm font-semibold" style={{ color: row.color }}>{row.value}</span>
                            </motion.div>
                          ))}
                        </motion.div>
                        {/* Annotated Chart */}
                        <AnnotatedChart
                          chartBase64={chartBase64}
                          chartMime={chartMime}
                          smc={{
                            fvg:             a.fvg,
                            liquiditySweeps: a.liquiditySweeps,
                            orderBlocks:     a.orderBlocks,
                            structureBreaks: a.structureBreaks,
                            equalLevels:     a.equalLevels,
                            marketZone:      a.marketZone,
                            patterns:        a.patterns,
                            smcFibonacci:    a.smcFibonacci,
                            smc_summary:     a.smc_summary,
                          } as SMCData}
                          entry={a.tradeSetup?.entry ?? ""}
                          stopLoss={a.tradeSetup?.stopLoss ?? ""}
                          takeProfit={a.tradeSetup?.takeProfit1 ?? ""}
                          isPro={isPro}
                          clientId={clientId}
                        />

                        {/* Smart Entry Timer */}
                        {(a.entrySession || a.entryTimeUTC) && (
                          <EntryTimerWidget
                            entrySession={a.entrySession ?? "Market Open"}
                            entryTimeUTC={a.entryTimeUTC ?? "13:00"}
                            entryRationale={a.entryRationale}
                            waitForConfirmation={a.waitForConfirmation}
                            isPro={isPro}
                            clientId={clientId}
                          />
                        )}

                        <motion.div className="grid grid-cols-2 gap-3"
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.82, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
                          <div className="rounded-2xl bg-[#4ade80]/[0.05] border border-[#4ade80]/12 p-3.5">
                            <p className="text-[#4ade80]/50 text-[10px] font-semibold uppercase tracking-wider mb-2">Resistance</p>
                            {a.keyLevels?.resistance?.map((l, i) => <p key={i} className="font-dm-mono text-[#4ade80] text-sm leading-relaxed">{l}</p>)}
                          </div>
                          <div className="rounded-2xl bg-[#f87171]/[0.05] border border-[#f87171]/12 p-3.5">
                            <p className="text-[#f87171]/50 text-[10px] font-semibold uppercase tracking-wider mb-2">Support</p>
                            {a.keyLevels?.support?.map((l, i) => <p key={i} className="font-dm-mono text-[#f87171] text-sm leading-relaxed">{l}</p>)}
                          </div>
                        </motion.div>
                        <motion.div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4"
                          initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.96, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
                          <p className="text-[#6b7280] text-[10px] font-semibold uppercase tracking-[0.12em] mb-3">Indicators</p>
                          {[
                            { label: "RSI",      value: a.indicators?.rsi },
                            { label: "MACD",     value: a.indicators?.macd },
                            { label: "MA Cross", value: a.indicators?.maCross },
                          ].map((row) => (
                            <div key={row.label} className="flex justify-between items-center py-2.5 border-b border-white/[0.04] last:border-0">
                              <span className="text-[#6b7280] text-sm">{row.label}</span>
                              <span className="font-dm-mono text-white text-sm">{row.value}</span>
                            </div>
                          ))}
                        </motion.div>
                        {/* Confluence checklist */}
                        {a.confluenceChecks && a.confluenceChecks.length > 0 && (
                          isPro ? <ConfluerenceChecklist checks={a.confluenceChecks} /> : (
                            <div className="relative rounded-2xl overflow-hidden">
                              <div style={{ filter: "blur(5px)", pointerEvents: "none", userSelect: "none" }}>
                                <ConfluerenceChecklist checks={a.confluenceChecks} />
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-2xl"
                                style={{ background: "rgba(8,10,16,0.75)" }}>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="6" width="10" height="7" rx="1.5" stroke="#00e676" strokeWidth="1.2"/><path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="#00e676" strokeWidth="1.2" strokeLinecap="round"/></svg>
                                <span className="text-[#00e676] text-xs font-bold">Pro — Confluence Checklist</span>
                              </div>
                            </div>
                          )
                        )}

                        <motion.div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4"
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 1.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
                          <p className="text-[#6b7280] text-[10px] font-semibold uppercase tracking-[0.12em] mb-3">AI Summary</p>
                          <StructuredSummary text={a.summary} isPro={isPro} startDelay={1.22} />
                        </motion.div>
                        {a.confluences?.length > 0 && (
                          <motion.div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4"
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.35, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}>
                            <p className="text-[#6b7280] text-[10px] font-semibold uppercase tracking-[0.12em] mb-3">Confluences</p>
                            <ul className="space-y-2">
                              {a.confluences.map((c, i) => <li key={i} className="flex items-start gap-2 text-sm text-[#d1d5db]"><Check />{c}</li>)}
                            </ul>
                          </motion.div>
                        )}
                        {a.warnings?.length > 0 && (
                          isPro ? (
                            <motion.div className="rounded-2xl bg-[#f87171]/[0.05] border border-[#f87171]/15 p-4"
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 1.48, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}>
                              <p className="text-[#f87171] text-[10px] font-semibold uppercase tracking-[0.12em] mb-2">⚠ Risk Warnings</p>
                              {a.warnings.map((w, i) => <p key={i} className="text-[#fca5a5] text-sm mt-1">· {w}</p>)}
                            </motion.div>
                          ) : (
                            <div className="relative rounded-2xl overflow-hidden">
                              <div className="rounded-2xl bg-[#f87171]/[0.05] border border-[#f87171]/15 p-4"
                                style={{ filter: "blur(5px)", pointerEvents: "none", userSelect: "none" }}>
                                <p className="text-[#f87171] text-[10px] font-semibold uppercase tracking-[0.12em] mb-2">⚠ Risk Warnings</p>
                                {a.warnings.slice(0, 2).map((w, i) => <p key={i} className="text-[#fca5a5] text-sm mt-1">· {w}</p>)}
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-2xl"
                                style={{ background: "rgba(8,10,16,0.75)" }}>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="6" width="10" height="7" rx="1.5" stroke="#00e676" strokeWidth="1.2"/><path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="#00e676" strokeWidth="1.2" strokeLinecap="round"/></svg>
                                <span className="text-[#00e676] text-xs font-bold">Pro — Risk Warnings</span>
                              </div>
                            </div>
                          )
                        )}

                        {/* SMC Analysis */}
                        <SMCSection a={a} isPro={isPro} clientId={clientId} />

                        {/* Pine Script Export */}
                        <PineScriptExport
                          asset={asset}
                          timeframe={a.timeframe}
                          signal={a.bias === "BULLISH" ? "LONG" : a.bias === "BEARISH" ? "SHORT" : "NEUTRAL"}
                          entry={a.tradeSetup?.entry}
                          stopLoss={a.tradeSetup?.stopLoss}
                          takeProfit1={a.tradeSetup?.takeProfit1}
                          confidence={a.confidence}
                          isPro={isPro}
                        />

                        {/* MT Trade Setup */}
                        <MTTradeSetup
                          asset={asset}
                          signal={a.bias === "BULLISH" ? "LONG" : "SHORT"}
                          entry={a.tradeSetup?.entry}
                          stopLoss={a.tradeSetup?.stopLoss}
                          takeProfit={a.tradeSetup?.takeProfit1}
                          isPro={isPro}
                        />

                        {/* Pro deep analysis — Pro only */}
                        {isPro && <ProDeepAnalysis a={a} />}

                        {/* Free watermark — nudges upgrade */}
                        {!isPro && (
                          <FreeWatermark onUpgrade={() => {
                            if (clientId) {
                              fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) })
                                .then((r) => r.json()).then((d) => { if (d.url) window.location.href = d.url; });
                            }
                          }} />
                        )}

                        {/* Share CTA — bottom of analysis */}
                        <motion.div
                          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 2.0, duration: 0.4 }}
                          className="rounded-2xl p-5 text-center"
                          style={{ background: "rgba(0,230,118,0.04)", border: "1px solid rgba(0,230,118,0.18)" }}
                        >
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <circle cx="11" cy="3" r="2" stroke="#00e676" strokeWidth="1.2"/>
                              <circle cx="3" cy="7" r="2" stroke="#00e676" strokeWidth="1.2"/>
                              <circle cx="11" cy="11" r="2" stroke="#00e676" strokeWidth="1.2"/>
                              <path d="M5 6.1l4-2.2M5 7.9l4 2.2" stroke="#00e676" strokeWidth="1.2" strokeLinecap="round"/>
                            </svg>
                            <p className="font-dm-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#00e676]">
                              Share This Setup
                            </p>
                          </div>
                          <p className="text-[#6b7280] text-xs mb-4 leading-relaxed">
                            Found a great setup? Share a branded card with your trading community.
                            {shareCount != null && shareCount > 0 && (
                              <span className="text-[#9ca3af]"> · {shareCount} trader{shareCount !== 1 ? "s" : ""} already shared this one.</span>
                            )}
                          </p>
                          <button
                            onClick={() => setShowShareModal(true)}
                            className="w-full py-3.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 active:scale-[0.98] flex items-center justify-center gap-2"
                            style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 20px rgba(0,230,118,0.28)" }}
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <circle cx="11" cy="3" r="2" stroke="currentColor" strokeWidth="1.3"/>
                              <circle cx="3" cy="7" r="2" stroke="currentColor" strokeWidth="1.3"/>
                              <circle cx="11" cy="11" r="2" stroke="currentColor" strokeWidth="1.3"/>
                              <path d="M5 6.1l4-2.2M5 7.9l4 2.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                            </svg>
                            Share — Download, X, Discord
                          </button>
                        </motion.div>
                      </div>
                    );
                  })()}

                  {/* Higher / Highest tabs — pro-gated context card */}
                  {(activeTab === "higher" || activeTab === "highest") && (() => {
                    const a  = result.analyses[activeTab];
                    const tf = result.tfLabels[activeTab];
                    const bc = a.bias === "BULLISH" ? "#00e676" : a.bias === "BEARISH" ? "#f87171" : "#9ca3af";
                    const title    = activeTab === "higher" ? "Higher Timeframe Context" : "Macro Bias";
                    const subtitle = activeTab === "higher" ? "Trend direction & key zones" : "Overall market direction";
                    return (
                      <div className="relative">
                        {!isPro && (
                          <div className="absolute inset-0 z-10 rounded-2xl flex flex-col items-center justify-center text-center px-6"
                            style={{ backdropFilter: "blur(8px)", background: "rgba(8,10,16,0.65)" }}>
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mb-3">
                              <rect x="4" y="14" width="24" height="16" rx="4" stroke="#00e676" strokeWidth="1.5"/>
                              <path d="M10 14V10a6 6 0 0112 0v4" stroke="#00e676" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            <p className="text-white font-bold mb-1">Pro Feature</p>
                            <p className="text-[#6b7280] text-sm mb-4">Multi-timeframe context requires a Pro plan.</p>
                            <button
                              onClick={() => { if (clientId) fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) }).then(r => r.json()).then(d => { if (d.url) window.location.href = d.url; }); }}
                              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
                              style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 20px rgba(0,230,118,0.3)" }}>
                              Upgrade to Pro — £19/mo
                            </button>
                          </div>
                        )}
                        <div className={!isPro ? "pointer-events-none select-none" : ""}>
                          <div className="rounded-2xl border p-4 flex items-center justify-between gap-4 mb-3"
                            style={{ borderColor: `${bc}35`, background: `${bc}0d` }}>
                            <div>
                              <p className="text-[#6b7280] text-[10px] uppercase tracking-[0.12em] mb-1">{title}</p>
                              <p className="text-xs text-[#6b7280]">{subtitle}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-dm-mono text-xs text-[#6b7280] mb-1">{tf}</p>
                              <p className="text-2xl font-extrabold" style={{ color: bc, textShadow: `0 0 20px ${bc}60` }}>{a.bias}</p>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] py-6 flex justify-center mb-3">
                            <ConfidenceGauge score={a.confidence} />
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="rounded-2xl bg-[#4ade80]/[0.05] border border-[#4ade80]/12 p-3.5">
                              <p className="text-[#4ade80]/50 text-[10px] font-semibold uppercase tracking-wider mb-2">Resistance</p>
                              {a.keyLevels?.resistance?.map((l, i) => <p key={i} className="font-dm-mono text-[#4ade80] text-sm leading-relaxed">{l}</p>)}
                            </div>
                            <div className="rounded-2xl bg-[#f87171]/[0.05] border border-[#f87171]/12 p-3.5">
                              <p className="text-[#f87171]/50 text-[10px] font-semibold uppercase tracking-wider mb-2">Support</p>
                              {a.keyLevels?.support?.map((l, i) => <p key={i} className="font-dm-mono text-[#f87171] text-sm leading-relaxed">{l}</p>)}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4 mb-3">
                            <p className="text-[#6b7280] text-[10px] font-semibold uppercase tracking-[0.12em] mb-2">
                              {activeTab === "higher" ? "Context Summary" : "Macro Summary"}
                            </p>
                            <p className="text-[#d1d5db] text-sm leading-relaxed">{a.summary}</p>
                          </div>
                          {a.confluences?.length > 0 && (
                            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4 mb-3">
                              <p className="text-[#6b7280] text-[10px] font-semibold uppercase tracking-[0.12em] mb-3">Key Factors</p>
                              <ul className="space-y-2">
                                {a.confluences.map((c, i) => <li key={i} className="flex items-start gap-2 text-sm text-[#d1d5db]"><Check />{c}</li>)}
                              </ul>
                            </div>
                          )}
                          {a.warnings?.length > 0 && (
                            <div className="rounded-2xl bg-[#f87171]/[0.05] border border-[#f87171]/15 p-4">
                              <p className="text-[#f87171] text-[10px] font-semibold uppercase tracking-[0.12em] mb-2">⚠ Risk Warnings</p>
                              {a.warnings.map((w, i) => <p key={i} className="text-[#fca5a5] text-sm mt-1">· {w}</p>)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              )}
            </div>
          </div>

          {/* ── Position calculator toggle ── */}
          {result && (
            <>
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => setShowCalculator((s) => !s)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-dm-mono text-xs font-semibold border transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    background: showCalculator ? "rgba(0,230,118,0.1)" : "rgba(255,255,255,0.03)",
                    borderColor: showCalculator ? "rgba(0,230,118,0.3)" : "rgba(255,255,255,0.08)",
                    color: showCalculator ? "#00e676" : "#6b7280",
                  }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <rect x="0.7" y="0.7" width="11.6" height="11.6" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M3 4h7M3 6.5h7M3 9h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                  </svg>
                  {showCalculator ? "Hide Calculator" : "Calculate Position Size"}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                    style={{ transform: showCalculator ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                    <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              {showCalculator && result.analyses.current.tradeSetup && (
                <PositionCalculator
                  key={revealKey}
                  defaultEntry={result.analyses.current.tradeSetup.entry ?? ""}
                  defaultSL={result.analyses.current.tradeSetup.stopLoss ?? ""}
                  defaultTP1={result.analyses.current.tradeSetup.takeProfit1 ?? ""}
                  asset={asset}
                  isPro={isPro}
                  clientId={clientId}
                />
              )}
            </>
          )}

          {/* ── Chat box (full width, below grid) ── */}
          {result && (
            <ChatBox
              key={revealKey}
              journalId={journalId}
              analysisJson={result.analyses.current}
              chartBase64={chartBase64}
              chartMime={chartMime}
              clientId={clientId}
              isPro={isPro}
            />
          )}
        </div>
      </section>

      {/* ── MULTI-CHART ANALYSIS ────────────────────────────── */}
      <section className="py-16 px-6 border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-bebas text-[32px] tracking-[0.06em] text-white leading-none">MULTI CHART ANALYSIS</h2>
                <span className="px-2.5 py-1 rounded-full font-dm-mono text-[9px] font-bold tracking-widest"
                  style={{ background: "rgba(0,230,118,0.12)", border: "1px solid rgba(0,230,118,0.3)", color: "#00e676" }}>
                  ELITE
                </span>
              </div>
              <p className="text-[#6b7280] text-sm">Upload up to 6 charts simultaneously and find confluence across markets</p>
            </div>
          </div>

          {/* Gate / content */}
          <div className="relative rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.07)", background: "#0a0c12" }}>

            {!isElite && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-8"
                style={{ backdropFilter: "blur(8px)", background: "rgba(8,10,16,0.8)" }}>
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none" className="mb-3">
                  <rect x="2.5" y="11" width="21" height="13" rx="2.5" stroke="#00e676" strokeWidth="1.3"/>
                  <path d="M8 11V8a5 5 0 0110 0v3" stroke="#00e676" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                <p className="font-bebas text-2xl tracking-[0.06em] text-white mb-1">ELITE FEATURE</p>
                <p className="text-[#6b7280] text-sm mb-5">Multi-chart confluence analysis requires Elite — £39/mo</p>
                <a href="/pricing"
                  className="px-6 py-2.5 rounded-xl font-dm-mono text-sm font-bold transition-all hover:-translate-y-0.5"
                  style={{ background: "#00e676", color: "#080a10" }}>
                  Upgrade to Elite →
                </a>
              </div>
            )}

            <div className={`p-6 space-y-6 ${!isElite ? "pointer-events-none select-none" : ""}`}
              style={!isElite ? { filter: "blur(5px)" } : {}}>

              {/* Upload grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {([mRef0, mRef1, mRef2, mRef3, mRef4, mRef5] as React.RefObject<HTMLInputElement | null>[]).map((ref, i) => {
                  const file = multiFiles[i];
                  return (
                    <div key={i}>
                      <div className="flex gap-1.5 mb-2">
                        <input
                          type="text"
                          value={multiLabels[i]}
                          onChange={(e) => { const l = [...multiLabels]; l[i] = e.target.value; setMultiLabels(l); }}
                          className="flex-1 px-2 py-1 rounded-lg font-dm-mono text-[10px] text-white focus:outline-none"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                        />
                        {file && (
                          <button onClick={() => { const f = [...multiFiles]; f[i] = null; setMultiFiles(f); }}
                            className="w-6 h-6 rounded flex items-center justify-center text-[#6b7280] hover:text-white transition-colors"
                            style={{ background: "rgba(255,255,255,0.06)" }}>×</button>
                        )}
                      </div>
                      <div
                        onClick={() => ref.current?.click()}
                        className="rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all hover:border-[#00e676]/40"
                        style={file
                          ? { borderColor: "rgba(0,230,118,0.35)", background: "rgba(0,230,118,0.04)" }
                          : { borderColor: "rgba(255,255,255,0.08)" }}>
                        {file ? (
                          <p className="font-dm-mono text-[10px] text-[#00e676] truncate">{file.name}</p>
                        ) : (
                          <>
                            <svg className="w-6 h-6 mx-auto mb-1 opacity-30" viewBox="0 0 24 24" fill="none">
                              <path d="M12 5v10M7 9l5-4 5 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M3 19h18" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                            </svg>
                            <p className="font-dm-mono text-[10px] text-[#4b5563]">Chart {i + 1}</p>
                          </>
                        )}
                        <input ref={ref} type="file" accept="image/*" className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            const arr = [...multiFiles]; arr[i] = f; setMultiFiles(arr);
                          }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Analyse button */}
              {(() => {
                const filled = multiFiles.filter(Boolean).length;
                return (
                  <button
                    disabled={filled < 2 || multiLoading}
                    onClick={async () => {
                      setMultiLoading(true);
                      setMultiResult(null);
                      try {
                        const fd = new FormData();
                        if (clientId) fd.append("client_id", clientId);
                        multiFiles.forEach((f, i) => {
                          if (f) { fd.append(`chart_${i + 1}`, f); fd.append(`label_${i + 1}`, multiLabels[i]); }
                        });
                        const res = await fetch("/api/analyze-multi", { method: "POST", body: fd });
                        const data = await res.json();
                        if (!data.error) setMultiResult(data);
                      } catch { /* ignore */ }
                      finally { setMultiLoading(false); }
                    }}
                    className="w-full py-3.5 rounded-xl font-bebas text-[18px] tracking-[0.06em] transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ background: filled >= 2 ? "#00e676" : "rgba(0,230,118,0.08)", color: filled >= 2 ? "#080a10" : "#4b5563", border: "1px solid rgba(0,230,118,0.2)" }}>
                    {multiLoading ? (
                      <><span className="w-4 h-4 rounded-full border-2 border-[#080a10]/30 border-t-[#080a10] animate-spin" />ANALYSING {filled} CHARTS…</>
                    ) : `ANALYSE ALL CHARTS ${filled >= 2 ? `(${filled})` : "— UPLOAD 2+"}`}
                  </button>
                );
              })()}

              {/* Results */}
              {multiResult && (() => {
                const c = multiResult.combined as { overallBias: string; confluenceScore: number; strongestSetup: string; correlations: string[]; conflicts: string[]; summary: string };
                const biasColor = c.overallBias === "BULLISH" ? "#00e676" : c.overallBias === "BEARISH" ? "#f87171" : "#fbbf24";
                return (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {/* Overall bias + confluence */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-2xl p-5 text-center"
                        style={{ background: `${biasColor}0d`, border: `1px solid ${biasColor}30` }}>
                        <p className="font-dm-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: biasColor }}>Overall Bias</p>
                        <p className="font-bebas text-[36px] leading-none" style={{ color: biasColor }}>{c.overallBias}</p>
                      </div>
                      <div className="rounded-2xl p-5"
                        style={{ background: "rgba(0,230,118,0.06)", border: "1px solid rgba(0,230,118,0.15)" }}>
                        <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] mb-2">Confluence Score</p>
                        <p className="font-bebas text-[36px] text-[#00e676] leading-none">{c.confluenceScore}%</p>
                        <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.06] mt-2">
                          <div className="h-full rounded-full bg-[#00e676]" style={{ width: `${c.confluenceScore}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Strongest setup */}
                    {c.strongestSetup && (
                      <div className="rounded-xl p-3 flex items-center gap-3"
                        style={{ background: "rgba(0,230,118,0.06)", border: "1px solid rgba(0,230,118,0.15)" }}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.5 3.5L13 6l-2.5 2.5.5 3.5L8 10.5 5 12l.5-3.5L3 6l3.5-.5L8 2z" fill="#00e676"/></svg>
                        <div>
                          <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280]">Strongest Setup</p>
                          <p className="font-dm-mono text-sm font-bold text-[#00e676]">{c.strongestSetup}</p>
                        </div>
                      </div>
                    )}

                    {/* Correlations and conflicts */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {c.correlations?.length > 0 && (
                        <div className="rounded-xl p-4"
                          style={{ background: "rgba(0,230,118,0.04)", border: "1px solid rgba(0,230,118,0.12)" }}>
                          <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#4ade80] mb-2">Correlations</p>
                          {c.correlations.map((r, i) => <p key={i} className="text-sm text-[#d1d5db] leading-relaxed">· {r}</p>)}
                        </div>
                      )}
                      {c.conflicts?.length > 0 && (
                        <div className="rounded-xl p-4"
                          style={{ background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.12)" }}>
                          <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#f87171] mb-2">Conflicts</p>
                          {c.conflicts.map((r, i) => <p key={i} className="text-sm text-[#d1d5db] leading-relaxed">· {r}</p>)}
                        </div>
                      )}
                    </div>

                    {/* Summary */}
                    <div className="rounded-xl p-4"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280] mb-2">Combined Summary</p>
                      <p className="text-[#d1d5db] text-sm leading-relaxed">{c.summary}</p>
                    </div>

                    {/* Individual results grid */}
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {multiResult.individual.map((a, i) => {
                        const bias = String(a.bias ?? "NEUTRAL");
                        const bc = bias === "BULLISH" ? "#00e676" : bias === "BEARISH" ? "#f87171" : "#9ca3af";
                        return (
                          <div key={i} className="rounded-xl p-3"
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <p className="font-bebas text-[18px] text-white">{String(a.asset ?? a.label)}</p>
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="px-1.5 py-0.5 rounded font-dm-mono text-[8px] font-bold"
                                style={{ background: `${bc}20`, color: bc }}>{bias}</span>
                              <span className="font-dm-mono text-[9px] text-[#6b7280]">{Number(a.confidence)}%</span>
                            </div>
                            <p className="font-dm-mono text-[9px] text-[#6b7280] leading-snug">{String(a.summary ?? "")}</p>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="text-center mb-16" data-animate>
            <SectionBadge>EVERYTHING YOU NEED</SectionBadge>
            <h2 className="font-bebas text-[clamp(40px,5vw,64px)] leading-none tracking-[0.03em] text-white mt-3 mb-4">
              BUILT FOR SERIOUS TRADERS
            </h2>
            <p className="text-[#6b7280] text-lg max-w-xl mx-auto leading-relaxed">
              Every feature designed to help you find better trades, manage risk, and track your performance
            </p>
          </div>

          {/* Cards grid */}
          <div className="grid md:grid-cols-2 gap-6">

            {/* ── FEATURE 1 — AI CHART ANALYSIS ─────────────── */}
            <div className="rounded-[14px] border border-white/[0.07] p-8 flex flex-col gap-6 group hover:border-[#00e676]/25 transition-colors duration-300" style={{ background: "#0d1310" }} data-animate data-delay="1">
              <div>
                <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3" style={{ background: "rgba(107,114,128,0.15)", color: "#9ca3af", border: "1px solid rgba(107,114,128,0.2)" }}>FREE</span>
                <h3 className="font-bebas text-[28px] tracking-[0.03em] text-white leading-none mb-2">Instant AI Chart Analysis</h3>
                <p className="text-[#6b7280] text-sm leading-relaxed mb-4">Drop any chart screenshot and get a complete trade plan in under 5 seconds. Works with any asset, any timeframe, any platform.</p>
                <ul className="space-y-1.5">
                  {["Entry, stop loss & take profit", "Signal direction: LONG or SHORT", "Works on any asset or platform"].map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-[#9ca3af]">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="#00e676" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-[#00e676]/10 p-4" style={{ background: "#080a10" }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[#6b7280]">XAU/USD · 1H</p>
                    <p className="font-bebas text-lg text-white tracking-wide">AI Analysis</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-dm-mono text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}>SHORT</span>
                    <span className="font-dm-mono text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }}>A+</span>
                  </div>
                </div>
                <div className="space-y-1.5 mb-3">
                  {[{ label: "Entry", value: "3,293", color: "#e2e8f0" }, { label: "Stop Loss", value: "3,302", color: "#f87171" }, { label: "Take Profit", value: "3,256", color: "#00e676" }].map((r) => (
                    <div key={r.label} className="flex justify-between items-center px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                      <span className="font-dm-mono text-[10px] text-[#6b7280]">{r.label}</span>
                      <span className="font-dm-mono text-[11px] font-bold" style={{ color: r.color }}>{r.value}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-end gap-1 h-8 px-1">
                  {[40, 55, 35, 70, 45, 80, 60, 75, 50, 85, 65, 55].map((h, i) => (
                    <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i >= 9 ? "rgba(248,113,113,0.45)" : "rgba(0,230,118,0.22)" }} />
                  ))}
                </div>
              </div>
            </div>

            {/* ── FEATURE 2 — CONFIDENCE SCORE ───────────────── */}
            <div className="rounded-[14px] border border-white/[0.07] p-8 flex flex-col gap-6 group hover:border-[#00e676]/25 transition-colors duration-300" style={{ background: "#0d1310" }} data-animate data-delay="2">
              <div>
                <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3" style={{ background: "rgba(107,114,128,0.15)", color: "#9ca3af", border: "1px solid rgba(107,114,128,0.2)" }}>FREE</span>
                <h3 className="font-bebas text-[28px] tracking-[0.03em] text-white leading-none mb-2">Confidence Score & Trade Grade</h3>
                <p className="text-[#6b7280] text-sm leading-relaxed mb-4">Never enter a weak setup again. Every analysis is scored 0–100 and graded A+ to D based on how many factors align. Only take A and B grade trades.</p>
                <ul className="space-y-1.5">
                  {["0–100 confidence score on every setup", "A+ to D letter grade", "Only take A and B grade trades"].map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-[#9ca3af]">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="#00e676" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-[#00e676]/10 p-5 flex flex-col items-center gap-3" style={{ background: "#080a10" }}>
                <div className="relative w-28 h-28">
                  <svg viewBox="0 0 100 100" width="112" height="112">
                    <circle cx="50" cy="50" r="36" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" strokeLinecap="round"
                      strokeDasharray="150.8 75.4" transform="rotate(150 50 50)" />
                    <circle cx="50" cy="50" r="36" fill="none" stroke="#00e676" strokeWidth="7" strokeLinecap="round"
                      strokeDasharray="131.2 95" transform="rotate(150 50 50)"
                      style={{ filter: "drop-shadow(0 0 8px rgba(0,230,118,0.7))" }} />
                    <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="24"
                      style={{ fontFamily: "var(--font-bebas), Impact, sans-serif" }}>87</text>
                  </svg>
                </div>
                <span className="font-dm-mono text-xs font-bold px-3 py-1 rounded-full" style={{ background: "rgba(0,230,118,0.12)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }}>Grade A+</span>
                <div className="flex gap-2 flex-wrap justify-center">
                  {["Trend ✓", "Volume ✓", "Structure ✓"].map((f) => (
                    <span key={f} className="font-dm-mono text-[10px] px-2.5 py-1 rounded-full" style={{ background: "rgba(0,230,118,0.07)", color: "#4ade80", border: "1px solid rgba(0,230,118,0.15)" }}>{f}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* ── FEATURE 3 — TRADE JOURNAL ──────────────────── */}
            <div className="rounded-[14px] border border-white/[0.07] p-8 flex flex-col gap-6 group hover:border-[#00e676]/25 transition-colors duration-300" style={{ background: "#0d1310" }} data-animate data-delay="3">
              <div>
                <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3" style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }}>PRO</span>
                <h3 className="font-bebas text-[28px] tracking-[0.03em] text-white leading-none mb-2">Automatic Trade Journal</h3>
                <p className="text-[#6b7280] text-sm leading-relaxed mb-4">Every analysis is automatically saved. Track your win rate, best performing assets, and see exactly where you are making and losing money.</p>
                <ul className="space-y-1.5">
                  {["Win rate & P&L tracking", "Best and worst performing assets", "Performance trends over time"].map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-[#9ca3af]">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="#00e676" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-[#00e676]/10 p-4" style={{ background: "#080a10" }}>
                <div className="flex justify-between items-center gap-2 mb-3 pb-3 border-b border-white/[0.05]">
                  {[{ v: "68%", l: "Win Rate" }, { v: "47", l: "Trades" }, { v: "1:2.3", l: "Avg R:R" }].map((s) => (
                    <div key={s.l} className="text-center">
                      <div className="font-bebas text-xl text-[#00e676] leading-none">{s.v}</div>
                      <div className="font-dm-mono text-[9px] text-[#6b7280] mt-0.5">{s.l}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[
                    { pair: "XAU/USD", dir: "SHORT", out: "WIN",  dc: "#f87171", oc: "#00e676" },
                    { pair: "BTC/USD", dir: "LONG",  out: "WIN",  dc: "#00e676", oc: "#00e676" },
                    { pair: "EUR/USD", dir: "SHORT", out: "LOSS", dc: "#f87171", oc: "#f87171" },
                  ].map((row) => (
                    <div key={row.pair} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                      <span className="font-dm-mono text-[11px] font-bold text-white">{row.pair}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-dm-mono text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${row.dc}18`, color: row.dc }}>{row.dir}</span>
                        <span className="font-dm-mono text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${row.oc}18`, color: row.oc }}>{row.out}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── FEATURE 4 — MULTI-TIMEFRAME ────────────────── */}
            <div className="rounded-[14px] border border-white/[0.07] p-8 flex flex-col gap-6 group hover:border-[#00e676]/25 transition-colors duration-300" style={{ background: "#0d1310" }} data-animate data-delay="4">
              <div>
                <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3" style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }}>PRO</span>
                <h3 className="font-bebas text-[28px] tracking-[0.03em] text-white leading-none mb-2">Multi-Timeframe Confluence</h3>
                <p className="text-[#6b7280] text-sm leading-relaxed mb-4">See what the higher timeframes say before entering. Get analysis on your current timeframe plus the two above it. Only trade when all timeframes agree.</p>
                <ul className="space-y-1.5">
                  {["Analysis on 3 timeframes at once", "Confluence score and summary", "Filters out low-probability setups"].map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-[#9ca3af]">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="#00e676" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-[#00e676]/10 p-4" style={{ background: "#080a10" }}>
                <div className="flex gap-2 mb-4">
                  {["5m", "1H", "4H"].map((tf, i) => (
                    <button key={tf} className="font-dm-mono text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                      style={i === 1 ? { background: "rgba(0,230,118,0.15)", color: "#00e676", border: "1px solid rgba(0,230,118,0.3)" } : { background: "rgba(255,255,255,0.04)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.07)" }}>{tf}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg" style={{ background: "rgba(0,230,118,0.07)", border: "1px solid rgba(0,230,118,0.15)" }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 6l3 3L10.5 1.5" stroke="#00e676" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span className="font-dm-mono text-[11px] font-bold text-[#00e676]">3/3 Bullish Confluence</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {["5m · LONG", "1H · LONG", "4H · LONG"].map((tf) => (
                    <div key={tf} className="text-center py-2 rounded-lg font-dm-mono text-[10px] font-bold" style={{ background: "rgba(0,230,118,0.08)", color: "#00e676", border: "1px solid rgba(0,230,118,0.15)" }}>{tf}</div>
                  ))}
                </div>
                <p className="font-dm-mono text-[10px] text-center text-[#4b5563]">All timeframes aligned ✓</p>
              </div>
            </div>

            {/* ── FEATURE 5 — ECONOMIC CALENDAR ──────────────── */}
            <div className="rounded-[14px] border border-white/[0.07] p-8 flex flex-col gap-6 group hover:border-[#00e676]/25 transition-colors duration-300" style={{ background: "#0d1310" }} data-animate data-delay="5">
              <div>
                <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3" style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }}>PRO</span>
                <h3 className="font-bebas text-[28px] tracking-[0.03em] text-white leading-none mb-2">Economic Calendar & News Alerts</h3>
                <p className="text-[#6b7280] text-sm leading-relaxed mb-4">Never trade blindly into high impact news again. See upcoming NFP, CPI, and Fed meetings directly in the app with warnings on your analysis when news is nearby.</p>
                <ul className="space-y-1.5">
                  {["High-impact event warnings on analysis", "Real-time countdown to next event", "Colour-coded by impact level"].map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-[#9ca3af]">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="#00e676" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-[#00e676]/10 p-4" style={{ background: "#080a10" }}>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="font-dm-mono text-[10px] font-bold px-2.5 py-1.5 rounded-lg" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}>🔴 NFP · in 45min</span>
                  <span className="font-dm-mono text-[10px] font-bold px-2.5 py-1.5 rounded-lg" style={{ background: "rgba(156,163,175,0.1)", color: "#9ca3af", border: "1px solid rgba(156,163,175,0.25)" }}>⚪ CPI · in 3h</span>
                  <span className="font-dm-mono text-[10px] font-bold px-2.5 py-1.5 rounded-lg" style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }}>🟢 FOMC · in 2d</span>
                </div>
                <div className="flex items-start gap-2.5 px-3 py-3 rounded-lg" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
                  <span className="text-sm mt-0.5 flex-shrink-0">⚠️</span>
                  <p className="font-dm-mono text-[10px] text-[#fca5a5] leading-relaxed">High impact news in 45 minutes — trade with caution</p>
                </div>
              </div>
            </div>

            {/* ── FEATURE 6 — RISK CALCULATOR ────────────────── */}
            <div className="rounded-[14px] border border-white/[0.07] p-8 flex flex-col gap-6 group hover:border-[#00e676]/25 transition-colors duration-300" style={{ background: "#0d1310" }} data-animate data-delay="6">
              <div>
                <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3" style={{ background: "rgba(107,114,128,0.15)", color: "#9ca3af", border: "1px solid rgba(107,114,128,0.2)" }}>FREE</span>
                <h3 className="font-bebas text-[28px] tracking-[0.03em] text-white leading-none mb-2">Position Size Calculator</h3>
                <p className="text-[#6b7280] text-sm leading-relaxed mb-4">Input your account balance and risk percentage and get your exact position size, lot size, and potential profit or loss instantly. Never risk more than you plan to.</p>
                <ul className="space-y-1.5">
                  {["Exact lot size for your account", "Risk amount in £ or $", "Potential profit calculated instantly"].map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-[#9ca3af]">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="#00e676" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-[#00e676]/10 p-4" style={{ background: "#080a10" }}>
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between items-center px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <span className="font-dm-mono text-[10px] text-[#6b7280]">Balance</span>
                    <span className="font-dm-mono text-[11px] font-bold text-white">£10,000</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <span className="font-dm-mono text-[10px] text-[#6b7280]">Risk %</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <div className="h-full rounded-full" style={{ width: "10%", background: "#00e676" }} />
                      </div>
                      <span className="font-dm-mono text-[11px] font-bold text-[#00e676]">1%</span>
                    </div>
                  </div>
                </div>
                <div className="h-px mb-3" style={{ background: "rgba(255,255,255,0.05)" }} />
                <div className="space-y-1.5">
                  {[
                    { l: "Risk amount",     v: "£100",      c: "#e2e8f0" },
                    { l: "Position size",   v: "0.38 lots", c: "#e2e8f0" },
                    { l: "Potential profit", v: "£245",     c: "#00e676" },
                    { l: "Potential loss",  v: "£100",      c: "#f87171" },
                  ].map((r) => (
                    <div key={r.l} className="flex justify-between items-center">
                      <span className="font-dm-mono text-[10px] text-[#6b7280]">{r.l}</span>
                      <span className="font-dm-mono text-[11px] font-bold" style={{ color: r.c }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── FEATURE 7 — WATCHLIST & ALERTS ─────────────── */}
            <div className="rounded-[14px] border border-white/[0.07] p-8 flex flex-col gap-6 group hover:border-[#00e676]/25 transition-colors duration-300" style={{ background: "#0d1310" }} data-animate data-delay="7">
              <div>
                <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3" style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }}>PRO</span>
                <h3 className="font-bebas text-[28px] tracking-[0.03em] text-white leading-none mb-2">Watchlist & Email Alerts</h3>
                <p className="text-[#6b7280] text-sm leading-relaxed mb-4">Save your favourite pairs and get email alerts the moment a high confidence signal fires. Never miss a setup on the pairs you trade most.</p>
                <ul className="space-y-1.5">
                  {["Unlimited watchlist pairs", "Email alerts on high-confidence signals", "Alert threshold you control"].map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-[#9ca3af]">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="#00e676" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-[#00e676]/10 p-4" style={{ background: "#080a10" }}>
                <div className="space-y-2.5">
                  {[
                    { pair: "XAU/USD", dir: "SHORT",   conf: 87, alert: true,  dc: "#f87171" },
                    { pair: "BTC/USD", dir: "LONG",    conf: 91, alert: true,  dc: "#00e676" },
                    { pair: "EUR/USD", dir: "NEUTRAL", conf: 52, alert: false, dc: "#6b7280" },
                  ].map((w) => (
                    <div key={w.pair} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div className="flex items-center gap-2.5">
                        <span className="font-dm-mono text-[11px] font-bold text-white">{w.pair}</span>
                        <span className="font-dm-mono text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${w.dc}18`, color: w.dc }}>{w.dir}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-dm-mono text-[11px] font-bold" style={{ color: w.conf >= 75 ? "#00e676" : "#6b7280" }}>{w.conf}%</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill={w.alert ? "#00e676" : "#374151"}><path d="M12 2a7 7 0 0 1 7 7c0 5.25 2 6.5 2 9H3c0-2.5 2-3.75 2-9a7 7 0 0 1 7-7zm0 20a2 2 0 0 1-2-2h4a2 2 0 0 1-2 2z" /></svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── FEATURE 8 — AI CHAT ────────────────────────── */}
            <div className="rounded-[14px] border border-white/[0.07] p-8 flex flex-col gap-6 group hover:border-[#00e676]/25 transition-colors duration-300" style={{ background: "#0d1310" }} data-animate data-delay="8">
              <div>
                <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3" style={{ background: "rgba(107,114,128,0.15)", color: "#9ca3af", border: "1px solid rgba(107,114,128,0.2)" }}>FREE</span>
                <h3 className="font-bebas text-[28px] tracking-[0.03em] text-white leading-none mb-2">Follow-Up AI Chat</h3>
                <p className="text-[#6b7280] text-sm leading-relaxed mb-4">After every analysis ask Claude anything about your chart. Get specific answers about entries, risk, alternative scenarios, and trade management — like a professional trader on call 24/7.</p>
                <ul className="space-y-1.5">
                  {["Ask anything about your chart", "Alternative entries & scenarios", "Trade management advice"].map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-[#9ca3af]">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="#00e676" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-[#00e676]/10 p-4 flex flex-col gap-3" style={{ background: "#080a10" }}>
                <div className="flex justify-end">
                  <div className="font-dm-mono text-[11px] text-white px-3 py-2 rounded-xl rounded-br-sm max-w-[80%]" style={{ background: "rgba(255,255,255,0.07)" }}>
                    Where is a safer entry for this setup?
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#00e676" }}>
                    <svg width="10" height="10" viewBox="0 0 15 15" fill="none"><path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="#080a10" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <div className="font-dm-mono text-[10px] text-[#9ca3af] px-3 py-2 rounded-xl rounded-tl-sm flex-1 leading-relaxed" style={{ background: "rgba(0,230,118,0.05)", border: "1px solid rgba(0,230,118,0.1)" }}>
                    A safer entry would be to wait for a retest of 3,285 support with a rejection candle on the 5m...
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="font-dm-mono text-[10px] text-[#4b5563] flex-1">Ask anything about this chart...</span>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,230,118,0.15)" }}>
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 8L8 5L2 2v2.5l4 .5-4 .5V8z" fill="#00e676" /></svg>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14" data-animate>
            <SectionBadge>HOW IT WORKS</SectionBadge>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Chart to trade plan in <span className="text-[#00e676]">under 5 seconds</span>
            </h2>
            <p className="text-[#6b7280] mt-4 text-lg">No complex setup. No learning curve. Just drop and go.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { n: "1", emoji: "🖥",  highlight: false, delay: "1", title: "Screenshot any chart",
                desc: "TradingView, Binance, MT4/5, FXReplay — any platform, any timeframe.",
                checks: ["Drag & drop or click to upload", "PNG, JPG supported", "Any chart platform"] },
              { n: "2", emoji: "🤖",  highlight: false, delay: "2", title: "Drop it in ChartIQ",
                desc: "AI reads price action, structure, volume and indicators instantly.",
                checks: ["Pattern recognition", "Support & resistance", "Multi-indicator analysis"] },
              { n: "3", emoji: "📋",  highlight: false, delay: "3", title: "Get your full trade plan",
                desc: "Signal, entry, SL, TP, R:R, confidence score and AI summary in under 5 seconds.",
                checks: ["Entry & exit levels", "Risk-reward ratio", "Confidence score 0–100"] },
              { n: "4", emoji: "📊",  highlight: false, delay: "4", title: "Track your performance",
                desc: "Every analysis auto-saved to your trade journal with win rate tracking.",
                checks: ["Auto-saved to journal", "Win/loss tracking", "Performance over time"] },
            ].map((step) => (
              <div key={step.n} className="relative rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-1"
                style={{ borderColor: step.highlight ? "rgba(0,230,118,0.35)" : "rgba(255,255,255,0.07)", background: "#0c0f18", boxShadow: "none" }}
                data-animate data-delay={step.delay}>
                <div className="absolute -top-4 -left-4 w-8 h-8 rounded-xl flex items-center justify-center text-sm font-extrabold shadow-lg"
                  style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 14px rgba(0,230,118,0.45)" }}>
                  {step.n}
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center text-2xl mb-4">{step.emoji}</div>
                <h3 className="font-bold text-white mb-2">{step.title}</h3>
                <p className="text-[#6b7280] text-sm leading-relaxed mb-4">{step.desc}</p>
                <ul className="space-y-1.5">
                  {step.checks.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-xs text-[#6b7280]">
                      <Check color="#22c55e" />{c}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="text-center mt-12" data-animate>
            <a href="#analyze" className="btn-purple inline-flex items-center gap-2 px-8 py-3.5 text-sm">Try It Free →</a>
          </div>
        </div>
      </section>

      {/* ── MOST SHARED SETUPS ──────────────────────────────── */}
      <MostSharedSetups />

      {/* ── PRICING ─────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10" data-animate>
            <SectionBadge>SIMPLE PRICING</SectionBadge>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              START FREE. <span className="text-[#00e676]">UPGRADE WHEN YOU ARE READY.</span>
            </h2>
            <p className="text-[#6b7280] mt-4 text-lg">Join 2,400 traders already using ChartIQ. No card needed to start.</p>
          </div>

          {/* Monthly / Annual toggle */}
          <div className="flex items-center justify-center mb-10" data-animate>
            <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <button
                onClick={() => setShowAnnualPricing(false)}
                className="px-5 py-2 rounded-lg font-dm-mono text-sm font-bold transition-all"
                style={!showAnnualPricing ? { background: "#00e676", color: "#080a10" } : { color: "#6b7280" }}>
                Monthly
              </button>
              <button
                onClick={() => setShowAnnualPricing(true)}
                className="flex items-center gap-2 px-5 py-2 rounded-lg font-dm-mono text-sm font-bold transition-all"
                style={showAnnualPricing ? { background: "#00e676", color: "#080a10" } : { color: "#6b7280" }}>
                Annual
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: showAnnualPricing ? "rgba(8,10,16,0.2)" : "rgba(0,230,118,0.15)", color: showAnnualPricing ? "#080a10" : "#00e676" }}>
                  SAVE 35%
                </span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {[
              {
                name: "Free", sub: "For new traders",
                price: "£0", annualPrice: "£0", period: "/month", annualNote: "Free forever",
                note: "No card needed", noteColor: "#4ade80",
                features: [
                  { text: "5 analyses to get started",          locked: false },
                  { text: "Basic signal + entry/SL/TP",        locked: false },
                  { text: "Confidence score",                  locked: false },
                  { text: "Risk calculator",                   locked: false },
                  { text: "Trade Journal",                     locked: true  },
                  { text: "Watchlist & alerts",                locked: true  },
                  { text: "Economic calendar",                 locked: true  },
                  { text: "Multi-timeframe analysis",          locked: true  },
                ],
                cta: "Start for free", highlight: false, popular: false, delay: "1",
              },
              {
                name: "Pro", sub: "For serious traders",
                price: "£19", annualPrice: "£149", period: "/month", annualNote: "£12.42/mo · billed annually",
                note: "Most popular", noteColor: "#00e676",
                features: [
                  { text: "Unlimited chart analyses",           locked: false },
                  { text: "Full trade breakdown + R:R",         locked: false },
                  { text: "Multi-timeframe analysis",           locked: false },
                  { text: "Trade Journal (full history)",        locked: false },
                  { text: "Watchlist + email alerts",           locked: false },
                  { text: "Economic calendar",                  locked: false },
                  { text: "Trade grade A+ to D",                locked: false },
                  { text: "Confluence checklist",               locked: false },
                  { text: "Priority support",                   locked: false },
                ],
                cta: "Upgrade to Pro", highlight: true, popular: true, delay: "2",
              },
              {
                name: "Elite", sub: "For professional traders",
                price: "£39", annualPrice: "£299", period: "/month", annualNote: "£24.92/mo · billed annually",
                note: "Coming soon", noteColor: "#c084fc",
                features: [
                  { text: "Everything in Pro",                  locked: false },
                  { text: "Multi-chart comparison",             locked: false },
                  { text: "PDF export",                         locked: false },
                  { text: "Custom branding on exports",         locked: false },
                  { text: "Early access to new features",       locked: false },
                  { text: "24h priority support",               locked: false },
                ],
                cta: "Join waitlist", highlight: false, popular: false, delay: "3",
              },
            ].map((planItem) => (
              <div key={planItem.name}
                className="relative rounded-2xl border transition-all duration-200 hover:-translate-y-1"
                style={{
                  borderColor: planItem.highlight ? "rgba(0,230,118,0.45)" : "rgba(255,255,255,0.07)",
                  background: planItem.highlight ? "rgba(0,230,118,0.025)" : "#0c0f18",
                  boxShadow: planItem.highlight ? "0 0 40px rgba(0,230,118,0.08)" : "none",
                  padding: planItem.highlight ? "2rem" : "1.75rem",
                  transform: planItem.highlight ? "scale(1.03)" : undefined,
                }}
                data-animate data-delay={planItem.delay}>
                {planItem.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#00e676] text-[#080a10] text-xs font-extrabold whitespace-nowrap"
                    style={{ boxShadow: "0 0 20px rgba(0,230,118,0.45)" }}>
                    BEST VALUE
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="text-xl font-bold text-white">{planItem.name}</h3>
                  <p className="text-[#6b7280] text-sm">{planItem.sub}</p>
                </div>
                <div className="mb-1">
                  <span className="text-[40px] font-extrabold leading-none" style={{ color: planItem.highlight ? "#00e676" : "white" }}>
                    {showAnnualPricing ? planItem.annualPrice : planItem.price}
                  </span>
                  <span className="text-[#6b7280] text-sm">{showAnnualPricing ? "/year" : planItem.period}</span>
                </div>
                <p className="text-sm mb-6 mt-1" style={{ color: planItem.noteColor }}>
                  {showAnnualPricing ? planItem.annualNote : planItem.note}
                </p>
                <ul className="space-y-2 mb-7">
                  {planItem.features.map((f) => {
                    const feat = typeof f === "string" ? { text: f, locked: false } : f;
                    return (
                      <li key={feat.text} className="flex items-center gap-2 text-sm"
                        style={{ color: feat.locked ? "#4b5563" : "white" }}>
                        {feat.locked
                          ? <svg width="12" height="13" viewBox="0 0 12 13" fill="none" className="flex-shrink-0"><rect x="1.5" y="5.5" width="9" height="6.5" rx="1.3" stroke="#4b5563" strokeWidth="1.1"/><path d="M3.5 5.5V4A2.5 2.5 0 018.5 4v1.5" stroke="#4b5563" strokeWidth="1.1" strokeLinecap="round"/></svg>
                          : <Check />
                        }
                        {feat.text}
                      </li>
                    );
                  })}
                </ul>
                <button
                  onClick={() => {
                    if (planItem.highlight && clientId) {
                      fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, annual: showAnnualPricing }) })
                        .then((r) => r.json()).then((d) => { if (d.url) window.location.href = d.url; });
                    }
                  }}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                  style={planItem.highlight ? { background: "#00e676", color: "#080a10", boxShadow: "0 0 22px rgba(0,230,118,0.4)" } : { border: "1px solid rgba(255,255,255,0.14)", color: "white" }}>
                  {planItem.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14" data-animate>
            <SectionBadge>WHAT TRADERS SAY</SectionBadge>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Real traders. <span className="text-[#00e676]">Real results.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "The confidence score is a game changer. I used to second-guess every entry. Now if the AI gives me 80%+, I know the setup is clean. Went from 48% win rate to 67% in 6 weeks.",
                name: "James R.",
                role: "Forex trader · 3 years",
                delay: "1",
              },
              {
                quote: "The journal auto-save alone is worth it. I used to forget to log trades and had no idea if I was actually profitable. Now I can see my win rate in real time and it's pushed me to be more selective.",
                name: "Sophie M.",
                role: "Crypto & indices trader",
                delay: "2",
              },
              {
                quote: "Multi-timeframe analysis changed how I trade. I was getting stopped out constantly until ChartIQ showed me I was trading against the 4H trend. The economic calendar also saved me from trading straight into NFP twice.",
                name: "Daniel K.",
                role: "Full-time trader · Pro plan",
                delay: "3",
              },
            ].map((t) => (
              <div key={t.name} className="rounded-2xl border border-white/[0.07] p-7 flex flex-col gap-5" style={{ background: "#0c0f18" }} data-animate data-delay={t.delay}>
                <div className="flex gap-0.5">
                  {[0,1,2,3,4].map((i) => (
                    <svg key={i} width="14" height="14" viewBox="0 0 14 14" fill="#00e676"><path d="M7 1l1.8 3.6L13 5.4l-3 2.9.7 4.1L7 10.4l-3.7 2 .7-4.1-3-2.9 4.2-.8z"/></svg>
                  ))}
                </div>
                <p className="text-[#9ca3af] text-sm leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
                <div>
                  <p className="text-white text-sm font-bold">{t.name}</p>
                  <p className="text-[#6b7280] text-xs mt-0.5">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BAND ────────────────────────────────────────── */}
      <section className="py-28 px-6" style={{ background: "#080c0a", borderTop: "1px solid rgba(0,230,118,0.18)", borderBottom: "1px solid rgba(0,230,118,0.18)" }}>
        <div className="max-w-4xl mx-auto text-center" data-animate>
          <h2 className="font-bebas text-[clamp(52px,8vw,88px)] leading-none tracking-[0.03em] text-white mb-4">
            STOP GUESSING.<br /><span className="text-[#00e676]">START TRADING.</span>
          </h2>
          <p className="text-[#9ca3af] text-lg mb-10 max-w-md mx-auto leading-relaxed mt-6">
            Join thousands of traders using AI to read charts faster and smarter.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            <a href="#analyze" className="btn-yellow px-8 py-3.5 text-sm flex items-center gap-2">⚡ Start free — no card needed</a>
            <a href="#how-it-works" className="btn-outline px-8 py-3.5 text-sm">See it in action →</a>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-[#6b7280] text-sm">
            {["🔒 No credit card required", "⚡ 5 free analyses to start", "📊 Works with any platform"].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="py-16 px-6 bg-[#05060c] border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <LogoMark />
                <span className="font-bold text-[17px] text-white">ChartIQ <span className="text-[#00e676]">AI</span></span>
              </div>
              <p className="text-[#4b5563] text-sm leading-relaxed mb-5">
                AI-powered trading intelligence. Upload any chart. Get institutional-grade insights instantly.
              </p>
              <div className="flex gap-2.5">
                {["𝕏", "in", "▲", "♪"].map((icon, i) => (
                  <button key={i} className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-xs text-[#4b5563] hover:bg-white/[0.1] hover:text-white transition-all duration-150">{icon}</button>
                ))}
              </div>
            </div>
            {[
              { title: "Product",   links: [["Features", "#features"], ["How It Works", "#how-it-works"], ["Pricing", "/pricing"], ["Brokers", "/brokers"], ["Pine Scripts", "/tools/pine-scripts"], ["Strategy Tester", "/strategy-tester"]] },
              { title: "Resources", links: [["Blog", "#"], ["FAQ", "#"], ["Contact", "#"], ["About Us", "#"], ["Community", "#"]] },
              { title: "Legal",     links: [["Privacy Policy", "#"], ["Terms of Service", "#"], ["Cookie Policy", "#"], ["Disclaimer", "#"]] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-white font-semibold text-sm mb-4">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map(([label, href]) => (
                    <li key={label}><a href={href} className="text-[#4b5563] text-sm hover:text-white transition-colors duration-150">{label}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-8 border-t border-white/[0.05] mb-5">
            <p className="text-[#374151] text-[11px] leading-relaxed text-center">
              ChartIQ AI analysis is for informational purposes only and does not constitute financial advice.
              Trading involves significant risk of loss. Never risk more than you can afford to lose.
              Automated trading features are provided as tools only — you are solely responsible for all trading decisions and outcomes.
              Past performance does not guarantee future results.
            </p>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[#374151] text-sm">© 2026 ChartIQ AI. All rights reserved.</p>
            <div className="flex gap-6 text-[#374151] text-sm">
              <span>🔒 SSL Secured</span>
              <span>✓ GDPR Compliant</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
