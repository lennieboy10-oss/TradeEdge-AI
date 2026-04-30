import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

async function hashKey(key: string): Promise<string> {
  const enc = new TextEncoder().encode(key);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// POST /api/apikeys — generate a new key
export async function POST(request: Request) {
  try {
    const { clientId, userId } = await request.json();
    if (!clientId && !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();

    // Check plan
    const id = userId ?? clientId;
    const isUid = !!userId;
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq(isUid ? "id" : "client_id", id)
      .single();

    if (!profile || (profile.plan !== "pro" && profile.plan !== "elite")) {
      return NextResponse.json({ error: "Pro or Elite plan required" }, { status: 403 });
    }

    // Generate key: ciq_ + 32 hex chars
    const raw   = "ciq_" + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const hash  = await hashKey(raw);
    const uid   = userId ?? null;

    await supabase.from("api_keys").insert({
      user_id:  uid,
      key_hash: hash,
    });

    // Return key ONCE — never stored in plaintext
    return NextResponse.json({ success: true, key: raw });
  } catch (err) {
    console.error("API key gen error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GET /api/apikeys?userId=... — list active keys (masked)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId   = searchParams.get("userId");
    const clientId = searchParams.get("clientId");
    if (!userId && !clientId) {
      return NextResponse.json({ keys: [] });
    }

    const supabase = getSupabase();
    const { data } = await supabase
      .from("api_keys")
      .select("id, created_at, last_used, is_active")
      .eq("user_id", userId ?? clientId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    return NextResponse.json({ keys: data ?? [] });
  } catch {
    return NextResponse.json({ keys: [] });
  }
}

// DELETE /api/apikeys — revoke a key
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const supabase = getSupabase();
    await supabase
      .from("api_keys")
      .update({ is_active: false })
      .eq("id", id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
