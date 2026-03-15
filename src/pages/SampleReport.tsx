import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Trophy, Brain, Search, Microscope, Crosshair, Map, GitCompare, MessageSquare, Target, DollarSign, BarChart3, Wrench, Compass, Pickaxe, Layers, Eye } from "lucide-react";
import { SignalCard } from "@/components/report/SignalCard";
import { OpportunitySection } from "@/components/report/OpportunitySection";
import { RevenueBenchmark } from "@/components/report/RevenueBenchmark";
import { NicheAnalysis } from "@/components/report/NicheAnalysis";
import { UnitEconomics } from "@/components/report/UnitEconomics";
import { BuildComplexity } from "@/components/report/BuildComplexity";
import { OpenSourceLandscape } from "@/components/report/OpenSourceLandscape";
import { ScoreRing } from "@/components/report/ScoreRing";
import { KeyStatsBar } from "@/components/report/KeyStatsBar";
import { UserQuotesSection } from "@/components/report/UserQuotesSection";
import { MethodologySection } from "@/components/report/MethodologySection";
import { GlossarySection } from "@/components/report/GlossarySection";
import { ProofDashboard } from "@/components/report/ProofDashboard";
import { KeywordDemand } from "@/components/report/KeywordDemand";
import { AppStoreIntelligence } from "@/components/report/AppStoreIntelligence";
import { RecommendedStrategy } from "@/components/report/RecommendedStrategy";
import { MarketExploitMap } from "@/components/report/MarketExploitMap";
import { CompetitorMatrix } from "@/components/report/CompetitorMatrix";
import { FounderDecision } from "@/components/report/FounderDecision";
import { KillShotAnalysis } from "@/components/report/KillShotAnalysis";
import { ReviewIntelligence } from "@/components/report/ReviewIntelligence";
import { EvidenceStrength } from "@/components/report/EvidenceStrength";
import { FounderInsight } from "@/components/report/FounderInsight";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BlueprintSection } from "@/components/report/BlueprintSection";
import { mockReport } from "@/data/mockReport";
import { ReportNavigator } from "@/components/report/ReportNavigator";
import { ReportLayerHeader } from "@/components/report/ReportLayerHeader";
import { ScoreDeepDive } from "@/components/report/ScoreDeepDive";
import { CollapsibleSection } from "@/components/report/CollapsibleSection";
import { safeValue } from "@/lib/safeValue";

const sectionSubtitles: Record<string, string> = {
  "Trend Momentum": "Is interest growing or fading?",
  "Market Saturation": "How crowded is this market?",
  "Competitor Snapshot": "Who are you up against?",
  "Sentiment & Pain Points": "What real users love and hate",
  "Growth Signals": "Signs this market is heating up",
};

