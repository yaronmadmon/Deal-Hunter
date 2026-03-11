export const SUBSCRIPTION_TIERS = {
  starter: {
    name: "Starter",
    price_id: "price_1T9uH5FDYbFzESfWd8q9QfOx",
    product_id: "prod_U8AcRADCC7pvqR",
    monthly: 9,
    credits_per_month: 10,
    free_reports_on_signup: 3,
  },
  pro: {
    name: "Pro",
    price_id: "price_1T9uJcFDYbFzESfW9k8hntj2",
    product_id: "prod_U8AeVZPYMnMkCq",
    monthly: 29,
    credits_per_month: -1, // unlimited
    free_reports_on_signup: 3,
  },
  agency: {
    name: "Agency",
    price_id: "price_1T9uKEFDYbFzESfWCDsC0dPT",
    product_id: "prod_U8AfEDCYRPGFhE",
    monthly: 79,
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
