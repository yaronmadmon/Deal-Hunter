import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfidenceLabel } from "./ConfidenceLabel";
import { AlertTriangle, ShieldAlert, TrendingDown } from "lucide-react";
import type { KillShotAnalysisData } from "@/data/mockReport";

interface Props {
  data: KillShotAnalysisData;
}

const riskColor = (level: string) => {
  switch (level) {
    case "Low": return "text-success";
    case "Medium": return "text-warning";
    case "High": return "text-destructive";
    default: return "text-muted-foreground";
  }
};

const riskBg = (level: string) => {
  switch (level) {
    case "Low": return "bg-success/10 border-success/20";
    case "Medium": return "bg-warning/10 border-warning/20";
    case "High": return "bg-destructive/10 border-destructive/20";
    default: return "bg-muted/10 border-muted/20";
  }
};

export const KillShotAnalysis = ({ data }: Props) => {
  return (
    <div className="bg-card border rounded-2xl p-8 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-destructive" />
          <h2 className="font-heading text-xl font-bold text-foreground">Kill Shot Analysis</h2>
        </div>
        <ConfidenceLabel level={data.confidence || "Medium"} />
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Critical risks that could prevent this idea from succeeding. Address these before committing resources.
      </p>

      {/* Risk items */}
      <div className="space-y-3 mb-6">
        {data.risks.map((risk, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
            <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{risk.risk}</p>
              {risk.severity && (
                <Badge variant="outline" className={`mt-1 text-[10px] ${
                  risk.severity === "High" ? "border-destructive/30 text-destructive" :
                  risk.severity === "Medium" ? "border-warning/30 text-warning" :
                  "border-muted-foreground/30 text-muted-foreground"
                }`}>
                  {risk.severity} severity
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Overall risk level */}
      <div className={`rounded-xl border p-5 ${riskBg(data.riskLevel)}`}>
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className={`w-4 h-4 ${riskColor(data.riskLevel)}`} />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overall Risk Level</span>
        </div>
        <p className={`text-lg font-bold ${riskColor(data.riskLevel)}`}>{data.riskLevel}</p>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{data.interpretation}</p>
      </div>
    </div>
  );
};
