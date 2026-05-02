import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `You are an expert trading analyst. The user has uploaded a chart and received a technical analysis. Answer their follow-up questions about this specific chart. Be concise, specific, and actionable. Reference exact price levels from the analysis. Never give generic advice.`;

export async function POST(req: Request) {
  const { message, analysisJson, imageBase64, imageMime, chatHistory, clientId, journalId } =
    await req.json();

  if (!message) {
    return new Response(JSON.stringify({ error: "No message" }), { status: 400 });
  }

  // Pro check
  let isPro = false;
  if (clientId) {
    try {
      const { data } = await getSupabase()
        .from("profiles")
        .select("plan")
        .eq("client_id", clientId)
        .single();
      isPro = data?.plan === "pro" || data?.plan === "elite";
    } catch { /* non-fatal */ }
  }

  // Free users: 1 AI response per analysis
  const prevAssistantMsgs = (chatHistory ?? []).filter(
    (m: { role: string }) => m.role === "assistant"
  ).length;
  if (!isPro && prevAssistantMsgs >= 1) {
    return new Response(
      JSON.stringify({ error: "limit", message: "Upgrade to Pro for unlimited chat." }),
      { status: 429 }
    );
  }

  // Build messages for Claude
  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

  type Msg = { role: "user" | "assistant"; content: string | ContentBlock[] };

  const messages: Msg[] = [];

  // Prepend prior history (text only — image sent once on first message)
  for (const h of chatHistory ?? []) {
    messages.push({ role: h.role, content: h.content });
  }

  // Build current user message
  const isFirst = !chatHistory || chatHistory.length === 0;
  const userContent: ContentBlock[] = [];

  if (isFirst && imageBase64 && imageMime) {
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: imageMime, data: imageBase64 },
    });
  }

  const analysisContext = analysisJson
    ? `Here is the technical analysis of this chart:\n${typeof analysisJson === "string" ? analysisJson : JSON.stringify(analysisJson, null, 2)}\n\nUser question: ${message}`
    : message;

  userContent.push({ type: "text", text: analysisContext });
  messages.push({ role: "user", content: userContent });

  // Stream response
  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const s = anthropic.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: messages as Parameters<typeof anthropic.messages.create>[0]["messages"],
        });

        for await (const chunk of s) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            const text = chunk.delta.text;
            fullResponse += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();

        // Save chat history to Supabase
        if (journalId) {
          const newHistory = [
            ...(chatHistory ?? []),
            { role: "user", content: message },
            { role: "assistant", content: fullResponse },
          ];
          try {
            await getSupabase()
              .from("journal")
              .update({ chat_history: newHistory })
              .eq("id", journalId);
          } catch (e) {
            console.error("[chat] save failed:", e);
          }
        }
      } catch (err) {
        console.error("[chat] stream error:", err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
}
