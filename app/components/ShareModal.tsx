"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { generateShareCard, ShareCardParams } from "@/app/lib/shareCard";

type Format = "square" | "landscape";

interface Props {
  params: ShareCardParams;
  onClose: () => void;
  onShare: (platform: string) => void;
}

export default function ShareModal({ params, onClose, onShare }: Props) {
  const [dataUrl, setDataUrl]     = useState<string | null>(null);
  const [generating, setGenerating] = useState(true);
  const [format, setFormat]       = useState<Format>("square");
  const [copied, setCopied]       = useState(false);

  useEffect(() => {
    let cancelled = false;
    setGenerating(true);
    setDataUrl(null);

    generateShareCard({ ...params, landscape: format === "landscape" })
      .then((url) => { if (!cancelled) { setDataUrl(url); setGenerating(false); } })
      .catch(() => { if (!cancelled) setGenerating(false); });

    return () => { cancelled = true; };
  }, [format, params]);

  function buildTweet() {
    const sig   = params.signal;
    const grade = params.grade ? ` ${params.grade}` : "";
    return encodeURIComponent(
      `Just analysed ${params.asset ?? "a chart"} on ${params.timeframe} with @ChartIQ_AI\n\n` +
      `Signal: ${sig}${grade}\n` +
      `Entry: ${params.entry}\n` +
      `Stop Loss: ${params.stopLoss}\n` +
      `Take Profit: ${params.takeProfit}\n` +
      `Confidence: ${params.confidence}%\n\n` +
      `Analyse your charts free 👇\ntrade-edge-ai.vercel.app\n\n` +
      `#trading #forex #crypto #chartanalysis`
    );
  }

  async function handleDownload() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `chartiq-${params.asset ?? "analysis"}-${format}.png`;
    a.click();
    onShare("download");
  }

  async function handleCopy() {
    if (!dataUrl) return;
    try {
      const res  = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      onShare("copy");
    } catch {
      // Fallback: copy URL
      await navigator.clipboard.writeText("trade-edge-ai.vercel.app");
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  function handleTwitter() {
    window.open(`https://twitter.com/intent/tweet?text=${buildTweet()}`, "_blank", "noopener");
    onShare("twitter");
  }

  function handleDiscord() {
    if (!dataUrl) return;
    // Download then user pastes — Discord doesn't support direct share API
    handleDownload();
    onShare("discord");
  }

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      style={{ background: "rgba(4,6,10,0.94)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: "#080c0a",
          border: "1px solid rgba(0,230,118,0.25)",
          boxShadow: "0 0 60px rgba(0,230,118,0.07), 0 24px 64px rgba(0,0,0,0.55)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="font-bold text-white text-sm">Share This Setup</h2>
            <p className="font-dm-mono text-[10px] text-[#6b7280] mt-0.5 uppercase tracking-[0.1em]">
              {params.asset ?? "Chart"} · {params.timeframe} · {params.signal}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition-colors">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2l6 6M8 2L2 8" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Format toggle */}
        <div className="flex gap-1 mx-5 mt-4 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {(["square", "landscape"] as Format[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold font-dm-mono transition-all duration-150"
              style={format === f
                ? { background: "#00e676", color: "#080a10" }
                : { background: "transparent", color: "#6b7280" }}
            >
              {f === "square" ? "1080×1080" : "1920×1080"}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="mx-5 mt-3 rounded-xl overflow-hidden" style={{ background: "#0a0d0a", border: "1px solid rgba(255,255,255,0.06)", minHeight: "160px" }}>
          {generating ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-[#00e676]/25 border-t-[#00e676] animate-spin" />
              <p className="font-dm-mono text-[10px] text-[#4b5563] uppercase tracking-widest">Generating card…</p>
            </div>
          ) : dataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={dataUrl} alt="Share card preview" className="w-full block" style={{ aspectRatio: format === "landscape" ? "16/9" : "1/1", objectFit: "cover" }} />
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="font-dm-mono text-xs text-[#4b5563]">Preview unavailable</p>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="p-5 space-y-2.5">
          {/* Row 1: Download + Copy */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleDownload}
              disabled={!dataUrl}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 disabled:opacity-40"
              style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 16px rgba(0,230,118,0.25)" }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v8M3 6.5l3.5 3.5L10 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M1 11.5h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Download PNG
            </button>
            <button
              onClick={handleCopy}
              disabled={!dataUrl}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 disabled:opacity-40"
              style={{
                background: copied ? "rgba(0,230,118,0.12)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${copied ? "rgba(0,230,118,0.35)" : "rgba(255,255,255,0.09)"}`,
                color: copied ? "#00e676" : "#9ca3af",
              }}
            >
              {copied ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M2 7l3 3L11 3" stroke="#00e676" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M4 9H3a1.5 1.5 0 01-1.5-1.5v-5A1.5 1.5 0 013 1h5A1.5 1.5 0 019.5 2.5V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  Copy Image
                </>
              )}
            </button>
          </div>

          {/* Row 2: Twitter */}
          <button
            onClick={handleTwitter}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
            style={{ background: "rgba(29,161,242,0.1)", border: "1px solid rgba(29,161,242,0.25)", color: "#1DA1F2" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M13 1.5L8.2 6.9 13.5 13H9.8L6.5 8.9 2.7 13H1l5.1-5.8L.5 1.5h3.8l2.9 3.7L10.3 1.5H13z" fill="#1DA1F2" />
            </svg>
            Post to X (Twitter)
          </button>

          {/* Row 3: Discord */}
          <button
            onClick={handleDiscord}
            disabled={!dataUrl}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 disabled:opacity-40"
            style={{ background: "rgba(88,101,242,0.1)", border: "1px solid rgba(88,101,242,0.25)", color: "#7289DA" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M11.5 2.5A10 10 0 009.2 2a7 7 0 00-.31.64 9.2 9.2 0 00-2.78 0A7 7 0 005.8 2a10 10 0 00-2.3.5C1.67 4.97 1.3 7.4 1.47 9.8a10.2 10.2 0 003.13 1.57 7.6 7.6 0 00.66-1.07 6.5 6.5 0 01-1.03-.5l.24-.19a7.3 7.3 0 006.06 0l.24.19c-.32.19-.66.35-1.03.5a7.6 7.6 0 00.66 1.07 10.2 10.2 0 003.13-1.57C13.7 7.07 13.1 4.65 11.5 2.5zM5.3 8.5c-.61 0-1.1-.56-1.1-1.24s.48-1.24 1.1-1.24c.61 0 1.12.56 1.1 1.24 0 .68-.49 1.24-1.1 1.24zm3.4 0c-.61 0-1.1-.56-1.1-1.24s.48-1.24 1.1-1.24c.61 0 1.12.56 1.1 1.24 0 .68-.49 1.24-1.1 1.24z" fill="#7289DA" />
            </svg>
            Share to Discord (download & paste)
          </button>
        </div>

        {/* Footer note */}
        <p className="font-dm-mono text-[10px] text-[#374151] text-center pb-4">
          Sharing helps others discover ChartIQ AI
        </p>
      </motion.div>
    </div>
  );
}
