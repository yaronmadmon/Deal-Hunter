import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Download, ArrowRight } from "lucide-react";
import { SignalCard } from "@/components/report/SignalCard";
import { OpportunitySection } from "@/components/report/OpportunitySection";
import { RevenueBenchmark } from "@/components/report/RevenueBenchmark";
import { ScoreBreakdown } from "@/components/report/ScoreBreakdown";
import { BlueprintSection } from "@/components/report/BlueprintSection";
import { ScoreRing } from "@/components/report/ScoreRing";
import { ThemeToggle } from "@/components/ThemeToggle";
import { mockReport } from "@/data/mockReport";

const Report = () => {
  const navigate = useNavigate();
  const r = mockReport;

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto border-b border-border/50">
        <span className="font-heading text-xl font-bold text-foreground">⛏️ Gold Rush</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
            Dashboard
          </Button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-12">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-6">{r.idea}</h1>
          <ScoreRing score={r.overallScore} signalStrength={r.signalStrength} />
          <p className="text-sm text-muted-foreground mt-4">Analysis based on Reddit, App Store, and Google Trends data.</p>
          <p className="text-[11px] text-muted-foreground mt-1 italic">Gold Rush provides market signals and competitive intelligence. It does not predict success.</p>
        </div>

        {/* Signal Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {r.signalCards.map((card) => (
            <SignalCard key={card.title} card={card} />
          ))}
        </div>

        {/* Opportunity */}
        <OpportunitySection opportunity={r.opportunity} />

        {/* Revenue Benchmark */}
        <RevenueBenchmark benchmark={r.revenueBenchmark} />

        {/* Score Breakdown */}
        <ScoreBreakdown
          breakdown={r.scoreBreakdown}
          total={r.overallScore}
          signalStrength={r.signalStrength}
          explanation={r.scoreExplanation}
        />

        {/* Blueprint Generator */}
        <BlueprintSection blueprint={r.blueprint} />

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 mt-10 justify-center">
          <Button variant="default" size="lg">
            <Download className="mr-1" /> Download PDF
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate("/dashboard")}>
            Analyze Another Idea <ArrowRight className="ml-1" />
          </Button>
        </div>
      </main>

      <footer className="text-center py-8 text-sm text-muted-foreground border-t border-border/50">
        © 2026 Gold Rush
      </footer>
    </div>
  );
};

export default Report;
