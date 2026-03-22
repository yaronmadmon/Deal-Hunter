import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  Clock,
  FileText,
  Lightbulb,
  Map,
  Menu,
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
    title: "Demand",
    description: "See whether people are already searching for the problem you want to solve.",
    tag: "Search intent",
  },
  {
    icon: Users,
    title: "Crowding",
    description: "Measure how saturated the market is and where competitors are still weak.",
    tag: "Competitive gaps",
  },
  {
    icon: Target,
    title: "Pain",
    description: "Pull recurring complaints from reviews, communities, and product feedback.",
    tag: "User language",
  },
];

const workflowSteps = [
  {
    step: "01",
    icon: Lightbulb,
    title: "Drop in the idea",
    description: "Describe the startup in one sentence. No deck, no research, no setup.",
  },
  {
    step: "02",
    icon: Search,
    title: "Gold Rush scans the market",
    description: "It pulls demand, competitors, reviews, and market momentum into one evidence layer.",
  },
  {
    step: "03",
    icon: BarChart3,
    title: "You get a clear read",
    description: "See the score, the upside, the risks, and what deserves a closer look.",
  },
  {
    step: "04",
    icon: Map,
    title: "Build from signal, not vibes",
    description: "Use the blueprint to position the product, scope the MVP, and avoid wasted months.",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
            <span className="font-heading text-lg font-bold tracking-[-0.03em] text-foreground">Gold Rush</span>
          </button>

          <div className="hidden items-center gap-8 md:flex">
            <button onClick={() => scrollTo("report-preview")} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Sample Report
            </button>
            <button onClick={() => scrollTo("how-it-works")} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              How It Works
            </button>
            <button onClick={() => navigate("/pricing")} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Pricing
            </button>
            <button onClick={() => navigate("/live")} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Live Signals
            </button>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="text-muted-foreground hover:text-foreground">
              Log In
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/auth")}
              className="rounded-lg border border-primary/40 bg-primary/15 px-5 text-foreground transition-all duration-200 hover:bg-primary/25 hover:shadow-accent"
            >
              Analyze My Idea
              <ArrowRight className="h-4 w-4" />
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

        <Button variant="ghost" className="justify-start" onClick={() => scrollTo("report-preview")}>
          Sample Report
        </Button>
        <Button variant="ghost" className="justify-start" onClick={() => scrollTo("how-it-works")}>
          How It Works
        </Button>
        <Button variant="ghost" className="justify-start" onClick={() => { navigate("/pricing"); setMobileMenuOpen(false); }}>
          Pricing
        </Button>
        <Button variant="ghost" className="justify-start" onClick={() => { navigate("/live"); setMobileMenuOpen(false); }}>
          Live Signals
        </Button>

        <div className="mt-auto space-y-3 border-t border-border pt-5">
          <Button variant="ghost" className="w-full justify-start" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}>
            Log In
          </Button>
          <Button
            className="w-full justify-center rounded-lg border border-primary/40 bg-primary/15 text-foreground transition-all duration-200 hover:bg-primary/25"
            onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}
          >
            Analyze My Idea
          </Button>
        </div>
      </div>

      <main>
        <section className="mx-auto grid max-w-6xl gap-16 px-6 pb-24 pt-20 md:grid-cols-[minmax(0,1.1fr)_360px] md:items-end md:pt-28">
          <div className="max-w-3xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              For founders shipping fast
            </div>

            <h1 className="max-w-4xl font-heading text-5xl font-bold leading-[0.95] tracking-[-0.06em] text-foreground sm:text-6xl lg:text-7xl">
              Stop building apps
              <br />
              <span className="text-foreground">nobody wants.</span>
            </h1>

            <p className="mt-7 max-w-xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
              Gold Rush shows you search demand, market pressure, competitor density, and user pain before you commit months to building.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="rounded-xl border border-primary/40 bg-primary/15 px-7 text-foreground transition-all duration-200 hover:bg-primary/25 hover:shadow-accent"
              >
                Analyze My Idea
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate("/sample-report")}
                className="rounded-xl border-border px-7 text-foreground hover:bg-secondary"
              >
                See a Sample Report
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Validation speed</span>
                <span className="rounded-full border border-border bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground">Live</span>
              </div>
              <div className="font-mono text-3xl font-semibold tracking-[-0.04em] text-foreground">minutes</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Enough time to kill a weak idea early or double down on a strong one.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Sources</div>
                <div className="mt-3 font-mono text-3xl font-semibold text-foreground">7+</div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Search, reviews, apps, and live market signals.</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Signal Strength</div>
                <div className="mt-3 font-mono text-3xl font-semibold text-foreground">Clear</div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">A clear read before you spend the next quarter building.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto h-px max-w-6xl bg-border" />

        <section className="mx-auto max-w-6xl px-6 py-24" id="proof">
          <div className="mb-12 max-w-2xl">
            <p className="mb-4 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">What founders expect</p>
            <h2 className="font-heading text-3xl font-bold tracking-[-0.05em] text-foreground md:text-4xl">
              A landing page for this category needs one thing fast: proof.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
              So the page now leads with the product outcome, shows a real sample early, and keeps every section focused on the decision a founder is trying to make.
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

        <section id="report-preview" className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_320px] lg:items-end">
            <div>
              <p className="mb-4 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Sample output</p>
              <h2 className="font-heading text-3xl font-bold tracking-[-0.05em] text-foreground md:text-4xl">
                Show the report before asking for trust.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
                This sits directly under the hero so visitors can inspect the product immediately instead of hunting for proof halfway down the page.
              </p>

              <div className="mt-10 overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Report preview</p>
                    <h3 className="mt-1 font-heading text-xl font-semibold tracking-[-0.04em] text-foreground">AI note-taking for students</h3>
                  </div>
                  <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    Trending
                  </span>
                </div>

                <div className="grid gap-6 p-5 md:grid-cols-[160px_minmax(0,1fr)] md:p-6">
                  <div className="rounded-xl border border-border bg-background p-5">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Score</div>
                    <div className="mt-4 font-mono text-6xl font-semibold tracking-[-0.06em] text-foreground">71</div>
                    <div className="mt-2 text-xs text-muted-foreground">Moderate signal</div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      {[
                        { label: "Interest", value: "+34%" },
                        { label: "Competitors", value: "140" },
                        { label: "Revenue", value: "$1–5M" },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-xl border border-border bg-background p-4">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{stat.label}</div>
                          <div className="mt-3 font-mono text-2xl font-semibold text-foreground">{stat.value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Why it matters</span>
                        <span className="rounded-full border border-border bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground">
                          Review synthesis
                        </span>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Students want faster summarization, but existing tools feel generic. The opportunity is sharper workflow design for lectures, revision, and source-backed notes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-border bg-card p-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">What people want to know</p>
                <h3 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.04em] text-foreground">
                  Can I trust the output quickly?
                </h3>
              </div>

              {[
                "Real sample report available before signup",
                "Numbers surfaced in scan-friendly blocks",
                "Category tags clarify what each signal means",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/50" />
                  <span>{item}</span>
                </div>
              ))}

              <Button
                size="lg"
                onClick={() => navigate("/sample-report")}
                className="mt-2 w-full rounded-xl border border-primary/40 bg-primary/15 text-foreground transition-all duration-200 hover:bg-primary/25 hover:shadow-accent"
              >
                Open Sample Report
                <FileText className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        <div className="mx-auto h-px max-w-6xl bg-border" />

        <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-12 max-w-2xl">
            <p className="mb-4 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">How it works</p>
            <h2 className="font-heading text-3xl font-bold tracking-[-0.05em] text-foreground md:text-4xl">
              Four steps. No fluff. No black box.
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-[15px]">
              The layout is intentionally sparse so the page reads more like a product spec than a marketing wall.
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

        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-xl border border-border bg-card p-8">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Why this feels sharper</p>
              <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.05em] text-foreground">
                Built like a developer tool, not a glossy promise.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
                Minimal surfaces, tight type, structured spacing, and restrained accent color give the page a more credible product posture — closer to what founders expect from serious B2B tools.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-8">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Trust signal</p>
                  <h3 className="font-heading text-xl font-semibold tracking-[-0.04em] text-foreground">Data over guesswork</h3>
                </div>
              </div>
              <p className="text-sm leading-7 text-muted-foreground sm:text-[15px]">
                Gold Rush leads with evidence, keeps claims tight, and uses color only where attention matters: scores, labels, status, and decisions.
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto h-px max-w-6xl bg-border" />

        <section className="mx-auto max-w-4xl px-6 py-24 text-center">
          <p className="mb-4 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Final call to action</p>
          <h2 className="font-heading text-4xl font-bold tracking-[-0.06em] text-foreground sm:text-5xl">
            Validate the idea before the build sprint starts.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
            If the idea is weak, you find out early. If the signal is real, you move with more confidence.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="rounded-xl border border-primary/40 bg-primary/15 px-7 text-foreground transition-all duration-200 hover:bg-primary/25 hover:shadow-accent"
            >
              Analyze My Idea
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/sample-report")}
              className="rounded-xl border-border px-7 text-foreground hover:bg-secondary"
            >
              Review the Sample
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground md:flex-row">
          <span className="font-heading font-semibold text-foreground">Gold Rush</span>
          <p>© 2026 Gold Rush. Validate faster. Build smarter.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
