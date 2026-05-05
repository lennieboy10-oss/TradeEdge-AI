"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useUserPlan } from "@/app/lib/plan-context";
import AppNav from "@/app/components/AppNav";
import { ProLockedPage } from "@/app/components/ProLockedPage";

type CalEvent = {
  title: string;
  country: string;
  date: string;
  time: string;
  impact: "High" | "Medium" | "Low";
  forecast: string;
  previous: string;
  actual: string;
};

// ── Event intelligence ──────────────────────────────────────────
type EventMeta = {
  typicalMove: string;
  affectedPairs: string[];
  strategy: string;
};

const CCY_PAIRS: Record<string, string[]> = {
  USD: ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "XAUUSD"],
  EUR: ["EURUSD", "EURGBP", "EURJPY", "EURCHF", "EURCAD"],
  GBP: ["GBPUSD", "EURGBP", "GBPJPY", "GBPCAD", "GBPCHF"],
  JPY: ["USDJPY", "EURJPY", "GBPJPY", "CADJPY", "AUDJPY"],
  AUD: ["AUDUSD", "AUDNZD", "AUDJPY", "AUDCAD"],
  CAD: ["USDCAD", "EURCAD", "CADJPY", "AUDCAD"],
  NZD: ["NZDUSD", "NZDCAD", "NZDJPY", "AUDNZD"],
  CHF: ["USDCHF", "EURCHF", "GBPCHF", "CHFJPY"],
};

const EVENT_RULES: [RegExp, { typicalMove?: string; affectedPairs?: string[] }][] = [
  [/non.?farm|nfp/i,                        { typicalMove: "80–250 pips EURUSD · 100–300 XAUUSD", affectedPairs: ["EURUSD","GBPUSD","USDJPY","XAUUSD"] }],
  [/fomc|fed funds|fed rate/i,              { typicalMove: "50–150+ pips · 200+ on surprises",    affectedPairs: ["EURUSD","GBPUSD","USDJPY","XAUUSD","USDCHF"] }],
  [/pce|personal consumption expenditure/i, { typicalMove: "30–80 pips",                           affectedPairs: ["EURUSD","USDJPY","XAUUSD"] }],
  [/cpi|consumer price/i,                   { typicalMove: "30–100 pips" }],
  [/gdp/i,                                  { typicalMove: "20–80 pips" }],
  [/pmi|purchasing manager/i,               { typicalMove: "20–60 pips" }],
  [/retail sales/i,                         { typicalMove: "25–80 pips" }],
  [/unemployment|claimant|jobless/i,        { typicalMove: "20–60 pips" }],
  [/adp\s+(non.?farm|employment)/i,         { typicalMove: "20–60 pips" }],
  [/jolts|job opening/i,                    { typicalMove: "15–50 pips" }],
  [/interest rate|rate decision|cash rate|bank rate/i, { typicalMove: "50–200+ pips on surprise" }],
  [/ism\s*(manufacturing|services|non)/i,   { typicalMove: "20–50 pips" }],
  [/ppi|producer price/i,                   { typicalMove: "20–60 pips" }],
  [/trade balance/i,                        { typicalMove: "15–40 pips" }],
  [/housing start|building permit/i,        { typicalMove: "10–30 pips" }],
  [/inflation/i,                            { typicalMove: "25–80 pips" }],
];

const STRATEGY: Record<"High" | "Medium" | "Low", string> = {
  High:   "Close or reduce positions 15 min before. Wait for the initial spike to fade (2–5 min) before re-entering with a confirmed close.",
  Medium: "Tighten stops or reduce size 5 min before. Initial move often retraces within 10 min.",
  Low:    "Low expected impact — monitor only. No position changes needed.",
};

function getEventMeta(event: CalEvent): EventMeta {
  let typicalMove = "";
  let affectedPairs: string[] | undefined;

  for (const [rx, rule] of EVENT_RULES) {
    if (rx.test(event.title)) {
      if (rule.typicalMove) typicalMove = rule.typicalMove;
      if (rule.affectedPairs) affectedPairs = rule.affectedPairs;
      break;
    }
  }

  return {
    typicalMove,
    affectedPairs: affectedPairs ?? CCY_PAIRS[event.country] ?? [],
    strategy: STRATEGY[event.impact],
  };
}

