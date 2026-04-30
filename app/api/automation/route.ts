import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

// GET — fetch current automation settings
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? searchParams.get("clientId");
  if (!userId) return NextResponse.json({ settings: null });

  const supabase = getSupabase();
  const { data } = await supabase
    .from("automation_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  return NextResponse.json({ settings: data ?? null });
}

// POST — upsert automation settings
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, ...settings } = body;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabase();

    await supabase
      .from("automation_settings")
      .upsert({ user_id: userId, ...settings, updated_at: new Date().toISOString() });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
