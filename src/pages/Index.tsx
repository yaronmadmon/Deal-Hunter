import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowRight,
  BarChart3,
  Clock3,
  Gavel,
  MapPin,
  Menu,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const productPillars = [
  {
    icon: Search,
    eyebrow: "Search",
    title: "One bar for ZIPs and exact addresses",
    description: "Scan a market by ZIP or drill into a single property from the same input. The system sorts out the mode behind the scenes.",
  },
  {
    icon: BarChart3,
    eyebrow: "Analysis",
    title: "AI analysis that surfaces the facts fast",
    description: "See equity, distress depth, market pressure, and risk signals in one place so you can decide quickly without leaning on a black-box score.",
  },
  {
    icon: Phone,
    eyebrow: "Contact",
    title: "Owner outreach without the swivel-chair workflow",
    description: "Skip trace, outreach, notes, and pipeline tracking stay attached to the deal so your team can move without context switching.",
  },
];

const workflowSteps = [
  {
    step: "01",
    title: "Enter a ZIP or a property",
    description: "Start broad with a ZIP code, or paste a full street address when you already know the target.",
  },
  {
    step: "02",
    title: "Pull live distress records",
    description: "ATTOM-backed search results bring back tax liens, foreclosure activity, valuation context, and public-record detail.",
  },
  {
    step: "03",
    title: "Rank what deserves a call",
    description: "Deal Hunter highlights the opportunities with the best blend of motivation, equity, and market setup.",
  },
  {
    step: "04",
    title: "Work the deal in one place",
    description: "Open the property, review the report, get the owner info, and push the lead straight into your pipeline.",
  },
];

const reportFacts = [
  "Exact-address analysis and ZIP scans from the same search flow",
  "Tax lien and foreclosure tags surfaced at the card level",
  "Mortgage, tax, owner, sale history, and AVM context on the detail page",
  "AI outreach and contact logging attached to the property record",
];

