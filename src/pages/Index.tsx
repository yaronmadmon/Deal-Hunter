import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Search, BarChart3, FileText, Lightbulb, Map, Pickaxe,
  TrendingUp, Users, Target, ShieldCheck, Layers, Rocket, Gem, Compass,
  Menu, X, Zap, Clock, AlertTriangle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";

const Index = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ─── NAVIGATION ─── */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/40">
        <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <span className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
            <Pickaxe className="w-5 h-5 text-primary" />
            Gold Rush
          </span>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => scrollTo("how-it-works")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </button>
            <button onClick={() => navigate("/live")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Live Signals
            </button>
            <button onClick={() => navigate("/pricing")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </button>
          </div>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="text-muted-foreground hover:text-foreground">
              Log In
            </Button>
            <Button size="sm" onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
              <Zap className="w-3.5 h-3.5 mr-1" />
              Analyze My Idea
            </Button>
          </div>

          {/* Mobile hamburger button */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile slide-in panel */}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-background border-l border-border z-50 p-6 flex flex-col gap-3 md:hidden transition-transform duration-300 ease-out ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="font-heading text-lg font-bold text-foreground">Menu</span>
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <Button variant="ghost" className="justify-start h-11 text-base" onClick={() => scrollTo("how-it-works")}>
          <Search className="w-4 h-4 mr-3" /> How It Works
        </Button>
        <Button variant="ghost" className="justify-start h-11 text-base" onClick={() => { navigate("/live"); setMobileMenuOpen(false); }}>
          <TrendingUp className="w-4 h-4 mr-3" /> Live Signals
        </Button>
        <Button variant="ghost" className="justify-start h-11 text-base" onClick={() => { navigate("/pricing"); setMobileMenuOpen(false); }}>
          <Gem className="w-4 h-4 mr-3" /> Pricing
        </Button>

        <div className="mt-auto flex flex-col gap-3 pt-4 border-t border-border">
          <Button variant="ghost" size="sm" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }} className="justify-start text-muted-foreground hover:text-foreground">
            Log In
          </Button>
          <Button size="sm" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }} className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
            <Zap className="w-3.5 h-3.5 mr-1" />
            Analyze My Idea
          </Button>
        </div>
      </div>

      {/* ─── HERO ─── */}
      <section className="relative max-w-5xl mx-auto px-6 pt-24 pb-16 text-center overflow-hidden">
        {/* Decorative gold glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium mb-8">
            <Gem className="w-3.5 h-3.5" />
            Trusted by indie devs & founders
          </div>

          <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] mb-6">
            Stop Building Apps
            <br />
            <span className="text-primary">Nobody Wants.</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Know if your idea has real demand — before you write a single line of code.
            Gold Rush scans real market signals and tells you if it's worth your time.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button size="lg" onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 font-semibold text-base px-8">
              Analyze My Idea — Free
              <ArrowRight className="ml-1 w-4 h-4" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate("/sample-report")} className="border-primary/30 text-foreground hover:bg-primary/5 font-semibold text-base px-8">
              See a Sample Report
            </Button>
          </div>

          {/* Social proof stats */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-primary" />
              7 real data sources
            </span>
            <span className="hidden sm:inline text-border">•</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              Results in minutes
            </span>
            <span className="hidden sm:inline text-border">•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              No fluff, just data
            </span>
          </div>
        </div>
      </section>

      {/* ─── PAIN POINTS ─── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            What You Get in <span className="text-primary">Every Report</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base leading-relaxed">
            We answer the questions you'd spend weeks researching on your own.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {[
            { icon: TrendingUp, title: "Is Anyone Searching for This?", desc: "Real search volume and trend data — not guesses" },
            { icon: Users, title: "How Crowded Is It?", desc: "See how many competitors exist and where the gaps are" },
            { icon: Target, title: "What Frustrates Users?", desc: "Pain points pulled from real reviews and discussions" },
            { icon: Rocket, title: "Is This Market Growing?", desc: "Signals showing if the space is expanding right now" },
            { icon: Compass, title: "Where's the Opportunity?", desc: "Underserved niches other builders haven't found yet" },
          ].map((item) => (
            <div key={item.title} className="bg-card rounded-xl border border-border/60 p-6 text-center hover:border-primary/30 transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <item.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-heading text-sm font-semibold text-foreground mb-1.5">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── REPORT PREVIEW ─── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">
            Don't Take Our Word for It — <span className="text-primary">See a Real Report</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            This is exactly what you'll get. No signup needed — explore a full report right now.
          </p>
        </div>

        <div className="relative bg-card rounded-2xl border border-border/60 p-8 md:p-10 overflow-hidden group hover:border-primary/30 transition-colors">
          {/* Decorative gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80 pointer-events-none z-10" />

          <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
            <div className="shrink-0">
              {/* Inline mini score ring */}
              <div className="relative w-24 h-24">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r="54" fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 54}
                    strokeDashoffset={2 * Math.PI * 54 - (71 / 100) * 2 * Math.PI * 54}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-heading text-2xl font-bold text-foreground">71</span>
                  <span className="text-[10px] text-muted-foreground">/100</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-heading text-xl font-bold text-foreground mb-1">AI Note Taking App for Students</h3>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Moderate Signal</span>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="bg-secondary/50 px-2.5 py-1 rounded-md">📈 +34% interest (90d)</span>
                <span className="bg-secondary/50 px-2.5 py-1 rounded-md">🏆 140 competitors</span>
                <span className="bg-secondary/50 px-2.5 py-1 rounded-md">💰 $1M–$5M potential</span>
              </div>
            </div>
          </div>

          {/* CTA overlay */}
          <div className="relative z-20 flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button size="lg" onClick={() => navigate("/sample-report")} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 font-semibold">
              Explore Full Report
              <ArrowRight className="ml-1 w-4 h-4" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate("/auth")} className="border-primary/30 text-foreground hover:bg-primary/5 font-semibold">
              Analyze your own idea
            </Button>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-center text-foreground mb-4">
          How It Works — <span className="text-primary">4 Steps</span>
        </h2>
        <p className="text-center text-muted-foreground mb-14 max-w-xl mx-auto">
          Type your idea. Get real market data. Make a smarter decision.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[
            {
              step: "01", icon: Lightbulb, title: "Describe Your Idea",
              desc: "One sentence is all we need. No business plan required.",
              example: '"AI tool that summarizes lectures for students"',
            },
            {
              step: "02", icon: Search, title: "We Scan the Market",
              desc: "Gold Rush pulls live data from search trends, app stores, reviews, forums, and startup databases.",
            },
            {
              step: "03", icon: BarChart3, title: "Get Your Verdict",
              desc: "A clear GO, PIVOT, or NO-GO score backed by real data — not AI opinions. Plus competitor maps, sentiment analysis, and opportunity gaps.",
            },
            {
              step: "04", icon: Map, title: "Build With a Blueprint",
              desc: "Get a step-by-step startup blueprint: positioning, features, target users, monetization, and an MVP roadmap to launch faster.",
            },
          ].map((item) => (
            <div key={item.step} className="bg-card rounded-xl border border-border/60 p-8 relative overflow-hidden group hover:border-primary/30 transition-colors">
              <span className="absolute top-4 right-6 font-heading text-5xl font-bold text-primary/10 group-hover:text-primary/20 transition-colors">
                {item.step}
              </span>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-heading text-lg font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              {item.example && (
                <p className="mt-3 text-xs text-primary/80 italic border-l-2 border-primary/30 pl-3">
                  {item.example}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── WHY TRUST THIS ─── */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="bg-card rounded-2xl border border-border/60 p-10 md:p-14 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <ShieldCheck className="w-10 h-10 text-primary mx-auto mb-6" />
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-4">
              Built on Data. <span className="text-primary">Not AI Hype.</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed mb-4">
              Most "idea validators" just ask ChatGPT and wrap the answer in a pretty template. Gold Rush is different.
            </p>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
              We pull real signals from 7+ data sources, cross-validate every claim, and flag anything we're not confident about. You get transparent scoring, not hype.
            </p>
            <p className="text-primary font-semibold mt-6 text-sm">
              If the data says your idea is weak, we'll tell you. That's the point.
            </p>
          </div>
        </div>
      </section>

      {/* ─── THE COST OF NOT KNOWING ─── */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <AlertTriangle className="w-10 h-10 text-primary mx-auto mb-6" />
        <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-6">
          The Cost of <span className="text-primary">Building Blind</span>
        </h2>
        <div className="max-w-xl mx-auto space-y-4 text-muted-foreground leading-relaxed">
          <p>Most indie devs spend 3–6 months building something before checking if anyone wants it.</p>
          <p>That's hundreds of hours of code, design, and marketing — gone.</p>
          <p className="text-foreground font-medium">What if you could check demand before writing line one?</p>
          <p className="text-primary font-semibold">
            That's what Gold Rush does. In minutes, not months.
          </p>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-10 md:p-16 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
              Don't Waste 6 Months on the <span className="text-primary">Wrong Idea.</span>
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-8 leading-relaxed">
              Find out if your startup idea has real market demand — in minutes, not months.
              Your first analysis is free.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 font-semibold text-base px-8">
                Analyze My Idea — Free
                <ArrowRight className="ml-1 w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="text-center py-10 text-sm text-muted-foreground border-t border-border/40">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Pickaxe className="w-4 h-4 text-primary" />
          <span className="font-heading font-semibold text-foreground">Gold Rush</span>
        </div>
        © 2026 Gold Rush. Dig smarter. Build better.
      </footer>
    </div>
  );
};

export default Index;
