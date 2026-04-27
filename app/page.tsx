"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────
type AnalysisResult = {
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;
  timeframe: string;
  summary: string;
  tradeSetup: {
    entry: string;
    entryType: string;
    stopLoss: string;
    takeProfit1: string;
    riskReward: string;
  };
  keyLevels: {
    resistance: string[];
    support: string[];
  };
  indicators: {
    rsi: string;
    macd: string;
    maCross: string;
  };
  confluences: string[];
  warnings: string[];
};

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
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#7c3aed]/30 bg-[#7c3aed]/10 text-[#a78bfa] text-xs font-semibold tracking-[0.13em] uppercase mb-5">
      {children}
    </div>
  );
}

function LogoMark() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#4338ca] flex items-center justify-center flex-shrink-0">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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
            background: "linear-gradient(90deg, #7c3aed, #00e676)",
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

// ── Main app ───────────────────────────────────────────────────
export default function App() {
  const [file, setFile]             = useState<File | null>(null);
  const [preview, setPreview]       = useState<string | null>(null);
  const [asset, setAsset]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<AnalysisResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [revealKey, setRevealKey]           = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [usedToday, setUsedToday]           = useState(0);
  const [clientId, setClientId]             = useState<string | null>(null);
  const [plan, setPlan]                     = useState("free");
  const fileRef = useRef<HTMLInputElement>(null);

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

    // Sync plan from server (background, non-blocking)
    fetch(`/api/user/plan?client_id=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.plan) {
          setPlan(d.plan);
          localStorage.setItem("ciq_plan", d.plan);
        }
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
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  }

  function clearFile() {
    setFile(null);
    setResult(null);
    setError(null);
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
    const fd = new FormData();
    fd.append("file", file);
    fd.append("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
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

      if (data.success && data.analysis) {
        setResult(data.analysis);
        setRevealKey(k => k + 1);
        // Pro users: no counter update needed
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

  const biasColor =
    result?.bias === "BULLISH" ? "#00e676" :
    result?.bias === "BEARISH" ? "#f87171" :
    "#f59e0b";

  const isPro    = plan === "pro";
  const navLinks = ["Features", "How It Works", "Pricing", "Journal", "Account"];

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
            <a key={l} href={l === "Journal" ? "/journal" : `#${l.toLowerCase().replace(/ /g, "-")}`}
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
              const href = l === "Journal" ? "/journal" : l === "Account" ? "/account" : `#${l.toLowerCase().replace(/ /g, "-")}`;
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
            {!isPro && usedToday > 0 && (
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
      <section className="relative pt-40 pb-28 px-6 text-center overflow-hidden">
        <div className="absolute top-0 left-1/2 hero-glow pointer-events-none"
          style={{ width: "900px", height: "520px", background: "radial-gradient(ellipse at center top, rgba(124,58,237,0.15) 0%, transparent 68%)" }} />

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="animate-fade-up">
            <SectionBadge>
              <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse-dot" />
              AI-Powered Chart Analysis
            </SectionBadge>
          </div>
          <h1 className="animate-fade-up delay-100 text-[clamp(42px,7vw,72px)] font-extrabold leading-[1.08] tracking-tight mb-6">
            See What The Market Is<br />
            <span className="text-[#f5c518]">About </span>
            <span className="text-[#38bdf8]">To Do</span><br />
            Before It Happens
          </h1>
          <p className="animate-fade-up delay-200 text-[#6b7280] text-xl mb-10 max-w-sm mx-auto leading-relaxed">
            Upload a chart. Let AI reveal the trade.
          </p>
          <div className="animate-fade-up delay-300 flex flex-wrap items-center justify-center gap-3 mb-16">
            <button className="btn-purple px-7 py-3.5 text-sm">View Pricing →</button>
            <a href="#analyze" className="btn-yellow px-7 py-3.5 text-sm flex items-center gap-2">⚡ Analyze My Chart</a>
            <button className="btn-outline px-7 py-3.5 text-sm flex items-center gap-2">▶ Watch Demo</button>
          </div>
          <div className="animate-fade-up delay-400 flex flex-wrap items-center justify-center gap-4">
            {[{ value: "50K+", label: "Charts Analyzed" }, { value: "100+", label: "Countries" }, { value: "<3s", label: "Analysis Speed" }].map((s) => (
              <div key={s.label} className="px-8 py-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] text-center min-w-[136px]">
                <div className="text-[28px] font-extrabold text-[#f5c518] leading-none mb-1">{s.value}</div>
                <div className="text-[#6b7280] text-xs tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

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

          <div className="grid md:grid-cols-2 gap-6">

            {/* ── Upload card ── */}
            <div className="card-dark p-7" data-animate data-delay="1">
              <div className="mb-5">
                <h3 className="text-lg font-bold text-white">Upload Your Chart</h3>
                <p className="text-[#6b7280] text-sm mt-0.5">Drag & drop or click to select</p>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => !file && fileRef.current?.click()}
                className={[
                  "rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200",
                  file ? "cursor-default" : "cursor-pointer",
                  isDragging ? "border-[#7c3aed] bg-[#7c3aed]/[0.07] scale-[1.01]"
                             : "border-white/[0.09] hover:border-white/20 hover:bg-white/[0.02]",
                ].join(" ")}
              >
                {preview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={preview} alt="Chart preview" className="max-h-52 mx-auto rounded-xl object-contain" />
                ) : (
                  <>
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-[#7c3aed]/10 border border-[#7c3aed]/20 flex items-center justify-center mb-3">
                      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                        <rect x="2" y="4" width="22" height="18" rx="3" stroke="#7c3aed" strokeWidth="1.4" />
                        <path d="M2 9.5h22" stroke="#7c3aed" strokeWidth="1.4" />
                        <circle cx="6" cy="7" r="1.1" fill="#7c3aed" />
                        <circle cx="9.5" cy="7" r="1.1" fill="#7c3aed" />
                        <path d="M6 18l4-5 3.5 3 4.5-6 3 4" stroke="#7c3aed" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
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
                  <div className="w-7 h-7 rounded-lg bg-[#7c3aed]/15 flex items-center justify-center flex-shrink-0">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <rect x="1" y="1" width="11" height="11" rx="2" stroke="#a78bfa" strokeWidth="1.2" />
                      <path d="M3 5h7M3 7.5h5" stroke="#a78bfa" strokeWidth="1.2" strokeLinecap="round" />
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
                className="w-full mt-3 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-[#4b5563] focus:outline-none focus:border-[#7c3aed]/60 transition-colors"
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
                    {result ? `${result.bias} · ${result.timeframe} · ${result.confidence}% confidence` : "Your AI-powered insights will appear here"}
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

              {/* ── Animated results reveal ── */}
              {result && (
                <motion.div
                  key={revealKey}
                  className="space-y-3 relative"
                  initial="hidden"
                  animate="visible"
                >
                  <ScanLine color={biasColor} />

                  {/* Step 1 — Bias / timeframe badge */}
                  <motion.div
                    className="rounded-2xl border p-4 flex items-center justify-between gap-4 relative overflow-hidden"
                    style={{ borderColor: `${biasColor}35`, background: `${biasColor}0d` }}
                    initial={{ opacity: 0, scale: 0.88 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0, duration: 0.45, type: "spring", bounce: 0.28 }}
                  >
                    <ParticleBurst color={biasColor} />
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <p className="text-[#6b7280] text-[10px] uppercase tracking-[0.12em] mb-1">Bias</p>
                      <p className="text-2xl font-extrabold" style={{ color: biasColor, textShadow: `0 0 20px ${biasColor}60` }}>{result.bias}</p>
                    </div>
                    <div className="text-right" style={{ position: "relative", zIndex: 1 }}>
                      <p className="text-[#6b7280] text-[10px] uppercase tracking-[0.12em] mb-1">Timeframe</p>
                      <p className="font-dm-mono text-xl font-bold text-white">{result.timeframe}</p>
                    </div>
                  </motion.div>

                  {/* Step 2 — Confidence gauge (arc draws from 0 via CSS transition) */}
                  <motion.div
                    className="rounded-2xl border border-white/[0.05] bg-white/[0.02] py-6 flex justify-center"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.28, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <ConfidenceGauge score={result.confidence} />
                  </motion.div>

                  {/* Step 3 — Trade setup rows slide in from left */}
                  <motion.div
                    className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4"
                    initial={{ opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.55, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <p className="text-[#6b7280] text-[10px] font-semibold uppercase tracking-[0.12em] mb-3">
                      Trade Setup · {result.tradeSetup.entryType}
                    </p>
                    {[
                      { label: "Entry",         value: result.tradeSetup.entry,       color: "white",   i: 0 },
                      { label: "Stop Loss",     value: result.tradeSetup.stopLoss,    color: "#f87171", i: 1 },
                      { label: "Take Profit",   value: result.tradeSetup.takeProfit1, color: "#4ade80", i: 2 },
                      { label: "Risk / Reward", value: result.tradeSetup.riskReward,  color: "#c084fc", i: 3 },
                    ].map((row) => (
                      <motion.div
                        key={row.label}
                        className="flex justify-between items-center py-2.5 border-b border-white/[0.04] last:border-0"
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.65 + row.i * 0.09, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <span className="text-[#6b7280] text-sm">{row.label}</span>
                        <span className="font-dm-mono text-sm font-semibold" style={{ color: row.color }}>{row.value}</span>
                      </motion.div>
                    ))}
                  </motion.div>

                  {/* Key levels */}
                  <motion.div
                    className="grid grid-cols-2 gap-3"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.82, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="rounded-2xl bg-[#4ade80]/[0.05] border border-[#4ade80]/12 p-3.5">
                      <p className="text-[#4ade80]/50 text-[10px] font-semibold uppercase tracking-wider mb-2">Resistance</p>
                      {result.keyLevels.resistance.map((l, i) => (
                        <p key={i} className="font-dm-mono text-[#4ade80] text-sm leading-relaxed">{l}</p>
                      ))}
                    </div>
                    <div className="rounded-2xl bg-[#f87171]/[0.05] border border-[#f87171]/12 p-3.5">
                      <p className="text-[#f87171]/50 text-[10px] font-semibold uppercase tracking-wider mb-2">Support</p>
                      {result.keyLevels.support.map((l, i) => (
                        <p key={i} className="font-dm-mono text-[#f87171] text-sm leading-relaxed">{l}</p>
                      ))}
                    </div>
                  </motion.div>

                  {/* Indicators */}
                  <motion.div
                    className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4"
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.96, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <p className="text-[#6b7280] text-[10px] font-semibold uppercase tracking-[0.12em] mb-3">Indicators</p>
                    {[
                      { label: "RSI",      value: result.indicators.rsi      },
                      { label: "MACD",     value: result.indicators.macd     },
                      { label: "MA Cross", value: result.indicators.maCross  },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between items-center py-2.5 border-b border-white/[0.04] last:border-0">
                        <span className="text-[#6b7280] text-sm">{row.label}</span>
                        <span className="font-dm-mono text-white text-sm">{row.value}</span>
                      </div>
                    ))}
                  </motion.div>

                  {/* Step 5 — Summary fades in word by word */}
                  <motion.div
                    className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <p className="text-[#6b7280] text-[10px] font-semibold uppercase tracking-[0.12em] mb-2">AI Summary</p>
                    <WordFade text={result.summary} startDelay={1.22} />
                  </motion.div>

                  {/* Confluences */}
                  {result.confluences?.length > 0 && (
                    <motion.div
                      className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.35, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <p className="text-[#6b7280] text-[10px] font-semibold uppercase tracking-[0.12em] mb-3">Confluences</p>
                      <ul className="space-y-2">
                        {result.confluences.map((c, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-[#d1d5db]"><Check />{c}</li>
                        ))}
                      </ul>
                    </motion.div>
                  )}

                  {/* Warnings */}
                  {result.warnings?.length > 0 && (
                    <motion.div
                      className="rounded-2xl bg-[#fbbf24]/[0.05] border border-[#fbbf24]/15 p-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.48, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <p className="text-[#fbbf24] text-[10px] font-semibold uppercase tracking-[0.12em] mb-2">⚠ Risk Warnings</p>
                      {result.warnings.map((w, i) => (
                        <p key={i} className="text-[#fcd34d] text-sm mt-1">· {w}</p>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14" data-animate>
            <SectionBadge>POWERFUL FEATURES</SectionBadge>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              The Trading Edge You've Been <span className="text-[#f5c518]">Missing</span>
            </h2>
            <p className="text-[#6b7280] mt-4 text-lg max-w-lg mx-auto">
              Every feature designed to give you an unfair advantage in the markets
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { emoji: "📊", title: "Instant Chart Intelligence",  desc: "AI reads your chart in seconds, identifying patterns, support/resistance levels, and key price zones automatically.", bg: "rgba(124,58,237,0.1)",  delay: "1" },
              { emoji: "🎯", title: "High-Probability Setups",     desc: "Know exactly where to enter and exit with precise trade setups backed by AI analysis and historical data.",          bg: "rgba(245,197,24,0.1)",  delay: "2" },
              { emoji: "🛡",  title: "Advanced Risk Insights",     desc: "Never trade blindly again. Get comprehensive risk analysis including position sizing and drawdown warnings.",          bg: "rgba(74,222,128,0.1)",  delay: "3" },
              { emoji: "🌐", title: "Multi-Market Compatible",     desc: "Works seamlessly across crypto, forex, stocks, and commodities. One tool for all your trading markets.",             bg: "rgba(56,189,248,0.1)",  delay: "4" },
              { emoji: "📚", title: "Built for All Levels",        desc: "From beginners to professional traders. Our AI adapts to your experience level and trading style.",                   bg: "rgba(167,139,250,0.1)", delay: "5" },
              { emoji: "⚡",  title: "Save Hours Daily",           desc: "Skip the tedious chart analysis. Get actionable insights in under 3 seconds and focus on executing trades.",          bg: "rgba(251,146,60,0.1)",  delay: "6" },
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

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14" data-animate>
            <SectionBadge>HOW IT WORKS</SectionBadge>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Three Steps to <span className="text-[#f5c518]">Trading Intelligence</span>
            </h2>
            <p className="text-[#6b7280] mt-4 text-lg">From chart to clarity in seconds. No complex setup, no learning curve.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "1", emoji: "🖼", highlight: false, delay: "1", title: "Upload Your Chart",
                desc: "Take a screenshot of any trading chart — TradingView, MetaTrader, Binance, or any platform — and upload it.",
                checks: ["Screenshot or drag & drop", "Any chart timeframe", "All markets supported"] },
              { n: "2", emoji: "🤖", highlight: false, delay: "2", title: "AI Analyzes Instantly",
                desc: "Our AI processes your chart in under 3 seconds, detecting patterns, trend lines, indicators, and market structure.",
                checks: ["Pattern recognition", "Support & resistance", "Volume & momentum analysis"] },
              { n: "3", emoji: "📈", highlight: true, delay: "3", title: "Get Actionable Insights",
                desc: "Receive clear, actionable trade setups with entry points, stop loss, take profit targets, and confidence scores.",
                checks: ["Entry & exit points", "Risk-reward ratio", "Confidence score"] },
            ].map((step) => (
              <div key={step.n} className="relative rounded-2xl border p-7 transition-all duration-200 hover:-translate-y-1"
                style={{ borderColor: step.highlight ? "rgba(245,197,24,0.6)" : "rgba(255,255,255,0.07)", background: step.highlight ? "rgba(245,197,24,0.03)" : "#0c0f18", boxShadow: step.highlight ? "0 0 30px rgba(245,197,24,0.08)" : "none" }}
                data-animate data-delay={step.delay}>
                <div className="absolute -top-4 -left-4 w-8 h-8 rounded-xl flex items-center justify-center text-sm font-extrabold shadow-lg"
                  style={{ background: step.highlight ? "#f5c518" : "#7c3aed", color: step.highlight ? "#080a10" : "white", boxShadow: step.highlight ? "0 0 16px rgba(245,197,24,0.5)" : "0 0 14px rgba(124,58,237,0.45)" }}>
                  {step.n}
                </div>
                <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center text-3xl mb-4">{step.emoji}</div>
                <h3 className="font-bold text-white text-lg mb-2">{step.title}</h3>
                <p className="text-[#6b7280] text-sm leading-relaxed mb-4">{step.desc}</p>
                <ul className="space-y-2">
                  {step.checks.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-sm text-[#6b7280]">
                      <Check color={step.highlight ? "#f5c518" : "#22c55e"} />{c}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="text-center mt-12" data-animate>
            <a href="#analyze" className="btn-purple inline-flex items-center gap-2 px-8 py-3.5 text-sm">See It In Action →</a>
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
            <p className="text-[#6b7280] mt-4 text-lg">Start free. Upgrade when you're ready to dominate the markets.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Starter", sub: "Perfect for beginners", price: "$0", period: "/month", note: "Free forever", noteColor: "#4ade80",
                features: ["5 chart analyses/month", "Basic trade setups", "Email support"], disabled: ["Advanced risk analysis"],
                cta: "Get Started Free", highlight: false, popular: false, delay: "1" },
              { name: "Pro", sub: "For serious traders", price: "$49", period: "/month", was: "$79/month",
                note: "Limited-time pricing", noteColor: "#f5c518",
                features: ["Unlimited chart analyses", "Advanced trade setups", "Full risk analysis", "Priority support", "Multi-market analysis"],
                cta: "Start Free Trial", highlight: true, popular: true, delay: "2" },
              { name: "Elite", sub: "For professional traders", price: "$99", period: "/month", was: "$149/month",
                note: "Limited-time pricing", noteColor: "#f5c518",
                features: ["Everything in Pro", "API access", "Custom alerts", "1-on-1 onboarding", "White-label option"],
                cta: "Contact Sales", highlight: false, popular: false, delay: "3" },
            ].map((plan) => (
              <div key={plan.name}
                className="relative rounded-2xl border p-7 transition-all duration-200 hover:-translate-y-1"
                style={{ borderColor: plan.highlight ? "rgba(245,197,24,0.55)" : "rgba(255,255,255,0.07)", background: plan.highlight ? "rgba(245,197,24,0.025)" : "#0c0f18", boxShadow: plan.highlight ? "0 0 40px rgba(245,197,24,0.07)" : "none" }}
                data-animate data-delay={plan.delay}>
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#f5c518] text-[#080a10] text-xs font-extrabold whitespace-nowrap"
                    style={{ boxShadow: "0 0 20px rgba(245,197,24,0.5)" }}>
                    MOST POPULAR
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <p className="text-[#6b7280] text-sm">{plan.sub}</p>
                </div>
                <div className="mb-1">
                  <span className="text-[40px] font-extrabold leading-none" style={{ color: plan.highlight ? "#f5c518" : "white" }}>{plan.price}</span>
                  <span className="text-[#6b7280] text-sm">{plan.period}</span>
                </div>
                {plan.was && <p className="text-[#4b5563] text-sm line-through">{plan.was}</p>}
                <p className="text-sm mb-6 mt-0.5" style={{ color: plan.noteColor }}>{plan.note}</p>
                <ul className="space-y-2.5 mb-7">
                  {plan.features.map((f) => <li key={f} className="flex items-start gap-2 text-sm text-white"><Check />{f}</li>)}
                  {plan.disabled?.map((f) => <li key={f} className="flex items-start gap-2 text-sm text-[#4b5563]"><XIcon />{f}</li>)}
                </ul>
                <button className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                  style={plan.highlight ? { background: "#f5c518", color: "#080a10", boxShadow: "0 0 22px rgba(245,197,24,0.4)" } : { border: "1px solid rgba(255,255,255,0.14)", color: "white" }}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BAND ────────────────────────────────────────── */}
      <section className="cta-gradient py-28 px-6">
        <div className="max-w-4xl mx-auto text-center" data-animate>
          <h2 className="text-5xl md:text-[60px] font-extrabold leading-tight tracking-tight mb-6">
            The Edge You've Been<br /><span className="text-[#f5c518]">Missing</span>
          </h2>
          <p className="text-[#c4b5fd] text-lg mb-10 max-w-sm mx-auto leading-relaxed">
            Start trading with clarity, confidence, and speed.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            <button className="btn-outline px-8 py-3.5 text-sm">View Pricing →</button>
            <a href="#analyze" className="btn-yellow px-8 py-3.5 text-sm flex items-center gap-2">⚡ Analyze My Chart</a>
            <button className="btn-outline px-8 py-3.5 text-sm">▶ Watch Demo</button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-[#a78bfa] text-sm">
            {["🔒 Secure payments", "🛡 30-day guarantee", "⚡ Instant access", "💬 24/7 support"].map((t) => (
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
