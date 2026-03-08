import type { ScoreBreakdownItem } from "@/data/mockReport";
import { Badge } from "@/components/ui/badge";

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

export const ScoreBreakdown = ({ breakdown, total, signalStrength, explanation }: Props) => {
  const strengthVariant = signalStrength === "Strong" ? "go" as const : signalStrength === "Moderate" ? "pivot" as const : "nogo" as const;

  return (
    <div className="bg-card border rounded-2xl p-8">
      <h2 className="font-heading text-xl font-bold text-foreground mb-6">Score Breakdown</h2>

      <div className="space-y-4 mb-8">
        {breakdown.map((item, i) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className="text-sm font-semibold text-foreground">{item.value}<span className="text-muted-foreground font-normal">/20</span></span>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${colorForIndex(i)}`}
                style={{ width: `${(item.value / 20) * 100}%` }}
              />
            </div>
          </div>
        ))}
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
