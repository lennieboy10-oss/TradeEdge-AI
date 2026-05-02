import Stripe from "stripe";
import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-11-20.acacia" as any });

// Dedicated Elite-only endpoint — no routing logic possible
const ELITE_PRICE_ID = process.env.STRIPE_ELITE_PRICE_ID ?? "price_1TSYQq3Xa1paguaYmYOmDlK1";

export async function POST(req: Request) {
  try {
    const { clientId, email } = await req.json();

    console.log(`[stripe/checkout-elite] clientId=${clientId} priceId=${ELITE_PRICE_ID}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: ELITE_PRICE_ID, quantity: 1 }],
      customer_email: email || undefined,
      client_reference_id: clientId || undefined,
      metadata: { user_id: clientId || "", plan: "elite" },
      subscription_data: {
        metadata: { client_id: clientId || "", plan: "elite" },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/?cancelled=true`,
    });

    return NextResponse.json({ url: session.url, plan: "elite", priceId: ELITE_PRICE_ID });
  } catch (err) {
    console.error("[stripe/checkout-elite]", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
