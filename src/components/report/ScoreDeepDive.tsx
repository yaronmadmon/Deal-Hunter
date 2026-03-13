import { useState } from "react";
import { cn } from "@/lib/utils";
import { ScoreExplanation } from "./ScoreExplanation";
import { ScoringJourney } from "./ScoringJourney";
import { ScoreBreakdown } from "./ScoreBreakdown";
import type { MockReportData } from "@/data/mockReport";

interface Props {
  report: MockReportData;
}

type Tab = "explanation" | "breakdown" | "journey";

export const ScoreDeepDive = ({ report }: Props) => {
  const [activeTab, setActiveTab] = useState<Tab>("explanation");

  const hasExplanation = !!report.scoreExplanationData;
  const hasJourney = !!report.scoringJourney;
  const hasBreakdown = report.scoreBreakdown && report.scoreBreakdown.length > 0;

  if (!hasExplanation && !hasJourney && !hasBreakdown) return null;

  const tabs: { key: Tab; label: string; available: boolean }[] = [
    { key: "explanation", label: "Why This Score", available: hasExplanation },
    { key: "breakdown", label: "Category Breakdown", available: hasBreakdown },
    { key: "journey", label: "Scoring Journey", available: hasJourney },
  ];

  const availableTabs = tabs.filter(t => t.available);

  return (
    <div className="mb-10">
      {/* Tab bar */}
      {availableTabs.length > 1 && (
        <div className="flex gap-1 mb-4 p-1 bg-secondary/30 rounded-xl w-fit">
          {availableTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                activeTab === tab.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      {activeTab === "explanation" && hasExplanation && (
        <ScoreExplanation data={report.scoreExplanationData!} score={report.overallScore} />
      )}
      {activeTab === "breakdown" && hasBreakdown && (
        <ScoreBreakdown
          breakdown={report.scoreBreakdown}
          total={report.overallScore}
          signalStrength={report.signalStrength}
          explanation={report.scoreExplanation}
          complexityPenalty={report.buildComplexity?.scorePenalty}
        />
      )}
      {activeTab === "journey" && hasJourney && (
        <ScoringJourney journey={report.scoringJourney!} />
      )}
    </div>
  );
};
