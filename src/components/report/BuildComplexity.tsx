import { Hammer, Clock, AlertTriangle, Gauge, Code2, Sparkles } from "lucide-react";
import type { BuildComplexityData, BuildEstimate } from "@/data/mockReport";
import { DataSourceBadge } from "./DataSourceBadge";
import { Badge } from "@/components/ui/badge";

interface Props {
  data: BuildComplexityData;
}

const feasibilityConfig: Record<string, { variant: string; description: string }> = {
  "Easy": { variant: "go", description: "Buildable with Lovable or Cursor in weeks" },
  "Moderate": { variant: "pivot", description: "Requires some custom backend work" },
  "Hard": { variant: "nogo", description: "Significant engineering required" },
  "Do Not Attempt": { variant: "nogo", description: "Enterprise-level complexity" },
};

const EstimateColumn = ({ estimate, icon, title }: { estimate: BuildEstimate; icon: React.ReactNode; title: string }) => (
  <div className="bg-secondary/30 rounded-xl p-5 flex flex-col">
    <div className="flex items-center gap-2 mb-4">
      {icon}
      <h4 className="font-semibold text-sm text-foreground">{title}</h4>
    </div>
    <div className="space-y-4 flex-1">
      <div>
        <p className="text-[13px] text-muted-foreground mb-1">Estimated Time</p>
        <p className="text-lg font-bold text-foreground">{estimate.timeRange}</p>
      </div>
      <div>
        <p className="text-[13px] text-muted-foreground mb-1">Estimated Cost</p>
        <p className="text-lg font-bold text-foreground">{estimate.costRange}</p>
      </div>
      <div>
        <p className="text-[13px] text-muted-foreground mb-1">Skills Involved</p>
        <div className="flex flex-wrap gap-1.5">
          {estimate.skillsRequired.map((skill, i) => (
            <span key={i} className="text-xs bg-background border rounded-full px-2.5 py-1 text-muted-foreground">{skill}</span>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const BuildComplexity = ({ data }: Props) => {
  const feasibility = data.vibeCoderFeasibility || "Moderate";
  const config = feasibilityConfig[feasibility] || feasibilityConfig["Moderate"];
  const comparison = data.buildEstimateComparison;

  return (
    <div className="bg-card border rounded-2xl p-8 mb-12">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Hammer className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Build Complexity Estimate</h2>
          <p className="text-[13px] text-muted-foreground italic">How long and how much to ship this?</p>
        </div>
      </div>

      {/* Vibe Coder Feasibility Rating */}
      {data.complexityScore != null && (
        <div className="bg-secondary/30 rounded-xl p-5 mt-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Vibe Coder Feasibility</h3>
          </div>
          <div className="flex items-center gap-4 mb-2">
            <Badge variant={config.variant as any} className="text-sm px-4 py-1">{feasibility}</Badge>
            <span className="text-sm text-muted-foreground">Complexity: {data.complexityScore}/10</span>
            {data.scorePenalty != null && data.scorePenalty !== 0 && (
              <span className="text-sm font-semibold text-destructive">{data.scorePenalty} pts from score</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{config.description}</p>
          {data.complexityFactors && data.complexityFactors.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.complexityFactors.map((f, i) => (
                <span key={i} className="text-xs bg-background border rounded-full px-2.5 py-1 text-muted-foreground">{f}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Build Estimate Comparison */}
      {comparison && (
        <div className="mb-6">
          <h3 className="font-semibold text-sm text-foreground mb-3">Build Estimate Comparison</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EstimateColumn
              estimate={comparison.traditional}
              icon={<Code2 className="w-4 h-4 text-muted-foreground" />}
              title="Traditional Dev Build"
            />
            <EstimateColumn
              estimate={comparison.aiAssisted}
              icon={<Sparkles className="w-4 h-4 text-accent" />}
              title="AI-Assisted Build"
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 italic">Ranges are informational estimates based on typical projects of similar complexity.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="bg-secondary/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm text-foreground">MVP Timeline</h3>
          </div>
          <p className="text-2xl font-bold text-foreground mb-2">{data.mvpTimeline}</p>
          <ul className="space-y-1.5">
            {data.mvpScope.map((s, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-accent mt-0.5 text-[13px]">●</span> {s}
              </li>
            ))}
          </ul>
        </div>

        {/* Tech Challenges */}
        <div className="bg-secondary/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h3 className="font-semibold text-sm text-foreground">Technical Challenges</h3>
          </div>
          <ul className="space-y-2">
            {data.techChallenges.map((c, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-destructive mt-0.5 text-[13px]">⚠</span> {c}
              </li>
            ))}
          </ul>
        </div>

        {/* Costs */}
        <div className="bg-secondary/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Hammer className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm text-foreground">Cost Estimates</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[13px] text-muted-foreground">Estimated MVP Cost</p>
              <p className="text-lg font-bold text-foreground">{data.estimatedCost}</p>
            </div>
            <div>
              <p className="text-[13px] text-muted-foreground">Voice API Costs</p>
              <p className="text-sm text-foreground">{data.voiceApiCosts}</p>
            </div>
            <div>
              <p className="text-[13px] text-muted-foreground">On-Device Processing</p>
              <p className="text-sm text-muted-foreground">{data.onDeviceNote}</p>
            </div>
          </div>
        </div>
      </div>

      {data.dataSource && (
        <div className="mt-4">
          <DataSourceBadge dataSource={data.dataSource} sourceUrls={data.sourceUrls} />
        </div>
      )}
    </div>
  );
};