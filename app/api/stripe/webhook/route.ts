import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-11-20.acacia" as any });

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig     = req.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("[stripe/webhook] signature failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getSupabase();

  console.log("[stripe/webhook] Webhook received:", event.type);

  try {
    switch (event.type) {

      // Primary upgrade trigger — fires reliably on first payment
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice        = event.data.object as any;
        const email          = (invoice.customer_email as string | null) ?? null;
        const customerId     = typeof invoice.customer === "string" ? (invoice.customer as string) : null;
        const subscriptionId = typeof invoice.subscription === "string" ? (invoice.subscription as string) : null;

        console.log("[stripe/webhook] invoice.paid — customer:", customerId, "email:", email);

        // Retrieve subscription to get client_id metadata + price for plan detection
        let clientId: string | null = null;
        let plan = "pro";
        if (subscriptionId) {
          try {
            const ELITE_PRICE_ID = "price_1TSYQq3Xa1paguaYmYOmDlK1"; // £39.99/mo Elite — hardcoded
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            clientId  = sub.metadata?.client_id ?? null;
            const priceId = sub.items.data[0]?.price?.id;
            if (priceId && priceId === ELITE_PRICE_ID) plan = "elite";
          } catch (e) {
            console.error("[stripe/webhook] failed to retrieve subscription:", e);
          }
        }

        console.log(`[stripe/webhook] Updating user plan to ${plan} for client_id:`, clientId, "email:", email);

        if (clientId) {
          const { data, error } = await supabase.from("profiles").upsert(
            { client_id: clientId, email, plan, stripe_customer_id: customerId },
            { onConflict: "client_id" }
          ).select("id, client_id, plan");
          console.log(`Plan upgraded to ${plan} for:`, email, "result:", data, error);
        } else if (email) {
          const { data, error } = await supabase.from("profiles")
            .update({ plan, stripe_customer_id: customerId ?? undefined })
            .eq("email", email)
            .select("id, client_id, plan");
          console.log(`Plan upgraded to ${plan} for:`, email, "result:", data, error);
        } else {
          console.warn("[stripe/webhook] Cannot identify user — no client_id or email on invoice");
        }
        break;
      }

      // Belt-and-suspenders: also handle checkout.session.completed if it fires
      case "checkout.session.completed": {
        const session    = event.data.object as Stripe.Checkout.Session;
        const clientId   = session.client_reference_id;
        const email      = session.customer_email ?? session.metadata?.email ?? null;
        const customerId = typeof session.customer === "string" ? session.customer : null;
        console.log("[stripe/webhook] checkout.session.completed — client_id:", clientId);
        if (clientId) {
          // Detect plan from purchased price
          let plan = "pro";
          try {
            const ELITE_PRICE_ID = "price_1TSYQq3Xa1paguaYmYOmDlK1"; // £39.99/mo Elite — hardcoded
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
            const priceId   = lineItems.data[0]?.price?.id;
            if (priceId && priceId === ELITE_PRICE_ID) plan = "elite";
          } catch { /* non-fatal — default to pro */ }
          const { data, error } = await supabase.from("profiles").upsert(
            { client_id: clientId, email, plan, stripe_customer_id: customerId },
            { onConflict: "client_id" }
          ).select("id, client_id, plan");
          console.log(`Plan upgraded to ${plan} for:`, email, "result:", data, error);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub        = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : null;
        console.log("[stripe/webhook] Subscription deleted for customer:", customerId);
        if (customerId) {
          const { data, error } = await supabase.from("profiles")
            .update({ plan: "free" })
            .eq("stripe_customer_id", customerId)
            .select("id, plan");
          console.log("[stripe/webhook] Supabase downgrade result:", data, error);
        }
        break;
      }

      default:
        console.log("[stripe/webhook] Unhandled event type:", event.type);
    }
  } catch (err) {
    console.error("[stripe/webhook] db update failed:", err);
  }

  return NextResponse.json({ received: true });
}
