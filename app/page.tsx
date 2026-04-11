"use client";

import { useState } from "react";

export default function AnalyzeSection() {
  const [loading, setLoading] = useState(false);

  return (
    <section className="relative py-24 px-6 bg-[#05070f] text-white overflow-hidden">

      {/* background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-transparent to-yellow-500/10 blur-3xl" />

      <div className="max-w-6xl mx-auto relative z-10">

        {/* TITLE */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold">
            Analyze Your Chart{" "}
            <span className="bg-gradient-to-r from-yellow-400 to-purple-500 bg-clip-text text-transparent">
              Instantly
            </span>
          </h2>
          <p className="text-gray-400 mt-4">
            Upload a chart and get AI-powered entries, stop loss, and take profit levels.
          </p>
        </div>

        {/* MAIN GRID */}
        <div className="grid md:grid-cols-2 gap-8">

          {/* UPLOAD CARD */}
          <div className="relative group rounded-2xl p-[1px] bg-gradient-to-r from-purple-500/30 to-yellow-500/30">

            <div className="bg-[#0b0f1a] rounded-2xl p-8 border border-white/5 backdrop-blur-xl">

              <div className="border-2 border-dashed border-purple-500/30 rounded-xl p-10 text-center hover:border-purple-400 transition">

                <p className="text-gray-400 mb-4">Drop your chart here</p>

                <input type="file" className="mb-6 text-sm" />

                <button
                  onClick={() => setLoading(true)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-yellow-500 font-semibold hover:opacity-90 transition"
                >
                  {loading ? "Analyzing..." : "Analyze Chart"}
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-4 text-center">
                PNG, JPG supported • Secure & private
              </p>
            </div>
          </div>

          {/* RESULTS CARD */}
          <div className="relative group rounded-2xl p-[1px] bg-gradient-to-r from-green-500/30 to-purple-500/30">

            <div className="bg-[#0b0f1a] rounded-2xl p-8 border border-white/5 backdrop-blur-xl">

              <h3 className="text-green-400 text-xl font-bold mb-4">
                NEUTRAL
              </h3>

              {/* METRICS */}
              <div className="space-y-3 text-gray-300 text-sm">

                <div className="flex justify-between">
                  <span>Confidence</span>
                  <span>60%</span>
                </div>

                <div className="flex justify-between">
                  <span>Entry</span>
                  <span>3290 - 3295</span>
                </div>

                <div className="flex justify-between text-green-400">
                  <span>Take Profit</span>
                  <span>3310</span>
                </div>

                <div className="flex justify-between text-red-400">
                  <span>Stop Loss</span>
                  <span>3280</span>
                </div>

                <div className="flex justify-between text-purple-400">
                  <span>R:R</span>
                  <span>1:1.5</span>
                </div>
              </div>

              {/* DESCRIPTION */}
              <p className="text-gray-400 text-sm mt-6 leading-relaxed">
                The chart shows a recent sharp upward movement followed by a pullback. 
                Price is consolidating with no clear breakout direction. 
                Volume spikes suggest potential volatility ahead.
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}