import Stripe from "stripe";
import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-11-20.acacia" as any });

export async function POST(req: Request) {
  try {
    const { clientId, email, annual, elite, plan } = await req.json();

    // Price IDs — env vars preferred, hardcoded as fallback so production never routes wrong
    const ELITE_PRICE   = process.env.STRIPE_ELITE_PRICE_ID   ?? "price_1TSYQq3Xa1paguaYmYOmDlK1";
    const PRO_PRICE     = process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? process.env.STRIPE_PRICE_ID!;
    const PRO_ANN_PRICE = process.env.STRIPE_PRO_ANNUAL_PRICE_ID  ?? process.env.STRIPE_PRICE_ID!;

    let priceId: string;
    if (elite || plan === "elite") {
      priceId = ELITE_PRICE;
    } else if (annual) {
      priceId = PRO_ANN_PRICE;
    } else {
      priceId = PRO_PRICE;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      client_reference_id: clientId || undefined,
      metadata: { user_id: clientId || "" },
      subscription_data: {
        metadata: { client_id: clientId || "" },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/?cancelled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/checkout]", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
