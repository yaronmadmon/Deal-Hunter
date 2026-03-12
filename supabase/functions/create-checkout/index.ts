import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_CONFIG = {
  starter: { amount: 900, currency: "usd" },
  pro: { amount: 2900, currency: "usd" },
  agency: { amount: 7900, currency: "usd" },
} as const;

type TierKey = keyof typeof PLAN_CONFIG;

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

const normalizeTier = (tier: unknown): TierKey | null => {
  if (typeof tier !== "string") return null;
  const normalized = tier.toLowerCase();
  if (normalized === "starter" || normalized === "pro" || normalized === "agency") {
    return normalized;
  }
  return null;
};

const validateProvidedPrice = async (stripe: Stripe, priceId: string) => {
  const price = await stripe.prices.retrieve(priceId);
  if (!price.active) {
    throw new Error(`Price is not active: ${priceId}`);
  }
  if (price.recurring?.interval !== "month") {
    throw new Error(`Price is not monthly recurring: ${priceId}`);
  }
  return price.id;
};

const resolvePriceForTier = async (
  stripe: Stripe,
  tier: TierKey,
  fallbackPriceId?: string,
) => {
  if (fallbackPriceId) {
    try {
      const validated = await validateProvidedPrice(stripe, fallbackPriceId);
      logStep("Using provided priceId", { tier, priceId: validated });
      return validated;
    } catch (error) {
      logStep("Provided priceId invalid, resolving automatically", {
        tier,
        fallbackPriceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const byLookupKey = await stripe.prices.list({
    lookup_keys: [tier],
    active: true,
    limit: 10,
  });

  const lookupPrice = byLookupKey.data.find((price) => price.recurring?.interval === "month");
  if (lookupPrice) {
    logStep("Resolved price from lookup key", { tier, priceId: lookupPrice.id });
    return lookupPrice.id;
  }

  const expected = PLAN_CONFIG[tier];
  const recurringPrices = await stripe.prices.list({
    active: true,
    type: "recurring",
    limit: 100,
    expand: ["data.product"],
  });

  const byAmount = recurringPrices.data.find((price) =>
    price.recurring?.interval === "month" &&
    price.currency === expected.currency &&
    price.unit_amount === expected.amount
  );

  if (byAmount) {
    logStep("Resolved price from amount/currency", { tier, priceId: byAmount.id });
    return byAmount.id;
  }

  const byProductName = recurringPrices.data.find((price) => {
    if (price.recurring?.interval !== "month") return false;
    const product = price.product;
    if (typeof product === "string") return false;
    return product.name.toLowerCase().includes(tier);
  });

  if (byProductName) {
    logStep("Resolved price from product name", { tier, priceId: byProductName.id });
    return byProductName.id;
  }

  throw new Error(
    `No active monthly price found for tier "${tier}". Add lookup key "${tier}" or create ${expected.currency.toUpperCase()} ${(expected.amount / 100).toFixed(2)}/month price.`,
  );
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError) throw new Error(`Authentication error: ${authError.message}`);

    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const body = await req.json().catch(() => ({}));
    const providedPriceId = typeof body?.priceId === "string" ? body.priceId : undefined;
    const selectedTier = normalizeTier(body?.tier);

    if (!selectedTier && !providedPriceId) {
      throw new Error("Missing tier or priceId");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const resolvedPriceId = selectedTier
      ? await resolvePriceForTier(stripe, selectedTier, providedPriceId)
      : await validateProvidedPrice(stripe, providedPriceId!);

    logStep("Creating checkout", {
      tier: selectedTier,
      providedPriceId,
      resolvedPriceId,
      userId: user.id,
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    if (customerId) {
      logStep("Existing customer found", { customerId });
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/dashboard?subscription=success`,
      cancel_url: `${origin}/pricing`,
      metadata: {
        user_id: user.id,
        tier: selectedTier ?? "",
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
