import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, X, Home, Zap, Sparkles, Star, Loader2, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SUBSCRIPTION_TIERS, type SubscriptionTier } from "@/lib/subscriptionTiers";
import { toast } from "sonner";

const tiers = [
  {
    key: "free" as SubscriptionTier,
    name: "Free",
    icon: Zap,
    monthly: 0,
    annual: 0,
    sub: "Try before you commit",
    features: [
      "3 property searches (lifetime)",
      "2 skip traces (lifetime)",
      "AI deal score",
      "Basic property info",
      "No deal pipeline CRM",
    ],
    btnLabel: "Start Free",
    btnVariant: "outline" as const,
    btnClass: "",
    highlight: false,
    priceId: null,
  },
  {
    key: "starter" as SubscriptionTier,
    name: "Starter",
    icon: Sparkles,
    monthly: 29,
    annual: 290,
    sub: "50 searches/mo + 25 skip traces",
    features: [
      "50 property searches/month",
      "25 skip traces/month",
      "Full AI deal analysis",
      "Deal pipeline CRM",
      "Saved search alerts",
      "Foreclosure auction calendar",
    ],
    btnLabel: "Get Started",
    btnVariant: "outline" as const,
    btnClass: "border-primary text-primary hover:bg-primary hover:text-primary-foreground",
    highlight: false,
    priceId: SUBSCRIPTION_TIERS.starter.price_id,
  },
  {
    key: "pro" as SubscriptionTier,
    name: "Pro",
    icon: Star,
    monthly: 79,
    annual: 790,
    sub: "For serious investors",
    features: [
      "Unlimited property searches",
      "100 skip traces/month",
      "Full AI + intelligence layer",
      "Owner research reports",
      "Deal pipeline CRM",
      "Priority ATTOM data refresh",
      "CSV export",
    ],
    btnLabel: "Start Pro",
    btnVariant: "default" as const,
    btnClass: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25",
    highlight: true,
    badge: "Most Popular",
    priceId: SUBSCRIPTION_TIERS.pro.price_id,
  },
];

const comparisonFeatures = [
  { label: "Property searches/month", values: ["3 lifetime", "50/mo", "Unlimited"] },
  { label: "Skip traces/month", values: ["2 lifetime", "25/mo", "100/mo"] },
  { label: "AI deal score", values: [true, true, true] },
  { label: "Full AI deal analysis", values: [false, true, true] },
  { label: "Owner research layer", values: [false, true, true] },
  { label: "Deal pipeline CRM", values: [false, true, true] },
  { label: "Saved search email alerts", values: [false, true, true] },
  { label: "Foreclosure auction calendar", values: [false, true, true] },
  { label: "ROI calculator", values: [true, true, true] },
  { label: "Priority data refresh", values: [false, false, true] },
  { label: "CSV export", values: [false, false, true] },
];

const testimonials = [
  { quote: "Found a tax lien deal in 20 minutes that would have taken me days to track down manually", role: "Real estate investor", initials: "MR" },
  { quote: "The owner research layer is insane — it confirmed the seller's distress before I even called", role: "Wholesaler", initials: "JT" },
  { quote: "Closed my first deal using Deal Hunter within 3 weeks of signing up", role: "Fix & flip investor", initials: "AS" },
];

const faqs = [
  { q: "Can I cancel anytime?", a: "Yes. No contracts, cancel in one click from your account settings." },
  { q: "What data sources do you use?", a: "Property data from ATTOM Data Solutions — the same source used by major real estate platforms. Enriched with Serper, Perplexity, Keywords Everywhere, and Firecrawl for owner research, neighborhood sentiment, and market heat signals." },
  { q: "How accurate is the skip tracing?", a: "We use Tracerfy, which returns up to 8 phone numbers and 5 emails per owner. Contact data is cross-referenced across multiple sources for accuracy." },
  { q: "How fresh is the distressed property data?", a: "ATTOM captures new tax lien, foreclosure, and lis pendens filings within 24-48 hours of county recording." },
  { q: "What is the AI deal score?", a: "A 0-100 score computed by Claude using ATTOM property facts + neighborhood sentiment + market heat (motivated seller volume vs. investor competition). Properties ≥70 are flagged as Strong Deal." },
  { q: "Do unused skip traces roll over?", a: "Monthly skip traces reset each billing cycle and do not roll over. One-time purchased traces never expire." },
];

