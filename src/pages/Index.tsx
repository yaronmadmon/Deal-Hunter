import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Search, BarChart3, FileText, Lightbulb, Map, Pickaxe,
  TrendingUp, Users, Target, ShieldCheck, Layers, Rocket, Gem, Compass,
  Menu, X
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
              <Pickaxe className="w-3.5 h-3.5 mr-1" />
              Start Digging
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
            <Pickaxe className="w-3.5 h-3.5 mr-1" />
            Start Digging
          </Button>
        </div>
      </div>

      {/* ─── HERO ─── */}
      <section className="relative max-w-5xl mx-auto px-6 pt-24 pb-20 text-center overflow-hidden">
        {/* Decorative gold glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium mb-8">
            <Gem className="w-3.5 h-3.5" />
            Market Intelligence for Builders
          </div>

          <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] mb-4">
            The Gold Rush Is Back.
            <br />
            <span className="text-primary">This Time, the Gold Is Startup Ideas.</span>
          </h1>

          <p className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold text-foreground/80 mb-6">
            Validate Your App Idea Before You Build It.
          </p>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-4 leading-relaxed">
            Don't miss your opportunity. Grab your shovel and start digging for the next big app.
          </p>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Gold Rush analyzes real market signals — trends, competitors, reviews, and user demand — to help you discover whether your startup idea is worth pursuing.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 font-semibold text-base px-8">
              Validate Your Idea in Minutes
              <ArrowRight className="ml-1 w-4 h-4" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate("/auth")} className="border-primary/30 text-foreground hover:bg-primary/5 font-semibold text-base px-8">
              <Pickaxe className="mr-1 w-4 h-4" />
              Start Digging
            </Button>
          </div>
        </div>
      </section>

      {/* ─── SUPPORTING DESCRIPTION ─── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            Turn Startup Ideas Into <span className="text-primary">Market Intelligence</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base leading-relaxed">
            Gold Rush scans real data sources across the internet to transform raw startup ideas into structured market intelligence reports.
            Instead of guessing whether an idea is good, you get a clear signal-driven breakdown showing where real opportunity exists.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {[
            { icon: TrendingUp, title: "Market Demand", desc: "Real search and trend signals showing genuine user interest" },
            { icon: Users, title: "Competitor Saturation", desc: "How crowded the space is and where gaps exist" },
            { icon: Target, title: "User Pain Points", desc: "What real users are complaining about in this space" },
            { icon: Rocket, title: "Growth Signals", desc: "Indicators that the market is expanding right now" },
            { icon: Compass, title: "Opportunity Gaps", desc: "Underserved niches waiting to be claimed" },
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

        <p className="text-center text-primary font-semibold mt-8 text-sm tracking-wide">
          No guessing. Just real signals.
        </p>
      </section>

      {/* ─── REPORT PREVIEW ─── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">
            See a <span className="text-primary">Real Report</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Here's what you'll get when you analyze an idea. Explore a full sample report — no signup required.
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
              Explore Full Sample Report
              <ArrowRight className="ml-1 w-4 h-4" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate("/auth")} className="border-primary/30 text-foreground hover:bg-primary/5 font-semibold">
              Or analyze your own idea
            </Button>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-center text-foreground mb-4">
          How <span className="text-primary">Gold Rush</span> Works
        </h2>
        <p className="text-center text-muted-foreground mb-14 max-w-xl mx-auto">
          From idea to actionable market intelligence in four simple steps.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[
            {
              step: "01", icon: Lightbulb, title: "Enter Your Idea",
              desc: "Describe your startup idea in one sentence.",
              example: '"AI tool that summarizes lectures for students."',
            },
            {
              step: "02", icon: Search, title: "Market Analysis",
              desc: "Gold Rush scans multiple sources including search trends, app store competitors, user reviews, online discussions, and startup activity.",
            },
            {
              step: "03", icon: BarChart3, title: "Market Intelligence Report",
              desc: "In under a minute you receive a structured report including market signal score, competitor analysis, sentiment insights, growth signals, and opportunity gaps.",
            },
            {
              step: "04", icon: Map, title: "Startup Blueprint",
              desc: "Generate a structured startup blueprint including product positioning, feature suggestions, target users, monetization ideas, and MVP roadmap.",
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

      {/* ─── POSITIONING ─── */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="bg-card rounded-2xl border border-border/60 p-10 md:p-14 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <ShieldCheck className="w-10 h-10 text-primary mx-auto mb-6" />
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-4">
              Not Guesswork. <span className="text-primary">Real Market Signals.</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed mb-2">
              Gold Rush does not predict startup success.
            </p>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Instead, it analyzes real signals from across the internet to help founders make smarter, more informed decisions before they build.
            </p>
            <p className="text-primary font-semibold mt-6 text-sm">
              Think of it as market intelligence for builders.
            </p>
          </div>
        </div>
      </section>

      {/* ─── THEME SECTION ─── */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <Pickaxe className="w-10 h-10 text-primary mx-auto mb-6" />
        <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-6">
          Every Gold Rush Needs the <span className="text-primary">Right Tools</span>
        </h2>
        <div className="max-w-xl mx-auto space-y-4 text-muted-foreground leading-relaxed">
          <p>In the old days, people rushed west with a shovel and a dream.</p>
          <p>Today, founders rush into building apps.</p>
          <p className="text-foreground font-medium">But most people start digging in the wrong place.</p>
          <p className="text-primary font-semibold">
            Gold Rush helps you dig where the real opportunity is.
          </p>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-10 md:p-16 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ready to <span className="text-primary">Start Digging?</span>
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-8 leading-relaxed">
              Validate your startup idea and uncover real market signals in under a minute.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 font-semibold text-base px-8">
                Start the Gold Rush
                <ArrowRight className="ml-1 w-4 h-4" />
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate("/auth")} className="border-primary/30 text-foreground hover:bg-primary/5 font-semibold text-base px-8">
                Analyze My Idea
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