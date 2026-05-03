import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

async function verifyAdmin(clientId: string | null): Promise<boolean> {
  if (!clientId || !ADMIN_EMAIL) return false;
  const { data } = await getSupabase()
    .from("profiles")
    .select("email")
    .eq("client_id", clientId)
    .single();
  return data?.email === ADMIN_EMAIL;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("admin_client_id");

  if (!(await verifyAdmin(clientId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("tradingview_access")
    .select("*")
    .order("requested_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows  = data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return NextResponse.json({
    rows,
    stats: {
      total:    rows.length,
      pending:  rows.filter((r) => r.status === "pending").length,
      approved: rows.filter((r) => r.status === "approved").length,
      today:    rows.filter((r) => r.requested_at?.slice(0, 10) === today).length,
    },
  });
}
