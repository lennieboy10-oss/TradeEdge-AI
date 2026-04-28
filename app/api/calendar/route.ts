import { NextResponse } from "next/server";
import axios from "axios";

export const dynamic = "force-dynamic";

type RawEvent = Record<string, string>;

export type CalEvent = {
  title: string;
  country: string;
  date: string;    // MM-DD-YYYY as returned by API
  time: string;    // HH:MM:SS UTC, or "All Day"
  impact: "High" | "Medium" | "Low";
  forecast: string;
  previous: string;
};

// Server-level cache — lives as long as the Node process
let _cache: { events: CalEvent[]; ts: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function normalizeImpact(raw: string): "High" | "Medium" | "Low" {
  const l = (raw ?? "").toLowerCase();
  if (l.includes("high") || l === "3") return "High";
  if (l.includes("medium") || l.includes("moderate") || l === "2") return "Medium";
  return "Low";
}

export async function GET() {
  const now = Date.now();
  if (_cache && now - _cache.ts < CACHE_TTL) {
    return NextResponse.json({ events: _cache.events });
  }
  try {
    const { data } = await axios.get<RawEvent[]>(
      "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
      { timeout: 10_000, headers: { Accept: "application/json" } }
    );
    const events: CalEvent[] = (Array.isArray(data) ? data : []).map((e) => ({
      title:    String(e.title    ?? "").trim(),
      country:  String(e.country  ?? "").toUpperCase().trim(),
      date:     String(e.date     ?? "").trim(),
      time:     String(e.time     ?? "").trim(),
      impact:   normalizeImpact(e.impact ?? ""),
      forecast: String(e.forecast ?? "").trim(),
      previous: String(e.previous ?? "").trim(),
    }));
    _cache = { events, ts: now };
    return NextResponse.json({ events });
  } catch (err) {
    console.error("[calendar] fetch failed:", err);
    // Serve stale cache rather than fail
    if (_cache) return NextResponse.json({ events: _cache.events });
    return NextResponse.json({ events: [] });
  }
}
