import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");

  if (!clientId) {
    return NextResponse.json({ plan: "free", email: null, totalAnalyses: 0 });
  }

  const supabase = getSupabase();
  const [profileRes, countRes] = await Promise.all([
    supabase.from("profiles").select("plan, email").eq("client_id", clientId).single(),
    supabase.from("journal").select("id", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    plan:          profileRes.data?.plan  ?? "free",
    email:         profileRes.data?.email ?? null,
    totalAnalyses: countRes.count         ?? 0,
  });
}
