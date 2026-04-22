// TODO: Before launch, create new Stripe products for $29 Starter and $79 Pro,
// then replace the price_id and product_id values below with the new IDs.
// Until then, legacy IDs are kept so existing subscribers are not disrupted.

export const SUBSCRIPTION_TIERS = {
  // Legacy Gold Rush tiers — kept so existing Stripe webhooks keep working
  // during the transition. Remove once all subscribers have migrated.
  _legacy_starter: {
    name: "Starter (legacy)",
    price_id: "price_1T9zz9JxNS5tkQFqAymso8ZE",
    product_id: "prod_U8GWnWSv5dmoMX",
    monthly: 9,
    searches_per_month: 50,
    skip_traces_per_month: 25,
    free_searches_on_signup: 3,
    free_skip_traces_on_signup: 2,
  },
  _legacy_pro: {
    name: "Pro (legacy)",
    price_id: "price_1TA01SJxNS5tkQFqLx9oAtAz",
    product_id: "prod_U8GYqKRTiz3L9A",
    monthly: 29,
    searches_per_month: -1,
    skip_traces_per_month: 100,
    free_searches_on_signup: 3,
    free_skip_traces_on_signup: 2,
  },
  // New Deal Hunter tiers — replace price_id / product_id after creating in Stripe
  starter: {
    name: "Starter",
    price_id: "price_1T9zz9JxNS5tkQFqAymso8ZE", // TODO: replace with new $29/mo price ID
    product_id: "prod_U8GWnWSv5dmoMX",           // TODO: replace with new Starter product ID
    monthly: 29,
    searches_per_month: 50,
    skip_traces_per_month: 25,
    free_searches_on_signup: 3,
    free_skip_traces_on_signup: 2,
  },
  pro: {
    name: "Pro",
    price_id: "price_1TA01SJxNS5tkQFqLx9oAtAz", // TODO: replace with new $79/mo price ID
    product_id: "prod_U8GYqKRTiz3L9A",           // TODO: replace with new Pro product ID
    monthly: 79,
    searches_per_month: -1, // unlimited
    skip_traces_per_month: 100,
    free_searches_on_signup: 3,
    free_skip_traces_on_signup: 2,
  },
} as const;

export const FREE_TIER_LIMITS = {
  searches_lifetime: 3,
  skip_traces_lifetime: 2,
} as const;

export type SubscriptionTier = "free" | "starter" | "pro";

export function getTierByProductId(productId: string): SubscriptionTier {
  for (const [key, tier] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (key.startsWith("_")) continue; // skip legacy during new-tier lookups
    if (tier.product_id === productId) return key as SubscriptionTier;
  }
  // Fall back to legacy check so existing subscribers keep their access
  for (const [key, tier] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (!key.startsWith("_")) continue;
    if (tier.product_id === productId) {
      return key.replace("_legacy_", "") as SubscriptionTier;
    }
  }
  return "free";
}

export function getTierByPriceId(priceId: string): SubscriptionTier {
  for (const [key, tier] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (tier.price_id === priceId) {
      const clean = key.replace("_legacy_", "");
      return clean as SubscriptionTier;
    }
  }
  return "free";
}

export function getSkipTracesPerMonth(tier: SubscriptionTier): number {
  if (tier === "free") return FREE_TIER_LIMITS.skip_traces_lifetime;
  return SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS]?.skip_traces_per_month ?? 0;
}

export function getSearchesPerMonth(tier: SubscriptionTier): number {
  if (tier === "free") return FREE_TIER_LIMITS.searches_lifetime;
  return SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS]?.searches_per_month ?? 0;
}
