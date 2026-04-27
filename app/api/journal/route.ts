import { getSupabase } from "@/app/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("journal")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return Response.json({ success: true, entries: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch journal";
    return Response.json({ success: false, error: msg }, { status: 500 });
  }
}
