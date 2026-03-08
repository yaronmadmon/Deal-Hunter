import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Search, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <span className="font-heading text-xl font-bold text-foreground">
          ⛏️ Gold Rush
        </span>
        <Button variant="outline" size="sm" onClick={() => navigate("/auth")}>
          Sign In
        </Button>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="font-heading text-4xl md:text-6xl font-bold text-foreground leading-tight mb-6">
          Validate Your Startup Idea
          <span className="text-primary"> Before You Build</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Gold Rush analyzes real market signals to show if your idea has demand.
        </p>
        <Button variant="hero" size="lg" onClick={() => navigate("/auth")}>
          Validate My Idea Free
          <ArrowRight className="ml-1" />
        </Button>
      </section>

      {/* How It Works */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="font-heading text-2xl md:text-3xl font-bold text-center text-foreground mb-14">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Search, step: "1", title: "Enter your idea", desc: "Describe your startup concept in a few sentences." },
            { icon: BarChart3, step: "2", title: "We analyze the market", desc: "Gold Rush scans Reddit, App Store, and Google Trends for real signals." },
            { icon: FileText, step: "3", title: "Get a data-backed verdict", desc: "Receive a clear GO, PIVOT, or NO-GO with evidence." },
          ].map((item) => (
            <div key={item.step} className="bg-card rounded-xl border p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <item.icon className="w-6 h-6 text-primary" />
              </div>
              <div className="text-sm font-semibold text-primary mb-2">Step {item.step}</div>
              <h3 className="font-heading text-lg font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="bg-card border rounded-2xl p-10">
          <h2 className="font-heading text-2xl font-bold text-foreground mb-4">Simple Pricing</h2>
          <p className="text-muted-foreground mb-6">Start with 2 free validations. No credit card required.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <div className="bg-secondary rounded-xl p-6 flex-1">
              <div className="text-3xl font-heading font-bold text-foreground">Free</div>
              <div className="text-sm text-muted-foreground mt-1">2 validations</div>
            </div>
            <div className="bg-primary/5 border-2 border-primary rounded-xl p-6 flex-1">
              <div className="text-3xl font-heading font-bold text-foreground">$9</div>
              <div className="text-sm text-muted-foreground mt-1">5 credits</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-muted-foreground">
        © 2026 Gold Rush. Validate smarter.
      </footer>
    </div>
  );
};

export default Index;
