import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";
import { Download, ArrowRight, Bookmark, BookmarkCheck, Eye, Loader2 } from "lucide-react";
import { generateReportPdf } from "@/lib/generateReportPdf";
import { SignalCard } from "@/components/report/SignalCard";
import { OpportunitySection } from "@/components/report/OpportunitySection";
import { RevenueBenchmark } from "@/components/report/RevenueBenchmark";
import { NicheAnalysis } from "@/components/report/NicheAnalysis";
import { UnitEconomics } from "@/components/report/UnitEconomics";
import { BuildComplexity } from "@/components/report/BuildComplexity";
import { ScoreBreakdown } from "@/components/report/ScoreBreakdown";
import { BlueprintSection } from "@/components/report/BlueprintSection";
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
import { ScoreExplanation } from "@/components/report/ScoreExplanation";
import { DataQualitySummary } from "@/components/report/DataQualitySummary";
import { ConflictingSignals } from "@/components/report/ConflictingSignals";
import { PerplexityWarningBanner } from "@/components/report/PerplexityWarningBanner";
import { CrossValidationCard } from "@/components/report/CrossValidationCard";
import { SourceContaminationBanner } from "@/components/report/SourceContaminationBanner";
import { ReportComparison } from "@/components/report/ReportComparison";
import { ScoringJourney } from "@/components/report/ScoringJourney";
import { ReviewIntelligence } from "@/components/report/ReviewIntelligence";
import { EvidenceStrength } from "@/components/report/EvidenceStrength";
import { FounderInsight } from "@/components/report/FounderInsight";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { MockReportData } from "@/data/mockReport";
import { mockReport } from "@/data/mockReport";
import { toast } from "sonner";

/** Section subtitles for card titles */
const sectionSubtitles: Record<string, string> = {
  "Trend Momentum": "Is interest growing or fading?",
  "Market Saturation": "How crowded is this market?",
  "Competitor Snapshot": "Who are you up against?",
  "Sentiment & Pain Points": "What real users love and hate",
  "Growth Signals": "Signs this market is heating up",
};

/** Safely display a value — never show null, undefined, NaN, or N/A */
const safeValue = (val: any): string => {
  if (val === null || val === undefined || val === "N/A" || val === "n/a" || val === "NaN" || Number.isNaN(val)) {
    return "Insufficient data";
  }
  return String(val);
};

