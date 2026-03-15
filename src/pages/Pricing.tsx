import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles, Zap, Building2, Star, Loader2, Settings } from "lucide-react";
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
      "3 reports (lifetime)",
      "Basic score only",
      "No blueprint",
      "Watermarked PDF",
      "No Gold Rush Live",
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
    monthly: 9,
    annual: 90,
    sub: "10 credits/mo + 3 free reports",
    features: [
      "10 credits per month",
      "3 free reports on signup",
      "Full report with all 6 cards",
      "Blueprint included",
      "Clean PDF download",
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
    monthly: 29,
    annual: 290,
    sub: "For serious founders",
    features: [
      "Unlimited reports",
      "Full blueprint",
      "Gold Rush Live access 🔥",
      "Idea tracking & saved reports",
      "GitHub trending signals",
      "Priority data refresh",
    ],
    btnLabel: "Start Pro",
    btnVariant: "default" as const,
    btnClass: "bg-gold text-gold-foreground hover:bg-gold/90 shadow-lg shadow-gold/25",
    highlight: true,
    badge: "Most Popular",
    priceId: SUBSCRIPTION_TIERS.pro.price_id,
  },
];

const comparisonFeatures = [
  { label: "Monthly credits", values: ["3 lifetime", "10/mo", "Unlimited"] },
  { label: "Free reports on signup", values: ["3", "3", "3"] },
  { label: "Score breakdown", values: [true, true, true] },
  { label: "Full 6-card report", values: [false, true, true] },
  { label: "Startup blueprint", values: [false, true, true] },
  { label: "Clean PDF export", values: [false, true, true] },
  { label: "Gold Rush Live", values: [false, false, true] },
  { label: "Idea tracking", values: [false, false, true] },
  { label: "GitHub trending signals", values: [false, false, true] },
  { label: "Priority data refresh", values: [false, false, true] },
];

const testimonials = [
  { quote: "Saved me from building the wrong app", role: "indie developer", initials: "JK" },
  { quote: "The blueprint alone is worth $29", role: "SaaS founder", initials: "AS" },
  { quote: "Our team uses it before every client pitch", role: "agency owner", initials: "RM" },
];

const faqs = [
  { q: "Can I cancel anytime?", a: "Yes. No contracts, cancel in one click." },
  { q: "What makes this different from just Googling?", a: "Gold Rush pulls from 5 live data sources simultaneously and scores the opportunity for you. Google takes hours. Gold Rush takes 60 seconds." },
  { q: "Is the data real or AI generated?", a: "All data is sourced from real APIs — Perplexity, Serper, Firecrawl, Product Hunt, and GitHub. AI synthesizes it, not invents it." },
  { q: "What is Gold Rush Live?", a: "A real-time trending dashboard that shows what app ideas are exploding right now — so you discover opportunities without even having to search." },
  { q: "Do you offer refunds?", a: "Yes, 7 day money back guarantee, no questions asked." },
  { q: "Do I get free reports when I subscribe?", a: "Yes! Every paid plan includes 3 free reports immediately on signup, plus your monthly credit allowance." },
];

