import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

interface ScoringStep {
  label: string;
  value: number;
  description: string;
}

interface Props {
  journey: {
    steps: ScoringStep[];
    finalScore: number;
    complexityPenalty: number;
  };
}

export const ScoringJourney = ({ journey }: Props) => {
  if (!journey?.steps || journey.steps.length === 0) return null;

  const getStepColor = (idx: number, prevValue: number | null, currentValue: number) => {
    if (prevValue === null) return "text-foreground";
    if (currentValue > prevValue) return "text-green-500";
    if (currentValue < prevValue) return "text-destructive";
    return "text-muted-foreground";
  };

  return (
    <div className="bg-card border rounded-2xl p-6 mb-8">
      <h3 className="font-heading text-lg font-bold text-foreground mb-1">Scoring Journey</h3>
      <p className="text-xs text-muted-foreground mb-5">How the final score was constructed step-by-step</p>

      {/* Step flow */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {journey.steps.map((step, i) => {
          const prev = i > 0 ? journey.steps[i - 1].value : null;
          const delta = prev !== null ? step.value - prev : 0;
          const color = getStepColor(i, prev, step.value);

          return (
            <div key={step.label} className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <span className={`font-heading text-2xl font-bold ${color}`}>
                  {step.value}
                </span>
                <span className="text-[10px] text-muted-foreground text-center max-w-[80px] leading-tight">
                  {step.label}
                </span>
                {delta !== 0 && (
                  <Badge
                    variant={delta > 0 ? "go" : "nogo"}
                    className="text-[9px] px-1.5 py-0 mt-0.5"
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </Badge>
                )}
              </div>
              {i < journey.steps.length - 1 && (
                <ArrowRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step details */}
      <div className="space-y-2">
        {journey.steps.map((step, i) => {
          const prev = i > 0 ? journey.steps[i - 1].value : null;
          const delta = prev !== null ? step.value - prev : 0;
          const changed = delta !== 0;

          return (
            <div
              key={step.label}
              className={`flex items-start gap-3 text-sm px-3 py-2 rounded-lg ${
                changed ? "bg-secondary/40" : "bg-secondary/20"
              }`}
            >
              <span className="font-mono text-xs text-muted-foreground w-6 shrink-0 pt-0.5">
                {i + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-foreground">{step.label}</span>
                <span className="text-muted-foreground"> — {step.description}</span>
              </div>
              {changed && (
                <Badge
                  variant={delta > 0 ? "go" : "nogo"}
                  className="text-[10px] shrink-0"
                >
                  {delta > 0 ? `+${delta}` : delta}
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