const Report = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, loading } = useAuth();
  const [report, setReport] = useState<MockReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [isTracked, setIsTracked] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!id || !user) return;

    let cancelled = false;

    const loadReport = async () => {
      setLoadingReport(true);
      try {
        const { data, error } = await supabase
          .from("analyses")
          .select("*")
          .eq("id", id)
          .single();

        if (cancelled) return;

        if (error || !data) {
          toast.error("Report not found.");
          navigate("/dashboard", { replace: true });
          return;
        }

        if (data.report_data) {
          const rd = data.report_data as unknown as MockReportData;
          setReport({
            ...rd,
            overallScore: data.overall_score ?? rd.overallScore,
            signalStrength: (data.signal_strength as MockReportData["signalStrength"]) ?? rd.signalStrength,
            blueprint: data.blueprint_data as unknown as MockReportData["blueprint"] ?? rd.blueprint,
          });
          return;
        }

        if (data.status === "failed") {
          const reportError = (data.report_data as any)?.error;
          const reportMessage = (data.report_data as any)?.message;
          toast.error(
            reportError === "insufficient_data"
              ? reportMessage || "Insufficient data to analyze this idea."
              : reportMessage || "Analysis failed. Please try again.",
          );
          navigate("/dashboard", { replace: true });
          return;
        }

        if (data.status === "complete") {
          toast.error("This report couldn't be generated. Please retry the analysis.");
          navigate("/dashboard", { replace: true });
          return;
        }

        navigate(`/processing/${id}`, { replace: true });
      } catch {
        if (!cancelled) {
          toast.error("Failed to load report.");
          navigate("/dashboard", { replace: true });
        }
      } finally {
        if (!cancelled) setLoadingReport(false);
      }
    };

    loadReport();

    // Check if already tracked
    supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", user.id)
      .eq("analysis_id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && !cancelled) setIsTracked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [id, user, navigate]);

  const handleTrack = async () => {
    if (!user || !id || !report) return;
    setTrackingLoading(true);

    try {
      if (isTracked) {
        await supabase.from("watchlist").delete().eq("user_id", user.id).eq("analysis_id", id);
        setIsTracked(false);
        toast.success("Removed from watchlist");
      } else {
        const { error } = await supabase.from("watchlist").insert({
          user_id: user.id,
          analysis_id: id,
          idea: report.idea,
          current_score: report.overallScore,
          last_analyzed_at: new Date().toISOString(),
        });
        if (error) {
          toast.error("Something went wrong — please try again");
        } else {
          setIsTracked(true);
          toast.success("Added to watchlist! Track it from your Idea Watchlist.");
        }
      }
    } finally {
      setTrackingLoading(false);
    }
  };

  if (loadingReport) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading report…</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-foreground font-medium">This report is unavailable.</p>
          <Button className="mt-4" onClick={() => navigate("/dashboard")}>Back to dashboard</Button>
        </div>
      </div>
    );
  }

  const r = report;
  const totalEvidence = r.signalCards.reduce((sum, c) => sum + (c.evidenceCount || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto border-b border-border/50">
        <span className="font-heading text-xl font-bold text-foreground">⛏️ Gold Rush</span>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => navigate("/watchlist")}>
            <Eye className="w-3.5 h-3.5 mr-1" /> Watchlist
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
            Dashboard
          </Button>
        </div>
      </nav>

      <main id="report-content" className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">{r.idea}</h1>
            <Button
              variant={isTracked ? "default" : "outline"}
              size="sm"
              onClick={handleTrack}
              disabled={trackingLoading}
              className="shrink-0"
            >
              {isTracked ? (
                <><BookmarkCheck className="w-4 h-4 mr-1" /> Tracking</>
              ) : (
                <><Bookmark className="w-4 h-4 mr-1" /> Track This Idea</>
              )}
            </Button>
          </div>
          <ScoreRing score={r.overallScore} signalStrength={r.signalStrength} />
          <p className="text-sm text-muted-foreground mt-4">
            Analysis based on <span className="font-semibold text-foreground">{r.dataSources?.length || totalEvidence}</span> verified data points from {r.dataSources?.length ? `${r.dataSources.length} sources` : "Reddit, App Store, and Google Trends"}.
          </p>
          {r.dataSources && r.dataSources.length > 0 && (
            <details className="mt-2 mb-8">
              <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
                View {r.dataSources.length} source URLs
              </summary>
              <ul className="mt-1 space-y-0.5">
                {r.dataSources.map((url: string, i: number) => (
                  <li key={i}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline truncate block max-w-md">
                      [{i + 1}] {url}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="text-[11px] text-muted-foreground mt-1 italic">Gold Rush provides market signals and competitive intelligence. It does not predict success.</p>
        </div>

        {/* Key Stats */}
        <KeyStatsBar stats={r.keyStats || [
          { value: `${r.overallScore}/100`, label: "Market Signal Score", sentiment: r.overallScore >= 70 ? "positive" : r.overallScore >= 40 ? "neutral" : "negative" as any },
          { value: `${totalEvidence}+`, label: "Data Points Analyzed", sentiment: "neutral" as any },
          { value: safeValue(r.signalCards.find(c => c.title === "Trend Momentum")?.metrics?.[0]?.value), label: "Interest Change (90d)", change: r.signalCards.find(c => c.title === "Trend Momentum")?.metrics?.[0]?.value, sentiment: "positive" as any },
          { value: safeValue(r.revenueBenchmark.range), label: "Revenue Potential (est.)", sentiment: "positive" as any },
        ]} />

        {/* Perplexity Dominance Warning Banner */}
        {r.pipelineMetrics?.perplexityDominanceBanner && (
          <PerplexityWarningBanner 
            percentage={r.pipelineMetrics.perplexityDominanceBanner.percentage} 
            message={r.pipelineMetrics.perplexityDominanceBanner.message} 
          />
        )}

        {/* Source Contamination Warning */}
        {r.pipelineMetrics?.sourceContamination && r.pipelineMetrics.sourceContamination.length > 0 && (
          <SourceContaminationBanner sources={r.pipelineMetrics.sourceContamination} />
        )}

        {/* Data Quality Summary */}
        {r.dataQualitySummary && (
          <DataQualitySummary 
            data={r.dataQualitySummary} 
            relevanceFilter={r.pipelineMetrics?.relevanceFilter}
          />
        )}

        {/* Cross-Validated Signals */}
        {r.pipelineMetrics?.crossValidatedSignals && r.pipelineMetrics.crossValidatedSignals.length > 0 && (
          <CrossValidationCard signals={r.pipelineMetrics.crossValidatedSignals} />
        )}

        {/* Conflicting Evidence */}
        {r.conflictingSignals && r.conflictingSignals.length > 0 && (
          <ConflictingSignals signals={r.conflictingSignals} />
        )}

        {/* Report Comparison Between Runs */}
        {user && id && (
          <ReportComparison currentReport={r} currentAnalysisId={id} userId={user.id} />
        )}

        {/* Founder Insight — plain-English interpretation */}
        {r.founderInsight && <FounderInsight data={r.founderInsight} />}

        {/* Proof Dashboard — immediate evidence */}
        {r.proofDashboard && <ProofDashboard data={r.proofDashboard} />}

        {/* Evidence Strength — tier-ranked signals */}
        <EvidenceStrength proofDashboard={r.proofDashboard} />

        {/* Keyword Demand */}
        {r.keywordDemand && <KeywordDemand data={r.keywordDemand} />}

        {/* Signal Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {r.signalCards.map((card) => (
            <SignalCard key={card.title} card={card} subtitle={sectionSubtitles[card.title]} />
          ))}
        </div>

        {/* User Quotes */}
        <UserQuotesSection quotes={(() => {
          if (r.userQuotes && r.userQuotes.length > 0) return r.userQuotes.slice(0, 5);
          // Extract quotes from all signal card evidence
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

        {/* App Store Intelligence */}
        {r.appStoreIntelligence && <AppStoreIntelligence data={r.appStoreIntelligence} />}

        {/* Open Source Landscape */}
        {r.githubRepos && <OpenSourceLandscape repos={r.githubRepos} />}

        {/* Opportunity */}
        <OpportunitySection opportunity={r.opportunity} />

        {/* Niche Deep Dive */}
        {r.nicheAnalysis && <NicheAnalysis data={r.nicheAnalysis} />}

        {/* Unit Economics */}
        {r.unitEconomics && <UnitEconomics data={r.unitEconomics} />}

        {/* Revenue Benchmark */}
        <RevenueBenchmark benchmark={r.revenueBenchmark} />

        {/* Build Complexity */}
        {r.buildComplexity && <BuildComplexity data={r.buildComplexity} />}

        {/* Score Explanation */}
        {r.scoreExplanationData && <ScoreExplanation data={r.scoreExplanationData} score={r.overallScore} />}

        {/* Scoring Journey — debug panel showing score transformation */}
        {r.scoringJourney && <ScoringJourney journey={r.scoringJourney} />}

        {/* Score Breakdown */}
        <ScoreBreakdown
          breakdown={r.scoreBreakdown}
          total={r.overallScore}
          signalStrength={r.signalStrength}
          explanation={r.scoreExplanation}
          complexityPenalty={r.buildComplexity?.scorePenalty}
        />

        {/* Review Intelligence */}
        {r.reviewIntelligence && r.reviewIntelligence.complaintClusters?.length > 0 && (
          <div className="mt-12">
            <ReviewIntelligence data={r.reviewIntelligence} />
          </div>
        )}

        {/* Kill Shot Analysis */}
        {r.killShotAnalysis && <KillShotAnalysis data={r.killShotAnalysis} />}

        {/* Market Exploit Map */}
        {r.marketExploitMap && <MarketExploitMap data={r.marketExploitMap} />}

        {/* Competitor Comparison Matrix */}
        {r.competitorMatrix && <CompetitorMatrix data={r.competitorMatrix} />}

        {/* Recommended Strategy */}
        {r.recommendedStrategy && <RecommendedStrategy data={r.recommendedStrategy} />}

        {/* Founder Decision Matrix */}
        {r.founderDecision && <FounderDecision data={r.founderDecision} />}

        {/* Glossary */}
        <GlossarySection />

        {/* Methodology */}
        <MethodologySection methodology={r.methodology} dataSources={r.dataSources} />

        {/* Download & Track CTAs — right after report content */}
        <div className="flex flex-col sm:flex-row gap-3 mt-10 mb-12 justify-center">
          <Button variant="default" size="lg" disabled={pdfGenerating} onClick={async () => {
            setPdfGenerating(true);
            try {
              toast.info("Generating PDF...");
              await new Promise(resolve => setTimeout(resolve, 50)); // Let UI update
              generateReportPdf(r);
              toast.success("PDF downloaded!");
            } catch (err) {
              console.error("Report PDF generation failed:", err);
              toast.error("PDF generation failed. Please try again or use a desktop browser.");
            } finally {
              setPdfGenerating(false);
            }
          }}>
            {pdfGenerating ? (
              <><Loader2 className="mr-1 w-4 h-4 animate-spin" /> Generating…</>
            ) : (
              <><Download className="mr-1" /> Download Report PDF</>
            )}
          </Button>
          <Button
            variant={isTracked ? "secondary" : "outline"}
            size="lg"
            onClick={handleTrack}
            disabled={trackingLoading}
          >
            {isTracked ? <><BookmarkCheck className="mr-1" /> Tracking This Idea</> : <><Bookmark className="mr-1" /> Track This Idea</>}
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate("/dashboard")}>
            Analyze Another Idea <ArrowRight className="ml-1" />
          </Button>
        </div>

        {/* Blueprint Generator — below the report */}
        <BlueprintSection
          blueprint={r.blueprint}
          analysisId={id}
          idea={r.idea}
          pdfContext={{
            overallScore: r.overallScore,
            signalStrength: r.signalStrength,
            googleTrendsSparkline: r.signalCards.find(c => c.googleTrendsSparkline)?.googleTrendsSparkline,
            sparkline: r.signalCards.find(c => c.sparkline)?.sparkline,
            donut: r.signalCards.find(c => c.donut)?.donut,
            scoreBreakdown: r.scoreBreakdown,
          }}
          buildComplexity={r.buildComplexity}
        />
      </main>

      <footer className="text-center py-8 text-sm text-muted-foreground border-t border-border/50">
        © 2026 Gold Rush
      </footer>
    </div>
  );
};

export default Report;
