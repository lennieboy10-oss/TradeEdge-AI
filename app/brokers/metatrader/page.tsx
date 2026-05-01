"use client";

import Link from "next/link";
import { motion } from "framer-motion";
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

const steps = [
  {
    n: "01",
    title: "Download the EA File",
    body: "Download the Expert Advisor file for your platform from the Brokers page.",
    detail: (
      <div className="flex gap-3 mt-3">
        <a href="/api/mt/ea?version=mt4"
          className="flex-1 py-2 rounded-xl text-xs font-bold text-center transition-all hover:-translate-y-0.5"
          style={{ background: "rgba(123,82,232,0.15)", color: "#9b72f8", border: "1px solid rgba(123,82,232,0.25)" }}>
          Download MT4 .mq4
        </a>
        <a href="/api/mt/ea?version=mt5"
          className="flex-1 py-2 rounded-xl text-xs font-bold text-center transition-all hover:-translate-y-0.5"
          style={{ background: "rgba(155,114,248,0.15)", color: "#b59bfc", border: "1px solid rgba(155,114,248,0.25)" }}>
          Download MT5 .mq5
        </a>
      </div>
    ),
  },
  {
    n: "02",
    title: "Open MetaEditor",
    body: "In MetaTrader 4 or 5, go to Tools → MetaQuotes Language Editor (or press F4).",
  },
  {
    n: "03",
    title: "Install the EA File",
    detail: (
      <div className="mt-3 space-y-1.5">
        <p className="text-xs text-[#6b7280]"><strong className="text-[#9ca3af]">MT4:</strong> Copy the .mq4 file to: <span className="font-dm-mono text-[#7c93b0]">MQL4/Experts/</span></p>
        <p className="text-xs text-[#6b7280]"><strong className="text-[#9ca3af]">MT5:</strong> Copy the .mq5 file to: <span className="font-dm-mono text-[#7c93b0]">MQL5/Experts/</span></p>
        <p className="text-xs text-[#6b7280]">Find the folder via: <strong className="text-[#9ca3af]">File → Open Data Folder</strong> in MT.</p>
        <p className="text-xs text-[#6b7280]">After copying, click <strong className="text-[#9ca3af]">Compile</strong> in MetaEditor (F7). Green output = success.</p>
      </div>
    ),
  },
  {
    n: "04",
    title: "Enable Automated Trading",
    body: "In MT settings, make sure automated trading is enabled.",
    detail: (
      <ul className="mt-3 space-y-1.5">
        {[
          "MT4/5 toolbar: click the AutoTrading button (must show green arrow)",
          "Tools → Options → Expert Advisors → Allow automated trading",
          "Allow DLL imports (only if prompted)",
        ].map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-[#6b7280]">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="flex-shrink-0 mt-0.5">
              <path d="M1.5 5l2 2.5L8.5 2" stroke="#00e676" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {s}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: "05",
    title: "Allow WebRequests to ChartIQ",
    body: "The EA needs internet access to poll signals.",
    detail: (
      <div className="mt-3 space-y-2">
        <p className="text-xs text-[#6b7280]"><strong className="text-[#9ca3af]">MT4:</strong> Tools → Options → Expert Advisors → Allow WebRequest for listed URL</p>
        <p className="text-xs text-[#6b7280]"><strong className="text-[#9ca3af]">MT5:</strong> Tools → Options → Expert Advisors → Allow WebRequest for listed URL</p>
        <p className="text-xs text-[#6b7280] mb-2">Add this URL to the allowed list:</p>
        <code className="block font-dm-mono text-[11px] text-[#00e676] px-3 py-2 rounded-lg"
          style={{ background: "rgba(0,230,118,0.06)", border: "1px solid rgba(0,230,118,0.14)" }}>
          https://trade-edge-ai.vercel.app
        </code>
      </div>
    ),
  },
  {
    n: "06",
    title: "Attach the EA to a Chart",
    body: "Open the chart for your target pair (e.g. XAUUSD). Drag the ChartIQ AI EA from the Navigator panel onto the chart.",
    detail: (
      <p className="text-xs text-[#6b7280] mt-2">
        Navigator panel → Expert Advisors → ChartIQ AI. Drag to chart or double-click.
      </p>
    ),
  },
  {
    n: "07",
    title: "Enter Your API Key",
    body: "In the EA inputs dialog, paste your ChartIQ API key.",
    detail: (
      <div className="mt-3 space-y-2">
        <p className="text-xs text-[#6b7280]">Get your key from <Link href="/account#apikeys" className="text-[#00e676] hover:underline">Account → API Keys</Link>.</p>
        <div className="rounded-xl p-3" style={{ background: "rgba(0,230,118,0.05)", border: "1px solid rgba(0,230,118,0.12)" }}>
          <p className="font-dm-mono text-[10px] text-[#9ca3af]">APIKey = ciq_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</p>
          <p className="font-dm-mono text-[10px] text-[#9ca3af]">MinConfidence = 80</p>
          <p className="font-dm-mono text-[10px] text-[#9ca3af]">MaxLotSize = 0.10</p>
          <p className="font-dm-mono text-[10px] text-[#9ca3af]">AutoTrade = true</p>
        </div>
      </div>
    ),
  },
  {
    n: "08",
    title: "The EA Is Now Live",
    body: "The EA polls ChartIQ every 60 seconds. When a signal with 80%+ confidence is found for your pair, a limit order is placed automatically.",
    detail: (
      <p className="text-xs text-[#6b7280] mt-2">
        Watch the Experts log tab at the bottom of MT for confirmation messages from the EA.
      </p>
    ),
  },
];

const troubleshooting = [
  { q: "WebRequest returned -1", a: "The EA URL is not in MT's allowed list. Go to Tools → Options → Expert Advisors and add https://trade-edge-ai.vercel.app" },
  { q: "No trades placed despite signals", a: "Check: AutoTrade is enabled (green toolbar button), AutoTrade=true in EA inputs, MinConfidence is not set too high, chart symbol matches the signal asset exactly (e.g. XAUUSD not XAU/USD)" },
  { q: "Order fails with error 130", a: "Invalid stops. Ensure SL and TP are at least your broker's minimum distance from entry. Some brokers require a larger gap." },
  { q: "EA not showing in Navigator", a: "Compile the .mq4/.mq5 file in MetaEditor (F7). If compile errors appear, ensure the file was downloaded correctly — re-download if needed." },
  { q: "API key not recognised", a: "Ensure you generated an API key from Account → API Keys and pasted it exactly into the APIKey input. Keys start with ciq_." },
];

export default function MetaTraderGuide() {
  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <AppNav />

      <main className="pt-32 pb-24 px-6">
        <div className="max-w-2xl mx-auto">

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs font-semibold tracking-[0.13em] uppercase mb-4">
              Setup Guide
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-3">
              MetaTrader 4 &amp; 5 Setup
            </h1>
            <p className="text-[#6b7280] text-sm leading-relaxed">
              Install the ChartIQ Expert Advisor to auto-trade high-confidence signals directly from your MT4 or MT5 platform.
            </p>
          </motion.div>

          {/* Steps */}
          <div className="space-y-4 mb-12">
            {steps.map((step, i) => (
              <motion.div key={step.n}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.4 }}
                className="rounded-2xl border border-white/[0.07] bg-[#0c0f18] p-5">
                <div className="flex items-start gap-4">
                  <span className="font-dm-mono text-[11px] font-bold text-[#00e676] flex-shrink-0 mt-0.5">{step.n}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-white text-sm mb-1">{step.title}</p>
                    {step.body && <p className="text-[#6b7280] text-xs leading-relaxed">{step.body}</p>}
                    {step.detail}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Troubleshooting */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <p className="font-dm-mono text-[10px] font-bold tracking-[0.18em] uppercase text-[#6b7280] mb-4">
              Troubleshooting
            </p>
            <div className="space-y-3">
              {troubleshooting.map((item) => (
                <div key={item.q} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-sm font-semibold text-[#f87171] mb-1">{item.q}</p>
                  <p className="text-xs text-[#6b7280] leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
            className="mt-10 rounded-2xl p-5 text-center"
            style={{ background: "rgba(0,230,118,0.04)", border: "1px solid rgba(0,230,118,0.16)" }}>
            <p className="text-sm font-semibold text-white mb-1">Need your ChartIQ API key?</p>
            <p className="text-xs text-[#6b7280] mb-4">Generate it from your account settings.</p>
            <Link href="/account#apikeys"
              className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
              style={{ background: "#00e676", color: "#080a10" }}>
              Go to API Keys →
            </Link>
          </motion.div>

          {/* Disclaimer */}
          <p className="text-[#374151] text-xs text-center mt-8 leading-relaxed">
            ChartIQ AI signals are for informational purposes only and do not constitute financial advice.
            You are solely responsible for all trades placed by the Expert Advisor.
          </p>
        </div>
      </main>
    </div>
  );
}
