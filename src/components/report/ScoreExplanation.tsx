import { Card } from "@/components/ui/card";
import { ConfidenceLabel } from "./ConfidenceLabel";
import { Lightbulb } from "lucide-react";
import type { ScoreExplanationData } from "@/data/mockReport";

interface Props {
  data: ScoreExplanationData;
  score: number;
}

const categoryIcon = (label: string) => {
  const colors = [
    "bg-primary/15 text-primary",
    "bg-accent/15 text-accent",
    "bg-destructive/15 text-destructive",
    "bg-teal/15 text-teal",
    "bg-success/15 text-success",
  ];
  const index = ["demand", "competition", "sentiment", "growth", "opportunity"].findIndex(
    k => label.toLowerCase().includes(k)
  );
  return colors[index >= 0 ? index : 0];
};

export const ScoreExplanation = ({ data, score }: Props) => {
  return (
    <div className="bg-card border rounded-2xl p-8 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" />
          <h2 className="font-heading text-xl font-bold text-foreground">Why This Score: {score}/100</h2>
        </div>
        <ConfidenceLabel level={data.confidence || "Medium"} />
      </div>

      {data.summary && (
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{data.summary}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.factors.map((factor, i) => (
          <div key={i} className={`rounded-xl p-4 border bg-secondary/20`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${
                ["bg-primary", "bg-accent", "bg-destructive", "bg-teal", "bg-success"][i % 5]
              }`} />
              <h3 className="text-sm font-semibold text-foreground">{factor.category}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{factor.explanation}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
