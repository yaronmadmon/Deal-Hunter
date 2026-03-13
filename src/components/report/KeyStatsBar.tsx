import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { KeyStat } from "@/data/mockReport";

interface Props {
  stats: KeyStat[];
}

const sentimentConfig = {
  positive: { icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
  negative: { icon: TrendingDown, color: "text-destructive", bg: "bg-destructive/10" },
  neutral: { icon: Minus, color: "text-muted-foreground", bg: "bg-muted" },
};

const statExplanations: Record<string, string> = {
  "Market Signal Score": "Overall market viability based on all signals",
  "Signal Score": "Overall market viability based on all signals",
  "Data Points Analyzed": "Total verified data points collected across sources",
  "Data Points": "Total verified data points collected across sources",
  "Interest Change (90d)": "How search interest has shifted in the last 90 days",
  "Revenue Potential (est.)": "Estimated annual revenue range for this market",
  "Revenue Est.": "Estimated annual revenue range for this market",
  "Competition Count": "Number of existing competitors identified",
  "Competition count": "Number of existing competitors identified",
  "Sources Analyzed": "Number of independent data sources used",
};

export const KeyStatsBar = ({ stats }: Props) => {
  if (!stats || stats.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
      {stats.slice(0, 4).map((stat, i) => {
        const s = stat.sentiment || "neutral";
        const config = sentimentConfig[s];
        const Icon = config.icon;
        const explanation = statExplanations[stat.label] || "";

        return (
          <div
            key={i}
            className="bg-card border rounded-xl p-4 flex flex-col gap-1"
          >
            <div className="flex items-center gap-1.5">
              <span className="font-heading text-2xl font-bold text-foreground">
                {stat.value}
              </span>
              {stat.change && (
                <span className={`text-[13px] font-medium flex items-center gap-0.5 ${config.color}`}>
                  <Icon className="w-3 h-3" />
                  {stat.change}
                </span>
              )}
            </div>
            <span className="text-[13px] text-muted-foreground leading-tight">
              {stat.label}
            </span>
            {explanation && (
              <span className="text-[11px] text-muted-foreground/60 leading-tight">
                {explanation}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};