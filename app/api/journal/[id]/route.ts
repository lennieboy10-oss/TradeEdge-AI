import { getSupabase } from "@/app/lib/supabase";
import type { Outcome } from "@/app/lib/supabase";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const update: { outcome?: Outcome | null; notes?: string } = {};

    if ("outcome" in body) update.outcome = body.outcome;
    if ("notes"   in body) update.notes   = body.notes;

    const supabase = getSupabase();
    const { error } = await supabase.from("journal").update(update).eq("id", id);

    if (error) throw error;
    return Response.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Update failed";
    return Response.json({ success: false, error: msg }, { status: 500 });
  }
}
