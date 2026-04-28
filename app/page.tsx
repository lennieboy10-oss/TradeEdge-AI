"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

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
  warnings: string[];
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
          const color  = urgent ? "#f87171" : caution ? "#f59e0b" : "#00e676";
          const bg     = urgent ? "rgba(248,113,113,0.1)" : caution ? "rgba(245,158,11,0.1)" : "rgba(0,230,118,0.1)";
          const border = urgent ? "rgba(248,113,113,0.3)" : caution ? "rgba(245,158,11,0.3)" : "rgba(0,230,118,0.3)";
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
    <div className="rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/[0.07] p-3.5 mb-4 flex items-start gap-3">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
        <path d="M8 2L1.5 13.5h13L8 2z" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 6.5v3.5M8 11.5v.5" stroke="#f59e0b" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-[#f59e0b] text-xs font-bold uppercase tracking-[0.1em] mb-0.5 font-dm-mono">
          HIGH IMPACT NEWS IN {minStr}
        </p>
        <p className="text-[#fcd34d] text-xs leading-relaxed">
          {warnings.map((w) => `${w.title} (${w.country})`).join(" · ")} · Consider waiting for the news candle to close before entering this trade.
        </p>
      </div>
    </div>
  );
}

// ── Position calculator ────────────────────────────────────────
type CalcAssetType = "forex" | "crypto" | "stocks" | "gold";
type CalcCurrency  = "GBP" | "USD" | "EUR";
const CURRENCY_SYMBOLS: Record<CalcCurrency, string> = { GBP: "£", USD: "$", EUR: "€" };

