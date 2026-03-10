import { Badge } from "@/components/ui/badge";
import { Target, Lightbulb, DollarSign, Crosshair } from "lucide-react";
import type { RecommendedStrategyData } from "@/data/mockReport";
import { ConfidenceLabel } from "./ConfidenceLabel";

interface Props {
  data: RecommendedStrategyData;
}

export const RecommendedStrategy = ({ data }: Props) => {
  return (
    <div className="bg-card border rounded-2xl p-8 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
            <Target className="w-4 h-4 text-success" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">Recommended Strategy</h2>
            <p className="text-xs text-muted-foreground">Actionable advice based on the data above</p>
          </div>
        </div>
        <ConfidenceLabel level={data.confidence || "Medium"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Positioning */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-heading font-semibold text-foreground">Positioning</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{data.positioning || "Data unavailable"}</p>
        </div>

        {/* Pricing */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-success" />
            <h3 className="text-sm font-heading font-semibold text-foreground">Suggested Pricing</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{data.suggestedPricing || "Data unavailable"}</p>
        </div>

        {/* Differentiation */}
        <div className="md:col-span-2 space-y-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-warning" />
            <h3 className="text-sm font-heading font-semibold text-foreground">Differentiation Opportunities</h3>
          </div>
          {data.differentiators && data.differentiators.length > 0 ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.differentiators.map((d, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2 bg-secondary/30 rounded-lg px-3 py-2">
                  <span className="text-primary font-bold mt-0.5">→</span>
                  {d}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">Data unavailable</p>
          )}
        </div>

        {/* Primary Target */}
        {data.primaryTarget && (
          <div className="md:col-span-2 space-y-2">
            <h3 className="text-sm font-heading font-semibold text-foreground">Primary Target Segment</h3>
            <p className="text-sm text-muted-foreground leading-relaxed bg-primary/5 border border-primary/10 rounded-lg px-4 py-3">{data.primaryTarget}</p>
          </div>
        )}

        {/* Go-To-Market Channels */}
        {data.channels && data.channels.length > 0 && (
          <div className="md:col-span-2 space-y-2">
            <h3 className="text-sm font-heading font-semibold text-foreground">Go-to-Market Channels</h3>
            <div className="flex flex-wrap gap-2">
              {data.channels.map((ch, i) => (
                <Badge key={i} variant="secondary" className="text-xs px-3 py-1">{ch}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
