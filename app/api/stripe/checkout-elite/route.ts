import Stripe from "stripe";
import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-11-20.acacia" as any });

// Dedicated Elite checkout — no routing logic, hardcoded price only
const ELITE_PRICE_ID = "price_1TSYQq3Xa1paguaYmYOmDlK1";

export async function POST(req: Request) {
  try {
    const { clientId, email } = await req.json();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: ELITE_PRICE_ID, quantity: 1 }],
      customer_email: email || undefined,
      client_reference_id: clientId || undefined,
      metadata: { user_id: clientId || "" },
      subscription_data: {
        metadata: { client_id: clientId || "" },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/?cancelled=true`,
    });

    console.log(`[stripe/checkout-elite] session=${session.id} price=${ELITE_PRICE_ID} clientId=${clientId}`);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/checkout-elite]", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
