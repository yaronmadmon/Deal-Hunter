import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowRight,
  BarChart3,
  Clock,
  Gavel,
  MapPin,
  Menu,
  Phone,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const featureCards = [
  {
    icon: Search,
    title: "Distressed Property Search",
    description: "Search tax liens, foreclosures, divorce/probate, and delinquencies across any market — ATTOM data updated daily.",
    tag: "Layer 1 data",
  },
  {
    icon: BarChart3,
    title: "AI Deal Scoring",
    description: "Every property gets scored 0–100 using ATTOM facts plus live market intelligence: seller motivation, investor competition, and deal killers.",
    tag: "AI analysis",
  },
  {
    icon: Phone,
    title: "Skip Trace Owner Info",
    description: "One click reveals the owner's phone numbers, emails, and mailing address — so you can reach them before the competition does.",
    tag: "Contact data",
  },
];

const workflowSteps = [
  {
    step: "01",
    icon: MapPin,
    title: "Search your market",
    description: "Enter a city or zip code, select distress types, set price and equity filters. No setup required.",
  },
  {
    step: "02",
    icon: Search,
    title: "We find the properties",
    description: "ATTOM Data surfaces verified tax liens, foreclosures, and delinquencies — enriched with market heat and owner research.",
  },
  {
    step: "03",
    icon: BarChart3,
    title: "AI scores every deal",
    description: "Claude analyzes equity position, distress depth, market conditions, and deal killers. Strong Deal / Investigate / Pass.",
  },
  {
    step: "04",
    icon: Users,
    title: "Contact, track, close",
    description: "Skip trace the owner, log every call and email, manage your pipeline through to contract — all in one place.",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, navigate]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2.5 text-left"
          >
            <Phone className="h-5 w-5 text-primary" />
            <span className="font-heading text-lg font-bold tracking-[-0.03em] text-foreground">Deal Hunter</span>
          </button>

          <div className="hidden items-center gap-8 md:flex">
            <button onClick={() => scrollTo("how-it-works")} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              How It Works
            </button>
            <button onClick={() => navigate("/pricing")} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Pricing
            </button>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="text-muted-foreground hover:text-foreground">
              Log In
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/auth")}
              className="rounded-lg px-5 font-medium shadow-sm shadow-primary/20"
            >
              Find Deals
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen((open) => !open)} className="md:hidden">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </nav>

      {mobileMenuOpen && <div className="fixed inset-0 z-40 bg-background/80 md:hidden" onClick={() => setMobileMenuOpen(false)} />}

      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-72 flex-col gap-3 border-l border-border bg-background p-6 transition-transform duration-300 md:hidden ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="font-heading text-base font-bold text-foreground">Menu</span>
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <Button variant="ghost" className="justify-start" onClick={() => scrollTo("how-it-works")}>
          How It Works
        </Button>
        <Button variant="ghost" className="justify-start" onClick={() => { navigate("/pricing"); setMobileMenuOpen(false); }}>
          Pricing
        </Button>

        <div className="mt-auto space-y-3 border-t border-border pt-5">
          <Button variant="ghost" className="w-full justify-start" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}>
            Log In
          </Button>
          <Button
            className="w-full justify-center rounded-lg font-medium"
            onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}
          >
            Find Deals
          </Button>
        </div>
      </div>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-16 px-6 pb-24 pt-20 md:grid-cols-[minmax(0,1.1fr)_360px] md:items-end md:pt-28">
          <div className="max-w-3xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              AI-powered deal intelligence
            </div>

            <h1 className="max-w-4xl font-heading text-5xl font-bold leading-[0.95] tracking-[-0.06em] text-foreground sm:text-6xl lg:text-7xl">
              Find distressed
              <br />
              <span className="text-foreground">deals before anyone else.</span>
            </h1>

            <p className="mt-7 max-w-xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
              Deal Hunter surfaces tax liens, foreclosures, and delinquencies — then scores every property with AI using equity position, market heat, and owner motivation. Skip trace the owner. Close the deal.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="rounded-xl px-7 font-semibold shadow-lg shadow-primary/20"
              >
                Start Finding Deals
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate("/pricing")}
                className="rounded-xl border-border px-7 text-foreground hover:bg-secondary"
              >
                See Pricing
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Deal Score</span>
                <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-[11px] font-medium text-green-400">Strong Deal</span>
              </div>
              <div className="font-mono text-3xl font-semibold tracking-[-0.04em] text-foreground">84 / 100</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Tax lien + 42% equity + motivated seller confirmed by Serper court records.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Data Source</div>
                <div className="mt-3 font-mono text-3xl font-semibold text-foreground">ATTOM</div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Verified liens, equity & foreclosure data.</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Contact</div>
                <div className="mt-3 font-mono text-3xl font-semibold text-foreground">8 #s</div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Phone + email via Tracerfy skip trace.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto h-px max-w-6xl bg-border" />

        {/* Three core signals */}
        <section className="mx-auto max-w-6xl px-6 py-24" id="proof">
          <div className="mb-12 max-w-2xl">
            <p className="mb-4 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">What we give you</p>
            <h2 className="font-heading text-3xl font-bold tracking-[-0.05em] text-foreground md:text-4xl">
              Everything from search to close.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
              Most investors sift through spreadsheets and cold lists manually. Deal Hunter finds the properties, scores the deals, and gives you the owner's number — in one workflow.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {featureCards.map((card) => (
              <article key={card.title} className="rounded-xl border border-border bg-card p-7">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <card.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {card.tag}
                  </span>
                </div>
                <h3 className="font-heading text-xl font-semibold tracking-[-0.04em] text-foreground">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{card.description}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="mx-auto h-px max-w-6xl bg-border" />

        {/* Sample deal preview */}
        <section id="deal-preview" className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_320px] lg:items-end">
            <div>
              <p className="mb-4 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Sample deal analysis</p>
              <h2 className="font-heading text-3xl font-bold tracking-[-0.05em] text-foreground md:text-4xl">
                See exactly what you'll get.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
                A real AI-scored property report — equity, distress depth, market heat, and skip trace results in one place.
              </p>

              <div className="mt-10 overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Deal preview</p>
                    <h3 className="mt-1 font-heading text-xl font-semibold tracking-[-0.04em] text-foreground">1847 Maple St, Detroit, MI 48208</h3>
                  </div>
                  <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-[11px] font-medium text-green-400">
                    Strong Deal
                  </span>
                </div>

                <div className="grid gap-6 p-5 md:grid-cols-[160px_minmax(0,1fr)] md:p-6">
                  <div className="rounded-xl border border-border bg-background p-5">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Score</div>
                    <div className="mt-4 font-mono text-6xl font-semibold tracking-[-0.06em] text-foreground">84</div>
                    <div className="mt-2 text-xs text-muted-foreground">Strong deal signal</div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      {[
                        { label: "Equity", value: "42%" },
                        { label: "Est. Value", value: "$187K" },
                        { label: "Lien", value: "$12,400" },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-xl border border-border bg-background p-4">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{stat.label}</div>
                          <div className="mt-3 font-mono text-2xl font-semibold text-foreground">{stat.value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">AI rationale</span>
                        <span className="rounded-full border border-border bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground">
                          Claude claude-sonnet-4-6
                        </span>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Tax lien confirmed by ATTOM + county record. Owner name search surfaces 2026 foreclosure filing. Market heat: "sell my house fast Detroit" at 1,800/mo with low investor CPC — high motivated seller supply, moderate competition.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-border bg-card p-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Every deal report includes</p>
                <h3 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.04em] text-foreground">
                  Two intelligence layers.
                </h3>
              </div>

              {[
                "Verified lien/foreclosure data from ATTOM",
                "Equity position + estimated ARV",
                "AI deal score with rationale",
                "Market heat: motivated seller supply vs. competition",
                "Owner court record + distress confirmation",
                "Hard kill signals (flood zone, EPA, title dispute)",
                "Skip trace: phone numbers + emails",
                "ROI calculator with 70% rule pre-filled",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                  <span>{item}</span>
                </div>
              ))}

              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="mt-2 w-full rounded-xl font-semibold shadow-sm shadow-primary/20"
              >
                Start Finding Deals
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        <div className="mx-auto h-px max-w-6xl bg-border" />

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-12 max-w-2xl">
            <p className="mb-4 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">How it works</p>
            <h2 className="font-heading text-3xl font-bold tracking-[-0.05em] text-foreground md:text-4xl">
              From search to contract. Four steps.
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-[15px]">
              Enter a location. We find the distressed properties, score every deal with AI, and give you the owner's contact info.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {workflowSteps.map((step) => (
              <article key={step.step} className="rounded-xl border border-border bg-card p-7">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{step.step}</span>
                </div>
                <h3 className="font-heading text-xl font-semibold tracking-[-0.04em] text-foreground">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="mx-auto h-px max-w-6xl bg-border" />

        {/* Value props */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-8">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-heading text-xl font-semibold tracking-[-0.04em] text-foreground">
                Verified data, not scraped lists
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Layer 1 is ATTOM Data — the same source county assessors and lenders use. Tax lien amounts, foreclosure stages, and equity positions are pulled from public records, not estimated from Zillow listings.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-8">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-heading text-xl font-semibold tracking-[-0.04em] text-foreground">
                AI that kills bad deals early
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Before Claude scores, an adversarial pass checks for hard kills: FEMA flood zones, EPA superfund sites, active title disputes, and negative equity. Two hard kills force a Pass — no wasted calls, no wasted offers.
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto h-px max-w-6xl bg-border" />

        {/* Final CTA */}
        <section className="mx-auto max-w-4xl px-6 py-24 text-center">
          <h2 className="font-heading text-4xl font-bold tracking-[-0.06em] text-foreground sm:text-5xl">
            Your next deal is already out there.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
            The owner just doesn't know you exist yet. Deal Hunter finds them, scores the opportunity, and puts their phone number in your hand.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="rounded-xl px-7 font-semibold shadow-lg shadow-primary/20"
            >
              Start Finding Deals
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/pricing")}
              className="rounded-xl border-border px-7 text-foreground hover:bg-secondary"
            >
              View Pricing
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground md:flex-row">
          <span className="font-heading font-semibold text-foreground">Deal Hunter</span>
          <p>© 2026 Deal Hunter. Find the deal. Close the deal.</p>
          <div className="flex items-center gap-5">
            <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <button onClick={() => navigate("/pricing")} className="hover:text-foreground transition-colors">Pricing</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
