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
      case "checkout.session.completed": {
        const session    = event.data.object as Stripe.Checkout.Session;
        const clientId   = session.client_reference_id;
        const email      = session.customer_email ?? session.metadata?.email ?? null;
        const customerId = typeof session.customer === "string" ? session.customer : null;

        console.log("[stripe/webhook] Updating user plan to pro for:", clientId);

        if (clientId) {
          const { data, error } = await supabase.from("profiles").upsert(
            { client_id: clientId, email, plan: "pro", stripe_customer_id: customerId },
            { onConflict: "client_id" }
          ).select("id, client_id, plan");
          console.log("[stripe/webhook] Supabase update result:", data, error);
        } else {
          console.warn("[stripe/webhook] No client_reference_id on session:", session.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub        = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : null;
        console.log("[stripe/webhook] Subscription deleted for customer:", customerId);
        if (customerId) {
          const { data, error } = await supabase.from("profiles").update({ plan: "free" }).eq("stripe_customer_id", customerId).select("id, plan");
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
