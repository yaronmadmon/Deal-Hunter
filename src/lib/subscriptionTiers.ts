export const SUBSCRIPTION_TIERS = {
  starter: {
    name: "Starter",
    price_id: "price_1T9zz9JxNS5tkQFqAymso8ZE",
    product_id: "prod_U8GWnWSv5dmoMX",
    monthly: 9,
    credits_per_month: 10,
    free_reports_on_signup: 3,
  },
  pro: {
    name: "Pro",
    price_id: "price_1TA01SJxNS5tkQFqLx9oAtAz",
    product_id: "prod_U8GYqKRTiz3L9A",
    monthly: 29,
    credits_per_month: -1, // unlimited
    free_reports_on_signup: 3,
  },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS | "free";

export function getTierByProductId(productId: string): SubscriptionTier {
  for (const [key, tier] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (tier.product_id === productId) return key as keyof typeof SUBSCRIPTION_TIERS;
  }
  return "free";
}

export function getTierByPriceId(priceId: string): SubscriptionTier {
  for (const [key, tier] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (tier.price_id === priceId) return key as keyof typeof SUBSCRIPTION_TIERS;
  }
  return "free";
}
