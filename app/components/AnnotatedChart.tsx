"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";

export type FVGItem          = { type: string; priceRange: string; filled?: boolean; description?: string };
export type SweepItem        = { direction?: string; price: string; description?: string };
export type OBItem           = { type: string; priceRange: string; description?: string };
export type StructureItem    = { type: string; price: string; description?: string };
export type EqualLevelItem   = { type: string; price: string; description?: string };
export type PatternItem      = { name: string; direction?: string; target?: string; description?: string };
export type FibItem          = { level: string; price: string; description?: string };

export type SMCData = {
  fvg?:             FVGItem[];
  liquiditySweeps?: SweepItem[];
  orderBlocks?:     OBItem[];
  structureBreaks?: StructureItem[];
  equalLevels?:     EqualLevelItem[];
  marketZone?:      string;
  patterns?:        PatternItem[];
  smcFibonacci?:    FibItem[];
  smc_summary?:     string | null;
};

interface Props {
  chartBase64: string | null;
  chartMime:   string;
  smc:         SMCData;
  entry:       string;
  stopLoss:    string;
  takeProfit:  string;
  isPro:       boolean;
  clientId:    string | null;
}

type LayerKey = "fvg" | "ob" | "liquidity" | "patterns" | "fib" | "levels";
const LAYER_LABELS: Record<LayerKey, string> = {
  fvg: "FVG", ob: "Order Blocks", liquidity: "Liquidity", patterns: "Patterns", fib: "Fibonacci", levels: "Levels",
};