const operationalStats = [
  { label: "Data stack", value: "ATTOM + AI" },
  { label: "Search modes", value: "ZIP + Address" },
  { label: "Workflow", value: "Search to pipeline" },
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
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-3 text-left"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
              <Phone className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-heading text-lg font-bold leading-none">Deal Hunter</span>
              <span className="mt-1 block text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Investor workflow system</span>
            </span>
          </button>

          <div className="hidden items-center gap-8 md:flex">
            <button onClick={() => scrollTo("platform")} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Platform
            </button>
            <button onClick={() => scrollTo("workflow")} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Workflow
            </button>
            <button onClick={() => navigate("/pricing")} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Pricing
            </button>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
              Log In
            </Button>
            <Button size="sm" onClick={() => navigate("/auth")}>
              Open App
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen((open) => !open)} className="md:hidden">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </nav>

      {mobileMenuOpen && <div className="fixed inset-0 z-40 bg-background/70 md:hidden" onClick={() => setMobileMenuOpen(false)} />}

      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-72 flex-col gap-3 border-l border-border bg-background p-6 transition-transform duration-300 md:hidden ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="font-heading text-lg font-bold">Menu</span>
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <Button variant="ghost" className="justify-start" onClick={() => scrollTo("platform")}>
          Platform
        </Button>
        <Button variant="ghost" className="justify-start" onClick={() => scrollTo("workflow")}>
          Workflow
        </Button>
        <Button variant="ghost" className="justify-start" onClick={() => { navigate("/pricing"); setMobileMenuOpen(false); }}>
          Pricing
        </Button>

        <div className="mt-auto space-y-3 border-t border-border pt-5">
          <Button variant="ghost" className="w-full justify-start" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}>
            Log In
          </Button>
          <Button className="w-full justify-center" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}>
            Open App
          </Button>
        </div>
      </div>

      <main>
        <section className="landing-grid landing-radial border-b border-border">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_420px] lg:items-end lg:py-20">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Built for distressed-property investors
              </div>

              <h1 className="mt-6 max-w-4xl font-heading text-4xl font-extrabold leading-[0.92] tracking-[-0.06em] sm:text-6xl lg:text-7xl">
                Search once.
                <br />
                Work only the deals worth chasing.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Deal Hunter turns public-record distress data into a usable workflow. Search by ZIP or exact address, review the property facts,
                pull owner info, and move the lead into your pipeline without leaving the app.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={() => navigate("/auth")} className="rounded-xl px-7">
                  Start Searching
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="lg" onClick={() => navigate("/pricing")} className="rounded-xl px-7">
                  View Pricing
                </Button>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {operationalStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-border bg-card p-4">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{stat.label}</div>
                    <div className="mt-3 font-mono text-xl font-semibold text-foreground">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-4 rounded-[28px] border border-border bg-secondary" />
              <div className="relative rounded-[28px] border border-foreground bg-foreground p-4 text-background shadow-[0_28px_80px_-44px_rgba(0,0,0,0.9)] sm:p-5">
                <div className="rounded-[22px] border border-background/10 bg-background/5 p-4 backdrop-blur sm:p-5">
                  <div className="flex items-center justify-between gap-3 border-b border-background/10 pb-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-background/55">Live deal search</p>
                      <h2 className="mt-2 font-heading text-xl font-bold text-background">48208 or 1847 Maple St</h2>
                    </div>
                    <span className="rounded-full border border-background/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-background/70">
                      One-bar search
                    </span>
                  </div>

                  <div className="mt-5 rounded-2xl bg-background p-4 text-foreground">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Sample result</p>
                        <h3 className="mt-2 font-heading text-2xl font-bold">1847 Maple St</h3>
                        <p className="mt-1 text-sm text-muted-foreground">Detroit, MI 48208</p>
                      </div>
                      <div className="rounded-2xl border border-border px-3 py-2 text-right">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Owner</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">Absentee</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/12 px-3 py-1 text-xs font-medium text-amber-500">
                        Tax Lien
                      </span>
                      <span className="rounded-full border border-red-500/30 bg-red-500/12 px-3 py-1 text-xs font-medium text-red-500">
                        Foreclosure
                      </span>
                      <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-foreground">
                        Exact Address
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-border p-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Equity</div>
                        <div className="mt-2 font-mono text-lg font-semibold">42%</div>
                      </div>
                      <div className="rounded-xl border border-border p-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Value</div>
                        <div className="mt-2 font-mono text-lg font-semibold">$187K</div>
                      </div>
                      <div className="rounded-xl border border-border p-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Mortgage</div>
                        <div className="mt-2 font-mono text-lg font-semibold">$91K</div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl border border-border bg-secondary/65 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">AI rationale</p>
                      <p className="mt-2 text-sm leading-6 text-foreground/80">
                        Distress stack is confirmed, owner equity is workable, and the property clears the first-pass risk checks. This gets a call.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="platform" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
          <div className="mb-10 max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Platform</p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.05em] sm:text-5xl">
              The search layer, scoring layer, and contact layer now feel like one system.
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {productPillars.map((pillar) => (
              <article key={pillar.title} className="rounded-[28px] border border-border bg-card p-6 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-secondary">
                    <pillar.icon className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{pillar.eyebrow}</span>
                </div>
                <h3 className="mt-8 font-heading text-2xl font-bold tracking-[-0.04em]">{pillar.title}</h3>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">{pillar.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-card/60">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_320px] lg:items-start lg:py-20">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">What the report includes</p>
              <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.05em] sm:text-5xl">
                The property page is built to make the next decision obvious.
              </h2>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {reportFacts.map((fact) => (
                  <div key={fact} className="rounded-2xl border border-border bg-background p-4 text-sm leading-7 text-muted-foreground">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary">
                      <Target className="h-4 w-4 text-foreground" />
                    </div>
                    {fact}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-foreground bg-foreground p-6 text-background">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-background/10 bg-background/5">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="mt-8 font-heading text-2xl font-bold tracking-[-0.04em]">Less list noise, more call-ready context.</h3>
              <p className="mt-4 text-sm leading-7 text-background/70">
                Instead of pushing you into another spreadsheet, the app keeps the distress tags, analysis, owner info, and outreach tied to one record.
              </p>
              <div className="mt-8 space-y-3 border-t border-background/10 pt-6 text-sm text-background/70">
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4" />
                  Search results that stay linked to the property page
                </div>
                <div className="flex items-center gap-3">
                  <Clock3 className="h-4 w-4" />
                  Faster review because owner, mortgage, and tax data are already visible
                </div>
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4" />
                  One shared workflow for solo investors and acquisition teams
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
          <div className="mb-10 max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Workflow</p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.05em] sm:text-5xl">
              A four-step acquisition loop.
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {workflowSteps.map((step) => (
              <article key={step.step} className="rounded-[28px] border border-border bg-card p-6 sm:p-7">
                <div className="flex items-center justify-between gap-3 border-b border-border pb-5">
                  <span className="font-mono text-sm text-muted-foreground">{step.step}</span>
                  <div className="h-px flex-1 bg-border" />
                  <Gavel className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="mt-6 font-heading text-2xl font-bold tracking-[-0.04em]">{step.title}</h3>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-24">
          <div className="rounded-[32px] border border-foreground bg-foreground px-6 py-10 text-background sm:px-10 sm:py-14">
            <p className="text-[11px] uppercase tracking-[0.24em] text-background/60">Final note</p>
            <h2 className="mt-4 max-w-3xl font-heading text-3xl font-bold tracking-[-0.05em] sm:text-5xl">
              If the list is long but the calls are weak, the workflow is broken.
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-background/72 sm:text-base">
              Deal Hunter is designed to reduce list noise, surface the distress signals that matter, and put the next best action in front of you.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" variant="secondary" onClick={() => navigate("/auth")} className="rounded-xl">
                Open Deal Hunter
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/pricing")} className="rounded-xl border-background/20 bg-transparent text-background hover:bg-background/10 hover:text-background">
                Review Pricing
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:px-6 md:flex-row">
          <span className="font-heading font-bold text-foreground">Deal Hunter</span>
          <p>Copyright 2026 Deal Hunter. Search the market. Work the signal.</p>
          <div className="flex items-center gap-5">
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
