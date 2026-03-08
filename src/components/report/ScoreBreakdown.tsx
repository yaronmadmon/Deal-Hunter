import { Badge } from "@/components/ui/badge";
import type { ScoreBreakdownItem } from "@/data/mockReport";

interface Props {
  breakdown: ScoreBreakdownItem[];
  total: number;
  verdict: "GO" | "PIVOT" | "NO-GO";
  verdictExplanation: string;
}

export const ScoreBreakdown = ({ breakdown, total, verdict, verdictExplanation }: Props) => {
  const verdictVariant = verdict === "GO" ? "go" as const : verdict === "PIVOT" ? "pivot" as const : "nogo" as const;

  return (
    <div className="bg-card border rounded-2xl p-8">
      <h2 className="font-heading text-xl font-bold text-foreground mb-6">Score Breakdown</h2>

      <div className="space-y-3 mb-8">
        {breakdown.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <div className="flex items-center gap-3">
              <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(item.value / 20) * 100}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-foreground w-8 text-right">{item.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground mb-1">Total Score</div>
          <span className="font-heading text-4xl font-bold text-foreground">{total}</span>
          <span className="text-muted-foreground">/100</span>
        </div>
        <div className="text-right">
          <Badge variant={verdictVariant} className="text-sm px-4 py-1 mb-2">{verdict}</Badge>
          <p className="text-sm text-muted-foreground max-w-md">{verdictExplanation}</p>
        </div>
      </div>
    </div>
  );
};