function parseP(s: string): number {
  const n = parseFloat((s ?? "").replace(/,/g, "").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function parseRange(s: string): [number, number] {
  const clean = (s ?? "").replace(/,/g, "");
  const m = clean.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  if (m) {
    const a = parseFloat(m[1]), b = parseFloat(m[2]);
    return [Math.min(a, b), Math.max(a, b)];
  }
  const p = parseP(s);
  return p > 0 ? [p * 0.9995, p * 1.0005] : [0, 0];
}

export default function AnnotatedChart({ chartBase64, chartMime, smc, entry, stopLoss, takeProfit, isPro, clientId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);
  const [ready, setReady]     = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    fvg: true, ob: true, liquidity: true, patterns: true, fib: true, levels: true,
  });

  useEffect(() => {
    if (!chartBase64) return;
    setReady(false);
    const img = new Image();
    img.onload  = () => { imgRef.current = img; setReady(true); };
    img.onerror = () => setReady(false);
    img.src = `data:${chartMime || "image/png"};base64,${chartBase64}`;
  }, [chartBase64, chartMime]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img || !ready) return;

    const W = img.naturalWidth;
    const H = img.naturalHeight;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);

    if (!isPro) return;

    // Approximate chart data area (leaves room for axes/labels)
    const CL = W * 0.02;
    const CR = W * 0.87;
    const CT = H * 0.05;
    const CB = H * 0.86;
    const CW  = CR - CL;
    const CH  = CB - CT;

    // Collect all price values to determine visible range
    const prices: number[] = [];
    const push = (s: string) => { const p = parseP(s); if (p > 0) prices.push(p); };
    const pushR = (s: string) => { const [a, b] = parseRange(s); if (a > 0) { prices.push(a); prices.push(b); } };

    push(entry); push(stopLoss); push(takeProfit);
    (smc.fvg             ?? []).forEach(f => pushR(f.priceRange));
    (smc.orderBlocks     ?? []).forEach(o => pushR(o.priceRange));
    (smc.equalLevels     ?? []).forEach(e => push(e.price));
    (smc.structureBreaks ?? []).forEach(s => push(s.price));
    (smc.smcFibonacci    ?? []).forEach(f => push(f.price));
    (smc.liquiditySweeps ?? []).forEach(l => push(l.price));
    (smc.patterns        ?? []).forEach(p => { if (p.target) push(p.target); });

    if (prices.length < 2) return;

    const rawMin = Math.min(...prices);
    const rawMax = Math.max(...prices);
    const pad    = (rawMax - rawMin) * 0.30;
    const pMin   = rawMin - pad;
    const pMax   = rawMax + pad;

    const toY = (price: number) => CT + ((pMax - price) / (pMax - pMin)) * CH;

    const fs = Math.max(11, Math.round(H / 55));
    ctx.textBaseline = "middle";

    function tag(text: string, x: number, y: number, fg: string, bg: string) {
      ctx.font = `bold ${fs}px 'DM Mono', monospace`;
      const tw  = ctx.measureText(text).width;
      const pd  = fs * 0.38;
      const bh  = fs * 1.5;
      ctx.fillStyle = bg;
      ctx.beginPath();
      (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
        .roundRect(x, y - bh / 2, tw + pd * 2, bh, 3);
      ctx.fill();
      ctx.fillStyle = fg;
      ctx.fillText(text, x + pd, y);
    }

    // ── Fair Value Gaps ───────────────────────────────────────
    if (layers.fvg) {
      (smc.fvg ?? []).forEach(f => {
        const [lo, hi] = parseRange(f.priceRange);
        if (!lo || !hi || lo === hi) return;
        const isBull = f.type?.toLowerCase().includes("bull");
        const y1 = toY(hi), y2 = toY(lo);
        ctx.fillStyle   = isBull ? "rgba(0,230,118,0.18)" : "rgba(248,68,68,0.18)";
        ctx.fillRect(CL, y1, CW, y2 - y1);
        ctx.strokeStyle = isBull ? "rgba(0,230,118,0.65)" : "rgba(248,68,68,0.65)";
        ctx.lineWidth   = 1;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(CL, y1, CW, y2 - y1);
        ctx.setLineDash([]);
        const lbl = (f.filled ? "FVG ✓" : "FVG");
        tag(lbl, CL + 6, (y1 + y2) / 2, isBull ? "#00e676" : "#f84444", isBull ? "rgba(0,18,8,0.82)" : "rgba(18,0,0,0.82)");
      });
    }

    // ── Order Blocks ──────────────────────────────────────────
    if (layers.ob) {
      (smc.orderBlocks ?? []).forEach(o => {
        const [lo, hi] = parseRange(o.priceRange);
        if (!lo || !hi || lo === hi) return;
        const isBull = o.type?.toLowerCase().includes("bull");
        const y1 = toY(hi), y2 = toY(lo);
        ctx.fillStyle   = isBull ? "rgba(0,230,118,0.07)" : "rgba(248,68,68,0.07)";
        ctx.fillRect(CL, y1, CW, y2 - y1);
        ctx.strokeStyle = isBull ? "rgba(0,230,118,0.9)" : "rgba(248,68,68,0.9)";
        ctx.lineWidth   = 2;
        ctx.setLineDash([7, 3]);
        ctx.strokeRect(CL + 1, y1, CW - 2, y2 - y1);
        ctx.setLineDash([]);
        tag("OB", CR - fs * 3.8, (y1 + y2) / 2, isBull ? "#00e676" : "#f84444", isBull ? "rgba(0,18,8,0.85)" : "rgba(18,0,0,0.85)");
      });
    }

    // ── Equal highs / lows + Liquidity sweeps ─────────────────
    if (layers.liquidity) {
      (smc.equalLevels ?? []).forEach(el => {
        const p = parseP(el.price);
        if (!p) return;
        const y = toY(p);
        const isHigh = el.type?.toLowerCase().includes("high");
        ctx.strokeStyle = isHigh ? "rgba(248,68,68,0.85)" : "rgba(0,230,118,0.85)";
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([9, 6]);
        ctx.beginPath(); ctx.moveTo(CL, y); ctx.lineTo(CR, y); ctx.stroke();
        ctx.setLineDash([]);
        tag(isHigh ? "EQH" : "EQL", CR - fs * 4.8, y, isHigh ? "#f84444" : "#00e676", "rgba(8,10,16,0.85)");
      });

      (smc.liquiditySweeps ?? []).forEach(ls => {
        const p = parseP(ls.price);
        if (!p) return;
        const y = toY(p);
        ctx.strokeStyle = "rgba(251,191,36,0.85)";
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(CL, y); ctx.lineTo(CR, y); ctx.stroke();
        ctx.setLineDash([]);
        // downward arrow marker
        const ax = CL + CW * 0.12;
        ctx.fillStyle = "rgba(251,191,36,0.9)";
        ctx.beginPath();
        ctx.moveTo(ax, y - fs * 1.5);
        ctx.lineTo(ax - fs * 0.55, y - fs * 2.6);
        ctx.lineTo(ax + fs * 0.55, y - fs * 2.6);
        ctx.closePath();
        ctx.fill();
        tag("Sweep", CL + CW * 0.16, y, "#fbbf24", "rgba(18,13,0,0.85)");
      });
    }

    // ── Structure breaks (BOS / CHoCH) ────────────────────────
    if (layers.liquidity) {
      (smc.structureBreaks ?? []).forEach(sb => {
        const p = parseP(sb.price);
        if (!p) return;
        const y = toY(p);
        const isBull = sb.type?.toLowerCase().includes("bull") || sb.type?.toLowerCase().includes("high");
        ctx.strokeStyle = isBull ? "rgba(0,230,118,1)" : "rgba(248,68,68,1)";
        ctx.lineWidth   = 2.5;
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(CL, y); ctx.lineTo(CR, y); ctx.stroke();
        const lbl = sb.type?.toUpperCase().includes("CHOCH") ? "CHoCH" : "BOS";
        tag(lbl, CL + 6, y, isBull ? "#00e676" : "#f84444", "rgba(8,10,16,0.88)");
      });
    }

    // ── Fibonacci ─────────────────────────────────────────────
    if (layers.fib) {
      (smc.smcFibonacci ?? []).forEach(f => {
        const p = parseP(f.price);
        if (!p) return;
        const y = toY(p);
        ctx.strokeStyle = "rgba(192,132,252,0.7)";
        ctx.lineWidth   = 1;
        ctx.setLineDash([5, 7]);
        ctx.beginPath(); ctx.moveTo(CL, y); ctx.lineTo(CR, y); ctx.stroke();
        ctx.setLineDash([]);
        tag(f.level, CR - fs * 6.0, y, "#c084fc", "rgba(9,0,18,0.85)");
      });
    }

    // ── Pattern targets ───────────────────────────────────────
    if (layers.patterns) {
      (smc.patterns ?? []).forEach((pt, i) => {
        const tp = pt.target ? parseP(pt.target) : 0;
        if (tp > 0) {
          const y = toY(tp);
          ctx.strokeStyle = "rgba(56,189,248,0.65)";
          ctx.lineWidth   = 1.5;
          ctx.setLineDash([4, 7]);
          ctx.beginPath(); ctx.moveTo(CL, y); ctx.lineTo(CR, y); ctx.stroke();
          ctx.setLineDash([]);
          tag(`${pt.name} tgt`, CL + 6, y - fs * 1.6 * i, "#38bdf8", "rgba(0,7,16,0.85)");
        } else {
          tag(pt.name, CL + 6, CT + fs * 1.8 * (i + 1), "#38bdf8", "rgba(0,7,16,0.85)");
        }
      });
    }

    // ── Entry / SL / TP ───────────────────────────────────────
    if (layers.levels) {
      [
        { price: entry,     lbl: "Entry",  color: "rgba(255,255,255,0.85)", tagFg: "#ffffff", tagBg: "rgba(8,10,16,0.88)", lw: 1.5 },
        { price: stopLoss,  lbl: "SL",     color: "rgba(248,113,113,0.9)", tagFg: "#f87171",  tagBg: "rgba(20,4,4,0.88)",  lw: 2   },
        { price: takeProfit,lbl: "TP",     color: "rgba(74,222,128,0.9)",  tagFg: "#4ade80",  tagBg: "rgba(0,10,4,0.88)",  lw: 2   },
      ].forEach(({ price, lbl, color, tagFg, tagBg, lw }) => {
        const p = parseP(price);
        if (!p) return;
        const y = toY(p);
        ctx.strokeStyle = color;
        ctx.lineWidth   = lw;
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(CL, y); ctx.lineTo(CR, y); ctx.stroke();
        tag(lbl, CL + 6, y, tagFg, tagBg);
      });
    }
  }, [ready, layers, smc, entry, stopLoss, takeProfit, isPro, chartBase64, chartMime]);

  useEffect(() => { draw(); }, [draw]);

  if (!chartBase64) return null;

  function upgrade() {
    if (!clientId) return;
    fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, plan: "pro" }) })
      .then(r => r.json()).then(d => { if (d.url) window.location.href = d.url; });
  }

  const toolbar = (
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/[0.06]"
      style={{ background: "#0a0d0a" }}>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00e676]" />
        <span className="font-dm-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#00e676]">
          Annotated Chart
        </span>
        {!isPro && (
          <span className="font-dm-mono text-[9px] px-1.5 py-0.5 rounded-full"
            style={{ background: "rgba(0,230,118,0.1)", border: "1px solid rgba(0,230,118,0.25)", color: "#00e676" }}>
            PRO
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        {isPro && (Object.keys(LAYER_LABELS) as LayerKey[]).map(k => (
          <button key={k}
            onClick={() => setLayers(l => ({ ...l, [k]: !l[k] }))}
            className="font-dm-mono text-[9px] px-2 py-1 rounded-lg transition-all duration-150"
            style={{
              background: layers[k] ? "rgba(0,230,118,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${layers[k] ? "rgba(0,230,118,0.35)" : "rgba(255,255,255,0.07)"}`,
              color: layers[k] ? "#00e676" : "#4b5563",
            }}>
            {LAYER_LABELS[k]}
          </button>
        ))}
        {isPro && (
          <button
            onClick={() => setExpanded(e => !e)}
            title={expanded ? "Close" : "Expand"}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:bg-white/[0.08]"
            style={{ border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)", color: "#9ca3af" }}
          >
            {expanded ? (
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M2 2l3 3M9 9l-3-3M2 9l3-3M9 2L6 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1 4V1h3M10 4V1H7M1 7v3h3M10 7v3H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );

  const canvasArea = (
    <div className="relative" style={{ background: "#080a10" }}>
      <canvas ref={canvasRef} className="w-full block" />
      {!isPro && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-2"
          style={{ backdropFilter: "blur(5px)", background: "rgba(8,10,16,0.72)" }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="2.5" y="9.5" width="17" height="11" rx="2.5" stroke="#00e676" strokeWidth="1.3"/>
            <path d="M7 9.5V7a4 4 0 018 0v2.5" stroke="#00e676" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <p className="text-white font-bold text-sm">Annotated Chart — Pro Only</p>
          <p className="text-[#6b7280] text-xs leading-snug max-w-[210px]">
            FVG zones, order blocks, liquidity sweeps, BOS lines and key levels drawn on your chart
          </p>
          <button onClick={upgrade}
            className="mt-1 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
            style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 16px rgba(0,230,118,0.3)" }}>
            Upgrade to Pro — £19/mo
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Inline card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {toolbar}
        {canvasArea}
      </motion.div>

      {/* Full-screen modal */}
      {expanded && (
        <div
          className="fixed inset-0 z-[600] flex flex-col"
          style={{ background: "rgba(4,6,10,0.97)", backdropFilter: "blur(18px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setExpanded(false); }}
        >
          <div className="flex-shrink-0 rounded-none" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {toolbar}
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            <div className="w-full max-w-5xl rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(0,230,118,0.2)", boxShadow: "0 0 60px rgba(0,230,118,0.07)" }}>
              {canvasArea}
            </div>
          </div>
          <div className="flex-shrink-0 flex justify-center py-4">
            <button
              onClick={() => setExpanded(false)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l4 4 4-4M2 10l4-4 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
