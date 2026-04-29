import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function GET() {
  try {
    console.log("[test] calling Claude...");
    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 100,
      messages: [{ role: "user", content: "Say hello" }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "(no text)";
    console.log("[test] Claude replied:", text);
    return NextResponse.json({ ok: true, result: text, model: response.model });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[test] Claude call failed:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
