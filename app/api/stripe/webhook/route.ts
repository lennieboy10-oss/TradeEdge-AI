import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-11-20.acacia" as any });

const ELITE_PRICE_ID = process.env.STRIPE_ELITE_PRICE_ID ?? "price_1TSYQq3Xa1paguaYmYOmDlK1";

function planFromPriceId(priceId: string | null | undefined): "elite" | "pro" {
  return priceId === ELITE_PRICE_ID ? "elite" : "pro";
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig     = req.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Signature failed";
    console.error("[stripe/webhook] signature failed:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  console.log("[stripe/webhook] received:", event.type);

  const supabase = getSupabase();

  try {
    // ── checkout.session.completed ─────────────────────────────────
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Plan from metadata — set at checkout creation time
      const plan      = (session.metadata?.plan as "elite" | "pro") || "pro";
      const userId    = session.metadata?.userId || session.client_reference_id || "";
      const userEmail = session.metadata?.userEmail || session.customer_email ||
        (session.customer_details as { email?: string } | null)?.email || "";
      const customerId = typeof session.customer === "string" ? session.customer : null;

      console.log(`[stripe/webhook] checkout.session.completed plan=${plan} userId=${userId} email=${userEmail}`);

      if (!userEmail && !userId) {
        console.error("[stripe/webhook] no user identifier — skipping");
        return NextResponse.json({ received: true });
      }

      // Update by email
      if (userEmail) {
        const { error } = await supabase
          .from("profiles")
          .update({ plan, stripe_customer_id: customerId })
          .eq("email", userEmail);
        console.log(`[stripe/webhook] update by email → plan=${plan}`, error?.message);
      }

      // Update by userId (covers both user_id and client_id columns)
      if (userId) {
        const { error } = await supabase
          .from("profiles")
          .update({ plan, stripe_customer_id: customerId })
          .or(`user_id.eq.${userId},client_id.eq.${userId}`);
        console.log(`[stripe/webhook] update by userId → plan=${plan}`, error?.message);
      }
    }

    // ── invoice.paid / invoice.payment_succeeded ───────────────────
    if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoice        = event.data.object as any;
      const email          = (invoice.customer_email as string | null) ?? null;
      const customerId     = typeof invoice.customer === "string" ? invoice.customer : null;
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;

      let clientId: string | null = null;
      let plan: "elite" | "pro"  = "pro";

      if (subscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          clientId  = sub.metadata?.client_id ?? null;
          // Prefer plan from subscription metadata, fall back to price ID
          plan = (sub.metadata?.plan === "elite")
            ? "elite"
            : planFromPriceId(sub.items.data[0]?.price?.id);
        } catch (e) {
          console.error("[stripe/webhook] failed to retrieve subscription:", e);
          // Fall back: derive plan from invoice line item price
          const priceId = invoice.lines?.data?.[0]?.price?.id;
          plan = planFromPriceId(priceId);
        }
      }

      console.log(`[stripe/webhook] invoice.paid → plan=${plan} clientId=${clientId} email=${email}`);

      if (clientId) {
        const { error } = await supabase.from("profiles").upsert(
          { client_id: clientId, email, plan, stripe_customer_id: customerId },
          { onConflict: "client_id" }
        );
        console.log(`[stripe/webhook] upsert by clientId plan=${plan}`, error?.message);
      } else if (email) {
        const { error } = await supabase.from("profiles")
          .update({ plan, stripe_customer_id: customerId ?? undefined })
          .eq("email", email);
        console.log(`[stripe/webhook] update by email plan=${plan}`, error?.message);
      } else {
        console.warn("[stripe/webhook] no identifier on invoice — cannot update profile");
      }
    }

    // ── customer.subscription.deleted ─────────────────────────────
    if (event.type === "customer.subscription.deleted") {
      const sub        = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      if (customerId) {
        const { error } = await supabase.from("profiles")
          .update({ plan: "free" })
          .eq("stripe_customer_id", customerId);
        console.log("[stripe/webhook] downgraded to free:", error?.message);
      }
    }
  } catch (err) {
    console.error("[stripe/webhook] handler error:", err);
  }

  return NextResponse.json({ received: true });
}
