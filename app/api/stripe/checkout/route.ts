import Stripe from "stripe";
import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-11-20.acacia" as any });

const PRO_PRICE_ID   = process.env.STRIPE_PRO_PRICE_ID   ?? process.env.STRIPE_PRICE_ID   ?? "price_1TQuXc3Xa1paguaYjwxZEqEE";
const ELITE_PRICE_ID = process.env.STRIPE_ELITE_PRICE_ID ?? "price_1TSYQq3Xa1paguaYmYOmDlK1";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { plan, userId, email, clientId } = body;

    let priceId: string;
    if (plan === "elite") {
      priceId = ELITE_PRICE_ID;
    } else {
      priceId = PRO_PRICE_ID;
    }

    console.log(`[stripe/checkout] plan="${plan}" priceId=${priceId} clientId=${clientId}`);

    if (!priceId) {
      return NextResponse.json({ error: "Price ID not configured for plan: " + plan }, { status: 500 });
    }

    const resolvedClientId = userId ?? clientId ?? "";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      client_reference_id: resolvedClientId || undefined,
      metadata: {
        userId:    resolvedClientId,
        userEmail: email || "",
        plan:      plan || "pro",
      },
      subscription_data: {
        metadata: { client_id: resolvedClientId, plan: plan || "pro" },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=${plan || "pro"}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/?cancelled=true`,
    });

    console.log(`[stripe/checkout] session created: ${session.id} plan=${plan} priceId=${priceId}`);

    return NextResponse.json({ url: session.url, plan, priceId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Checkout failed";
    console.error("[stripe/checkout]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
