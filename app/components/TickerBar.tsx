"use client";

import { useState, useEffect } from "react";

type TickerItem = { label: string; price: string; change: number };

const FALLBACK: TickerItem[] = [
  { label: "XAU/USD", price: "3,312.40", change:  0.38 },
  { label: "BTC/USD", price: "94,850",   change:  1.24 },
  { label: "ETH/USD", price: "1,812.55", change: -0.76 },
  { label: "EUR/USD", price: "1.0842",   change: -0.12 },
  { label: "GBP/USD", price: "1.2658",   change:  0.08 },
  { label: "USD/JPY", price: "143.22",   change: -0.31 },
  { label: "SOL/USD", price: "148.30",   change:  2.14 },
  { label: "AAPL",    price: "207.15",   change:  0.54 },
  { label: "NVDA",    price: "117.40",   change:  1.87 },
  { label: "TSLA",    price: "281.90",   change: -1.32 },
  { label: "SPX500",  price: "5,648.10", change:  0.22 },
  { label: "OIL/USD", price: "64.78",    change: -0.45 },
  { label: "ES1!",    price: "5,648",    change:  0.22 },
  { label: "NQ1!",    price: "19,820",   change:  0.44 },
  { label: "GC1!",    price: "3,312",    change:  0.38 },
  { label: "CL1!",    price: "64.78",    change: -0.45 },
  { label: "ZB1!",    price: "118.31",   change: -0.18 },
];

export default function TickerBar() {
  const [items, setItems] = useState<TickerItem[]>(FALLBACK);

  async function fetchTicker() {
    try {
      const res  = await fetch("/api/ticker");
      const data = await res.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        setItems(data.items);
      }
    } catch { /* keep fallback */ }
  }

  useEffect(() => {
    fetchTicker();
    const id = setInterval(fetchTicker, 60_000);
    return () => clearInterval(id);
  }, []);

  // Duplicate items for seamless infinite loop
  const doubled = [...items, ...items];

  return (
    <div
      className="fixed left-0 right-0 z-[49] overflow-hidden"
      style={{
        top:          "60px",
        height:       "28px",
        background:   "rgba(8, 10, 16, 0.97)",
        borderTop:    "1px solid rgba(0, 230, 118, 0.15)",
        borderBottom: "1px solid rgba(0, 230, 118, 0.15)",
        backdropFilter:         "blur(12px)",
        WebkitBackdropFilter:   "blur(12px)",
      }}
    >
      <div
        className="ticker-scroll h-full flex items-center"
        style={{ width: "max-content" }}
      >
        {doubled.map((item, i) => (
          <div key={i} className="flex items-center h-full shrink-0">
            <div className="flex items-center gap-2 px-4">
              {/* Pair name */}
              <span
                className="text-[11px] font-semibold tracking-widest uppercase"
                style={{ color: "#6b7280" }}>
                {item.label}
              </span>

              {/* Price */}
              <span className="font-dm-mono text-[11px] text-white tabular-nums">
                {item.price}
              </span>

              {/* % change */}
              <span
                className="font-dm-mono text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums"
                style={{
                  color:      item.change >= 0 ? "#00e676" : "#f87171",
                  background: item.change >= 0
                    ? "rgba(0, 230, 118, 0.13)"
                    : "rgba(248, 113, 113, 0.13)",
                }}>
                {item.change >= 0 ? "+" : ""}
                {item.change.toFixed(2)}%
              </span>
            </div>

            {/* Separator dot */}
            <span
              className="text-sm select-none"
              style={{ color: "rgba(255,255,255,0.1)" }}>
              ·
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