const Pricing = () => {
  const [annual, setAnnual] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const navigate = useNavigate();
  const { user, subscription, subLoading, checkSubscription } = useAuth();

  // Auto-refresh subscription after redirect from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscription") === "success") {
      checkSubscription();
      toast.success("Subscription activated! 🎉");
      window.history.replaceState({}, "", "/pricing");
    }
  }, [checkSubscription]);

  const handleSubscribe = async (priceId: string | null, tierKey: SubscriptionTier) => {
    if (!priceId) {
      navigate("/auth");
      return;
    }

    if (!user) {
      navigate("/auth");
      return;
    }

    setCheckoutLoading(tierKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { tier: tierKey, priceId },
      });
      if (error || !data?.url) {
        toast.error("Failed to start checkout. Please try again.");
        return;
      }
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
      if (error || !data?.url) {
        toast.error("Failed to open subscription management");
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error("Something went wrong");
    } finally {
      setPortalLoading(false);
    }
  };

  const isCurrentTier = (tierKey: SubscriptionTier) => subscription.tier === tierKey;

  const getButtonContent = (tier: typeof tiers[0]) => {
    if (checkoutLoading === tier.key) {
      return <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>;
    }
    if (isCurrentTier(tier.key) && tier.key !== "free") {
      return <><Settings className="w-4 h-4 mr-2" /> Manage Plan</>;
    }
    if (subscription.subscribed && tier.key === "free") {
      return "Current Fallback";
    }
    // Upgrade nudge: if on a lower tier
    if (subscription.subscribed) {
      const tierOrder: SubscriptionTier[] = ["free", "starter", "pro"];
      const currentIdx = tierOrder.indexOf(subscription.tier);
      const thisIdx = tierOrder.indexOf(tier.key);
      if (thisIdx > currentIdx) return `Upgrade to ${tier.name}`;
      if (thisIdx < currentIdx) return tier.btnLabel;
    }
    return tier.btnLabel;
  };

  const handleTierClick = (tier: typeof tiers[0]) => {
    if (isCurrentTier(tier.key) && tier.key !== "free") {
      handleManageSubscription();
      return;
    }
    handleSubscribe(tier.priceId, tier.key);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto border-b border-border/50">
        <span
          className="font-heading text-xl font-bold text-foreground cursor-pointer"
          onClick={() => navigate("/")}
        >
          ⛏️ Gold Rush
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
            Dashboard
          </Button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
            Find Your Next Big Idea Before Anyone Else
          </h1>
          <p className="text-lg text-muted-foreground mb-4">Real market data. Not guesses.</p>

          {/* Current plan badge */}
          {user && subscription.subscribed && (
            <div className="inline-flex items-center gap-2 bg-success/10 text-success border border-success/20 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Check className="w-4 h-4" />
              You're on the <span className="font-bold capitalize">{subscription.tier}</span> plan
              {subscription.subscriptionEnd && (
                <span className="text-success/70">
                  · renews {new Date(subscription.subscriptionEnd).toLocaleDateString()}
                </span>
              )}
            </div>
          )}

          {/* Toggle */}
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${annual ? "bg-gold" : "bg-muted"}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${annual ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            <span className={`text-sm font-medium ${annual ? "text-foreground" : "text-muted-foreground"}`}>Annual</span>
            {annual && (
              <span className="ml-2 text-xs font-semibold bg-success/15 text-success px-2.5 py-1 rounded-full">
                Save 2 months — best value
              </span>
            )}
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
                    ? "border-success bg-card ring-2 ring-success/30 shadow-lg"
                    : tier.highlight
                    ? "border-gold bg-card shadow-lg shadow-gold/10 scale-[1.02] lg:scale-105 z-10 ring-1 ring-gold/30"
                    : "border-border bg-card hover:border-muted-foreground/30"
                }`}
              >
                {isCurrent && tier.key !== "free" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-success text-white text-xs font-bold px-4 py-1 rounded-full shadow-md">
                    Your Plan
                  </div>
                )}
                {!isCurrent && tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-gold-foreground text-xs font-bold px-4 py-1 rounded-full shadow-md">
                    {tier.badge}
                  </div>
                )}

                <div className="mb-4 mt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <tier.icon className={`w-5 h-5 ${isCurrent ? "text-success" : tier.highlight ? "text-gold" : "text-muted-foreground"}`} />
                    <h3 className="font-heading text-lg font-bold text-foreground">{tier.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">{tier.sub}</p>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1.5">
                    {annual && tier.monthly > 0 && (
                      <span className="text-lg text-muted-foreground line-through">${tier.monthly}</span>
                    )}
                    <span className="font-heading text-4xl font-bold text-foreground">
                      ${annual ? monthlyEquiv || "0" : price}
                    </span>
                    {tier.monthly > 0 && <span className="text-sm text-muted-foreground">/mo</span>}
                  </div>
                  {annual && tier.monthly > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ${tier.annual}/yr billed annually
                    </p>
                  )}
                  {annual && annualSavings > 0 && (
                    <p className="text-xs text-success font-medium mt-1">
                      You save ${annualSavings}/year
                    </p>
                  )}
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {tier.features.map((f) => {
                    const isNegative = f.startsWith("No ");
                    return (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        {isNegative ? (
                          <X className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                        ) : (
                          <Check className={`w-4 h-4 shrink-0 mt-0.5 ${isCurrent ? "text-success" : tier.highlight ? "text-gold" : "text-success"}`} />
                        )}
                        <span className={isNegative ? "text-muted-foreground/60" : "text-foreground"}>{f}</span>
                      </li>
                    );
                  })}
                </ul>

                <Button
                  variant={tier.btnVariant}
                  className={`w-full font-semibold ${isCurrent && tier.key !== "free" ? "border-success text-success hover:bg-success hover:text-white" : tier.btnClass}`}
                  onClick={() => handleTierClick(tier)}
                  disabled={checkoutLoading !== null || portalLoading || (isCurrent && tier.key === "free")}
                >
                  {getButtonContent(tier)}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Upgrade nudge for free users */}
        {user && !subscription.subscribed && (
          <div className="rounded-xl border border-gold/30 bg-gold/5 p-6 text-center mb-20">
            <p className="text-foreground font-medium mb-2">🔥 You're on the Free plan with limited reports</p>
            <p className="text-muted-foreground text-sm mb-4">
              Upgrade to Starter for just $9/mo and get <strong>10 credits/month + 3 free reports</strong> instantly.
            </p>
            <Button
              className="bg-gold text-gold-foreground hover:bg-gold/90"
              onClick={() => handleSubscribe(SUBSCRIPTION_TIERS.starter.price_id, "starter")}
              disabled={checkoutLoading !== null}
            >
              {checkoutLoading === "starter" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Upgrade to Starter — $9/mo
            </Button>
          </div>
        )}

        {/* Comparison Table */}
        <div className="mb-20">
          <h2 className="font-heading text-2xl font-bold text-foreground text-center mb-8">Compare Plans</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Feature</th>
                  {tiers.map((t) => (
                    <th key={t.name} className={`text-center py-3 px-4 font-semibold ${isCurrentTier(t.key) ? "text-success" : t.highlight ? "text-gold" : "text-foreground"}`}>
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
                          val ? (
                            <Check className={`w-4 h-4 mx-auto ${j === 2 ? "text-gold" : "text-success"}`} />
                          ) : (
                            <X className="w-4 h-4 mx-auto text-muted-foreground/40" />
                          )
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
          <h2 className="font-heading text-2xl font-bold text-foreground text-center mb-8">What Founders Say</h2>
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
        <div className="rounded-2xl bg-gradient-to-br from-card via-card to-gold/5 border border-gold/20 p-10 sm:p-14 text-center">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Your next big idea is already trending.
          </h2>
          <p className="text-muted-foreground mb-8">Find it before someone else builds it.</p>
          <Button
            size="lg"
            className="bg-gold text-gold-foreground hover:bg-gold/90 shadow-lg shadow-gold/25 text-base px-8 py-6 font-bold"
            onClick={() => user ? navigate("/dashboard") : navigate("/auth")}
          >
            {user ? "Go to Dashboard" : "Start Free Today"}
          </Button>
        </div>
      </main>

      <footer className="text-center py-8 text-sm text-muted-foreground border-t border-border/50">
        © 2026 Gold Rush
      </footer>
    </div>
  );
};

export default Pricing;
