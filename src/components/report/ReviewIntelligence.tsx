import { Shield, Target, Crosshair } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfidenceLabel } from "./ConfidenceLabel";
import type { ReviewIntelligenceData } from "@/data/mockReport";

interface Props {
  data: ReviewIntelligenceData;
}

const opportunityColor = (level: string) => {
  if (level === "High Opportunity") return "go";
  if (level === "Moderate Opportunity") return "pivot";
  return "nogo";
};

const severityColor = (level: string) => {
  if (level === "High") return "text-destructive";
  if (level === "Medium") return "text-accent";
  return "text-muted-foreground";
};

const quadrantColors: Record<string, string> = {
  "Critical Pain": "hsl(var(--destructive))",
  "Minor Annoyance": "hsl(var(--accent))",
  "Loved Feature": "hsl(var(--success))",
  "Hidden Gem": "hsl(var(--primary))",
};

const ReviewMatrix = ({ data }: { data: ReviewIntelligenceData["matrixData"] }) => {
  const width = 400;
  const height = 400;
  const padding = 50;
  const plotW = width - padding * 2;
  const plotH = height - padding * 2;

  return (
    <div className="flex justify-center my-6">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[400px]" role="img" aria-label="Review Intelligence 2x2 Matrix">
        {/* Background quadrants */}
        <rect x={padding} y={padding} width={plotW / 2} height={plotH / 2} fill="hsl(var(--destructive) / 0.08)" />
        <rect x={padding + plotW / 2} y={padding} width={plotW / 2} height={plotH / 2} fill="hsl(var(--destructive) / 0.15)" />
        <rect x={padding} y={padding + plotH / 2} width={plotW / 2} height={plotH / 2} fill="hsl(var(--success) / 0.08)" />
        <rect x={padding + plotW / 2} y={padding + plotH / 2} width={plotW / 2} height={plotH / 2} fill="hsl(var(--primary) / 0.08)" />

        {/* Quadrant labels */}
        <text x={padding + plotW * 0.25} y={padding + 18} textAnchor="middle" className="fill-muted-foreground text-[11px] font-semibold">Hidden Gem</text>
        <text x={padding + plotW * 0.75} y={padding + 18} textAnchor="middle" className="fill-destructive text-[11px] font-semibold">Critical Pain</text>
        <text x={padding + plotW * 0.25} y={padding + plotH - 8} textAnchor="middle" className="fill-success text-[11px] font-semibold">Loved Feature</text>
        <text x={padding + plotW * 0.75} y={padding + plotH - 8} textAnchor="middle" className="fill-muted-foreground text-[11px] font-semibold">Minor Annoyance</text>

        {/* Axes */}
        <line x1={padding} y1={padding + plotH} x2={padding + plotW} y2={padding + plotH} stroke="hsl(var(--border))" strokeWidth={1} />
        <line x1={padding} y1={padding} x2={padding} y2={padding + plotH} stroke="hsl(var(--border))" strokeWidth={1} />

        {/* Axis labels */}
        <text x={padding + plotW / 2} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">Frequency →</text>
        <text x={12} y={padding + plotH / 2} textAnchor="middle" className="fill-muted-foreground text-[11px]" transform={`rotate(-90, 12, ${padding + plotH / 2})`}>Intensity →</text>

        {/* Midlines */}
        <line x1={padding + plotW / 2} y1={padding} x2={padding + plotW / 2} y2={padding + plotH} stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="4 4" />
        <line x1={padding} y1={padding + plotH / 2} x2={padding + plotW} y2={padding + plotH / 2} stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="4 4" />

        {/* Data points */}
        {data.map((d, i) => {
          const x = padding + (d.frequency / 100) * plotW;
          const y = padding + plotH - (d.intensity / 100) * plotH;
          const color = quadrantColors[d.quadrant] || "hsl(var(--muted-foreground))";
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={8} fill={color} fillOpacity={0.7} stroke={color} strokeWidth={1.5} />
              <text x={x} y={y - 12} textAnchor="middle" className="fill-foreground text-[8px] font-medium">
                {d.theme.length > 20 ? d.theme.slice(0, 18) + "…" : d.theme}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const ReviewIntelligence = ({ data }: Props) => {
  return (
    <div className="bg-card border rounded-2xl p-8 mb-12">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">Review Intelligence</h2>
            <p className="text-[13px] text-muted-foreground italic">Competitor complaints clustered into exploitable gaps</p>
          </div>
        </div>
        <ConfidenceLabel level={data.confidence || "Medium"} />
      </div>

      <p className="text-sm text-muted-foreground mt-2 mb-6">
        Based on <span className="font-semibold text-foreground">{data.totalReviewsAnalyzed}</span> reviews analyzed across competitor apps.
      </p>

      {/* Complaint Clusters */}
      <div className="space-y-4 mb-8">
        {data.complaintClusters.map((cluster, i) => (
          <div key={i} className="bg-secondary/30 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${severityColor(cluster.severity)}`}>●</span>
                <h3 className="font-semibold text-sm text-foreground">{cluster.theme}</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{cluster.frequency} mentions</span>
                <Badge variant={opportunityColor(cluster.opportunityLevel) as any} className="text-xs">
                  {cluster.opportunityLevel}
                </Badge>
              </div>
            </div>
            <ul className="space-y-1 mb-2">
              {cluster.complaints.slice(0, 3).map((c, j) => (
                <li key={j} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-accent mt-0.5 text-[13px]">●</span> {c}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground italic">{cluster.exploitableGap}</p>
          </div>
        ))}
      </div>

      {/* 2x2 Matrix */}
      {data.matrixData && data.matrixData.length > 0 && (
        <div className="mb-8">
          <h3 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" /> Complaint vs. Praise Matrix
          </h3>
          <ReviewMatrix data={data.matrixData} />
        </div>
      )}

      {/* Top Attack Angles */}
      {data.topAttackAngles && data.topAttackAngles.length > 0 && (
        <div className="mb-8">
          <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-destructive" /> Top Attack Angles
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.topAttackAngles.map((angle, i) => (
              <div key={i} className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                <p className="text-sm font-semibold text-foreground mb-1">#{i + 1}: {angle.angle}</p>
                <p className="text-xs text-muted-foreground mb-1">Exploits: {angle.complaint}</p>
                <p className="text-xs text-destructive">Weak: {angle.competitorWeakness}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Differentiation Statements */}
      {data.differentiationStatements && data.differentiationStatements.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm text-foreground mb-3">Positioning Statements</h3>
          <div className="space-y-2">
            {data.differentiationStatements.map((stmt, i) => (
              <div key={i} className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
                <span className="text-primary font-bold text-sm mt-0.5">{i + 1}.</span>
                <p className="text-sm text-foreground">{stmt}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
