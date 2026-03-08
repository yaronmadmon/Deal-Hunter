import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";
import { Download, ArrowRight, Bookmark, BookmarkCheck, Eye } from "lucide-react";
import { generatePdfFromElement } from "@/lib/generatePdfFromElement";
import { SignalCard } from "@/components/report/SignalCard";
import { OpportunitySection } from "@/components/report/OpportunitySection";
import { RevenueBenchmark } from "@/components/report/RevenueBenchmark";
import { ScoreBreakdown } from "@/components/report/ScoreBreakdown";
import { BlueprintSection } from "@/components/report/BlueprintSection";
import { ScoreRing } from "@/components/report/ScoreRing";
import { KeyStatsBar } from "@/components/report/KeyStatsBar";
import { UserQuotesSection } from "@/components/report/UserQuotesSection";
import { MethodologySection } from "@/components/report/MethodologySection";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { MockReportData } from "@/data/mockReport";
import { mockReport } from "@/data/mockReport";
import { toast } from "sonner";

const Report = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, loading } = useAuth();
  const [report, setReport] = useState<MockReportData | null>(null);
  const [isTracked, setIsTracked] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!id || !user) return;

    supabase.from("analyses")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data?.report_data) {
          const rd = data.report_data as unknown as MockReportData;
          setReport({
            ...rd,
            overallScore: data.overall_score ?? rd.overallScore,
            signalStrength: (data.signal_strength as MockReportData["signalStrength"]) ?? rd.signalStrength,
            blueprint: data.blueprint_data as unknown as MockReportData["blueprint"] ?? rd.blueprint,
          });
        } else {
          setReport({ ...mockReport, idea: data?.idea ?? mockReport.idea });
        }
      });

    // Check if already tracked
    supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", user.id)
      .eq("analysis_id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setIsTracked(true);
      });
  }, [id, user]);

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
          toast.error("Failed to add to watchlist");
        } else {
          setIsTracked(true);
          toast.success("Added to watchlist! Track it from your Idea Watchlist.");
        }
      }
    } finally {
      setTrackingLoading(false);
    }
  };

  if (!report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading report…</p>
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
            <details className="mt-2 mb-6">
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
          { value: r.signalCards.find(c => c.title === "Trend Momentum")?.metrics?.[0]?.value || "N/A", label: "Interest Change (90d)", change: r.signalCards.find(c => c.title === "Trend Momentum")?.metrics?.[0]?.value, sentiment: "positive" as any },
          { value: r.revenueBenchmark.range, label: "Revenue Potential (est.)", sentiment: "positive" as any },
        ]} />

        {/* Signal Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {r.signalCards.map((card) => (
            <SignalCard key={card.title} card={card} />
          ))}
        </div>

        {/* User Quotes */}
        <UserQuotesSection quotes={r.userQuotes || [
          ...r.signalCards.flatMap(c => c.evidence.filter(e => e.includes('"')).map(e => {
            const match = e.match(/"([^"]+)"\s*—\s*(.+)/);
            return match ? {
              text: match[1],
              source: match[2],
              platform: (match[2].toLowerCase().includes("reddit") ? "reddit" : match[2].toLowerCase().includes("app store") ? "app_store" : "other") as any,
            } : null;
          }).filter(Boolean)) as any[],
        ]} />

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
        <BlueprintSection blueprint={r.blueprint} analysisId={id} idea={r.idea} />

        {/* Methodology */}
        <MethodologySection methodology={r.methodology} dataSources={r.dataSources} />

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 mt-10 justify-center">
          <Button variant="default" size="lg" onClick={() => generatePdfFromElement("report-content", `GoldRush_Report_${r.idea.replace(/\s+/g, "_").slice(0, 30)}.pdf`)}>
            <Download className="mr-1" /> Download Report PDF
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
      </main>

      <footer className="text-center py-8 text-sm text-muted-foreground border-t border-border/50">
        © 2026 Gold Rush
      </footer>
    </div>
  );
};

export default Report;
