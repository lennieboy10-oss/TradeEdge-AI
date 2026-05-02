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
  } catch (err) {
    console.error("[stripe/webhook] signature failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getSupabase();
  console.log("[stripe/webhook] received:", event.type);

  try {
    switch (event.type) {

      // Primary — fires reliably on first payment and renewals
      case "invoice.paid":
      case "invoice.payment_succeeded": {
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
            // Prefer plan stored in metadata, fall back to price ID comparison
            plan = (sub.metadata?.plan === "elite") ? "elite" : planFromPriceId(sub.items.data[0]?.price?.id);
          } catch (e) {
            console.error("[stripe/webhook] failed to retrieve subscription:", e);
          }
        }

        console.log(`[stripe/webhook] invoice.paid → plan=${plan} clientId=${clientId} email=${email}`);

        if (clientId) {
          const { data, error } = await supabase.from("profiles").upsert(
            { client_id: clientId, email, plan, stripe_customer_id: customerId },
            { onConflict: "client_id" }
          ).select("id, client_id, plan");
          console.log(`Upgraded to ${plan}:`, email, data, error);
        } else if (email) {
          const { data, error } = await supabase.from("profiles")
            .update({ plan, stripe_customer_id: customerId ?? undefined })
            .eq("email", email)
            .select("id, client_id, plan");
          console.log(`Upgraded to ${plan}:`, email, data, error);
        } else {
          console.warn("[stripe/webhook] no client_id or email — cannot identify user");
        }
        break;
      }

      // Belt-and-suspenders
      case "checkout.session.completed": {
        const session    = event.data.object as Stripe.Checkout.Session;
        const clientId   = session.client_reference_id;
        const email      = session.customer_email ?? session.metadata?.email ?? null;
        const customerId = typeof session.customer === "string" ? session.customer : null;

        if (!clientId) break;

        // Read plan from metadata (set during checkout creation), fall back to price ID
        let plan: "elite" | "pro" = "pro";
        if (session.metadata?.plan === "elite") {
          plan = "elite";
        } else {
          try {
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
            plan = planFromPriceId(lineItems.data[0]?.price?.id);
          } catch { /* non-fatal */ }
        }

        console.log(`[stripe/webhook] checkout.session.completed → plan=${plan} clientId=${clientId}`);

        const { data, error } = await supabase.from("profiles").upsert(
          { client_id: clientId, email, plan, stripe_customer_id: customerId },
          { onConflict: "client_id" }
        ).select("id, client_id, plan");
        console.log(`Upgraded to ${plan}:`, email, data, error);
        break;
      }

      case "customer.subscription.deleted": {
        const sub        = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : null;
        if (customerId) {
          const { data, error } = await supabase.from("profiles")
            .update({ plan: "free" })
            .eq("stripe_customer_id", customerId)
            .select("id, plan");
          console.log("[stripe/webhook] downgraded to free:", data, error);
        }
        break;
      }

      default:
        console.log("[stripe/webhook] unhandled:", event.type);
    }
  } catch (err) {
    console.error("[stripe/webhook] db update failed:", err);
  }

  return NextResponse.json({ received: true });
}
