import type { ScoreBreakdownItem } from "@/data/mockReport";
import { Badge } from "@/components/ui/badge";
import { ConfidenceLabel } from "./ConfidenceLabel";

interface Props {
  breakdown: ScoreBreakdownItem[];
  total: number;
  signalStrength: "Strong" | "Moderate" | "Weak";
  explanation: string;
}

const colorForIndex = (i: number) => {
  const colors = [
    "bg-primary",
    "bg-accent",
    "bg-destructive",
    "bg-teal",
    "bg-success",
  ];
  return colors[i % colors.length];
};

const defaultWeights = ["25%", "20%", "20%", "15%", "20%"];
const defaultMaxScores = [25, 20, 20, 15, 20];

export const ScoreBreakdown = ({ breakdown, total, signalStrength, explanation }: Props) => {
  const strengthVariant = signalStrength === "Strong" ? "go" as const : signalStrength === "Moderate" ? "pivot" as const : "nogo" as const;

  return (
    <div className="bg-card border rounded-2xl p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl font-bold text-foreground">Score Breakdown</h2>
        <ConfidenceLabel level="High" />
      </div>

      {/* Weight explanation */}
      <div className="bg-secondary/30 rounded-lg px-4 py-3 mb-6">
        <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">How the Score is Calculated</p>
        <div className="flex flex-wrap gap-3">
          {breakdown.map((item, i) => (
            <div key={item.label} className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${colorForIndex(i)}`} />
              {item.label}: <span className="font-semibold text-foreground">{item.weight || defaultWeights[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 mb-8">
        {breakdown.map((item, i) => {
          const maxScore = defaultMaxScores[i] || 20;
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-sm font-semibold text-foreground">{item.value}<span className="text-muted-foreground font-normal">/{maxScore}</span></span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${colorForIndex(i)}`}
                  style={{ width: `${(item.value / maxScore) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground mb-1">Market Signal Score</div>
          <span className="font-heading text-4xl font-bold text-foreground">{total}</span>
          <span className="text-muted-foreground">/100</span>
        </div>
        <div className="text-right">
          <Badge variant={strengthVariant} className="text-sm px-4 py-1 mb-2">{signalStrength}</Badge>
          <p className="text-sm text-muted-foreground max-w-md">{explanation}</p>
        </div>
      </div>
    </div>
  );
};