import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

// GET — fetch current automation settings
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId   = searchParams.get("userId");
  const clientId = searchParams.get("clientId");
  const id = userId ?? clientId;
  if (!id) return NextResponse.json({ settings: null });

  const supabase = getSupabase();
  const col = userId ? "user_id" : "client_id";
  const { data } = await supabase
    .from("automation_settings")
    .select("*")
    .eq(col, id)
    .single();

  return NextResponse.json({ settings: data ?? null });
}

// POST — upsert automation settings
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, clientId, ...settings } = body;
    const id = userId ?? clientId;
    if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabase();
    const col = userId ? "user_id" : "client_id";

    await supabase
      .from("automation_settings")
      .upsert({ [col]: id, ...settings, updated_at: new Date().toISOString() }, { onConflict: col });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