function parseNum(s: string): number | null {
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

type BeatMiss = "BEAT" | "MISS" | null;

function getBeatMiss(actual: string, forecast: string): BeatMiss {
  const a = parseNum(actual);
  const f = parseNum(forecast);
  if (a === null || f === null) return null;
  if (a === f) return null;
  return a > f ? "BEAT" : "MISS";
}

// ── Helpers ────────────────────────────────────────────────────
function normDate(raw: string): string {
  const mdy = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  return raw.slice(0, 10);
}

function todayUTC(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function fmtDayHeader(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const DAY = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${DAY[dt.getUTCDay()]} ${String(d).padStart(2, "0")} ${MON[m - 1]}`;
}

function fmtTime(t: string): string {
  if (!t || /all.?day|tentative/i.test(t)) return "All Day";
  return t.slice(0, 5);
}

function parseEventMs(dateStr: string, timeStr: string): number | null {
  if (!timeStr || /all.?day|tentative/i.test(timeStr)) return null;
  const mdy = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  const ymd = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let y: number, mo: number, d: number;
  if (mdy) { mo = +mdy[1]; d = +mdy[2]; y = +mdy[3]; }
  else if (ymd) { y = +ymd[1]; mo = +ymd[2]; d = +ymd[3]; }
  else return null;
  const [h, m = 0] = timeStr.split(":").map(Number);
  return Date.UTC(y, mo - 1, d, h, m);
}

function minutesFromNow(dateStr: string, timeStr: string): number | null {
  const ms = parseEventMs(dateStr, timeStr);
  if (ms === null) return null;
  return Math.round((ms - Date.now()) / 60_000);
}

function fmtCountdown(min: number): string {
  if (min <= 0) return "NOW";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const FLAGS: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵",
  AUD: "🇦🇺", CAD: "🇨🇦", NZD: "🇳🇿", CHF: "🇨🇭",
  CNY: "🇨🇳", XAU: "🥇", BTC: "₿",
};

const IMPACT_COLORS = {
  High:   { dot: "#ef4444", text: "#f87171", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.2)" },
  Medium: { dot: "#f97316", text: "#fb923c", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.2)" },
  Low:    { dot: "#374151", text: "#6b7280", bg: "rgba(55,65,81,0.15)",  border: "rgba(55,65,81,0.2)" },
};

// ── Shared UI ──────────────────────────────────────────────────
function LogoMark() {
  return (
    <div className="w-8 h-8 rounded-full bg-[#00e676] flex items-center justify-center flex-shrink-0">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="#080a10" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ImpactDot({ impact }: { impact: "High" | "Medium" | "Low" }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: IMPACT_COLORS[impact].dot }} />
      <span className="text-xs font-dm-mono" style={{ color: IMPACT_COLORS[impact].text }}>{impact}</span>
    </span>
  );
}

// ── Event row ──────────────────────────────────────────────────
function EventRow({ event }: { event: CalEvent }) {
  const [open, setOpen] = useState(false);
  const min = minutesFromNow(event.date, event.time);
  const isImminent = min !== null && min >= -60 && min <= 120;
  const isDanger   = min !== null && min >= -15 && min <= 15;
  const isPast     = min !== null && min < -15;
  const ic = IMPACT_COLORS[event.impact];
  const meta = getEventMeta(event);

  const beatMiss: BeatMiss = event.actual ? getBeatMiss(event.actual, event.forecast) : null;
  const hasActual = !!event.actual;

  return (
    <>
      <tr
        onClick={() => setOpen(!open)}
        className="cursor-pointer transition-colors"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          background: isDanger ? "rgba(239,68,68,0.04)" : undefined,
          outline: isDanger ? "1px solid rgba(239,68,68,0.2)" : undefined,
        }}
      >
        <td className="py-3 pl-4 pr-2 font-dm-mono text-xs text-[#6b7280] whitespace-nowrap">{fmtTime(event.time)} UTC</td>
        <td className="py-3 px-2 whitespace-nowrap">
          <span className="font-dm-mono text-xs font-semibold text-white">
            {FLAGS[event.country] ?? ""} {event.country}
          </span>
        </td>
        <td className="py-3 px-2 w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-white font-medium">{event.title}</span>
            {isImminent && !isPast && (
              <span className="font-dm-mono text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: isDanger ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                  color: isDanger ? "#f87171" : "#fbbf24",
                  border: isDanger ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(245,158,11,0.3)",
                }}>
                {fmtCountdown(min!)}
              </span>
            )}
            {isDanger && event.impact === "High" && (
              <span className="font-dm-mono text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse"
                style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.5)" }}>
                PREPARE NOW
              </span>
            )}
          </div>
        </td>
        <td className="py-3 px-2 whitespace-nowrap"><ImpactDot impact={event.impact} /></td>
        <td className="py-3 px-2 font-dm-mono text-xs text-[#9ca3af] whitespace-nowrap">{event.forecast || "—"}</td>
        <td className="py-3 px-2 font-dm-mono text-xs whitespace-nowrap">
          {hasActual ? (
            <span style={{ color: beatMiss === "BEAT" ? "#4ade80" : beatMiss === "MISS" ? "#f87171" : "#9ca3af" }}>
              {event.actual}
            </span>
          ) : (
            <span className="text-[#374151]">—</span>
          )}
        </td>
        <td className="py-3 pr-4 pl-2 font-dm-mono text-xs text-[#6b7280] whitespace-nowrap">{event.previous || "—"}</td>
      </tr>

      {open && (
        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.018)" }}>
          <td colSpan={7} className="px-4 py-4">
            <div className="space-y-3">

              {/* Data comparison */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-dm-mono text-xs">
                {hasActual && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#6b7280] uppercase tracking-[0.1em]">Actual</span>
                    <span className="font-bold text-sm" style={{ color: beatMiss === "BEAT" ? "#4ade80" : beatMiss === "MISS" ? "#f87171" : "#e5e7eb" }}>
                      {event.actual}
                    </span>
                    {beatMiss && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold"
                        style={beatMiss === "BEAT"
                          ? { background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }
                          : { background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
                        {beatMiss}
                      </span>
                    )}
                  </div>
                )}
                <div>
                  <span className="text-[#6b7280] uppercase tracking-[0.1em]">Forecast </span>
                  <span className="text-white font-semibold">{event.forecast || "N/A"}</span>
                </div>
                <div>
                  <span className="text-[#6b7280] uppercase tracking-[0.1em]">Previous </span>
                  <span className="text-white font-semibold">{event.previous || "N/A"}</span>
                </div>
              </div>

              {/* Typical move */}
              {meta.typicalMove && (
                <div className="flex items-center gap-2 text-xs">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="flex-shrink-0">
                    <path d="M1.5 10L4.5 5.5L7 7.5L11 2.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-[#6b7280]">Typical move: </span>
                  <span className="font-dm-mono font-semibold text-[#fbbf24]">{meta.typicalMove}</span>
                </div>
              )}

              {/* Affected pairs */}
              {meta.affectedPairs.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[#6b7280] text-xs">Affected pairs:</span>
                  {meta.affectedPairs.map((p) => (
                    <span key={p} className="font-dm-mono text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(255,255,255,0.05)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }}>
                      {p}
                    </span>
                  ))}
                </div>
              )}

              {/* Strategy */}
              <div className="rounded-xl p-3"
                style={event.impact === "High"
                  ? { background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)" }
                  : event.impact === "Medium"
                  ? { background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }
                  : { background: "rgba(55,65,81,0.2)", border: "1px solid rgba(55,65,81,0.3)" }}>
                <p className="text-xs leading-relaxed"
                  style={{ color: event.impact === "High" ? "#fca5a5" : event.impact === "Medium" ? "#fdba74" : "#6b7280" }}>
                  <span className="font-bold font-dm-mono">Strategy: </span>{meta.strategy}
                </p>
              </div>

            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Next high-impact event banner ──────────────────────────────
function NextEventBanner({ events }: { events: CalEvent[] }) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const candidates = events
    .filter((e) => e.impact === "High")
    .map((e) => ({ event: e, min: minutesFromNow(e.date, e.time) }))
    .filter(({ min }) => min !== null && min > -60)
    .sort((a, b) => a.min! - b.min!);

  if (candidates.length === 0) return null;

  const { event, min } = candidates[0];
  const isDanger = min !== null && min <= 30;

  return (
    <div className="rounded-2xl p-4 mb-6 flex items-center justify-between gap-4 flex-wrap"
      style={isDanger
        ? { background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }
        : { background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: isDanger ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.12)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke={isDanger ? "#ef4444" : "#f59e0b"} strokeWidth="1.3"/>
            <path d="M8 5v3.5l2 2" stroke={isDanger ? "#ef4444" : "#f59e0b"} strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <p className="font-dm-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: isDanger ? "#f87171" : "#fbbf24" }}>
            Next high-impact event
          </p>
          <p className="text-sm font-semibold text-white">
            {FLAGS[event.country] ?? ""} {event.country} · {event.title}
          </p>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-bebas text-3xl tracking-[0.05em]"
          style={{ color: isDanger ? "#ef4444" : "#fbbf24" }}>
          {min !== null ? fmtCountdown(min) : "—"}
        </p>
        <p className="font-dm-mono text-[10px] text-[#6b7280]">{fmtTime(event.time)} UTC</p>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────
type ImpactFilter   = "All" | "High" | "Medium" | "Low";
type CurrencyFilter = "All" | "USD" | "EUR" | "GBP" | "JPY" | "AUD" | "CAD" | "CHF";

function CalendarLockIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect x="4" y="6" width="24" height="22" rx="3" stroke="#00e676" strokeWidth="1.6"/>
      <path d="M10 4v4M22 4v4M4 14h24" stroke="#00e676" strokeWidth="1.6" strokeLinecap="round"/>
      <rect x="12" y="18" width="8" height="7" rx="1.5" stroke="#00e676" strokeWidth="1.3"/>
    </svg>
  );
}

export default function CalendarPage() {
  const { isPro: isProUser } = useUserPlan();
  const [events, setEvents]           = useState<CalEvent[]>([]);
  const [loading, setLoading]         = useState(true);
  const [lastRefresh, setLastRefresh] = useState(0);
  const [impact, setImpact]           = useState<ImpactFilter>("High");
  const [currency, setCurrency]       = useState<CurrencyFilter>("All");
  const [clientId, setClientId]       = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res  = await fetch("/api/calendar");
      const data = await res.json();
      setEvents(data.events ?? []);
      setLastRefresh(Date.now());
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    let id = localStorage.getItem("ciq_client_id");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("ciq_client_id", id); }
    setClientId(id);
    fetchEvents();
    const t = setInterval(fetchEvents, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchEvents]);

  const filtered = events.filter((e) => {
    if (impact !== "All" && e.impact !== impact) return false;
    if (currency !== "All" && e.country !== currency) return false;
    return true;
  });

  const groups = new Map<string, CalEvent[]>();
  for (const e of filtered) {
    const key = normDate(e.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const sortedDates = Array.from(groups.keys()).sort();
  const today = todayUTC();

  const todayHighCount = events.filter((e) => normDate(e.date) === today && e.impact === "High").length;

  return (
    <div className="min-h-screen bg-[#080a10] text-white overflow-x-hidden">
      <AppNav />

      {!isProUser ? (
        <ProLockedPage
          icon={<CalendarLockIcon />}
          heading="TRADE AROUND THE NEWS"
          subtext="Never trade into high impact news blindly — see upcoming events before you analyse — Pro only"
          features={[
            "Full week economic calendar",
            "Historical pip impact per event",
            "Pre-event strategy suggestions",
            "Affected currency pair mapping",
            "Actual vs forecast comparison",
            "Auto refresh every 30 minutes",
          ]}
          ctaLabel="Unlock calendar — £19/mo"
          clientId={clientId}
        />
      ) : (
        <>
          <div className="max-w-6xl mx-auto px-4 md:px-6 pt-28 pb-24">

            {/* Header */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00e676]/30 bg-[#00e676]/10 text-[#00e676] text-xs font-semibold tracking-[0.13em] uppercase mb-4">
                <span className="w-2 h-2 rounded-full bg-[#00e676] animate-pulse-dot" />
                Live · Updates every 30 min
              </div>
              <h1 className="font-bebas text-[52px] md:text-[64px] leading-none tracking-[0.04em] text-white mb-2">
                ECONOMIC CALENDAR
              </h1>
              <div className="flex items-center gap-4 flex-wrap">
                <p className="text-[#6b7280] text-base">
                  High-impact events that move markets. All times UTC.
                </p>
                {todayHighCount > 0 && (
                  <span className="font-dm-mono text-xs px-3 py-1 rounded-full"
                    style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                    {todayHighCount} high-impact event{todayHighCount > 1 ? "s" : ""} today
                  </span>
                )}
              </div>
              {lastRefresh > 0 && (
                <p className="font-dm-mono text-[11px] text-[#374151] mt-1">
                  Last updated {new Date(lastRefresh).toLocaleTimeString()}
                  <button onClick={fetchEvents} className="ml-3 text-[#4b5563] hover:text-[#9ca3af] transition-colors underline">Refresh</button>
                </p>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="flex gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                {(["All", "High", "Medium", "Low"] as ImpactFilter[]).map((v) => (
                  <button key={v} onClick={() => setImpact(v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold font-dm-mono transition-all duration-150"
                    style={impact === v
                      ? { background: "#00e676", color: "#080a10" }
                      : { background: "transparent", color: "#6b7280" }}>
                    {v === "All" ? "All Impact" : v}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-x-auto">
                {(["All", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF"] as CurrencyFilter[]).map((v) => (
                  <button key={v} onClick={() => setCurrency(v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold font-dm-mono transition-all duration-150 whitespace-nowrap flex-shrink-0"
                    style={currency === v
                      ? { background: "#00e676", color: "#080a10" }
                      : { background: "transparent", color: "#6b7280" }}>
                    {v === "All" ? "All CCY" : `${FLAGS[v] ?? ""} ${v}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Next high-impact countdown */}
            {!loading && <NextEventBanner events={events} />}

            {/* Table */}
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card-dark p-5 rounded-2xl">
                    <div className="skeleton h-4 w-32 rounded mb-3" />
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="flex gap-4 mb-2">
                        <div className="skeleton h-3 w-12 rounded" />
                        <div className="skeleton h-3 w-10 rounded" />
                        <div className="skeleton h-3 w-48 rounded" />
                        <div className="skeleton h-3 w-16 rounded ml-auto" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : sortedDates.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-white/[0.07] flex flex-col items-center justify-center py-20 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="4" width="20" height="18" rx="3" stroke="#374151" strokeWidth="1.4"/>
                    <path d="M8 2v3M16 2v3M2 10h20" stroke="#374151" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="text-[#4b5563] text-sm font-medium">No events match your filters</p>
                <p className="text-[#374151] text-xs mt-1">Try changing the impact or currency filter</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedDates.map((iso) => {
                  const isCurrentDay = iso === today;
                  const dayEvents = groups.get(iso)!.sort((a, b) => {
                    if (!a.time || a.time === "All Day") return -1;
                    if (!b.time || b.time === "All Day") return 1;
                    return a.time.localeCompare(b.time);
                  });
                  const highCount = dayEvents.filter((e) => e.impact === "High").length;

                  return (
                    <div key={iso}
                      className="card-dark overflow-hidden rounded-2xl"
                      style={isCurrentDay ? { borderLeft: "3px solid #00e676" } : {}}>
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05]"
                        style={isCurrentDay ? { background: "rgba(0,230,118,0.04)" } : {}}>
                        <span className="font-bebas text-lg tracking-[0.08em]"
                          style={{ color: isCurrentDay ? "#00e676" : "#ffffff" }}>
                          {fmtDayHeader(iso)}
                        </span>
                        {isCurrentDay && (
                          <span className="font-dm-mono text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(0,230,118,0.15)", color: "#00e676", border: "1px solid rgba(0,230,118,0.3)" }}>
                            TODAY
                          </span>
                        )}
                        {highCount > 0 && (
                          <span className="font-dm-mono text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                            {highCount} HIGH
                          </span>
                        )}
                        <span className="font-dm-mono text-[11px] text-[#4b5563] ml-auto">{dayEvents.length} events</span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full" style={{ borderCollapse: "collapse" }}>
                          <colgroup>
                            <col style={{ width: "80px" }} />
                            <col style={{ width: "72px" }} />
                            <col style={{ width: "auto" }} />
                            <col style={{ width: "90px" }} />
                            <col style={{ width: "76px" }} />
                            <col style={{ width: "76px" }} />
                            <col style={{ width: "76px" }} />
                          </colgroup>
                          <thead>
                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                              {["Time", "CCY", "Event", "Impact", "Forecast", "Actual", "Previous"].map((h) => (
                                <th key={h} className="px-2 py-2 text-left font-dm-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4b5563]"
                                  style={{ paddingLeft: h === "Time" ? "16px" : undefined, paddingRight: h === "Previous" ? "16px" : undefined }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {dayEvents.map((e, i) => <EventRow key={i} event={e} />)}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="mt-6 flex flex-wrap items-center gap-4 text-[11px] font-dm-mono text-[#4b5563]">
              <span>Click any row for strategy + typical move</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#4ade80]" /> BEAT = actual above forecast
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#f87171]" /> MISS = actual below forecast
              </span>
            </div>
          </div>

          <footer className="py-10 px-6 border-t border-white/[0.05] text-center">
            <Link href="/" className="inline-flex items-center gap-2.5 opacity-40 hover:opacity-70 transition-opacity">
              <LogoMark />
              <span className="font-bold text-sm text-white">ChartIQ <span className="text-[#00e676]">AI</span></span>
            </Link>
            <p className="font-dm-mono text-[11px] text-[#374151] mt-3">All times UTC · Data from ForexFactory via faireconomy.media</p>
          </footer>
        </>
      )}
    </div>
  );
}
