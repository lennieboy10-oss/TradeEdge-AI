import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  const supabase = getSupabase();

  const { data } = await supabase
    .from("profiles")
    .select("email, plan, stripe_customer_id, client_id, user_id")
    .eq("email", email || "")
    .single();

  return NextResponse.json({
    profile: data,
    env: {
      hasProPriceId:   !!process.env.STRIPE_PRO_PRICE_ID,
      hasElitePriceId: !!process.env.STRIPE_ELITE_PRICE_ID,
      proPriceId:      process.env.STRIPE_PRO_PRICE_ID?.slice(0, 20),
      elitePriceId:    process.env.STRIPE_ELITE_PRICE_ID?.slice(0, 20),
      appUrl:          process.env.NEXT_PUBLIC_APP_URL,
    },
  });
}
