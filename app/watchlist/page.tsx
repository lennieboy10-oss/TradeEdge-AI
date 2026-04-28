"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────
type WatchlistItem = {
  id: string;
  client_id: string;
  pair: string;
  created_at: string;
  alerts_enabled: boolean;
  alert_signal: string | null;
  alert_confidence: number | null;
  alert_price: string | null;
  alert_email: string | null;
};

type JournalSnap = {
  asset: string | null;
  signal: string | null;
  confidence: number | null;
  timeframe: string | null;
  created_at: string;
  entry: string | null;
  stop_loss: string | null;
  take_profit: string | null;
};

type AlertDraft = {
  alert_signal: string;
  alert_confidence: string;
  alert_price: string;
  alert_email: string;
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

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00e676]/30 bg-[#00e676]/10 text-[#00e676] text-xs font-semibold tracking-[0.13em] uppercase mb-5">
      {children}
    </div>
  );
}

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="relative flex-shrink-0 w-10 h-5 rounded-full transition-all duration-200 disabled:opacity-40"
      style={{ background: on ? "#00e676" : "rgba(255,255,255,0.1)", border: `1px solid ${on ? "#00e676" : "rgba(255,255,255,0.15)"}` }}
    >
      <span
        className="absolute top-[2px] left-[2px] w-4 h-4 rounded-full transition-all duration-200"
        style={{ background: on ? "#080a10" : "#4b5563", transform: on ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

function SignalBadge({ signal }: { signal: string | null }) {
  if (!signal) return null;
  const color  = signal === "LONG" ? "#00e676" : signal === "SHORT" ? "#f87171" : "#f59e0b";
  const bg     = signal === "LONG" ? "rgba(0,230,118,0.12)" : signal === "SHORT" ? "rgba(248,113,113,0.12)" : "rgba(245,158,11,0.12)";
  const border = signal === "LONG" ? "rgba(0,230,118,0.3)" : signal === "SHORT" ? "rgba(248,113,113,0.3)" : "rgba(245,158,11,0.3)";
  return (
    <span className="font-dm-mono text-[11px] font-bold px-2.5 py-1 rounded-full"
      style={{ color, background: bg, border: `1px solid ${border}` }}>
      {signal}
    </span>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ── Alert settings panel ───────────────────────────────────────
function AlertPanel({
  item,
  draft,
  onChange,
  onSave,
  saving,
  isPro,
}: {
  item: WatchlistItem;
  draft: AlertDraft;
  onChange: (k: keyof AlertDraft, v: string) => void;
  onSave: () => void;
  saving: boolean;
  isPro: boolean;
}) {
  if (!isPro) {
    return (
      <div className="mt-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center gap-3">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
          <rect x="2" y="7" width="12" height="8" rx="2" stroke="#4b5563" strokeWidth="1.3"/>
          <path d="M5 7V5a3 3 0 016 0v2" stroke="#4b5563" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <p className="text-[#4b5563] text-xs flex-1">Upgrade to Pro to enable email alerts.</p>
        <Link href="/account"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0"
          style={{ background: "#00e676", color: "#080a10" }}>
          Upgrade
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22 }}
      className="overflow-hidden"
    >
      <div className="mt-3 p-4 rounded-xl border border-[#00e676]/15 bg-[#00e676]/[0.04] space-y-3">
        <p className="text-[#00e676] text-[10px] font-semibold uppercase tracking-[0.12em] font-dm-mono">Alert Conditions</p>

        {/* Signal condition */}
        <div>
          <p className="text-[#6b7280] text-xs mb-2">Alert when signal changes to:</p>
          <div className="flex gap-2">
            {["LONG", "SHORT", "NEUTRAL"].map((s) => (
              <button key={s} onClick={() => onChange("alert_signal", draft.alert_signal === s ? "" : s)}
                className="text-xs px-3 py-1.5 rounded-lg border font-dm-mono font-semibold transition-all duration-150"
                style={draft.alert_signal === s
                  ? { background: s === "LONG" ? "rgba(0,230,118,0.2)" : s === "SHORT" ? "rgba(248,113,113,0.2)" : "rgba(245,158,11,0.2)",
                      borderColor: s === "LONG" ? "#00e676" : s === "SHORT" ? "#f87171" : "#f59e0b",
                      color: s === "LONG" ? "#00e676" : s === "SHORT" ? "#f87171" : "#f59e0b" }
                  : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.09)", color: "#6b7280" }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Confidence condition */}
        <div>
          <p className="text-[#6b7280] text-xs mb-1.5">Alert when confidence is above:</p>
          <div className="flex items-center gap-2">
            <input type="number" min="0" max="100" value={draft.alert_confidence}
              onChange={(e) => onChange("alert_confidence", e.target.value)}
              placeholder="e.g. 75"
              className="w-24 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.09] text-white text-sm font-dm-mono focus:outline-none focus:border-[#00e676]/50 transition-colors"
            />
            <span className="text-[#6b7280] text-sm">%</span>
          </div>
        </div>

        {/* Price level */}
        <div>
          <p className="text-[#6b7280] text-xs mb-1.5">Alert when price hits:</p>
          <input type="text" value={draft.alert_price}
            onChange={(e) => onChange("alert_price", e.target.value)}
            placeholder="e.g. 1900.00"
            className="w-full px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.09] text-white text-sm font-dm-mono focus:outline-none focus:border-[#00e676]/50 transition-colors"
          />
        </div>

        {/* Email */}
        <div>
          <p className="text-[#6b7280] text-xs mb-1.5">Send alerts to:</p>
          <input type="email" value={draft.alert_email}
            onChange={(e) => onChange("alert_email", e.target.value)}
            placeholder="your@email.com"
            className="w-full px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.09] text-white text-sm focus:outline-none focus:border-[#00e676]/50 transition-colors"
          />
        </div>

        <button onClick={onSave} disabled={saving}
          className="w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-150 disabled:opacity-50"
          style={{ background: "#00e676", color: "#080a10" }}>
          {saving ? "Saving…" : "Save Alert Settings"}
        </button>
      </div>
    </motion.div>
  );
}

// ── Watchlist card ─────────────────────────────────────────────
function WatchlistCard({
  item,
  journal,
  isPro,
  onRemove,
  onToggleAlerts,
  onSaveAlerts,
  savingAlerts,
}: {
  item: WatchlistItem;
  journal: JournalSnap | null;
  isPro: boolean;
  onRemove: (id: string) => void;
  onToggleAlerts: (item: WatchlistItem) => void;
  onSaveAlerts: (item: WatchlistItem, draft: AlertDraft) => void;
  savingAlerts: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<AlertDraft>({
    alert_signal:     item.alert_signal     ?? "",
    alert_confidence: item.alert_confidence != null ? String(item.alert_confidence) : "",
    alert_price:      item.alert_price      ?? "",
    alert_email:      item.alert_email      ?? "",
  });

  const confColor = journal?.confidence
    ? journal.confidence >= 75 ? "#00e676" : journal.confidence >= 50 ? "#f59e0b" : "#f87171"
    : "#4b5563";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.28 }}
      className="card-dark p-5 group transition-all duration-200"
      style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(0,230,118,0.22)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h2 className="font-bebas text-[32px] leading-none tracking-[0.04em] text-white">{item.pair}</h2>
          {journal?.signal && <SignalBadge signal={journal.signal} />}
        </div>
        <button
          onClick={() => onRemove(item.id)}
          className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-red-500/20 flex items-center justify-center transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
          title="Remove from watchlist"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 2l6 6M8 2L2 8" stroke="#9ca3af" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Journal data row */}
      {journal ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4">
          {journal.confidence != null && (
            <span className="font-dm-mono text-xs font-semibold" style={{ color: confColor }}>
              {journal.confidence}% conf
            </span>
          )}
          {journal.timeframe && (
            <span className="font-dm-mono text-[#4b5563] text-xs">{journal.timeframe}</span>
          )}
          <span className="font-dm-mono text-[#4b5563] text-xs">
            Last analysed {timeAgo(journal.created_at)}
          </span>
        </div>
      ) : (
        <p className="text-[#4b5563] text-xs font-dm-mono mb-4">No analysis yet for this pair</p>
      )}

      {/* Bottom row */}
      <div className="flex items-center gap-3">
        {/* Analyse Now */}
        <Link
          href={`/?asset=${encodeURIComponent(item.pair)}#analyze`}
          className="flex-1 text-center py-2 rounded-xl text-xs font-bold transition-all duration-150 hover:-translate-y-0.5"
          style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 14px rgba(0,230,118,0.22)" }}
        >
          Analyse Now →
        </Link>

        {/* Alerts toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isPro && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <title>Pro feature</title>
              <rect x="1.5" y="5.5" width="9" height="6" rx="1.5" stroke="#4b5563" strokeWidth="1.2"/>
              <path d="M3.5 5.5V3.8a2.5 2.5 0 015 0V5.5" stroke="#4b5563" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          )}
          <span className="text-[#6b7280] text-xs">Alerts</span>
          <Toggle
            on={item.alerts_enabled}
            onClick={() => {
              if (!isPro) { setExpanded(true); return; }
              onToggleAlerts(item);
              if (!item.alerts_enabled) setExpanded(true);
              else setExpanded(false);
            }}
          />
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[#4b5563] hover:text-[#9ca3af] transition-colors"
            title="Configure alerts"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 4.5h10M4.5 7h5M6 9.5h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Alert panel */}
      <AnimatePresence>
        {expanded && (
          <AlertPanel
            item={item}
            draft={draft}
            onChange={(k, v) => setDraft((prev) => ({ ...prev, [k]: v }))}
            onSave={() => onSaveAlerts(item, draft)}
            saving={savingAlerts}
            isPro={isPro}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────
export default function WatchlistPage() {
  const [items, setItems]               = useState<WatchlistItem[]>([]);
  const [journalMap, setJournalMap]     = useState<Record<string, JournalSnap>>({});
  const [loading, setLoading]           = useState(true);
  const [addInput, setAddInput]         = useState("");
  const [addLoading, setAddLoading]     = useState(false);
  const [addError, setAddError]         = useState<string | null>(null);
  const [savingId, setSavingId]         = useState<string | null>(null);
  const [clientId, setClientId]         = useState<string | null>(null);
  const [plan, setPlan]                 = useState("free");
  const [mobileOpen, setMobileOpen]     = useState(false);
  const isPro = plan === "pro";

  // Load identity
  useEffect(() => {
    let id = localStorage.getItem("ciq_client_id");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("ciq_client_id", id); }
    setClientId(id);
    setPlan(localStorage.getItem("ciq_plan") ?? "free");
    fetch(`/api/user/plan?client_id=${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.plan) { setPlan(d.plan); localStorage.setItem("ciq_plan", d.plan); } })
      .catch(() => {});
  }, []);

  // Fetch watchlist
  const fetchWatchlist = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/watchlist?client_id=${cid}`);
      const data = await res.json();
      const fetched: WatchlistItem[] = data.items ?? [];
      setItems(fetched);

      if (fetched.length > 0) {
        const pairs = fetched.map((i) => i.pair);
        const journalRes  = await fetch(`/api/journal?assets=${encodeURIComponent(pairs.join(","))}`);
        const journalData = await journalRes.json();
        const map: Record<string, JournalSnap> = {};
        for (const e of (journalData.entries ?? [])) {
          const key = (e.asset ?? "").toLowerCase();
          if (!map[key]) map[key] = e;
        }
        setJournalMap(map);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (clientId) fetchWatchlist(clientId);
  }, [clientId, fetchWatchlist]);

  async function handleAdd() {
    if (!addInput.trim() || !clientId) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const res  = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, pair: addInput.trim(), isPro }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.message ?? data.error ?? "Failed to add pair");
      } else {
        setItems((prev) => [...prev, data.item]);
        setAddInput("");
      }
    } catch { setAddError("Network error"); }
    setAddLoading(false);
  }

  async function handleRemove(id: string) {
    if (!clientId) return;
    await fetch("/api/watchlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, clientId }),
    });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleToggleAlerts(item: WatchlistItem) {
    if (!clientId) return;
    const next = !item.alerts_enabled;
    const res  = await fetch("/api/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, clientId, alerts_enabled: next,
        alert_signal: item.alert_signal, alert_confidence: item.alert_confidence,
        alert_price: item.alert_price, alert_email: item.alert_email }),
    });
    const data = await res.json();
    if (data.item) setItems((prev) => prev.map((i) => i.id === item.id ? data.item : i));
  }

  async function handleSaveAlerts(item: WatchlistItem, draft: AlertDraft) {
    if (!clientId) return;
    setSavingId(item.id);
    const res = await fetch("/api/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id, clientId,
        alerts_enabled:   true,
        alert_signal:     draft.alert_signal || null,
        alert_confidence: draft.alert_confidence ? parseInt(draft.alert_confidence, 10) : null,
        alert_price:      draft.alert_price || null,
        alert_email:      draft.alert_email || null,
      }),
    });
    const data = await res.json();
    if (data.item) setItems((prev) => prev.map((i) => i.id === item.id ? data.item : i));
    setSavingId(null);
  }

  const navLinks = ["Features", "How It Works", "Pricing", "Watchlist", "Journal", "Account"];

  return (
    <div className="min-h-screen bg-[#080a10] text-white overflow-x-hidden">

      {/* Mobile drawer */}
      <div className={`mobile-drawer md:hidden ${mobileOpen ? "open" : ""}`}>
        <div className="flex items-center justify-between px-6 h-16 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-bold text-[17px]">ChartIQ <span className="text-[#f5c518]">AI</span></span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>
        <nav className="flex flex-col px-6 pt-8 gap-1">
          {navLinks.map((l) => (
            <Link key={l}
              href={l === "Journal" ? "/journal" : l === "Account" ? "/account" : l === "Watchlist" ? "/watchlist" : `/#${l.toLowerCase().replace(/ /g, "-")}`}
              onClick={() => setMobileOpen(false)}
              className="text-lg font-semibold text-[#9ca3af] hover:text-white py-3 border-b border-white/[0.05] transition-colors">
              {l}
            </Link>
          ))}
        </nav>
      </div>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 nav-glass">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-bold text-[17px] text-white">ChartIQ <span className="text-[#f5c518]">AI</span></span>
          </Link>
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map((l) => {
              const href = l === "Journal" ? "/journal" : l === "Account" ? "/account" : l === "Watchlist" ? "/watchlist" : `/#${l.toLowerCase().replace(/ /g, "-")}`;
              return (
                <Link key={l} href={href}
                  className="text-sm transition-colors duration-150"
                  style={{ color: l === "Watchlist" ? "#00e676" : "#6b7280" }}>
                  {l}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            {isPro && (
              <span className="hidden md:inline-flex font-dm-mono text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full"
                style={{ background: "rgba(0,230,118,0.12)", color: "#00e676", border: "1px solid rgba(0,230,118,0.25)" }}>PRO</span>
            )}
            <button onClick={() => setMobileOpen(true)}
              className="md:hidden w-9 h-9 rounded-lg bg-white/[0.06] flex flex-col items-center justify-center gap-1.5">
              <span className="block rounded-full" style={{ width: "18px", height: "2px", background: "white" }} />
              <span className="block rounded-full" style={{ width: "14px", height: "2px", background: "white" }} />
              <span className="block rounded-full" style={{ width: "18px", height: "2px", background: "white" }} />
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 pt-28 pb-24">

        {/* Header */}
        <div className="mb-10">
          <SectionBadge>
            <span className="w-2 h-2 rounded-full bg-[#00e676] animate-pulse-dot" />
            Watchlist
          </SectionBadge>
          <h1 className="font-bebas text-[52px] md:text-[64px] leading-none tracking-[0.04em] text-white mb-3">
            YOUR WATCHLIST
          </h1>
          <p className="text-[#6b7280] text-base leading-relaxed max-w-lg">
            Track your favourite pairs, see last analysis signals, and get email alerts when conditions are met.
          </p>
        </div>

        {/* Add pair input */}
        <div className="card-dark p-5 mb-6">
          <p className="text-[#6b7280] text-[10px] font-semibold uppercase tracking-[0.12em] mb-3">Add a pair</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={addInput}
              onChange={(e) => { setAddInput(e.target.value); setAddError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="e.g. XAU/USD, BTC/USD, AAPL"
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-[#4b5563] focus:outline-none focus:border-[#00e676]/60 transition-colors"
            />
            <button
              onClick={handleAdd}
              disabled={!addInput.trim() || addLoading}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 hover:-translate-y-0.5 disabled:opacity-40 flex-shrink-0"
              style={{ background: "#00e676", color: "#080a10" }}>
              {addLoading ? "…" : "+ Add"}
            </button>
          </div>
          {addError && (
            <p className="text-red-400 text-xs mt-2 font-dm-mono">{addError}</p>
          )}
          {!isPro && (
            <p className="text-[#4b5563] text-[11px] mt-2 font-dm-mono">
              Free: up to 5 pairs ·{" "}
              <Link href="/account" className="text-[#00e676] hover:underline">Upgrade for unlimited</Link>
            </p>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-dark p-5 rounded-2xl">
                <div className="skeleton h-8 w-28 rounded mb-3" style={{ animationDelay: `${i * 0.1}s` }} />
                <div className="skeleton h-3 w-48 rounded mb-2" style={{ animationDelay: `${i * 0.1 + 0.05}s` }} />
                <div className="skeleton h-8 w-full rounded" style={{ animationDelay: `${i * 0.1 + 0.1}s` }} />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border-2 border-dashed border-[#00e676]/15 flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#00e676]/[0.06] border border-[#00e676]/15 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="#00e676" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-[#4b5563] text-sm font-medium mb-1">No pairs added yet</p>
            <p className="text-[#374151] text-xs">Add your first pair above to start tracking</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <WatchlistCard
                  key={item.id}
                  item={item}
                  journal={journalMap[(item.pair ?? "").toLowerCase()] ?? null}
                  isPro={isPro}
                  onRemove={handleRemove}
                  onToggleAlerts={handleToggleAlerts}
                  onSaveAlerts={handleSaveAlerts}
                  savingAlerts={savingId === item.id}
                />
              ))}
            </AnimatePresence>

            {/* Pro upsell if free + near limit */}
            {!isPro && items.length >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-[#00e676]/15 bg-[#00e676]/[0.04] p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-white text-sm font-semibold">
                    {items.length >= 5 ? "Watchlist full" : `${5 - items.length} slot${5 - items.length === 1 ? "" : "s"} remaining`}
                  </p>
                  <p className="text-[#6b7280] text-xs mt-0.5">Pro gives you unlimited pairs + email alerts.</p>
                </div>
                <Link href="/account"
                  className="px-4 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition-all hover:-translate-y-0.5"
                  style={{ background: "#00e676", color: "#080a10" }}>
                  Upgrade →
                </Link>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-white/[0.05] text-center">
        <Link href="/" className="inline-flex items-center gap-2.5 opacity-40 hover:opacity-70 transition-opacity">
          <LogoMark />
          <span className="font-bold text-sm text-white">ChartIQ <span className="text-[#f5c518]">AI</span></span>
        </Link>
      </footer>

    </div>
  );
}
