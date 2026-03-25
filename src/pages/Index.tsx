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
    title: "Search Demand",
    description: "See how many people are actively searching for your idea — and whether that interest is growing or fading.",
    tag: "Search intent",
  },
  {
    icon: Users,
    title: "Market Saturation",
    description: "Measure competitor density and pinpoint the gaps where you can still build a defensible position.",
    tag: "Competitive gaps",
  },
  {
    icon: Target,
    title: "Real User Pain",
    description: "Surface recurring complaints from app store reviews, Reddit, and community feedback — in users' own words.",
    tag: "User language",
  },
];

const workflowSteps = [
  {
    step: "01",
    icon: Lightbulb,
    title: "Describe your idea",
    description: "One sentence is enough. No deck, no research doc, no setup required.",
  },
  {
    step: "02",
    icon: Search,
    title: "We scan the market",
    description: "Seven live sources — search trends, app stores, Reddit, GitHub, and competitor reviews.",
  },
  {
    step: "03",
    icon: BarChart3,
    title: "Get a scored read",
    description: "A market score with evidence behind every signal: demand, competition, user pain, and risk.",
  },
  {
    step: "04",
    icon: Map,
    title: "Build on real signal",
    description: "Use the blueprint to define positioning, scope the MVP, and avoid the most common failure modes.",
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
              className="rounded-lg px-5 font-medium shadow-sm shadow-primary/20"
            >
              Get Started
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
            className="w-full justify-center rounded-lg font-medium"
            onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}
          >
            Get Started
          </Button>
        </div>
      </div>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-16 px-6 pb-24 pt-20 md:grid-cols-[minmax(0,1.1fr)_360px] md:items-end md:pt-28">
          <div className="max-w-3xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              Market intelligence for founders
            </div>

            <h1 className="max-w-4xl font-heading text-5xl font-bold leading-[0.95] tracking-[-0.06em] text-foreground sm:text-6xl lg:text-7xl">
              Stop building apps
              <br />
              <span className="text-foreground">nobody wants.</span>
            </h1>

            <p className="mt-7 max-w-xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
              Gold Rush analyzes real search demand, competitor density, and user pain points — then scores the opportunity so you know what's worth building before you commit months to it.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="rounded-xl px-7 font-semibold shadow-lg shadow-primary/20"
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
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Signal</div>
                <div className="mt-3 font-mono text-3xl font-semibold text-foreground">Clear</div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">One score. Real evidence. A clear decision.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto h-px max-w-6xl bg-border" />

        {/* Three core signals */}
        <section className="mx-auto max-w-6xl px-6 py-24" id="proof">
          <div className="mb-12 max-w-2xl">
            <p className="mb-4 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">What we analyze</p>
            <h2 className="font-heading text-3xl font-bold tracking-[-0.05em] text-foreground md:text-4xl">
              Three signals that tell the real story.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
              Most founders validate with gut feel and Google. Gold Rush pulls structured evidence from seven live sources and synthesizes it into a single, actionable read.
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

        {/* Report preview */}
        <section id="report-preview" className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_320px] lg:items-end">
            <div>
              <p className="mb-4 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Sample output</p>
              <h2 className="font-heading text-3xl font-bold tracking-[-0.05em] text-foreground md:text-4xl">
                See exactly what you'll get.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
                A real sample report — scored, structured, and sourced. No blurry screenshots or vague previews.
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
                        <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Key insight</span>
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
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Every report includes</p>
                <h3 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.04em] text-foreground">
                  Six analysis layers.
                </h3>
              </div>

              {[
                "Market demand score with trend direction",
                "Competitor density and positioning gaps",
                "User pain synthesis from real reviews",
                "Revenue benchmarks from comparable apps",
                "Risk flags and kill-shot analysis",
                "Startup blueprint for the MVP phase",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                  <span>{item}</span>
                </div>
              ))}

              <Button
                size="lg"
                onClick={() => navigate("/sample-report")}
                className="mt-2 w-full rounded-xl font-semibold shadow-sm shadow-primary/20"
              >
                Open Sample Report
                <FileText className="h-4 w-4" />
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
              Four steps. No setup. No fluff.
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-[15px]">
              Drop in your idea. We handle the research, the scoring, and the synthesis.
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
                Evidence, not guesswork
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Every signal links back to a real source — search volume, competitor reviews, Reddit threads, or app store rankings. No invented statistics, no AI hallucinations presented as data.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-8">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-heading text-xl font-semibold tracking-[-0.04em] text-foreground">
                A decision in minutes
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                The full pipeline runs in under three minutes. Enough to validate five ideas in an afternoon, kill a weak one before a sprint starts, or pressure-test an assumption before a pitch.
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto h-px max-w-6xl bg-border" />

        {/* Final CTA */}
        <section className="mx-auto max-w-4xl px-6 py-24 text-center">
          <h2 className="font-heading text-4xl font-bold tracking-[-0.06em] text-foreground sm:text-5xl">
            Validate before you build.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
            If the signal is weak, you find out in minutes — not months. If it's strong, you move with real evidence behind you.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="rounded-xl px-7 font-semibold shadow-lg shadow-primary/20"
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
