import Stripe from "stripe";
import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-11-20.acacia" as any });

// Hardcoded fallbacks so the route works even if env vars are missing in Vercel
const PRO_PRICE_ID   = process.env.STRIPE_PRO_PRICE_ID   ?? process.env.STRIPE_PRICE_ID   ?? "price_1TQuXc3Xa1paguaYjwxZEqEE";
const ELITE_PRICE_ID = process.env.STRIPE_ELITE_PRICE_ID ?? "price_1TSYQq3Xa1paguaYmYOmDlK1";

export async function POST(req: Request) {
  try {
    const { clientId, email, plan } = await req.json();

    const priceId = plan === "elite" ? ELITE_PRICE_ID : PRO_PRICE_ID;

    console.log(`[stripe/checkout] plan="${plan}" → priceId=${priceId}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      client_reference_id: clientId || undefined,
      metadata: { user_id: clientId || "", plan: plan || "pro" },
      subscription_data: {
        metadata: { client_id: clientId || "", plan: plan || "pro" },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/?cancelled=true`,
    });

    return NextResponse.json({ url: session.url, plan, priceId });
  } catch (err) {
    console.error("[stripe/checkout]", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
