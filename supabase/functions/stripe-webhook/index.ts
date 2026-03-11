import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    console.error("[stripe-webhook] Missing signature or webhook secret");
    return new Response(JSON.stringify({ error: "Missing signature" }), { status: 400, headers: corsHeaders });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400, headers: corsHeaders });
  }

  console.log(`[stripe-webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const credits = parseInt(session.metadata?.credits || "0", 10);
        const customerId = session.customer as string;

        if (userId && credits > 0) {
          // Add credits
          const { data: profile } = await supabase
            .from("profiles")
            .select("credits")
            .eq("id", userId)
            .single();

          if (profile) {
            await supabase
              .from("profiles")
              .update({ credits: profile.credits + credits })
              .eq("id", userId);

            await supabase.from("credits_log").insert({
              user_id: userId,
              amount: credits,
              reason: `Stripe webhook: purchased ${credits} credits`,
            });

            // Log analytics
            await supabase.from("analytics_events").insert({
              event_name: "credits_purchased",
              user_id: userId,
              metadata: { credits, session_id: session.id },
            });
          }
        }

        // Handle subscription checkout
        if (session.mode === "subscription" && userId && customerId) {
          const subscriptionId = session.subscription as string;
          const sub = await stripe.subscriptions.retrieve(subscriptionId);

          await supabase.from("subscriptions").upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan: sub.items.data[0]?.price?.lookup_key || "pro",
            status: "active",
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          }, { onConflict: "user_id" });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Find subscription by customer ID
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (sub) {
          await supabase
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("id", sub.id);
        }

        console.log(`[stripe-webhook] Payment failed for customer ${customerId}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (sub) {
          await supabase
            .from("subscriptions")
            .update({ status: "canceled", plan: "free" })
            .eq("id", sub.id);
        }

        console.log(`[stripe-webhook] Subscription canceled for customer ${customerId}`);
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error processing ${event.type}:`, err);
    return new Response(JSON.stringify({ error: "Processing failed" }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
