import type { OpportunityData } from "@/data/mockReport";
import { Lightbulb, Users, Target } from "lucide-react";

interface Props {
  opportunity: OpportunityData;
}

export const OpportunitySection = ({ opportunity }: Props) => {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 mb-10">
      <h2 className="font-heading text-xl font-bold text-foreground mb-6">Opportunity Gap</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Feature Gaps</h3>
          </div>
          <ul className="space-y-1.5">
            {opportunity.featureGaps.map((g) => (
              <li key={g} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-primary mt-1">•</span> {g}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Underserved Users</h3>
          </div>
          <ul className="space-y-1.5">
            {opportunity.underservedUsers.map((u) => (
              <li key={u} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-primary mt-1">•</span> {u}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Recommended Positioning</h3>
          </div>
          <p className="text-sm text-muted-foreground">{opportunity.positioning}</p>
        </div>
      </div>
    </div>
  );
};
