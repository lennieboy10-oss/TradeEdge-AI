import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const { client_id } = await request.json();

    if (!client_id) {
      return NextResponse.json({ error: "client_id required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Verify Pro plan
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, trial_ends_at")
      .eq("client_id", client_id)
      .single();

    const trialValid = profile?.plan === "trial" && profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date();
    const isPro = profile?.plan === "pro" || trialValid;

    if (!isPro) {
      return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
    }

    // Fetch journal entries
    const { data: entries, error: entriesError } = await supabase
      .from("journal")
      .select("asset, timeframe, signal, entry, stop_loss, take_profit, risk_reward, confidence, outcome, notes, created_at")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false });

    if (entriesError) {
      return NextResponse.json({ error: "Failed to fetch journal" }, { status: 500 });
    }

    if (!entries || entries.length < 10) {
      return NextResponse.json({ error: "Need at least 10 journal entries for coaching" }, { status: 400 });
    }

    const journalJson = JSON.stringify(entries, null, 2);

    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1200,
      system: `You are an expert trading coach. Analyse trader journal data and provide honest, specific, actionable coaching. Focus on patterns, not individual trades. Be direct and professional.`,
      messages: [{
        role: "user",
        content: `Here is a trader's complete journal data:\n\n${journalJson}\n\nAnalyse this trader's journal and identify their strengths, weaknesses, and patterns. Return ONLY raw JSON no markdown no backticks:\n{"strongestAsset":"symbol or null","weakestAsset":"symbol or null","bestTimeframe":"timeframe or null","worstTimeframe":"timeframe or null","bestSession":"morning/afternoon/evening or null","worstSession":"morning/afternoon/evening or null","winnerAvgR":"number as string e.g. 2.3 or null","loserAvgR":"number as string or null","keyPatterns":["pattern 1","pattern 2","pattern 3"],"improvements":["improvement 1","improvement 2","improvement 3"],"overallAssessment":"2-3 sentences of honest coaching feedback","coachingScore":75}`,
      }],
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";
    const cleanText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleanText);
    } catch {
      return NextResponse.json({ error: "Failed to parse coaching response", raw: cleanText }, { status: 500 });
    }

    return NextResponse.json({ success: true, coaching: parsed });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Coaching error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
