import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Download, ArrowRight } from "lucide-react";
import { SignalCard } from "@/components/report/SignalCard";
import { OpportunitySection } from "@/components/report/OpportunitySection";
import { ScoreBreakdown } from "@/components/report/ScoreBreakdown";
import { mockReport } from "@/data/mockReport";

const Report = () => {
  const navigate = useNavigate();
  const r = mockReport;

  const verdictVariant = r.verdict === "GO" ? "go" as const : r.verdict === "PIVOT" ? "pivot" as const : "nogo" as const;

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <span className="font-heading text-xl font-bold text-foreground">⛏️ Gold Rush</span>
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
          Dashboard
        </Button>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-4">{r.idea}</h1>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-5xl font-bold text-foreground">{r.overallScore}</span>
              <span className="text-muted-foreground text-sm">/100</span>
            </div>
            <Badge variant={verdictVariant} className="text-sm px-4 py-1">{r.verdict}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-3">Analysis based on Reddit, App Store, and Google Trends data</p>
        </div>

        {/* Signal Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
          {r.signalCards.map((card) => (
            <SignalCard key={card.title} card={card} />
          ))}
        </div>

        {/* Opportunity */}
        <OpportunitySection opportunity={r.opportunity} />

        {/* Score Breakdown */}
        <ScoreBreakdown breakdown={r.scoreBreakdown} total={r.overallScore} verdict={r.verdict} verdictExplanation={r.verdictExplanation} />

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 mt-10 justify-center">
          <Button variant="hero" size="lg">
            <Download className="mr-1" /> Download PDF
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate("/dashboard")}>
            Analyze Another Idea <ArrowRight className="ml-1" />
          </Button>
        </div>
      </main>

      <footer className="text-center py-8 text-sm text-muted-foreground">
        © 2026 Gold Rush
      </footer>
    </div>
  );
};

export default Report;
