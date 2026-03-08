import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, PieChart, Users, MessageCircle, Zap } from "lucide-react";
import {
  AreaChart, Area, PieChart as RePieChart, Pie, Cell,
  LineChart, Line, BarChart, Bar,
  ResponsiveContainer, Tooltip, XAxis,
} from "recharts";
import type { SignalCardData } from "@/data/mockReport";

interface SignalCardProps {
  card: SignalCardData;
}

const iconMap: Record<string, React.ElementType> = {
  TrendingUp, PieChart, Users, MessageCircle, Zap,
};

const confidenceBadge = (c: string) => {
  if (c === "High") return "go" as const;
  if (c === "Medium") return "pivot" as const;
  return "nogo" as const;
};

export const SignalCard = ({ card }: SignalCardProps) => {
  const IconComp = iconMap[card.icon] || TrendingUp;

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <IconComp className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-heading">{card.title}</CardTitle>
              <span className="text-[11px] text-muted-foreground">{card.source}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Badge variant={confidenceBadge(card.confidence)} className="text-[10px] px-2 py-0.5">
            {card.confidence}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {card.evidenceCount} signals analyzed
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 pt-0">
        {/* Sparkline for Trend */}
        {card.sparkline && (
          <div className="h-16 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={card.sparkline}>
                <defs>
                  <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(239 84% 67%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(239 84% 67%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="hsl(239 84% 67%)" fill="url(#sparkGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Donut for Saturation */}
        {card.donut && (
          <div className="h-20 flex items-center justify-center">
            <ResponsiveContainer width={80} height={80}>
              <RePieChart>
                <Pie data={card.donut} dataKey="value" innerRadius={22} outerRadius={35} paddingAngle={3} strokeWidth={0}>
                  <Cell fill="hsl(239 84% 67%)" />
                  <Cell fill="hsl(220 14% 90%)" />
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
            <div className="text-xs text-muted-foreground ml-2 space-y-1">
              {card.donut.map(s => (
                <div key={s.name} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${s.name === "Top 5" ? "bg-primary" : "bg-muted"}`} />
                  {s.name}: {s.value}%
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Line chart for Growth */}
        {card.lineChart && (
          <div className="h-16 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={card.lineChart}>
                <Line type="monotone" dataKey="value" stroke="hsl(174 58% 40%)" strokeWidth={2} dot={false} />
                <XAxis dataKey="name" hide />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Metrics */}
        {card.type === "metrics" && card.metrics && (
          <div className="space-y-2">
            {card.metrics.map((m) => (
              <div key={m.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{m.label}</span>
                <span className="font-medium text-foreground text-right max-w-[55%]">{m.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Competitors */}
        {card.type === "competitors" && card.competitors && (
          <div className="space-y-2.5">
            {card.competitors.map((c) => (
              <div key={c.name} className="border rounded-lg p-3 space-y-1.5 bg-secondary/30">
                <div className="font-medium text-sm text-foreground">{c.name}</div>
                <div className="grid grid-cols-3 gap-1 text-[11px] text-muted-foreground">
                  <span>{c.rating}</span>
                  <span>{c.reviews} reviews</span>
                  <span>{c.downloads} dl</span>
                </div>
                <div className="text-[11px] text-destructive/80">⚠ {c.weakness}</div>
              </div>
            ))}
          </div>
        )}

        {/* Sentiment with bar chart */}
        {card.type === "sentiment" && card.sentiment && (
          <div className="space-y-3">
            <div className="h-10">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={[
                  { name: "Complaints", value: card.sentiment.complaintCount },
                  { name: "Positive", value: card.sentiment.positiveCount },
                ]}>
                  <XAxis type="number" hide />
                  <Bar dataKey="value" radius={4} barSize={12}>
                    <Cell fill="hsl(0 72% 51%)" />
                    <Cell fill="hsl(142 71% 45%)" />
                  </Bar>
                  <Tooltip />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Top Complaints</div>
              <ul className="space-y-1">
                {card.sentiment.complaints.map((c) => (
                  <li key={c} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-destructive mt-0.5 text-xs">●</span> {c}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">What Users Love</div>
              <ul className="space-y-1">
                {card.sentiment.loves.map((l) => (
                  <li key={l} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-success mt-0.5 text-xs">●</span> {l}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Dominant Emotion</span>
              <span className="font-medium text-foreground">{card.sentiment.emotion}</span>
            </div>
          </div>
        )}

        {/* Evidence quote box */}
        <div className="bg-secondary/50 border border-border/50 rounded-lg p-3 space-y-2">
          {card.evidence.map((e, i) => (
            <p key={i} className="text-[11px] text-muted-foreground italic leading-relaxed">
              {e}
            </p>
          ))}
        </div>

        {/* Insight footer */}
        <p className="text-sm font-medium text-foreground mt-auto pt-3 border-t border-border/50">
          {card.insight}
        </p>
      </CardContent>
    </Card>
  );
};
