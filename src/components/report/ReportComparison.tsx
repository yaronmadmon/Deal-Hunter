import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitCompareArrows, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { MockReportData } from "@/data/mockReport";

interface ReportComparisonProps {
  currentReport: MockReportData;
  currentAnalysisId: string;
  userId: string;
}

interface PreviousRun {
  id: string;
  overall_score: number | null;
  created_at: string;
  report_data: any;
}

export const ReportComparison = ({ currentReport, currentAnalysisId, userId }: ReportComparisonProps) => {
  const [previousRun, setPreviousRun] = useState<PreviousRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrevious = async () => {
      // Find previous analyses for the same idea (fuzzy match: same first 30 chars)
      const ideaPrefix = currentReport.idea.slice(0, 30).toLowerCase();
      const { data } = await supabase
        .from("analyses")
        .select("id, overall_score, created_at, report_data")
        .eq("user_id", userId)
        .eq("status", "complete")
        .neq("id", currentAnalysisId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        // Find the most recent analysis with a similar idea
        const match = data.find((a) => {
          const rd = a.report_data as any;
          const prevIdea = (rd?.idea || "").slice(0, 30).toLowerCase();
          return prevIdea === ideaPrefix;
        });
        if (match) setPreviousRun(match);
      }
      setLoading(false);
    };
    fetchPrevious();
  }, [currentAnalysisId, currentReport.idea, userId]);

  if (loading || !previousRun) return null;

  const prevReport = previousRun.report_data as unknown as MockReportData;
  const prevScore = previousRun.overall_score ?? prevReport?.overallScore ?? 0;
  const currentScore = currentReport.overallScore;
  const scoreDelta = currentScore - prevScore;

  const prevBreakdown = prevReport?.scoreBreakdown || [];
  const currentBreakdown = currentReport.scoreBreakdown || [];

  const categoryDeltas = currentBreakdown.map((cat) => {
    const prev = prevBreakdown.find((p: any) => p.label === cat.label);
    const prevVal = prev ? Number(prev.value) || 0 : 0;
    const delta = (Number(cat.value) || 0) - prevVal;
    return { label: cat.label, current: Number(cat.value) || 0, previous: prevVal, delta };
  });

  const prevDate = new Date(previousRun.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const DeltaIcon = ({ delta }: { delta: number }) => {
    if (delta > 0) return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
    if (delta < 0) return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const deltaColor = (delta: number) =>
    delta > 0 ? "text-green-400" : delta < 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <Card className="border-border/50 bg-card/50 mb-8">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">Run Comparison</CardTitle>
          <Badge variant="secondary" className="text-[11px] ml-auto">vs {prevDate}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          How this analysis compares to your previous run of the same idea.
        </p>
      </CardHeader>
      <CardContent>
        {/* Overall score delta */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-muted/10 mb-3">
          <div className="flex items-center gap-2">
            <DeltaIcon delta={scoreDelta} />
            <span className="text-sm font-medium text-foreground">Overall Score</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{prevScore}</span>
            <span className="text-xs text-muted-foreground">→</span>
            <span className="text-sm font-semibold text-foreground">{currentScore}</span>
            <span className={`text-xs font-semibold ${deltaColor(scoreDelta)}`}>
              {scoreDelta > 0 ? "+" : ""}{scoreDelta}
            </span>
          </div>
        </div>

        {/* Category deltas */}
        <div className="space-y-1.5">
          {categoryDeltas.map((cat) => (
            <div key={cat.label} className="flex items-center justify-between py-1.5 px-2 text-sm">
              <div className="flex items-center gap-2">
                <DeltaIcon delta={cat.delta} />
                <span className="text-muted-foreground">{cat.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">{cat.previous}/20</span>
                <span className="text-[11px] text-muted-foreground">→</span>
                <span className="text-xs font-medium text-foreground">{cat.current}/20</span>
                {cat.delta !== 0 && (
                  <span className={`text-[11px] font-semibold ${deltaColor(cat.delta)}`}>
                    {cat.delta > 0 ? "+" : ""}{cat.delta}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
