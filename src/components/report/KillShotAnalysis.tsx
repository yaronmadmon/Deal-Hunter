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

/* ── SVG Risk Gauge ── */
const GAUGE_COLORS = {
  Low: { stroke: "hsl(var(--success))", trail: "hsl(var(--success) / 0.15)" },
  Medium: { stroke: "hsl(var(--warning))", trail: "hsl(var(--warning) / 0.15)" },
  High: { stroke: "hsl(var(--destructive))", trail: "hsl(var(--destructive) / 0.15)" },
};

function RiskGauge({ level }: { level: "Low" | "Medium" | "High" }) {
  const pct = level === "Low" ? 25 : level === "Medium" ? 55 : 85;
  const colors = GAUGE_COLORS[level] || GAUGE_COLORS.Medium;

  // Semi-circle arc (180°) — radius 60, stroke 10
  const R = 60;
  const CX = 70;
  const CY = 68;
  const circumHalf = Math.PI * R; // half-circle length
  const dashLen = (pct / 100) * circumHalf;

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="82" viewBox="0 0 140 82" className="overflow-visible">
        {/* Trail */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke={colors.trail}
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Active arc */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke={colors.stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dashLen} ${circumHalf}`}
          className="transition-all duration-700"
        />
        {/* Needle dot */}
        {(() => {
          const angle = Math.PI - (pct / 100) * Math.PI;
          const nx = CX + R * Math.cos(angle);
          const ny = CY - R * Math.sin(angle);
          return <circle cx={nx} cy={ny} r="5" fill={colors.stroke} className="drop-shadow-sm" />;
        })()}
        {/* Center label */}
        <text x={CX} y={CY - 12} textAnchor="middle" className="fill-foreground font-heading text-xl font-bold" fontSize="22">
          {pct}%
        </text>
        <text x={CX} y={CY + 2} textAnchor="middle" className="fill-muted-foreground text-xs" fontSize="11">
          risk
        </text>
      </svg>
      {/* Scale labels */}
      <div className="flex justify-between w-full px-1 -mt-1">
        <span className="text-[11px] text-success font-medium">Low</span>
        <span className="text-[11px] text-warning font-medium">Med</span>
        <span className="text-[11px] text-destructive font-medium">High</span>
      </div>
    </div>
  );
}

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

      {/* Gauge + risks side by side */}
      <div className="flex flex-col md:flex-row gap-6 mb-6">
        {/* Gauge */}
        <div className="flex items-center justify-center md:w-44 shrink-0">
          <RiskGauge level={(data.riskLevel as "Low" | "Medium" | "High") || "Medium"} />
        </div>

        {/* Risk items */}
        <div className="flex-1 space-y-3">
          {data.risks.map((risk, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{risk.risk}</p>
                {risk.severity && (
                  <Badge variant="outline" className={`mt-1 text-xs ${
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
      </div>

      {/* Overall risk level */}
      <div className={`rounded-xl border p-5 ${riskBg(data.riskLevel)}`}>
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className={`w-4 h-4 ${riskColor(data.riskLevel)}`} />
          <span className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Overall Risk Level</span>
        </div>
        <p className={`text-lg font-bold ${riskColor(data.riskLevel)}`}>{data.riskLevel}</p>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{data.interpretation}</p>
      </div>
    </div>
  );
};