function detectCalcAsset(asset: string): CalcAssetType {
  const up = (asset ?? "").toUpperCase().replace(/\s/g, "");
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

type CalcResult = { sizeLabel: string; profit1: number; rr1: number; marginRequired: number; slPips?: number };

function doCalc(
  type: CalcAssetType, riskAmt: number, entry: number, sl: number, tp: number, asset: string
): CalcResult | null {
  const slDist = Math.abs(entry - sl);
  const tpDist = Math.abs(tp - entry);
  if (slDist === 0 || entry === 0) return null;
  const rr1 = tpDist / slDist;
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
    score >= 50 ? "#f59e0b" :
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

// ── Daily limit modal ──────────────────────────────────────────
function LimitModal({ onClose, clientId }: { onClose: () => void; clientId: string | null }) {
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  async function handleUpgrade() {
    setCheckoutLoading(true);
    try {
      const res  = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { /* silent */ }
    setCheckoutLoading(false);
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(4, 6, 10, 0.94)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.22, duration: 0.5 }}
        className="w-full max-w-sm rounded-2xl p-8 text-center"
        style={{
          background: "#080c0a",
          border: "1px solid rgba(0,230,118,0.28)",
          boxShadow: "0 0 60px rgba(0,230,118,0.07), 0 24px 64px rgba(0,0,0,0.55)",
        }}
      >
        <div className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center"
          style={{ background: "rgba(0,230,118,0.09)", border: "1px solid rgba(0,230,118,0.22)" }}>
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <circle cx="13" cy="13" r="10" stroke="#00e676" strokeWidth="1.5" />
            <path d="M13 8v6M13 17v1" stroke="#00e676" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        <h2 className="font-bebas text-[40px] leading-none tracking-[0.05em] text-white mb-3">
          DAILY LIMIT REACHED
        </h2>

        <p className="text-[#6b7280] text-sm leading-relaxed mb-1">
          You&apos;ve used your 3 free analyses today.
        </p>
        <p className="text-[#6b7280] text-sm leading-relaxed mb-6">
          Upgrade to Pro for unlimited chart analysis.
        </p>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] py-4 px-6 mb-6">
          <p className="text-[#4b5563] text-[10px] uppercase tracking-[0.15em] mb-2 font-semibold font-dm-mono">
            Resets in
          </p>
          <MidnightCountdown />
        </div>

        <button
          onClick={handleUpgrade}
          disabled={checkoutLoading}
          className="w-full py-4 rounded-xl text-base font-bold mb-3 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60"
          style={{
            background: "#00e676",
            color: "#080c0a",
            boxShadow: "0 0 28px rgba(0,230,118,0.32), 0 4px 16px rgba(0,0,0,0.3)",
          }}
        >
          {checkoutLoading ? "Redirecting…" : "Upgrade to Pro — £19/mo"}
        </button>

        <button onClick={onClose}
          className="text-[#4b5563] text-sm hover:text-[#9ca3af] transition-colors">
          Remind me tomorrow
        </button>
      </motion.div>
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
          { label: "Aggressive",   riskPct: 2,   color: "#f59e0b" },
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
          {(["forex", "crypto", "stocks", "gold"] as const).map((t) => (
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

// ── Main app ───────────────────────────────────────────────────
export default function App() {
  const [file, setFile]             = useState<File | null>(null);
  const [preview, setPreview]       = useState<string | null>(null);
  const [asset, setAsset]           = useState("");
  const [selectedTF, setSelectedTF] = useState("1H");
  const [activeTab, setActiveTab]   = useState<"current" | "higher" | "highest">("current");
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<MultiResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [revealKey, setRevealKey]           = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [usedToday, setUsedToday]           = useState(0);
  const [clientId, setClientId]             = useState<string | null>(null);
  const [plan, setPlan]                     = useState("free");
  const fileRef = useRef<HTMLInputElement>(null);
  const [chartBase64, setChartBase64]   = useState<string | null>(null);
  const [chartMime, setChartMime]       = useState("image/png");
  const [journalId, setJournalId]       = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalEvent[]>([]);
  const [showCalculator, setShowCalculator] = useState(false);

  // Init client identity + usage from localStorage
  useEffect(() => {
    // Ensure client ID exists
    let id = localStorage.getItem("ciq_client_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("ciq_client_id", id);
    }
    setClientId(id);
    setPlan(localStorage.getItem("ciq_plan") ?? "free");

    // Usage counter
    const today = new Date().toISOString().slice(0, 10);
    const storedDate = localStorage.getItem("ciq_date");
    if (storedDate === today) {
      setUsedToday(parseInt(localStorage.getItem("ciq_used") || "0", 10));
    } else {
      localStorage.setItem("ciq_date", today);
      localStorage.setItem("ciq_used", "0");
    }

    // Pre-fill asset from URL param (?asset=BTC/USD)
    const params = new URLSearchParams(window.location.search);
    const preAsset = params.get("asset");
    if (preAsset) setAsset(decodeURIComponent(preAsset));

    // Fetch economic calendar (background, non-blocking)
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.events)) setCalendarEvents(d.events); })
      .catch(() => {});

    // If we verified pro in this browser session (just upgraded), trust it —
    // don't let a slow/failed Supabase fetch revert the plan.
    if (sessionStorage.getItem("ciq_verified_pro") === "true") {
      setPlan("pro");
      localStorage.setItem("ciq_plan", "pro");
      console.log("Current plan from Supabase: pro (session-verified)");
      return;
    }

    // Otherwise fetch from Supabase — source of truth on fresh loads
    fetch(`/api/user/plan?client_id=${id}`)
      .then((r) => r.json())
      .then((d) => {
        const serverPlan = d.plan ?? "free";
        console.log("Current plan from Supabase:", serverPlan);
        setPlan(serverPlan);
        localStorage.setItem("ciq_plan", serverPlan);
        // If Supabase confirms pro, persist it for this session too
        if (serverPlan === "pro") sessionStorage.setItem("ciq_verified_pro", "true");
      })
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

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

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
    if (asset.trim())  fd.append("asset", asset.trim());
    if (clientId)      fd.append("client_id", clientId);
    try {
      const res  = await fetch("/api/analyze", { method: "POST", body: fd });
      const data = await res.json();

      if (res.status === 429) {
        const today = new Date().toISOString().slice(0, 10);
        setUsedToday(3);
        localStorage.setItem("ciq_used", "3");
        localStorage.setItem("ciq_date", today);
        setShowLimitModal(true);
        return;
      }

      if (data.success && data.analyses) {
        setResult({ analyses: data.analyses, tfLabels: data.tfLabels, confluence: data.confluence });
        setJournalId(data.journalId ?? null);
        setRevealKey(k => k + 1);
        if (!data.usage?.isPro) {
          const newUsed = data.usage?.used ?? usedToday + 1;
          const today   = new Date().toISOString().slice(0, 10);
          setUsedToday(newUsed);
          localStorage.setItem("ciq_used", String(newUsed));
          localStorage.setItem("ciq_date", today);
        }
      } else {
        setError(data.error || "Analysis failed. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  const cur       = result?.analyses.current;
  const biasColor =
    cur?.bias === "BULLISH" ? "#00e676" :
    cur?.bias === "BEARISH" ? "#f87171" :
    "#f59e0b";

  const isPro    = plan === "pro";
  const navLinks = ["Features", "How It Works", "Pricing", "Watchlist", "Calculator", "Calendar", "Journal", "Account"];

  // Calendar urgent badge: HIGH impact event within 2 hours
  const calHasUrgent = calendarEvents.some((e) => {
    if (e.impact !== "High") return false;
    const min = calMinutesFromNow(e);
    return min !== null && min > 0 && min <= 120;
  });

  return (
    <div className="min-h-screen bg-[#080a10] text-white overflow-x-hidden">

      {/* ── DAILY LIMIT MODAL ───────────────────────────────── */}
      {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} clientId={clientId} />}

      {/* ── MOBILE DRAWER ───────────────────────────────────── */}
      <div className={`mobile-drawer md:hidden ${mobileOpen ? "open" : ""}`}>
        <div className="flex items-center justify-between px-6 h-16 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-bold text-[17px]">ChartIQ <span className="text-[#f5c518]">AI</span></span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav className="flex flex-col px-6 pt-8 gap-1">
          {navLinks.map((l) => (
            <a key={l} href={l === "Journal" ? "/journal" : l === "Account" ? "/account" : l === "Watchlist" ? "/watchlist" : l === "Calculator" ? "/calculator" : l === "Calendar" ? "/calendar" : `#${l.toLowerCase().replace(/ /g, "-")}`}
              onClick={() => setMobileOpen(false)}
              className="text-lg font-semibold text-[#9ca3af] hover:text-white py-3 border-b border-white/[0.05] transition-colors">
              {l}
            </a>
          ))}
          <a href="#analyze" onClick={() => setMobileOpen(false)}
            className="btn-yellow mt-6 py-4 text-base text-center rounded-xl flex items-center justify-center gap-2">
            ⚡ Analyze My Chart
          </a>
        </nav>
      </div>

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 nav-glass">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-bold text-[17px] text-white">
              ChartIQ <span className="text-[#f5c518]">AI</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map((l) => {
              const href = l === "Journal" ? "/journal" : l === "Account" ? "/account" : l === "Watchlist" ? "/watchlist" : l === "Calculator" ? "/calculator" : l === "Calendar" ? "/calendar" : `#${l.toLowerCase().replace(/ /g, "-")}`;
              return (
                <a key={l} href={href} className="text-sm text-[#6b7280] hover:text-white transition-colors duration-150">
                  {l}
                </a>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {/* PRO badge */}
            {isPro && (
              <span className="hidden md:inline-flex font-dm-mono text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full"
                style={{ background: "rgba(0,230,118,0.12)", color: "#00e676", border: "1px solid rgba(0,230,118,0.25)" }}>
                PRO
              </span>
            )}
            {/* Usage counter (free only) */}
            {!isPro && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.07]">
                <div className="flex gap-[3px]">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-[5px] h-[5px] rounded-full transition-colors duration-300"
                      style={{
                        background: i < usedToday
                          ? (usedToday >= 3 ? "#ef4444" : usedToday >= 2 ? "#f59e0b" : "#00e676")
                          : "rgba(255,255,255,0.12)"
                      }}
                    />
                  ))}
                </div>
                <span className="font-dm-mono text-[10px] leading-none"
                  style={{ color: usedToday >= 3 ? "#ef4444" : usedToday >= 2 ? "#f59e0b" : "#6b7280" }}>
                  {usedToday}/3 today
                </span>
              </div>
            )}
            {/* Calendar icon with urgent-event badge */}
            <a href="/calendar"
              className="hidden md:flex relative w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] items-center justify-center transition-colors hover:bg-white/[0.08]"
              title="Economic Calendar">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="1" y="2.5" width="13" height="12" rx="2" stroke="#6b7280" strokeWidth="1.2"/>
                <path d="M4.5 1v2M10.5 1v2M1 6.5h13" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {calHasUrgent && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border-2 border-[#080a10]" />
              )}
            </a>
            <a href="#analyze" className="btn-purple px-5 py-2 text-sm hidden md:inline-flex">
              See Live Demo
            </a>
            <button onClick={() => setMobileOpen(true)}
              className="md:hidden w-9 h-9 rounded-lg bg-white/[0.06] flex flex-col items-center justify-center gap-1.5">
              <span className="w-4.5 h-0.5 bg-white rounded-full block" style={{ width: "18px", height: "2px" }} />
              <span className="w-4.5 h-0.5 bg-white rounded-full block" style={{ width: "14px", height: "2px" }} />
              <span className="w-4.5 h-0.5 bg-white rounded-full block" style={{ width: "18px", height: "2px" }} />
            </button>
          </div>
        </div>
      </nav>

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
                Drop a screenshot. Get your entry, stop loss, take profit, confidence score, and full AI trade breakdown in seconds. For stocks, crypto, and forex.
              </p>
              <div className="animate-fade-up delay-300 flex flex-wrap gap-3 mb-10">
                <a href="#analyze" className="btn-yellow px-7 py-3.5 text-sm flex items-center gap-2">⚡ Start free — no card needed</a>
                <a href="#how-it-works" className="btn-outline px-7 py-3.5 text-sm flex items-center gap-2">See it in action →</a>
              </div>
              <div className="animate-fade-up delay-400 flex flex-wrap gap-8">
                {[{ value: "2,400+", label: "Active traders" }, { value: "<5s", label: "Analysis speed" }, { value: "3", label: "Free analyses/day" }].map((s) => (
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
              Analyze Your Chart <span className="text-[#f5c518]">Instantly</span>
            </h2>
            <p className="text-[#6b7280] mt-4 text-lg max-w-lg mx-auto leading-relaxed">
              Upload any trading chart and get institutional-grade insights in under 10 seconds.
            </p>
          </div>

          {/* ── Economic calendar strip ── */}
          <CalendarStrip events={calendarEvents} />

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
                    <p className="text-[#4b5563] text-sm">PNG, JPG — any platform, any timeframe</p>
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

              <input
                type="text"
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                placeholder="Asset (e.g. BTC/USD, EUR/USD, AAPL) — optional"
                className="w-full mt-3 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-[#4b5563] focus:outline-none focus:border-[#00e676]/60 transition-colors"
              />

              <button onClick={handleAnalyze} disabled={!file || loading}
                className="btn-yellow w-full py-3.5 mt-3 text-sm flex items-center justify-center gap-2">
                {loading ? (
                  <><span className="w-4 h-4 rounded-full border-2 border-[#080a10]/25 border-t-[#080a10] animate-spin-btn" />Analyzing with GPT-4o…</>
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
            <div className="card-dark p-7" data-animate data-delay="2">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-white">Analysis Results</h3>
                  <p className="text-[#6b7280] text-sm mt-0.5">
                    {result ? `${cur?.bias} · ${result.tfLabels.current} · ${cur?.confidence}% confidence` : "Your AI-powered insights will appear here"}
                  </p>
                </div>
                {result && (
                  <button onClick={clearFile}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[#9ca3af] hover:text-white text-xs font-medium transition-all duration-150 flex-shrink-0">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M10 5.5A4.5 4.5 0 111 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      <path d="M10 2.5V5.5H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    New Analysis
                  </button>
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
                      const bc    = bias === "BULLISH" ? "#00e676" : bias === "BEARISH" ? "#f87171" : "#f59e0b";
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
                        <motion.div className="rounded-2xl border p-4 flex items-center justify-between gap-4 relative overflow-hidden"
                          style={{ borderColor: `${biasColor}35`, background: `${biasColor}0d` }}
                          initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0, duration: 0.45, type: "spring", bounce: 0.28 }}>
                          <ParticleBurst color={biasColor} />
                          <div style={{ position: "relative", zIndex: 1 }}>
                            <p className="text-[#6b7280] text-[10px] uppercase tracking-[0.12em] mb-1">Bias</p>
                            <p className="text-2xl font-extrabold" style={{ color: biasColor, textShadow: `0 0 20px ${biasColor}60` }}>{a.bias}</p>
                          </div>
                          <div className="text-right" style={{ position: "relative", zIndex: 1 }}>
                            <p className="text-[#6b7280] text-[10px] uppercase tracking-[0.12em] mb-1">Timeframe</p>
                            <p className="font-dm-mono text-xl font-bold text-white">{a.timeframe}</p>
                          </div>
                        </motion.div>
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
                        <motion.div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4"
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 1.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
                          <p className="text-[#6b7280] text-[10px] font-semibold uppercase tracking-[0.12em] mb-2">AI Summary</p>
                          <WordFade text={a.summary} startDelay={1.22} />
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
                          <motion.div className="rounded-2xl bg-[#fbbf24]/[0.05] border border-[#fbbf24]/15 p-4"
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.48, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}>
                            <p className="text-[#fbbf24] text-[10px] font-semibold uppercase tracking-[0.12em] mb-2">⚠ Risk Warnings</p>
                            {a.warnings.map((w, i) => <p key={i} className="text-[#fcd34d] text-sm mt-1">· {w}</p>)}
                          </motion.div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Higher / Highest tabs — pro-gated context card */}
                  {(activeTab === "higher" || activeTab === "highest") && (() => {
                    const a  = result.analyses[activeTab];
                    const tf = result.tfLabels[activeTab];
                    const bc = a.bias === "BULLISH" ? "#00e676" : a.bias === "BEARISH" ? "#f87171" : "#f59e0b";
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
                            <div className="rounded-2xl bg-[#fbbf24]/[0.05] border border-[#fbbf24]/15 p-4">
                              <p className="text-[#fbbf24] text-[10px] font-semibold uppercase tracking-[0.12em] mb-2">⚠ Risk Warnings</p>
                              {a.warnings.map((w, i) => <p key={i} className="text-[#fcd34d] text-sm mt-1">· {w}</p>)}
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

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14" data-animate>
            <SectionBadge>POWERFUL FEATURES</SectionBadge>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Everything You Need to <span className="text-[#f5c518]">Trade Smarter</span>
            </h2>
            <p className="text-[#6b7280] mt-4 text-lg max-w-lg mx-auto">
              Eight tools. One platform. Every edge you need.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { emoji: "📊", title: "AI Chart Analysis",        desc: "Instant signal detection with entry, SL, TP and R:R — analysed in under 5 seconds.",                                   bg: "rgba(0,230,118,0.1)",   delay: "1" },
              { emoji: "🎯", title: "Confidence Score",         desc: "0–100 score showing exactly how strong or weak the setup is before you risk a penny.",                                  bg: "rgba(245,197,24,0.1)",  delay: "2" },
              { emoji: "📓", title: "Trade Journal",            desc: "Every analysis auto-saved. Track wins, losses and win rate over time without lifting a finger.",                        bg: "rgba(74,222,128,0.1)",  delay: "3" },
              { emoji: "📈", title: "Multi-Timeframe Analysis", desc: "See confluence across current, higher and highest timeframes so you never trade against the trend. Pro feature.",      bg: "rgba(124,58,237,0.1)",  delay: "4" },
              { emoji: "📅", title: "Economic Calendar",        desc: "High-impact news alerts built in. Never trade into NFP, CPI or FOMC releases blindly again.",                          bg: "rgba(56,189,248,0.1)",  delay: "5" },
              { emoji: "🧮", title: "Risk Calculator",          desc: "Input your balance and risk %. Get your exact position size and potential profit or loss instantly.",                   bg: "rgba(251,146,60,0.1)",  delay: "6" },
              { emoji: "🔔", title: "Watchlist & Alerts",       desc: "Save your favourite pairs and get email alerts the moment a signal fires on your watchlist.",                          bg: "rgba(167,139,250,0.1)", delay: "7" },
              { emoji: "💬", title: "Follow-up AI Chat",        desc: "Ask Claude anything about your chart after the analysis — unlimited questions on Pro.",                                bg: "rgba(248,113,113,0.1)", delay: "8" },
            ].map((f) => (
              <div key={f.title} className="card-dark card-lift p-6" data-animate data-delay={f.delay}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[22px] mb-4" style={{ background: f.bg }}>{f.emoji}</div>
                <h3 className="font-bold text-white mb-2">{f.title}</h3>
                <p className="text-[#6b7280] text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES SHOWCASE ───────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">

            {/* 1 — Confidence meter */}
            <div className="rounded-2xl border border-white/[0.07] p-7 flex flex-col gap-5" style={{ background: "#0c0f18" }} data-animate data-delay="1">
              <div>
                <p className="font-dm-mono text-[10px] uppercase tracking-[0.18em] text-[#00e676] font-semibold mb-2">KNOW YOUR EDGE</p>
                <h3 className="text-xl font-bold text-white mb-2">Confidence score on every setup</h3>
                <p className="text-[#6b7280] text-sm leading-relaxed">Never trade a weak signal again. The AI scores every setup from 0–100 so you know exactly when to pull the trigger.</p>
              </div>
              <div className="rounded-xl p-5 flex flex-col items-center gap-3 mt-auto"
                style={{ background: "rgba(0,230,118,0.05)", border: "1px solid rgba(0,230,118,0.15)" }}>
                <div className="relative w-28 h-28">
                  <svg viewBox="0 0 100 100" width="112" height="112">
                    <circle cx="50" cy="50" r="36" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${2*Math.PI*36*240/360} ${2*Math.PI*36*(1-240/360)}`} transform="rotate(150 50 50)" />
                    <circle cx="50" cy="50" r="36" fill="none" stroke="#00e676" strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${2*Math.PI*36*240/360*0.84} ${2*Math.PI*36*(1-0.84*240/360)}`} transform="rotate(150 50 50)"
                      style={{ filter: "drop-shadow(0 0 7px rgba(0,230,118,0.6))" }} />
                    <text x="50" y="55" textAnchor="middle" fill="white" fontSize="26" style={{ fontFamily: "var(--font-bebas), Impact, sans-serif" }}>84</text>
                  </svg>
                </div>
                <p className="font-dm-mono text-xs text-[#00e676] font-semibold">Strong setup — high confidence</p>
              </div>
            </div>

            {/* 2 — Watchlist */}
            <div className="rounded-2xl border border-white/[0.07] p-7 flex flex-col gap-5" style={{ background: "#0c0f18" }} data-animate data-delay="2">
              <div>
                <p className="font-dm-mono text-[10px] uppercase tracking-[0.18em] text-[#f59e0b] font-semibold mb-2">NEVER MISS A SETUP</p>
                <h3 className="text-xl font-bold text-white mb-2">Email alerts when signals fire</h3>
                <p className="text-[#6b7280] text-sm leading-relaxed">Add pairs to your watchlist and get alerted the moment the AI spots a trade meeting your criteria.</p>
              </div>
              <div className="space-y-2.5 mt-auto">
                {[
                  { pair: "EUR/USD", signal: "LONG",  conf: 78, color: "#00e676" },
                  { pair: "BTC/USD", signal: "LONG",  conf: 84, color: "#00e676" },
                  { pair: "GBP/JPY", signal: "SHORT", conf: 71, color: "#f87171" },
                ].map((w) => (
                  <div key={w.pair} className="flex items-center justify-between px-4 py-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="font-dm-mono text-sm font-bold text-white">{w.pair}</span>
                    <div className="flex items-center gap-2.5">
                      <span className="font-dm-mono text-[10px] font-bold px-2 py-0.5 rounded-lg"
                        style={{ background: `${w.color}15`, color: w.color, border: `1px solid ${w.color}30` }}>{w.signal}</span>
                      <span className="font-dm-mono text-[11px] text-[#6b7280]">{w.conf}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3 — Journal */}
            <div className="rounded-2xl border border-white/[0.07] p-7 flex flex-col gap-5" style={{ background: "#0c0f18" }} data-animate data-delay="3">
              <div>
                <p className="font-dm-mono text-[10px] uppercase tracking-[0.18em] text-[#c084fc] font-semibold mb-2">TRACK EVERY TRADE</p>
                <h3 className="text-xl font-bold text-white mb-2">Auto-saved journal with win rate</h3>
                <p className="text-[#6b7280] text-sm leading-relaxed">Every analysis lands in your journal automatically. Mark outcomes, add notes, and watch your edge compound.</p>
              </div>
              <div className="rounded-xl p-4 mt-auto" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex justify-between items-center mb-4">
                  <p className="font-dm-mono text-[10px] uppercase tracking-widest text-[#6b7280]">Win Rate</p>
                  <span className="font-bebas text-2xl text-[#00e676]">68%</span>
                </div>
                <div className="space-y-2">
                  {[
                    { asset: "EUR/USD", outcome: "WIN",  color: "#00e676" },
                    { asset: "BTC/USD", outcome: "WIN",  color: "#00e676" },
                    { asset: "AAPL",    outcome: "LOSS", color: "#f87171" },
                  ].map((j) => (
                    <div key={j.asset} className="flex justify-between items-center text-xs">
                      <span className="font-dm-mono text-[#9ca3af]">{j.asset}</span>
                      <span className="font-dm-mono font-bold" style={{ color: j.color }}>{j.outcome}</span>
                    </div>
                  ))}
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
              Chart to trade plan in <span className="text-[#f5c518]">under 5 seconds</span>
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
              { n: "3", emoji: "📋",  highlight: true,  delay: "3", title: "Get your full trade plan",
                desc: "Signal, entry, SL, TP, R:R, confidence score and AI summary in under 5 seconds.",
                checks: ["Entry & exit levels", "Risk-reward ratio", "Confidence score 0–100"] },
              { n: "4", emoji: "📊",  highlight: false, delay: "4", title: "Track your performance",
                desc: "Every analysis auto-saved to your trade journal with win rate tracking.",
                checks: ["Auto-saved to journal", "Win/loss tracking", "Performance over time"] },
            ].map((step) => (
              <div key={step.n} className="relative rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-1"
                style={{ borderColor: step.highlight ? "rgba(245,197,24,0.6)" : "rgba(255,255,255,0.07)", background: step.highlight ? "rgba(245,197,24,0.03)" : "#0c0f18", boxShadow: step.highlight ? "0 0 30px rgba(245,197,24,0.08)" : "none" }}
                data-animate data-delay={step.delay}>
                <div className="absolute -top-4 -left-4 w-8 h-8 rounded-xl flex items-center justify-center text-sm font-extrabold shadow-lg"
                  style={{ background: step.highlight ? "#f5c518" : "#00e676", color: "#080a10", boxShadow: step.highlight ? "0 0 16px rgba(245,197,24,0.5)" : "0 0 14px rgba(0,230,118,0.45)" }}>
                  {step.n}
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center text-2xl mb-4">{step.emoji}</div>
                <h3 className="font-bold text-white mb-2">{step.title}</h3>
                <p className="text-[#6b7280] text-sm leading-relaxed mb-4">{step.desc}</p>
                <ul className="space-y-1.5">
                  {step.checks.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-xs text-[#6b7280]">
                      <Check color={step.highlight ? "#f5c518" : "#22c55e"} />{c}
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

      {/* ── PRICING ─────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14" data-animate>
            <SectionBadge>SIMPLE PRICING</SectionBadge>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Choose Your <span className="text-[#f5c518]">Trading Edge</span>
            </h2>
            <p className="text-[#6b7280] mt-4 text-lg">Start free. Upgrade when you&apos;re ready to go unlimited.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Free", sub: "For new traders", price: "£0", period: "/month", note: "No card needed", noteColor: "#4ade80",
                features: ["3 chart analyses per day", "Basic signal + entry/SL/TP", "Confidence score", "Economic calendar", "Risk calculator", "Last 10 journal entries", "1 follow-up question per analysis", "5 watchlist pairs"],
                disabled: [],
                cta: "Start for free", highlight: false, popular: false, delay: "1",
              },
              {
                name: "Pro", sub: "For serious traders", price: "£19", period: "/month", note: "Most popular", noteColor: "#f5c518",
                features: ["Unlimited chart analyses", "Full trade breakdown + R:R", "Multi-timeframe analysis", "Unlimited journal history", "Unlimited follow-up questions", "Unlimited watchlist pairs", "Email alerts on watchlist", "Priority support", "PRO badge"],
                disabled: [],
                cta: "Upgrade to Pro", highlight: true, popular: true, delay: "2",
              },
              {
                name: "Elite", sub: "For professional traders", price: "£39", period: "/month", note: "Coming soon", noteColor: "#c084fc",
                features: ["Everything in Pro", "Multi-chart comparison", "PDF export", "Custom branding on exports", "Early access to new features", "24h priority support"],
                disabled: [],
                cta: "Join waitlist", highlight: false, popular: false, delay: "3",
              },
            ].map((planItem) => (
              <div key={planItem.name}
                className="relative rounded-2xl border p-7 transition-all duration-200 hover:-translate-y-1"
                style={{ borderColor: planItem.highlight ? "rgba(245,197,24,0.55)" : "rgba(255,255,255,0.07)", background: planItem.highlight ? "rgba(245,197,24,0.025)" : "#0c0f18", boxShadow: planItem.highlight ? "0 0 40px rgba(245,197,24,0.07)" : "none" }}
                data-animate data-delay={planItem.delay}>
                {planItem.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#f5c518] text-[#080a10] text-xs font-extrabold whitespace-nowrap"
                    style={{ boxShadow: "0 0 20px rgba(245,197,24,0.5)" }}>
                    MOST POPULAR
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="text-xl font-bold text-white">{planItem.name}</h3>
                  <p className="text-[#6b7280] text-sm">{planItem.sub}</p>
                </div>
                <div className="mb-1">
                  <span className="text-[40px] font-extrabold leading-none" style={{ color: planItem.highlight ? "#f5c518" : "white" }}>{planItem.price}</span>
                  <span className="text-[#6b7280] text-sm">{planItem.period}</span>
                </div>
                <p className="text-sm mb-6 mt-1" style={{ color: planItem.noteColor }}>{planItem.note}</p>
                <ul className="space-y-2 mb-7">
                  {planItem.features.map((f) => <li key={f} className="flex items-start gap-2 text-sm text-white"><Check />{f}</li>)}
                </ul>
                <button
                  onClick={() => {
                    if (planItem.highlight && clientId) {
                      fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) })
                        .then((r) => r.json()).then((d) => { if (d.url) window.location.href = d.url; });
                    }
                  }}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                  style={planItem.highlight ? { background: "#f5c518", color: "#080a10", boxShadow: "0 0 22px rgba(245,197,24,0.4)" } : { border: "1px solid rgba(255,255,255,0.14)", color: "white" }}>
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
              Real traders. <span className="text-[#f5c518]">Real results.</span>
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
                    <svg key={i} width="14" height="14" viewBox="0 0 14 14" fill="#f5c518"><path d="M7 1l1.8 3.6L13 5.4l-3 2.9.7 4.1L7 10.4l-3.7 2 .7-4.1-3-2.9 4.2-.8z"/></svg>
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
      <section className="cta-gradient py-28 px-6">
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
            {["🔒 No credit card required", "⚡ 3 free analyses daily", "📊 Works with any platform"].map((t) => (
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
                <span className="font-bold text-[17px] text-white">ChartIQ <span className="text-[#f5c518]">AI</span></span>
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
              { title: "Product",   links: ["Features", "How It Works", "Pricing", "Demo", "Case Studies"] },
              { title: "Resources", links: ["Blog", "FAQ", "Contact", "About Us", "Community"] },
              { title: "Legal",     links: ["Privacy Policy", "Terms of Service", "Cookie Policy", "Disclaimer"] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-white font-semibold text-sm mb-4">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l}><a href="#" className="text-[#4b5563] text-sm hover:text-white transition-colors duration-150">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-8 border-t border-white/[0.05] flex flex-col md:flex-row items-center justify-between gap-4">
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