const Pricing = () => {
  const [annual, setAnnual] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const navigate = useNavigate();
  const { user, subscription, subLoading, checkSubscription } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscription") === "success") {
      checkSubscription();
      toast.success("Subscription activated! Welcome to Deal Hunter.");
      window.history.replaceState({}, "", "/pricing");
    }
  }, [checkSubscription]);

  const handleSubscribe = async (priceId: string | null, tierKey: SubscriptionTier) => {
    if (!priceId) { navigate("/auth"); return; }
    if (!user) { navigate("/auth"); return; }
    setCheckoutLoading(tierKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { tier: tierKey, priceId },
      });
      if (error || !data?.url) { toast.error("Failed to start checkout. Please try again."); return; }
      window.location.href = data.url;
    } catch {
      toast.error("Something went wrong");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error || !data?.url) { toast.error("Failed to open subscription management"); return; }
      window.location.href = data.url;
    } catch {
      toast.error("Something went wrong");
    } finally {
      setPortalLoading(false);
    }
  };

  const isCurrentTier = (tierKey: SubscriptionTier) => subscription.tier === tierKey;

  const getButtonContent = (tier: typeof tiers[0]) => {
    if (checkoutLoading === tier.key) return <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>;
    if (isCurrentTier(tier.key) && tier.key !== "free") return <><Settings className="w-4 h-4 mr-2" /> Manage Plan</>;
    if (subscription.subscribed) {
      const tierOrder: SubscriptionTier[] = ["free", "starter", "pro"];
      const currentIdx = tierOrder.indexOf(subscription.tier);
      const thisIdx = tierOrder.indexOf(tier.key);
      if (thisIdx > currentIdx) return `Upgrade to ${tier.name}`;
    }
    return tier.btnLabel;
  };

  const handleTierClick = (tier: typeof tiers[0]) => {
    if (isCurrentTier(tier.key) && tier.key !== "free") { handleManageSubscription(); return; }
    handleSubscribe(tier.priceId, tier.key);
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto border-b border-border/50">
        <span className="font-heading text-xl font-bold text-foreground cursor-pointer flex items-center gap-2" onClick={() => navigate("/")}>
          <Home className="w-5 h-5 text-primary" /> Deal Hunter
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>Dashboard</Button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
            Find deals. Contact owners. Close.
          </h1>
          <p className="text-base text-muted-foreground mb-4">Start free. Upgrade when you're ready to scale.</p>

          {user && subscription.subscribed && (
            <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-500 border border-green-500/20 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Check className="w-4 h-4" />
              You're on the <span className="font-bold capitalize">{subscription.tier}</span> plan
              {subscription.subscriptionEnd && (
                <span className="opacity-70">· renews {new Date(subscription.subscriptionEnd).toLocaleDateString()}</span>
              )}
            </div>
          )}

          {/* Monthly / Annual toggle */}
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${annual ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${annual ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            <span className={`text-sm font-medium ${annual ? "text-foreground" : "text-muted-foreground"}`}>Annual</span>
            {annual && <span className="ml-2 text-xs font-semibold bg-green-500/15 text-green-500 px-2.5 py-1 rounded-full">Save 2 months</span>}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-20 max-w-4xl mx-auto">
          {tiers.map((tier) => {
            const price = annual ? tier.annual : tier.monthly;
            const monthlyEquiv = annual && tier.annual > 0 ? (tier.annual / 12).toFixed(0) : null;
            const annualSavings = tier.monthly > 0 ? tier.monthly * 12 - tier.annual : 0;
            const isCurrent = isCurrentTier(tier.key);

            return (
              <div
                key={tier.name}
                className={`relative rounded-xl border p-6 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  isCurrent
                    ? "border-green-500 bg-card ring-2 ring-green-500/30 shadow-lg"
                    : tier.highlight
                    ? "border-primary bg-card shadow-lg shadow-primary/10 scale-[1.02] lg:scale-105 z-10 ring-1 ring-primary/30"
                    : "border-border bg-card hover:border-muted-foreground/30"
                }`}
              >
                {isCurrent && tier.key !== "free" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-md">
                    Your Plan
                  </div>
                )}
                {!isCurrent && tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-full shadow-md">
                    {tier.badge}
                  </div>
                )}

                <div className="mb-4 mt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <tier.icon className={`w-5 h-5 ${isCurrent ? "text-green-500" : tier.highlight ? "text-primary" : "text-muted-foreground"}`} />
                    <h3 className="font-heading text-lg font-bold text-foreground">{tier.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">{tier.sub}</p>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1.5">
                    {annual && tier.monthly > 0 && <span className="text-lg text-muted-foreground line-through">${tier.monthly}</span>}
                    <span className="font-heading text-4xl font-bold text-foreground">
                      ${annual ? monthlyEquiv || "0" : price}
                    </span>
                    {tier.monthly > 0 && <span className="text-sm text-muted-foreground">/mo</span>}
                  </div>
                  {annual && tier.monthly > 0 && <p className="text-xs text-muted-foreground mt-1">${tier.annual}/yr billed annually</p>}
                  {annual && annualSavings > 0 && <p className="text-xs text-green-500 font-medium mt-1">You save ${annualSavings}/year</p>}
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {tier.features.map((f) => {
                    const isNegative = f.startsWith("No ");
                    return (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        {isNegative
                          ? <X className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                          : <Check className={`w-4 h-4 shrink-0 mt-0.5 ${isCurrent ? "text-green-500" : tier.highlight ? "text-primary" : "text-green-500"}`} />}
                        <span className={isNegative ? "text-muted-foreground/60" : "text-foreground"}>{f}</span>
                      </li>
                    );
                  })}
                </ul>

                <Button
                  variant={tier.btnVariant}
                  className={`w-full font-semibold ${isCurrent && tier.key !== "free" ? "border-green-500 text-green-500 hover:bg-green-500 hover:text-white" : tier.btnClass}`}
                  onClick={() => handleTierClick(tier)}
                  disabled={checkoutLoading !== null || portalLoading || (isCurrent && tier.key === "free")}
                >
                  {getButtonContent(tier)}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Comparison Table */}
        <div className="mb-20">
          <h2 className="font-heading text-2xl font-bold text-foreground text-center mb-8">Compare Plans</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Feature</th>
                  {tiers.map((t) => (
                    <th key={t.name} className={`text-center py-3 px-4 font-semibold ${isCurrentTier(t.key) ? "text-green-500" : t.highlight ? "text-primary" : "text-foreground"}`}>
                      {t.name}
                      {isCurrentTier(t.key) && t.key !== "free" && <span className="block text-xs font-normal">✓ Current</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((row, i) => (
                  <tr key={row.label} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-card" : "bg-muted/20"}`}>
                    <td className="py-2.5 px-4 text-foreground">{row.label}</td>
                    {row.values.map((val, j) => (
                      <td key={j} className="text-center py-2.5 px-4">
                        {typeof val === "boolean" ? (
                          val
                            ? <Check className={`w-4 h-4 mx-auto ${j === 2 ? "text-primary" : "text-green-500"}`} />
                            : <X className="w-4 h-4 mx-auto text-muted-foreground/40" />
                        ) : (
                          <span className="text-foreground font-medium">{val}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Testimonials */}
        <div className="mb-20">
          <h2 className="font-heading text-2xl font-bold text-foreground text-center mb-8">What Investors Say</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.initials} className="rounded-xl border border-border bg-card p-6 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-lg mb-4">
                  {t.initials}
                </div>
                <p className="text-foreground font-medium mb-3 italic">"{t.quote}"</p>
                <p className="text-xs text-muted-foreground">— {t.role}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-20 max-w-3xl mx-auto">
          <h2 className="font-heading text-2xl font-bold text-foreground text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details key={faq.q} className="group rounded-xl border border-border bg-card overflow-hidden">
                <summary className="cursor-pointer px-6 py-4 font-medium text-foreground flex items-center justify-between hover:bg-muted/30 transition-colors">
                  {faq.q}
                  <span className="text-muted-foreground group-open:rotate-45 transition-transform text-xl">+</span>
                </summary>
                <div className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="rounded-2xl border border-border bg-card p-10 sm:p-14 text-center">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Your next deal is already out there.
          </h2>
          <p className="text-muted-foreground mb-8 text-sm leading-7">
            Tax liens, foreclosures, divorces, delinquencies — distressed owners are motivated. Find them first.
          </p>
          <Button
            size="lg"
            className="px-8 font-semibold shadow-lg shadow-primary/20"
            onClick={() => user ? navigate("/dashboard") : navigate("/auth")}
          >
            {user ? "Find Deals Now" : "Start Free"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </main>

      <footer className="text-center py-8 text-sm text-muted-foreground border-t border-border/50">
        © 2026 Deal Hunter
      </footer>
    </div>
  );
};

export default Pricing;
