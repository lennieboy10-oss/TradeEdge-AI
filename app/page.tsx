"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [tp, setTp] = useState(20);
  const [entry, setEntry] = useState(50);
  const [sl, setSl] = useState(80);

  const handleUpload = async () => {
    if (!image) return;
    setLoading(true);

    const reader = new FileReader();
    reader.readAsDataURL(image);

    reader.onloadend = async () => {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: reader.result }),
      });

      const data = await res.json();
      setResult(data);
      setLoading(false);
    };
  };

  useEffect(() => {
    if (!result) return;
    setTp(20);
    setEntry(50);
    setSl(80);
  }, [result]);

  return (
    <main className="bg-[#05070d] text-white min-h-screen relative overflow-hidden">

      {/* GRID BACKGROUND */}
      <div className="absolute inset-0 -z-10 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:60px_60px]" />

      {/* PURPLE GLOW */}
      <div className="absolute top-[-200px] left-1/2 w-[1000px] h-[1000px] bg-purple-600/30 blur-[200px] -translate-x-1/2 -z-10" />

      {/* NAV */}
      <nav className="flex justify-between items-center px-10 py-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          TradeAI
        </h1>

        <button className="px-5 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition">
          Login
        </button>
      </nav>

      {/* HERO */}
      <section className="text-center pt-32 pb-20 px-6">

        <p className="text-purple-400 mb-6 text-sm tracking-wide">
          AI Trading Assistant
        </p>

        <h1 className="text-[64px] font-bold leading-[1.1] max-w-4xl mx-auto">
          AI-Powered Chart Analysis{" "}
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
            in Seconds
          </span>
        </h1>

        <p className="text-gray-400 mt-6 text-lg">
          Upload your chart and get instant trade setups with entry, TP & SL
        </p>

        <button className="mt-10 px-10 py-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_40px_rgba(168,85,247,0.5)] hover:scale-105 transition">
          Try It Free
        </button>

      </section>

      {/* TOOL CARD */}
      <section className="px-6 pb-32">

        <div className="max-w-3xl mx-auto p-10 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_80px_rgba(168,85,247,0.15)]">

          <p className="text-purple-400 text-center text-lg mb-6">
            Upload your chart
          </p>

          <div className="border border-dashed border-purple-500/40 rounded-xl p-10 text-center">

            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setImage(file);

                const reader = new FileReader();
                reader.onloadend = () => setPreview(reader.result as string);
                reader.readAsDataURL(file);
              }}
            />

            <button
              onClick={handleUpload}
              className="mt-6 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 w-full"
            >
              {loading ? "Analyzing..." : "Analyze Chart"}
            </button>

          </div>

        </div>

        {/* CHART */}
        {preview && (
          <div className="mt-16 max-w-4xl mx-auto relative rounded-xl overflow-hidden border border-white/10">

            <img src={preview} className="w-full" />

            {result && (
              <>
                <Line label="TP" color="green" position={tp} onDrag={setTp} />
                <Line label="ENTRY" color="yellow" position={entry} onDrag={setEntry} />
                <Line label="SL" color="red" position={sl} onDrag={setSl} />
              </>
            )}

          </div>
        )}

        {/* RESULT */}
        {result && (
          <div className="mt-10 max-w-3xl mx-auto p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">

            <p className="text-3xl font-bold text-green-400">
              {result.bias?.toUpperCase()}
            </p>

            <p className="text-gray-400 mt-2">
              Confidence: {result.confidence}
            </p>

            <div className="grid grid-cols-2 gap-6 mt-6">
              <DataBox label="Entry" value={result.entry_zone} />
              <DataBox label="TP" value={result.take_profit} color="green" />
              <DataBox label="SL" value={result.stop_loss} color="red" />
              <DataBox label="R:R" value={result.risk_reward} color="purple" />
            </div>

          </div>
        )}

      </section>

    </main>
  );
}

/* LINE */

function Line({ label, color, position, onDrag }: any) {
  const colors: any = {
    green: "border-green-400",
    red: "border-red-400",
    yellow: "border-yellow-400",
  };

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: 0, bottom: 400 }}
      onDragEnd={(e, info) => onDrag((info.point.y / 400) * 100)}
      className="absolute left-0 w-full"
      style={{ top: `${position}%` }}
    >
      <div className={`border-t-2 border-dashed ${colors[color]} relative`}>
        <span className="absolute right-2 -top-3 text-xs bg-black px-2 py-1 rounded">
          {label}
        </span>
      </div>
    </motion.div>
  );
}

/* DATA BOX */

function DataBox({ label, value, color }: any) {
  const colorClasses =
    color === "green"
      ? "text-green-400"
      : color === "red"
      ? "text-red-400"
      : color === "purple"
      ? "text-purple-400"
      : "text-white";

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className={`text-lg font-semibold ${colorClasses}`}>
        {value}
      </p>
    </div>
  );
}