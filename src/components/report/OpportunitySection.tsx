import type { OpportunityData } from "@/data/mockReport";
import { Lightbulb, Users, Target } from "lucide-react";

interface Props {
  opportunity: OpportunityData;
}

export const OpportunitySection = ({ opportunity }: Props) => {
  return (
    <div className="bg-primary/5 border border-primary/10 rounded-2xl p-8 mb-12">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Lightbulb className="w-4 h-4 text-primary" />
        </div>
        <h2 className="font-heading text-xl font-bold text-foreground">Opportunity Gap</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm text-foreground">Feature Gaps</h3>
          </div>
          <ul className="space-y-1.5">
            {opportunity.featureGaps.map((g) => (
              <li key={g} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-accent mt-0.5 text-xs">●</span> {g}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm text-foreground">Underserved Users</h3>
          </div>
          <ul className="space-y-1.5">
            {opportunity.underservedUsers.map((u) => (
              <li key={u} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-accent mt-0.5 text-xs">●</span> {u}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm text-foreground">Recommended Positioning</h3>
          </div>
          <p className="text-sm text-muted-foreground">{opportunity.positioning}</p>
        </div>
      </div>
    </div>
  );
};
