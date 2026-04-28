import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";
import type { Outcome } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const patch: Record<string, unknown> = {};
    if ("outcome" in body) patch.outcome = (body.outcome as Outcome) || null;
    if ("notes"   in body) patch.notes   = body.notes ?? "";

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: true });
    }

    const { error } = await getSupabase()
      .from("journal")
      .update(patch)
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await getSupabase()
      .from("journal")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
