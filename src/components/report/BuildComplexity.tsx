import { Hammer, Clock, AlertTriangle } from "lucide-react";
import type { BuildComplexityData } from "@/data/mockReport";
import { DataSourceBadge } from "./DataSourceBadge";

interface Props {
  data: BuildComplexityData;
}

export const BuildComplexity = ({ data }: Props) => {
  return (
    <div className="bg-card border rounded-2xl p-8 mb-12">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Hammer className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Build Complexity Estimate</h2>
          <p className="text-xs text-muted-foreground italic">How long and how much to ship this?</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
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
                <span className="text-accent mt-0.5 text-xs">●</span> {s}
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
                <span className="text-destructive mt-0.5 text-xs">⚠</span> {c}
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
              <p className="text-xs text-muted-foreground">Estimated MVP Cost</p>
              <p className="text-lg font-bold text-foreground">{data.estimatedCost}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Voice API Costs</p>
              <p className="text-sm text-foreground">{data.voiceApiCosts}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">On-Device Processing</p>
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
