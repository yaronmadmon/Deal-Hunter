import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles, Zap, Building2, Star } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const tiers = [
  {
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
  },
  {
    name: "Starter",
    icon: Sparkles,
    monthly: 9,
    annual: 90,
    sub: "For builders testing ideas",
    features: [
      "5 reports per month",
      "Full report with all 6 cards",
      "Blueprint included",
      "Clean PDF download",
      "No Gold Rush Live",
    ],
    btnLabel: "Get Started",
    btnVariant: "outline" as const,
    btnClass: "border-primary text-primary hover:bg-primary hover:text-primary-foreground",
    highlight: false,
  },
  {
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
  },
  {
    name: "Agency",
    icon: Building2,
    monthly: 79,
    annual: 790,
    sub: "For teams validating at scale",
    features: [
      "Everything in Pro",
      "3 team seats",
      "White label PDF (your logo)",
      "Bulk analyze 10 ideas at once",
      "Priority support",
    ],
    btnLabel: "Get Agency",
    btnVariant: "outline" as const,
    btnClass: "border-[hsl(270,60%,60%)] text-[hsl(270,60%,60%)] hover:bg-[hsl(270,60%,60%)] hover:text-white",
    highlight: false,
  },
];

const comparisonFeatures = [
  { label: "Monthly reports", values: ["3 lifetime", "5/mo", "Unlimited", "Unlimited"] },
  { label: "Score breakdown", values: [true, true, true, true] },
  { label: "Full 6-card report", values: [false, true, true, true] },
  { label: "Startup blueprint", values: [false, true, true, true] },
  { label: "Clean PDF export", values: [false, true, true, true] },
  { label: "Gold Rush Live", values: [false, false, true, true] },
  { label: "Idea tracking", values: [false, false, true, true] },
  { label: "GitHub trending signals", values: [false, false, true, true] },
  { label: "Priority data refresh", values: [false, false, true, true] },
  { label: "Team seats", values: ["1", "1", "1", "3"] },
  { label: "White label PDF", values: [false, false, false, true] },
  { label: "Bulk analysis", values: [false, false, false, true] },
  { label: "Priority support", values: [false, false, false, true] },
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
];

const Pricing = () => {
  const [annual, setAnnual] = useState(false);
  const navigate = useNavigate();

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
          <p className="text-lg text-muted-foreground mb-8">Real market data. Not guesses.</p>

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-20">
          {tiers.map((tier) => {
            const price = annual ? tier.annual : tier.monthly;
            const monthlyEquiv = annual && tier.annual > 0 ? (tier.annual / 12).toFixed(0) : null;
            const annualSavings = tier.monthly > 0 ? tier.monthly * 12 - tier.annual : 0;

            return (
              <div
                key={tier.name}
                className={`relative rounded-xl border p-6 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  tier.highlight
                    ? "border-gold bg-card shadow-lg shadow-gold/10 scale-[1.02] lg:scale-105 z-10 ring-1 ring-gold/30"
                    : "border-border bg-card hover:border-muted-foreground/30"
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-gold-foreground text-xs font-bold px-4 py-1 rounded-full shadow-md">
                    {tier.badge}
                  </div>
                )}

                <div className="mb-4 mt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <tier.icon className={`w-5 h-5 ${tier.highlight ? "text-gold" : "text-muted-foreground"}`} />
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
                          <Check className={`w-4 h-4 shrink-0 mt-0.5 ${tier.highlight ? "text-gold" : "text-success"}`} />
                        )}
                        <span className={isNegative ? "text-muted-foreground/60" : "text-foreground"}>{f}</span>
                      </li>
                    );
                  })}
                </ul>

                <Button
                  variant={tier.btnVariant}
                  className={`w-full font-semibold ${tier.btnClass}`}
                  onClick={() => navigate("/auth")}
                >
                  {tier.btnLabel}
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
                    <th key={t.name} className={`text-center py-3 px-4 font-semibold ${t.highlight ? "text-gold" : "text-foreground"}`}>
                      {t.name}
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
            onClick={() => navigate("/auth")}
          >
            Start Free Today
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