const SampleReport = () => {
  const navigate = useNavigate();
  const r = mockReport;
  const totalEvidence = r.signalCards.reduce((sum, c) => sum + (c.evidenceCount || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <ReportNavigator />

      {/* Sticky sample banner */}
      <div className="sticky top-0 z-50 bg-primary text-primary-foreground text-center py-2.5 px-4 text-sm font-medium">
        <span className="mr-2">👀 You're viewing a sample report.</span>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 text-xs font-semibold"
          onClick={() => navigate("/auth")}
        >
          Sign up free to analyze your own idea
          <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex items-center justify-between px-4 sm:px-6 py-4 max-w-6xl mx-auto border-b border-border/50">
        <span
          className="font-heading text-xl font-bold text-foreground shrink-0 cursor-pointer flex items-center gap-2"
          onClick={() => navigate("/")}
        >
          <Pickaxe className="w-5 h-5 text-primary" />
          Gold Rush
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => navigate("/auth")}>
            Log In
          </Button>
          <Button size="sm" onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
            <Pickaxe className="w-3.5 h-3.5 mr-1" />
            Start Free
          </Button>
        </div>
      </nav>

      <main id="report-content" className="max-w-6xl mx-auto px-6 py-10 lg:pr-24">

        {/* LAYER 1 — VERDICT */}
        <ReportLayerHeader
          id="layer-verdict"
          title="Verdict"
          subtitle="Your idea at a glance"
          icon={<Trophy className="w-4 h-4 text-primary" />}
          className="pt-0"
        />

        <div className="mb-8 mt-4">
          <div className="mb-6">
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">{r.idea}</h1>
          </div>
          <ScoreRing score={r.overallScore} signalStrength={r.signalStrength} />
          <p className="text-sm text-muted-foreground mt-4">
            Analysis based on <span className="font-semibold text-foreground">{r.dataSources?.length || totalEvidence}</span> verified data points from {r.dataSources?.length ? `${r.dataSources.length} sources` : "Reddit, App Store, and Google Trends"}.
          </p>
          <p className="text-xs text-muted-foreground mt-2 italic">Gold Rush provides market signals and competitive intelligence. It does not predict success.</p>
        </div>

        <KeyStatsBar stats={r.keyStats || [
          { value: `${r.overallScore}/100`, label: "Market Signal Score", sentiment: r.overallScore >= 70 ? "positive" : r.overallScore >= 40 ? "neutral" : "negative" as any },
          { value: `${totalEvidence}+`, label: "Data Points Analyzed", sentiment: "neutral" as any },
          { value: safeValue(r.signalCards.find(c => c.title === "Trend Momentum")?.metrics?.[0]?.value), label: "Interest Change (90d)", change: r.signalCards.find(c => c.title === "Trend Momentum")?.metrics?.[0]?.value, sentiment: "positive" as any },
          { value: safeValue(r.revenueBenchmark.range), label: "Revenue Potential (est.)", sentiment: "positive" as any },
        ]} />

        {r.founderInsight && <FounderInsight data={r.founderInsight} />}
        {r.founderDecision && <FounderDecision data={r.founderDecision} />}

        {/* Data Quality & Integrity */}
        {r.dataQualitySummary && (
          <details className="mb-6 bg-card rounded-lg border border-border/60 p-4">
            <summary className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Data Quality & Integrity
              <span className="ml-auto text-xs bg-secondary px-2 py-0.5 rounded-full">{r.dataQualitySummary.length} sources</span>
            </summary>
            <div className="mt-3 space-y-2">
              {r.dataQualitySummary.map((s, i) => (
                <div key={i} className="flex items-start gap-3 text-xs p-2 bg-secondary/30 rounded">
                  <span className="font-medium text-foreground min-w-[120px]">{s.sourceName}</span>
                  <span className="text-muted-foreground">{s.dataTier}</span>
                  <span className="text-muted-foreground ml-auto">{s.signalCount} signals</span>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* LAYER 2 — EXPLANATION */}
        <ReportLayerHeader
          id="layer-explanation"
          title="Explanation"
          subtitle="Why this score happened"
          icon={<Brain className="w-4 h-4 text-teal" />}
        />

        <CollapsibleSection title="Score Deep Dive" icon={<Brain className="w-4 h-4 text-teal" />} summary="Why you got this score">
          <ScoreDeepDive report={r} />
        </CollapsibleSection>

        <CollapsibleSection title="Signal Cards" icon={<Search className="w-4 h-4 text-primary" />} summary={`${r.signalCards.length} market signals analyzed`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {r.signalCards.map((card) => (
              <SignalCard key={card.title} card={card} subtitle={sectionSubtitles[card.title]} />
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Opportunity Gaps" icon={<Target className="w-4 h-4 text-success" />} summary="Where you can win">
          <OpportunitySection opportunity={r.opportunity} />
        </CollapsibleSection>

        {/* Mid-page CTA */}
        <div className="my-10 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-6 text-center">
          <p className="text-foreground font-semibold mb-2">Like what you see?</p>
          <p className="text-sm text-muted-foreground mb-4">Get a report like this for your own startup idea — it's free.</p>
          <Button onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
            Analyze My Idea <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* LAYER 3 — EVIDENCE */}
        <ReportLayerHeader
          id="layer-evidence"
          title="Evidence"
          subtitle="Supporting proof and raw signals"
          icon={<Search className="w-4 h-4 text-success" />}
        />

        {r.proofDashboard && (
          <CollapsibleSection title="Proof Dashboard" icon={<Search className="w-4 h-4 text-success" />} summary="Verified evidence overview">
            <ProofDashboard data={r.proofDashboard} />
          </CollapsibleSection>
        )}

        <CollapsibleSection title="Evidence Strength" icon={<BarChart3 className="w-4 h-4 text-primary" />} summary="How strong is the proof?">
          <EvidenceStrength proofDashboard={r.proofDashboard} />
        </CollapsibleSection>

        {r.keywordDemand && (
          <CollapsibleSection title="Keyword Demand" icon={<Search className="w-4 h-4 text-teal" />} summary="Search volume insights">
            <KeywordDemand data={r.keywordDemand} />
          </CollapsibleSection>
        )}

        <CollapsibleSection title="User Quotes" icon={<MessageSquare className="w-4 h-4 text-purple-400" />} summary="What real users are saying">
          <UserQuotesSection quotes={(() => {
            if (r.userQuotes && r.userQuotes.length > 0) return r.userQuotes.slice(0, 5);
            const extracted = r.signalCards.flatMap(c =>
              c.evidence.map(e => {
                const match = e.match(/"([^"]+)"\s*—\s*(.+)/);
                if (!match) return null;
                const src = match[2];
                return {
                  text: match[1],
                  source: src,
                  platform: (src.toLowerCase().includes("reddit") || src.toLowerCase().includes("r/") ? "reddit" : src.toLowerCase().includes("app store") ? "app_store" : "other") as any,
                };
              }).filter(Boolean)
            ) as any[];
            return extracted.slice(0, 5);
          })()} />
        </CollapsibleSection>

        {r.appStoreIntelligence && (
          <CollapsibleSection title="App Store Intelligence" icon={<Eye className="w-4 h-4 text-primary" />} summary="App store insights">
            <AppStoreIntelligence data={r.appStoreIntelligence} />
          </CollapsibleSection>
        )}

        {r.githubRepos && (
          <CollapsibleSection title="Open Source Landscape" icon={<GitCompare className="w-4 h-4 text-muted-foreground" />} summary="Related open-source projects">
            <OpenSourceLandscape repos={r.githubRepos} />
          </CollapsibleSection>
        )}

        {/* LAYER 4 — DEEP ANALYSIS */}
        <ReportLayerHeader
          id="layer-deep-analysis"
          title="Deep Analysis"
          subtitle="Advanced diagnostics and market intelligence"
          icon={<Microscope className="w-4 h-4 text-[hsl(262,60%,60%)]" />}
        />

        {r.killShotAnalysis && (
          <CollapsibleSection title="Kill Shot Analysis" icon={<Crosshair className="w-4 h-4 text-destructive" />} summary="Critical risks and deal-breakers">
            <KillShotAnalysis data={r.killShotAnalysis} />
          </CollapsibleSection>
        )}

        {r.marketExploitMap && (
          <CollapsibleSection title="Market Exploit Map" icon={<Map className="w-4 h-4 text-teal" />} summary="Gaps you can exploit">
            <MarketExploitMap data={r.marketExploitMap} />
          </CollapsibleSection>
        )}

        {r.competitorMatrix && (
          <CollapsibleSection title="Competitor Matrix" icon={<GitCompare className="w-4 h-4 text-blue-400" />} summary="How you stack up">
            <CompetitorMatrix data={r.competitorMatrix} />
          </CollapsibleSection>
        )}

        {r.reviewIntelligence && r.reviewIntelligence.complaintClusters?.length > 0 && (
          <CollapsibleSection title="Review Intelligence" icon={<MessageSquare className="w-4 h-4 text-purple-400" />} summary="Competitor pain points">
            <ReviewIntelligence data={r.reviewIntelligence} />
          </CollapsibleSection>
        )}

        {r.nicheAnalysis && (
          <CollapsibleSection title="Niche Analysis" icon={<Target className="w-4 h-4 text-green-400" />} summary="Market positioning">
            <NicheAnalysis data={r.nicheAnalysis} />
          </CollapsibleSection>
        )}

        {r.unitEconomics && (
          <CollapsibleSection title="Unit Economics" icon={<DollarSign className="w-4 h-4 text-primary" />} summary="Cost & revenue model">
            <UnitEconomics data={r.unitEconomics} />
          </CollapsibleSection>
        )}

        <CollapsibleSection title="Revenue Benchmark" icon={<BarChart3 className="w-4 h-4 text-green-500" />} summary={r.revenueBenchmark?.range || "Revenue estimates"}>
          <RevenueBenchmark benchmark={r.revenueBenchmark} />
        </CollapsibleSection>

        {r.buildComplexity && (
          <CollapsibleSection title="Build Complexity" icon={<Wrench className="w-4 h-4 text-muted-foreground" />} summary={`${r.buildComplexity.complexityScore || "?"}/10 difficulty`}>
            <BuildComplexity data={r.buildComplexity} />
          </CollapsibleSection>
        )}

        {r.recommendedStrategy && (
          <CollapsibleSection title="Recommended Strategy" icon={<Compass className="w-4 h-4 text-primary" />} summary="Suggested go-to-market approach" defaultOpen>
            <RecommendedStrategy data={r.recommendedStrategy} />
          </CollapsibleSection>
        )}

        <details className="mb-6">
          <summary className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground py-2">
            📖 Glossary of Terms
          </summary>
          <div className="mt-2">
            <GlossarySection />
          </div>
        </details>

        <details className="mb-6">
          <summary className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground py-2">
            🔬 Methodology
          </summary>
          <div className="mt-2">
            <MethodologySection methodology={r.methodology} dataSources={r.dataSources} />
          </div>
        </details>

        {/* Blueprint */}
        <BlueprintSection
          blueprint={r.blueprint}
          analysisId="sample"
          idea={r.idea}
          pdfContext={{
            overallScore: r.overallScore,
            signalStrength: r.signalStrength,
            sparkline: r.signalCards.find(c => c.sparkline)?.sparkline,
            donut: r.signalCards.find(c => c.donut)?.donut,
            scoreBreakdown: r.scoreBreakdown,
          }}
          buildComplexity={r.buildComplexity}
          report={r}
        />

        {/* Final CTA */}
        <div className="my-12 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-10 text-center">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-3">
            Ready to Validate <span className="text-primary">Your</span> Idea?
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto mb-6">
            Sign up for free and get a full market intelligence report for your own startup idea in under 60 seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 font-semibold text-base px-8">
              Get Your Own Report
              <ArrowRight className="ml-1 w-4 h-4" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate("/")} className="border-primary/30 text-foreground hover:bg-primary/5 font-semibold text-base px-8">
              Back to Home
            </Button>
          </div>
        </div>
      </main>

      <footer className="text-center py-8 text-sm text-muted-foreground border-t border-border/50">
        © 2026 Gold Rush
      </footer>
    </div>
  );
};

export default SampleReport;
