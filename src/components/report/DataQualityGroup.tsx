import { useState } from "react";
import { Shield, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PerplexityWarningBanner } from "./PerplexityWarningBanner";
import { SourceContaminationBanner } from "./SourceContaminationBanner";
import { DataQualitySummary } from "./DataQualitySummary";
import { CrossValidationCard } from "./CrossValidationCard";
import { ConflictingSignals } from "./ConflictingSignals";
import { ReportComparison } from "./ReportComparison";
import type { MockReportData } from "@/data/mockReport";

interface Props {
  report: MockReportData;
  userId?: string;
  analysisId?: string;
}

export const DataQualityGroup = ({ report, userId, analysisId }: Props) => {
  const [open, setOpen] = useState(false);

  const r = report;

  // Perplexity dominance banner — show prominently outside collapsible when >50%
  const perplexityBanner = r.pipelineMetrics?.perplexityDominanceBanner;
  const isPerplexityProminent = perplexityBanner && perplexityBanner.percentage > 50;

  // Count how many quality notes exist
  let noteCount = 0;
  if (perplexityBanner && perplexityBanner.percentage > 50 && !isPerplexityProminent) noteCount++;
  if (r.pipelineMetrics?.sourceContamination && r.pipelineMetrics.sourceContamination.length > 0) noteCount++;
  if (r.dataQualitySummary && r.dataQualitySummary.length > 0) noteCount++;
  if (r.pipelineMetrics?.crossValidatedSignals && r.pipelineMetrics.crossValidatedSignals.length > 0) noteCount++;
  if (r.conflictingSignals && r.conflictingSignals.length > 0) noteCount++;

  const hasCollapsibleContent = noteCount > 0 || (r.pipelineMetrics?.sourceContamination && r.pipelineMetrics.sourceContamination.length > 0);

  return (
    <>
      {/* Prominent non-collapsible perplexity warning */}
      {isPerplexityProminent && (
        <PerplexityWarningBanner
          percentage={perplexityBanner.percentage}
          message={perplexityBanner.message}
          prominent
        />
      )}

      {(noteCount > 0 || (!isPerplexityProminent && perplexityBanner)) && (
        <Collapsible open={open} onOpenChange={setOpen} className="mb-8">
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border/50 bg-card/50 hover:bg-card transition-colors cursor-pointer group">
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Data Quality & Integrity</span>
                {noteCount > 0 && (
                  <Badge variant="secondary" className="text-xs px-2 py-0 bg-muted text-muted-foreground">
                    {noteCount} {noteCount === 1 ? "note" : "notes"}
                  </Badge>
                )}
              </div>
              {open ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-0">
            {/* Non-prominent perplexity banner inside collapsible */}
            {!isPerplexityProminent && perplexityBanner && (
              <PerplexityWarningBanner
                percentage={perplexityBanner.percentage}
                message={perplexityBanner.message}
              />
            )}

            {r.pipelineMetrics?.sourceContamination && r.pipelineMetrics.sourceContamination.length > 0 && (
              <SourceContaminationBanner sources={r.pipelineMetrics.sourceContamination} />
            )}

            {r.dataQualitySummary && (
              <DataQualitySummary
                data={r.dataQualitySummary}
                relevanceFilter={r.pipelineMetrics?.relevanceFilter}
              />
            )}

            {r.pipelineMetrics?.crossValidatedSignals && r.pipelineMetrics.crossValidatedSignals.length > 0 && (
              <CrossValidationCard signals={r.pipelineMetrics.crossValidatedSignals} />
            )}

            {r.conflictingSignals && r.conflictingSignals.length > 0 && (
              <ConflictingSignals signals={r.conflictingSignals} />
            )}

            {userId && analysisId && (
              <ReportComparison currentReport={r} currentAnalysisId={analysisId} userId={userId} />
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </>
  );
};
