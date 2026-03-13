import { Badge } from "@/components/ui/badge";
import { Compass, ArrowRight, AlertTriangle, Zap, DollarSign } from "lucide-react";
import type { FounderDecisionData } from "@/data/mockReport";
import { ConfidenceLabel } from "./ConfidenceLabel";

interface Props {
  data: FounderDecisionData;
}

const decisionConfig: Record<string, { color: string; bgColor: string; borderColor: string; icon: string }> = {
  "Build Now": { color: "text-success", bgColor: "bg-success/10", borderColor: "border-success/20", icon: "🚀" },
  "Build, But Niche Down": { color: "text-warning", bgColor: "bg-warning/10", borderColor: "border-warning/20", icon: "🎯" },
  "Validate Further": { color: "text-primary", bgColor: "bg-primary/10", borderColor: "border-primary/20", icon: "🔍" },
  "Proceed with Caution": { color: "text-warning", bgColor: "bg-warning/10", borderColor: "border-warning/20", icon: "⚠️" },
  "Do Not Build": { color: "text-destructive", bgColor: "bg-destructive/10", borderColor: "border-destructive/20", icon: "🛑" },
};

const RiskBadge = ({ level }: { level: string }) => {
  const lower = level.toLowerCase();
  const variant = lower.includes("low") ? "go" as const : lower.includes("high") ? "nogo" as const : "pivot" as const;
  return <Badge variant={variant} className="text-[13px] px-2.5 py-0.5">{level}</Badge>;
};

export const FounderDecision = ({ data }: Props) => {
  const config = decisionConfig[data.decision] || decisionConfig["Validate Further"];

  return (
    <div className="bg-card border-2 border-primary/20 rounded-2xl p-8 mb-8 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Compass className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">Founder Decision Matrix</h2>
            <p className="text-[13px] text-muted-foreground">Data-driven recommendation for your next move</p>
          </div>
        </div>
        <ConfidenceLabel level={data.confidence || "Medium"} />
      </div>

      {/* Decision Card */}
      <div className={`${config.bgColor} border ${config.borderColor} rounded-xl p-6 mb-6`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{config.icon}</span>
          <h3 className={`font-heading text-lg font-bold ${config.color}`}>{data.decision}</h3>
        </div>
        <p className="text-sm text-foreground leading-relaxed">{data.reasoning}</p>
      </div>

      {/* Why */}
      {data.whyFactors && data.whyFactors.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-heading font-semibold text-foreground mb-3">Why this recommendation:</h4>
          <ul className="space-y-2">
            {data.whyFactors.map((factor, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Next Step */}
      {data.nextStep && (
        <div className="bg-secondary/30 rounded-lg px-4 py-3 mb-6">
          <h4 className="text-[13px] font-heading font-semibold text-muted-foreground uppercase tracking-wide mb-1">Suggested Next Step</h4>
          <p className="text-sm text-foreground">{data.nextStep}</p>
        </div>
      )}

      {/* Risk / Speed / Clarity indicators */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center space-y-1.5">
          <AlertTriangle className="w-4 h-4 text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Risk Level</p>
          <RiskBadge level={data.riskLevel || "Medium"} />
        </div>
        <div className="text-center space-y-1.5">
          <Zap className="w-4 h-4 text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Speed to MVP</p>
          <Badge variant="secondary" className="text-[13px] px-2.5 py-0.5">{data.speedToMvp || "Medium"}</Badge>
        </div>
        <div className="text-center space-y-1.5">
          <DollarSign className="w-4 h-4 text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Commercial Clarity</p>
          <Badge variant="secondary" className="text-[13px] px-2.5 py-0.5">{data.commercialClarity || "Moderate"}</Badge>
        </div>
      </div>
    </div>
  );
};