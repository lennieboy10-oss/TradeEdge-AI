import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-11-20.acacia" as any });

export async function POST(req: Request) {
  try {
    const { clientId } = await req.json();

    const supabase = getSupabase();
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("client_id", clientId)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   profile.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/account`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/portal]", err);
    return NextResponse.json({ error: "Failed to open portal" }, { status: 500 });
  }
}
