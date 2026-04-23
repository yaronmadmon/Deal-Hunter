import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, BarChart3, Menu, Phone, Search, ShieldCheck, Target, Clock, X, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Target className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-heading text-base font-bold tracking-tight text-foreground">Deal Hunter</span>
          </button>

          <div className="hidden items-center gap-6 md:flex">
            <button onClick={() => scrollTo("how-it-works")} className="text-sm text-muted-foreground transition-colors hover:text-foreground">How It Works</button>
            <button onClick={() => navigate("/pricing")} className="text-sm text-muted-foreground transition-colors hover:text-foreground">Pricing</button>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="text-muted-foreground hover:text-foreground">Log In</Button>
            <Button size="sm" onClick={() => navigate("/auth")} className="gap-1.5 font-medium">
              Start Free <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(o => !o)} className="md:hidden">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}
      <div className={`fixed right-0 top-0 z-50 flex h-full w-72 flex-col border-l border-border bg-background p-6 transition-transform duration-300 md:hidden ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Target className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-heading font-bold text-foreground">Deal Hunter</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}><X className="h-5 w-5" /></Button>
        </div>
        <div className="flex flex-col gap-1">
          <Button variant="ghost" className="justify-start" onClick={() => scrollTo("how-it-works")}>How It Works</Button>
          <Button variant="ghost" className="justify-start" onClick={() => { navigate("/pricing"); setMobileMenuOpen(false); }}>Pricing</Button>
        </div>
        <div className="mt-auto space-y-2 border-t border-border pt-5">
          <Button variant="outline" className="w-full" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}>Log In</Button>
          <Button className="w-full" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}>Start Free</Button>
        </div>
      </div>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="hero-glow absolute inset-0 pointer-events-none" />
          <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20">
            <div className="grid gap-12 lg:grid-cols-[1fr_380px] lg:items-center">
              {/* Left */}
              <div>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-[11px] font-medium text-primary">
                  <Zap className="h-3 w-3" />
                  AI-powered real estate intelligence
                </div>
                <h1 className="font-heading text-4xl font-bold text-foreground sm:text-5xl lg:text-6xl">
                  Find distressed deals
                  <br />
                  <span className="text-primary">before anyone else.</span>
                </h1>
                <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground sm:text-[15px]">
                  Deal Hunter surfaces tax liens, foreclosures, and delinquencies — then scores every property with AI using equity position, market heat, and owner motivation. Skip trace the owner. Close the deal.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" onClick={() => navigate("/auth")} className="gap-2 font-semibold">
                    Start Finding Deals <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => navigate("/pricing")} className="text-foreground">
                    View Pricing
                  </Button>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">Free to start · No credit card required</p>
              </div>

              {/* Right — product mockup */}
              <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
                <div className="rounded-xl border border-border bg-card shadow-2xl shadow-black/10 dark:shadow-black/40">
                  {/* Card header */}
                  <div className="flex items-start justify-between border-b border-border p-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Deal Score</p>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="font-mono text-4xl font-bold text-emerald-500 dark:text-emerald-400">84</span>
                        <span className="text-xs text-muted-foreground">/100</span>
                      </div>
                    </div>
                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Strong Deal</span>
                  </div>
                  {/* Address */}
                  <div className="border-b border-border px-4 py-3">
                    <p className="font-semibold text-foreground">1847 Maple St</p>
                    <p className="text-xs text-muted-foreground">Detroit, MI 48208</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">Tax Lien</span>
                      <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">Foreclosure</span>
                    </div>
                  </div>
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-px bg-border p-px">
                    {[{ label: "Equity", value: "42%" }, { label: "Value", value: "$187K" }, { label: "Lien", value: "$12.4K" }].map(s => (
                      <div key={s.label} className="bg-card px-3 py-3 text-center">
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                        <p className="mt-1 font-mono text-sm font-semibold text-foreground">{s.value}</p>
                      </div>
                    ))}
                  </div>
                  {/* AI rationale */}
                  <div className="p-4">
                    <p className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">AI Rationale</p>
                    <p className="text-xs leading-5 text-muted-foreground">Tax lien confirmed by ATTOM + county record. Market heat: 1,800 motivated sellers/mo, low investor CPC. High probability of motivated owner.</p>
                  </div>
                </div>
                {/* Floating owner card */}
                <div className="absolute -bottom-4 -right-2 rounded-xl border border-border bg-card p-3 shadow-xl sm:-right-6">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Owner Contact</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <Phone className="h-3 w-3 text-primary" />
                    (313) 555-0182
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">via Tracerfy · $0.02</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats strip */}
        <div className="border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
              {[
                { value: "~30s", label: "Avg. analysis time" },
                { value: "6", label: "Intelligence sources" },
                { value: "$0.02", label: "Per skip trace" },
                { value: "ATTOM", label: "Verified data source" },
              ].map(stat => (
                <div key={stat.label} className="px-4 py-5 text-center sm:px-8">
                  <p className="font-mono text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24" id="features">
          <div className="mb-10 sm:mb-14">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-primary">What you get</p>
            <h2 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">Everything from search to close.</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
              Most investors spend hours per property. Deal Hunter does it in seconds, for every distressed property in a market.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Search,
                tag: "Layer 1 · ATTOM",
                title: "Distressed Property Search",
                description: "Tax liens, foreclosures, divorce, delinquencies — verified by the same data source county assessors use. Updated daily.",
              },
              {
                icon: BarChart3,
                tag: "Layer 2 · AI",
                title: "AI Deal Scoring 0–100",
                description: "Every property scored using equity position, market heat, owner motivation, and an adversarial pass that kills flood zones and title disputes early.",
              },
              {
                icon: Phone,
                tag: "Skip Trace · Tracerfy",
                title: "Owner Contact in One Click",
                description: "Phone numbers, emails, and mailing address revealed instantly. No spreadsheets, no list brokers — pay only for what you use.",
              },
            ].map(card => (
              <article key={card.title} className="card-hover rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <card.icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[10px] font-medium text-muted-foreground">{card.tag}</span>
                </div>
                <h3 className="font-heading text-lg font-semibold text-foreground">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.description}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="mx-auto h-px max-w-6xl bg-border" />

        {/* Sample deal */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24" id="deal-preview">
          <div className="grid gap-10 lg:grid-cols-[1fr_300px] lg:items-start">
            <div>
              <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-primary">Sample analysis</p>
              <h2 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">See exactly what you'll get.</h2>
              <p className="mt-3 mb-8 text-sm leading-7 text-muted-foreground">A real AI-scored deal report — equity, distress depth, market heat, and skip trace in one place.</p>

              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Deal Preview</p>
                    <h3 className="mt-1 font-heading text-lg font-semibold text-foreground">1847 Maple St, Detroit, MI 48208</h3>
                  </div>
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Strong Deal</span>
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-[140px_1fr]">
                  <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-background py-6">
                    <span className="font-mono text-5xl font-bold text-emerald-500 dark:text-emerald-400">84</span>
                    <span className="mt-1 text-xs text-muted-foreground">Strong deal</span>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      {[{ label: "Equity", value: "42%" }, { label: "Est. Value", value: "$187K" }, { label: "Lien", value: "$12.4K" }].map(s => (
                        <div key={s.label} className="rounded-lg border border-border bg-background p-3">
                          <p className="text-[10px] text-muted-foreground">{s.label}</p>
                          <p className="mt-1.5 font-mono text-sm font-semibold text-foreground">{s.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg border border-border bg-background p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">AI Rationale</span>
                        <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">GPT-4o</span>
                      </div>
                      <p className="text-xs leading-5 text-muted-foreground">Tax lien confirmed by ATTOM + county. Owner search surfaces 2026 foreclosure filing. Market heat: "sell my house fast Detroit" 1,800/mo, low investor CPC.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Every report includes</p>
              <h3 className="mb-4 font-heading text-lg font-semibold text-foreground">Two intelligence layers.</h3>
              <div className="space-y-2">
                {[
                  "Verified ATTOM lien & foreclosure data",
                  "Equity position + estimated ARV",
                  "AI deal score with full rationale",
                  "Market heat: seller supply vs. competition",
                  "Owner court record & distress confirmation",
                  "Hard kill signals (flood, EPA, title dispute)",
                  "Skip trace: phones + emails",
                  "ROI calculator with 70% rule",
                ].map(item => (
                  <div key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {item}
                  </div>
                ))}
              </div>
              <Button size="lg" onClick={() => navigate("/auth")} className="mt-6 w-full gap-2 font-semibold">
                Start Finding Deals <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        <div className="mx-auto h-px max-w-6xl bg-border" />

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24" id="how-it-works">
          <div className="mb-10 sm:mb-14">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-primary">How it works</p>
            <h2 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">From search to contract. Four steps.</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">Enter a location. We find, score, and give you the owner's contact info.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { step: "01", icon: Target, title: "Search your market", description: "Enter a city or zip, select distress types, set price and equity filters. No setup required." },
              { step: "02", icon: Search, title: "We find the properties", description: "ATTOM Data surfaces verified tax liens, foreclosures, and delinquencies enriched with market intel." },
              { step: "03", icon: BarChart3, title: "AI scores every deal", description: "GPT-4o analyzes equity position, distress depth, market conditions, and deal killers. Strong Deal / Investigate / Pass." },
              { step: "04", icon: Phone, title: "Contact, track, close", description: "Skip trace the owner, log every call, manage your pipeline from new lead to contract — all in one place." },
            ].map(step => (
              <article key={step.step} className="card-hover rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <step.icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <span className="font-mono text-xs font-medium text-muted-foreground">{step.step}</span>
                </div>
                <h3 className="font-heading text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="mx-auto h-px max-w-6xl bg-border" />

        {/* Value props */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                icon: ShieldCheck,
                title: "Verified data, not scraped lists",
                description: "Layer 1 is ATTOM Data — the same source county assessors and lenders use. Tax lien amounts, foreclosure stages, and equity positions from public records, not Zillow estimates.",
              },
              {
                icon: Clock,
                title: "AI that kills bad deals early",
                description: "Before scoring, an adversarial pass checks for hard kills: FEMA flood zones, EPA superfund sites, active title disputes, and negative equity. Two hard kills force a Pass automatically.",
              },
            ].map(card => (
              <div key={card.title} className="card-hover rounded-xl border border-border bg-card p-7">
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <card.icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <h3 className="font-heading text-lg font-semibold text-foreground">{card.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{card.description}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mx-auto h-px max-w-6xl bg-border" />

        {/* CTA */}
        <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <h2 className="font-heading text-3xl font-bold text-foreground sm:text-5xl">
            Your next deal is already out there.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
            The owner just doesn't know you exist yet. Deal Hunter finds them, scores the opportunity, and puts their phone number in your hand.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={() => navigate("/auth")} className="gap-2 font-semibold">
              Start Finding Deals <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate("/pricing")} className="text-foreground">
              View Pricing
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Free plan · 3 searches · No credit card</p>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
              <Target className="h-3 w-3 text-white" />
            </div>
            <span className="font-heading text-sm font-bold text-foreground">Deal Hunter</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 Deal Hunter. Find the deal. Close the deal.</p>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <a href="/terms" className="transition-colors hover:text-foreground">Terms</a>
            <a href="/privacy" className="transition-colors hover:text-foreground">Privacy</a>
            <button onClick={() => navigate("/pricing")} className="transition-colors hover:text-foreground">Pricing</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
