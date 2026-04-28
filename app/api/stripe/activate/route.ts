import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-11-20.acacia" as any });

// Called immediately when user lands on /dashboard?upgraded=true&session_id=xxx
// Retrieves the Stripe session directly and upgrades the profile — no webhook needed.
export async function POST(req: Request) {
  const { sessionId, clientId } = await req.json();

  if (!sessionId || !clientId) {
    return NextResponse.json({ error: "Missing sessionId or clientId" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log("[stripe/activate] session payment_status:", session.payment_status, "client_id:", clientId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ plan: "free", error: "Payment not completed" }, { status: 402 });
    }

    const email      = session.customer_email ?? null;
    const customerId = typeof session.customer === "string" ? session.customer : null;

    const { data, error } = await getSupabase()
      .from("profiles")
      .upsert(
        { client_id: clientId, email, plan: "pro", stripe_customer_id: customerId },
        { onConflict: "client_id" }
      )
      .select("id, client_id, plan");

    console.log("[stripe/activate] Plan upgraded to pro for:", email, "result:", data, error);

    if (error) {
      return NextResponse.json({ plan: "free", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ plan: "pro", success: true });
  } catch (err) {
    console.error("[stripe/activate] failed:", err);
    return NextResponse.json({ plan: "free", error: "Activation failed" }, { status: 500 });
  }
}
